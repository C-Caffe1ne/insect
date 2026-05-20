import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search';
const KEY_SOURCE = path.join(__dirname, 'nibr_search.mjs');
const MAP_FILE = path.join(__dirname, 'ktsn_taxonomy_map.json');
const TAXONOMY_DIR = path.join(ROOT, 'project', 'taxonomy');
const TAXONOMY_INDEX = path.join(TAXONOMY_DIR, 'index.json');
const ORDERS_DIR = path.join(TAXONOMY_DIR, 'orders');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readApiKey() {
  const script = fs.readFileSync(KEY_SOURCE, 'utf8');
  const match = script.match(/API_KEY\s*=\s*'([^']+)'/);
  if (!match) throw new Error(`API key not found in ${KEY_SOURCE}`);
  return match[1];
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function sortObjectByKey(map) {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function buildUrl(apiKey, page) {
  const url = new URL(BASE_URL);
  url.searchParams.set('oapiAcsUnqNo', apiKey);
  url.searchParams.set('page', String(page));
  url.searchParams.set('responseType', 'json');
  url.searchParams.set('schTxgrpGroupCd', 'IN');
  return url;
}

async function fetchPage(apiKey, page, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(buildUrl(apiKey, page), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(350 * attempt);
    }
  }
}

function ingestItem(item, orders, families) {
  const orderScientificName = item.orderKtsnLtnNm || '';
  const familyScientificName = item.fmlyKtsnLtnNm || '';
  const orderKey = normalize(orderScientificName);
  const familyKey = `${orderKey}::${normalize(familyScientificName)}`;

  if (orderKey && item.orderKtsn) {
    const existing = orders.get(orderKey) || {};
    orders.set(orderKey, {
      orderKtsn: item.orderKtsn,
      scientificName: orderScientificName,
      commonName: item.orderKtsnKrnNm || existing.commonName || '',
    });
  }

  if (orderKey && familyScientificName && item.fmlyKtsn) {
    const existing = families.get(familyKey) || {};
    families.set(familyKey, {
      familyKtsn: item.fmlyKtsn,
      scientificName: familyScientificName,
      commonName: item.fmlyKtsnKrnNm || existing.commonName || '',
      orderScientificName,
      orderKtsn: item.orderKtsn || existing.orderKtsn || null,
    });
  }
}

async function fetchTaxonomyMap() {
  const apiKey = readApiKey();
  const first = await fetchPage(apiKey, 1);
  const pageInfo = first?.data?.pageInfo;
  const totalPages = Number(pageInfo?.totalPages || 0);
  const totalElements = Number(pageInfo?.totalElements || 0);
  if (!totalPages) throw new Error('Unable to read API pageInfo.totalPages');

  const orders = new Map();
  const families = new Map();
  for (const item of first?.data?.content || []) ingestItem(item, orders, families);

  const concurrency = 20;
  let completed = 1;
  let pages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
  const failedPages = [];

  for (let cursor = 0; cursor < pages.length; cursor += concurrency) {
    const batch = pages.slice(cursor, cursor + concurrency);
    const results = await Promise.allSettled(batch.map((page) => fetchPage(apiKey, page)));

    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      completed += 1;
      if (result.status !== 'fulfilled') {
        failedPages.push(batch[index]);
        continue;
      }
      for (const item of result.value?.data?.content || []) ingestItem(item, orders, families);
    }

    process.stdout.write(
      `\rAPI scan ${completed}/${totalPages} pages · orders ${orders.size} · families ${families.size}`
    );
    await sleep(120);
  }

  for (let pass = 1; failedPages.length && pass <= 5; pass += 1) {
    pages = failedPages.splice(0);
    console.log(`\nRetrying ${pages.length} failed pages, pass ${pass}...`);
    for (let cursor = 0; cursor < pages.length; cursor += 5) {
      const batch = pages.slice(cursor, cursor + 5);
      const results = await Promise.allSettled(batch.map((page) => fetchPage(apiKey, page, 6)));
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        if (result.status !== 'fulfilled') {
          failedPages.push(batch[index]);
          continue;
        }
        for (const item of result.value?.data?.content || []) ingestItem(item, orders, families);
      }
      process.stdout.write(
        `\rRetry pass ${pass}: ${Math.min(cursor + batch.length, pages.length)}/${pages.length} · remaining ${failedPages.length}`
      );
      await sleep(250);
    }
  }

  console.log('');
  return {
    fetchedAt: new Date().toISOString(),
    source: '국립생물자원관 KTSN API /gwsvc/openapi/rest/ktsn/taxons/search?schTxgrpGroupCd=IN',
    totalElements,
    totalPages,
    failedPages,
    totalOrders: orders.size,
    totalFamilies: families.size,
    orders: sortObjectByKey(orders),
    families: sortObjectByKey(families),
  };
}

function updateTaxonomyFiles(mapPayload) {
  const indexPayload = JSON.parse(fs.readFileSync(TAXONOMY_INDEX, 'utf8'));
  const missingOrders = [];
  const missingFamilies = [];

  indexPayload.ktsnUpdatedAt = mapPayload.fetchedAt;
  indexPayload.orders = indexPayload.orders.map((order) => {
    const match = mapPayload.orders[normalize(order.scientificName)];
    if (!match) missingOrders.push(order.scientificName);
    return {
      ...order,
      orderKtsn: match?.orderKtsn ?? order.orderKtsn ?? null,
    };
  });
  fs.writeFileSync(TAXONOMY_INDEX, `${JSON.stringify(indexPayload, null, 2)}\n`, 'utf8');

  for (const fileName of fs.readdirSync(ORDERS_DIR)) {
    if (!fileName.endsWith('.json')) continue;
    const filePath = path.join(ORDERS_DIR, fileName);
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const orderKey = normalize(payload.scientificName);
    const orderMatch = mapPayload.orders[orderKey];

    if (!orderMatch) missingOrders.push(payload.scientificName);

    payload.ktsnUpdatedAt = mapPayload.fetchedAt;
    payload.orderKtsn = orderMatch?.orderKtsn ?? payload.orderKtsn ?? null;
    payload.families = (payload.families || []).map((family) => {
      const familyKey = `${orderKey}::${normalize(family.scientificName)}`;
      const match = mapPayload.families[familyKey];
      if (!match) missingFamilies.push(`${payload.scientificName}::${family.scientificName}`);
      return {
        ...family,
        familyKtsn: match?.familyKtsn ?? family.familyKtsn ?? null,
      };
    });

    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  return {
    missingOrders: [...new Set(missingOrders)],
    missingFamilies: [...new Set(missingFamilies)],
  };
}

async function main() {
  console.log('Fetching KTSN map from NIBR API...');
  const mapPayload = await fetchTaxonomyMap();
  fs.writeFileSync(MAP_FILE, `${JSON.stringify(mapPayload, null, 2)}\n`, 'utf8');
  const result = updateTaxonomyFiles(mapPayload);

  console.log(`Saved ${path.relative(ROOT, MAP_FILE)}`);
  console.log(`Updated ${path.relative(ROOT, TAXONOMY_INDEX)} and order files`);
  console.log(`Orders: ${mapPayload.totalOrders}, families: ${mapPayload.totalFamilies}`);
  console.log(`Missing orders in taxonomy: ${result.missingOrders.length}`);
  console.log(`Missing families in taxonomy: ${result.missingFamilies.length}`);
  if (result.missingFamilies.length) {
    console.log(result.missingFamilies.slice(0, 20).join('\n'));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
