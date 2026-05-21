import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search';
const KEY_SOURCE = path.join(__dirname, 'nibr_search.mjs');
const TAXONOMY_DIR = path.join(ROOT, 'project', 'taxonomy');
const TAXONOMY_INDEX = path.join(TAXONOMY_DIR, 'index.json');
const ORDERS_DIR = path.join(TAXONOMY_DIR, 'orders');
const FAMILIES_DIR = path.join(TAXONOMY_DIR, 'families');
const CACHE_FILE = path.join(__dirname, 'korea_insect_all_species_by_family.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readApiKey() {
  const script = fs.readFileSync(KEY_SOURCE, 'utf8');
  const match = script.match(/API_KEY\s*=\s*'([^']+)'/);
  if (!match) throw new Error(`API key not found in ${KEY_SOURCE}`);
  return match[1];
}

function slug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function buildUrl(apiKey, page) {
  const url = new URL(BASE_URL);
  url.searchParams.set('oapiAcsUnqNo', apiKey);
  url.searchParams.set('page', String(page));
  url.searchParams.set('responseType', 'json');
  url.searchParams.set('schTxgrpGroupCd', 'IN');
  return url;
}

async function fetchPage(apiKey, page, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(buildUrl(apiKey, page), { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(400 * attempt);
    }
  }
}

function rank(scientificName, commonName, ktsn) {
  return {
    scientificName: scientificName || '',
    commonName: commonName || '',
    ktsn: ktsn || null,
  };
}

function extractInsect(item) {
  return {
    ktsn: item.ktsn || null,
    scientificName: item.stnm || '',
    commonName: item.ktsnKrnNm || '',
    terminalLatinName: item.ktsnLtnNm || '',
    nomenclaturalAuthor: item.nmcltrNm || '',
    namingYear: item.nmngYr || '',
    corsynSeYn: item.corsynSeYn || '',
    egspcsYn: item.egspcsYn || '',
    hrmflSpecsYn: item.hrmflSpecsYn || '',
    dispYn: item.dispYn || '',
    phspYn: item.phspYn || '',
    korUnqBispYn: item.korUnqBispYn || '',
    ntmYn: item.ntmYn || '',
    taxonomy: {
      phylum: rank(item.phlmKtsnLtnNm, item.phlmKtsnKrnNm, item.phlmKtsn),
      class: rank(item.classKtsnLtnNm, item.classKtsnKrnNm, item.classKtsn),
      order: rank(item.orderKtsnLtnNm, item.orderKtsnKrnNm, item.orderKtsn),
      family: rank(item.fmlyKtsnLtnNm, item.fmlyKtsnKrnNm, item.fmlyKtsn),
      genus: rank(item.gnusKtsnLtnNm, item.gnusKtsnKrnNm, item.gnusKtsn),
      subgenus: rank(item.sbguKtsnLtnNm, item.sbguKtsnKrnNm, item.sbguKtsn),
      species: rank(item.specsKtsnLtnNm, item.specsKtsnKrnNm, item.specsKtsn),
    },
  };
}

function loadTaxonomy() {
  const index = JSON.parse(fs.readFileSync(TAXONOMY_INDEX, 'utf8'));
  const orders = new Map();
  const families = new Map();

  for (const orderSummary of index.orders) {
    const filePath = path.join(TAXONOMY_DIR, orderSummary.file);
    const orderPayload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const orderKey = normalize(orderPayload.scientificName);
    orders.set(orderKey, { summary: orderSummary, payload: orderPayload, filePath });

    for (const family of orderPayload.families || []) {
      families.set(`${orderKey}::${normalize(family.scientificName)}`, {
        order: orderPayload,
        family,
      });
    }
  }

  return { index, orders, families };
}

function addBucket(buckets, key, meta, insect) {
  if (!buckets.has(key)) {
    buckets.set(key, {
      key,
      ...meta,
      insects: [],
    });
  }
  buckets.get(key).insects.push(insect);
}

function ingestItem(item, taxonomy, buckets, unknownFamilies, unclassified) {
  const orderScientificName = item.orderKtsnLtnNm || '';
  const familyScientificName = item.fmlyKtsnLtnNm || '';
  const orderId = slug(orderScientificName) || 'unknown-order';
  const familyId = slug(familyScientificName);
  const orderKey = normalize(orderScientificName);
  const familyKey = `${orderKey}::${normalize(familyScientificName)}`;
  const insect = extractInsect(item);

  if (!familyScientificName || !familyId) {
    const key = `_unclassified::${orderId}`;
    addBucket(unclassified, key, {
      orderId,
      orderScientificName,
      orderCommonName: item.orderKtsnKrnNm || '',
      orderKtsn: item.orderKtsn || null,
      file: `_unclassified/${orderId}.json`,
    }, insect);
    return;
  }

  const taxonomyMatch = taxonomy.families.get(familyKey);
  if (!taxonomyMatch) unknownFamilies.add(`${orderScientificName}::${familyScientificName}`);

  const key = `${orderId}::${familyId}`;
  const orderMeta = taxonomyMatch?.order || taxonomy.orders.get(orderKey)?.payload || {};
  const familyMeta = taxonomyMatch?.family || {};
  addBucket(buckets, key, {
    orderId,
    familyId,
    order: {
      id: orderMeta.id || orderId,
      scientificName: orderScientificName,
      commonName: item.orderKtsnKrnNm || orderMeta.commonName || '',
      orderKtsn: item.orderKtsn || orderMeta.orderKtsn || null,
    },
    family: {
      id: familyMeta.id || familyId,
      scientificName: familyScientificName,
      commonName: item.fmlyKtsnKrnNm || familyMeta.commonName || '',
      familyKtsn: item.fmlyKtsn || familyMeta.familyKtsn || null,
    },
    file: `${orderId}/${familyId}.json`,
  }, insect);
}

async function fetchAllSpecies() {
  const apiKey = readApiKey();
  const taxonomy = loadTaxonomy();
  const first = await fetchPage(apiKey, 1);
  const pageInfo = first?.data?.pageInfo;
  const totalPages = Number(pageInfo?.totalPages || 0);
  const totalElements = Number(pageInfo?.totalElements || 0);
  if (!totalPages) throw new Error('Unable to read API pageInfo.totalPages');

  const buckets = new Map();
  const unclassified = new Map();
  const unknownFamilies = new Set();
  for (const item of first?.data?.content || []) ingestItem(item, taxonomy, buckets, unknownFamilies, unclassified);

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
      for (const item of result.value?.data?.content || []) {
        ingestItem(item, taxonomy, buckets, unknownFamilies, unclassified);
      }
    }

    process.stdout.write(
      `\rAPI scan ${completed}/${totalPages} pages · family files ${buckets.size} · records ${countRecords(buckets) + countRecords(unclassified)}`
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
        for (const item of result.value?.data?.content || []) {
          ingestItem(item, taxonomy, buckets, unknownFamilies, unclassified);
        }
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
    totalPages,
    totalElements,
    failedPages,
    buckets,
    unclassified,
    unknownFamilies: [...unknownFamilies].sort(),
  };
}

function countRecords(map) {
  let count = 0;
  for (const bucket of map.values()) count += bucket.insects.length;
  return count;
}

function writeFamilyFiles(result, taxonomy) {
  fs.rmSync(FAMILIES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FAMILIES_DIR, { recursive: true });

  const indexFamilies = [];
  const buckets = [...result.buckets.values()].sort((a, b) => a.file.localeCompare(b.file));
  for (const bucket of buckets) {
    bucket.insects.sort((a, b) =>
      (a.scientificName || a.terminalLatinName).localeCompare(b.scientificName || b.terminalLatinName)
    );
    const payload = {
      generatedAt: result.fetchedAt,
      source: result.source,
      order: bucket.order,
      family: bucket.family,
      speciesCount: bucket.insects.length,
      insects: bucket.insects,
    };
    const filePath = path.join(FAMILIES_DIR, bucket.file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    indexFamilies.push({
      orderId: bucket.orderId,
      familyId: bucket.familyId,
      orderScientificName: bucket.order.scientificName,
      familyScientificName: bucket.family.scientificName,
      familyCommonName: bucket.family.commonName,
      familyKtsn: bucket.family.familyKtsn,
      speciesCount: bucket.insects.length,
      file: bucket.file,
    });
  }

  const unclassified = [...result.unclassified.values()].sort((a, b) => a.file.localeCompare(b.file));
  for (const bucket of unclassified) {
    bucket.insects.sort((a, b) =>
      (a.scientificName || a.terminalLatinName).localeCompare(b.scientificName || b.terminalLatinName)
    );
    const payload = {
      generatedAt: result.fetchedAt,
      source: result.source,
      order: {
        id: bucket.orderId,
        scientificName: bucket.orderScientificName,
        commonName: bucket.orderCommonName,
        orderKtsn: bucket.orderKtsn,
      },
      family: null,
      speciesCount: bucket.insects.length,
      insects: bucket.insects,
    };
    const filePath = path.join(FAMILIES_DIR, bucket.file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  const familyIndex = {
    generatedAt: result.fetchedAt,
    source: result.source,
    totalFamilies: indexFamilies.length,
    totalSpeciesRecords: countRecords(result.buckets),
    unclassifiedRecords: countRecords(result.unclassified),
    failedPages: result.failedPages,
    unknownFamilies: result.unknownFamilies,
    families: indexFamilies,
    unclassified: unclassified.map((bucket) => ({
      orderId: bucket.orderId,
      orderScientificName: bucket.orderScientificName,
      speciesCount: bucket.insects.length,
      file: bucket.file,
    })),
  };
  fs.writeFileSync(path.join(FAMILIES_DIR, 'index.json'), `${JSON.stringify(familyIndex, null, 2)}\n`, 'utf8');

  for (const { payload, filePath } of taxonomy.orders.values()) {
    payload.speciesUpdatedAt = result.fetchedAt;
    payload.families = (payload.families || []).map((family) => {
      const familyFile = `${payload.id}/${family.id}.json`;
      const bucket = result.buckets.get(`${payload.id}::${family.id}`);
      return {
        ...family,
        speciesFile: `../families/${familyFile}`,
        speciesCount: bucket?.insects.length || 0,
      };
    });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  return familyIndex;
}

async function main() {
  console.log('Fetching all insect species records from NIBR API...');
  const taxonomy = loadTaxonomy();
  const result = await fetchAllSpecies();
  const familyIndex = writeFamilyFiles(result, taxonomy);
  const cachePayload = {
    generatedAt: result.fetchedAt,
    source: result.source,
    totalPages: result.totalPages,
    totalElements: result.totalElements,
    failedPages: result.failedPages,
    familyFiles: familyIndex.totalFamilies,
    classifiedRecords: familyIndex.totalSpeciesRecords,
    unclassifiedRecords: familyIndex.unclassifiedRecords,
    unknownFamilies: result.unknownFamilies,
  };
  fs.writeFileSync(CACHE_FILE, `${JSON.stringify(cachePayload, null, 2)}\n`, 'utf8');

  console.log(`Saved family files under ${path.relative(ROOT, FAMILIES_DIR)}`);
  console.log(`Classified records: ${familyIndex.totalSpeciesRecords}`);
  console.log(`Unclassified records: ${familyIndex.unclassifiedRecords}`);
  console.log(`Family files: ${familyIndex.totalFamilies}`);
  console.log(`Failed pages: ${result.failedPages.length}`);
  console.log(`Unknown families: ${result.unknownFamilies.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
