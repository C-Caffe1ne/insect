import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TAXONOMY_FAMILIES_DIR = path.join(ROOT, 'project', 'taxonomy', 'families');
const INDEX_FILE = path.join(__dirname, 'digital_content_cache_index.json');

const DEFAULT_BASE_URL = 'https://species.nibr.go.kr/gwsvc/openapi/rest/digital/bispconts/search';
const CONTENT_TYPES = ['EO', 'FR', 'DT', 'EX'];
const THUMBNAIL_TYPES = new Set(['PH', 'PI', 'MO', '3D']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    baseUrl: process.env.DIGITAL_API_BASE_URL || DEFAULT_BASE_URL,
    method: (process.env.DIGITAL_API_METHOD || 'GET').toUpperCase(),
    apiKey: process.env.DIGITAL_API_KEY || '',
    concurrency: Number(process.env.DIGITAL_API_CONCURRENCY || 4),
    delayMs: Number(process.env.DIGITAL_API_DELAY_MS || 120),
    timeoutMs: Number(process.env.DIGITAL_API_TIMEOUT_MS || 10000),
    retries: Number(process.env.DIGITAL_API_RETRIES || 2),
    force: false,
    limit: 0,
    family: '',
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--force') options.force = true;
    else if (arg === '--family') options.family = args[++index] || '';
    else if (arg === '--limit') options.limit = Number(args[++index] || 0);
    else if (arg === '--concurrency') options.concurrency = Number(args[++index] || 4);
    else if (arg === '--delay-ms') options.delayMs = Number(args[++index] || options.delayMs);
    else if (arg === '--timeout-ms') options.timeoutMs = Number(args[++index] || options.timeoutMs);
    else if (arg === '--retries') options.retries = Number(args[++index] || options.retries);
    else if (arg === '--base-url') options.baseUrl = args[++index] || options.baseUrl;
    else if (arg === '--method') options.method = (args[++index] || options.method).toUpperCase();
  }

  if (!options.apiKey) {
    throw new Error('DIGITAL_API_KEY 환경변수가 필요합니다.');
  }
  if (!options.baseUrl) {
    throw new Error('DIGITAL_API_BASE_URL 또는 --base-url이 필요합니다.');
  }
  return options;
}

function walkJsonFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) out.push(...walkJsonFiles(filePath));
    else if (name.endsWith('.json') && name !== 'index.json') out.push(filePath);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function loadFamilyFiles(familyFilter) {
  let files = walkJsonFiles(TAXONOMY_FAMILIES_DIR);
  if (familyFilter) {
    const normalized = familyFilter.replaceAll('\\', '/').toLowerCase();
    files = files.filter((filePath) => {
      const relative = path.relative(TAXONOMY_FAMILIES_DIR, filePath).replaceAll('\\', '/').toLowerCase();
      return relative === normalized || relative.endsWith(`/${normalized}`) || relative.includes(normalized);
    });
  }
  return files;
}

function contentHasData(content) {
  if (!content) return false;
  return Boolean(
    content.cachedAt &&
    typeof content.thumbnailUrl !== 'undefined' &&
    CONTENT_TYPES.every((type) => Array.isArray(content.contents?.[type]))
  );
}

function buildPayload(apiKey, ktsn, page) {
  return {
    oapiAcsUnqNo: apiKey,
    schKtsn: String(ktsn),
    page,
    responseType: 'json',
  };
}

async function fetchPage(options, ktsn, page) {
  const retries = Math.max(1, options.retries);
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const init = { method: options.method, signal: controller.signal };
      let requestUrl = options.baseUrl;
      if (options.method === 'GET') {
        const url = new URL(options.baseUrl);
        for (const [key, value] of Object.entries(buildPayload(options.apiKey, ktsn, page))) {
          url.searchParams.set(key, value);
        }
        requestUrl = url.toString();
      } else {
        init.headers = { 'content-type': 'application/json' };
        init.body = JSON.stringify(buildPayload(options.apiKey, ktsn, page));
      }
      const response = await fetch(requestUrl, init);
      const text = await response.text();
      clearTimeout(timeoutId);
      let payload;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`JSON 파싱 실패: ${text.slice(0, 160)}`);
      }
      if (!response.ok || payload.status >= 400) {
        const message = `HTTP ${response.status} ${payload.errorCode || payload.message || ''}`.trim();
        const error = new Error(message);
        error.retryable = response.status === 429 || response.status >= 502;
        throw error;
      }
      return payload;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.retryable === false || attempt === retries) throw error;
      await sleep(400 * attempt);
    }
  }
}

async function fetchAllContent(options, ktsn) {
  const first = await fetchPage(options, ktsn, 1);
  const pageInfo = first?.data?.pageInfo || {};
  const totalPages = Number(pageInfo.totalPages || 1);
  const content = [...(first?.data?.content || [])];

  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await fetchPage(options, ktsn, page);
    content.push(...(payload?.data?.content || []));
    if (options.delayMs) await sleep(options.delayMs);
  }

  return {
    pageInfo,
    content,
  };
}

function pickThumbnail(items) {
  const candidates = items
    .filter((item) => item.thmbViewPath || item.thumbPath500 || item.thumbPath || item.fileViewPath)
    .sort((a, b) => scoreThumbnail(b) - scoreThumbnail(a));

  const item = candidates[0];
  if (!item) return { thumbnailUrl: null, source: null };

  return {
    thumbnailUrl: item.thmbViewPath || item.thumbPath500 || item.thumbPath || item.fileViewPath || null,
    source: normalizeContentItem(item),
  };
}

function scoreThumbnail(item) {
  let score = 0;
  if (item.rprsImgYn === 'Y') score += 100;
  if (item.thmbViewPath) score += 40;
  if (item.thumbPath500) score += 20;
  if (item.contsType === 'PH') score += 10;
  if (THUMBNAIL_TYPES.has(item.contsType)) score += 5;
  return score;
}

function normalizeContentItem(item) {
  return {
    ktsn: item.ktsn ?? null,
    contsType: item.contsType || '',
    contsTypeName: item.contentName || '',
    contsType2: item.contsType2 || '',
    contsType2Name: item.contentName2 || '',
    tableType: item.tblType || '',
    title: item.ttl || '',
    content: item.cn || '',
    businessName: item.bizNm || '',
    koreanName: item.ktsnKrnNm || '',
    scientificName: item.stnm || '',
    shotYear: item.shtYr || null,
    shotDate: item.shtDt || null,
    shotAddress: item.shtAddr || '',
    shotPlace: item.shtPlc || '',
    photographer: item.shtr || '',
    originalFileName: item.orgnlFileNm || '',
    fileName: item.fileNm || '',
    fileViewPath: item.fileViewPath || '',
    fileDownloadPath: item.fileDownloadPath || '',
    thumbnailViewPath: item.thmbViewPath || item.thumbPath500 || item.thumbPath || '',
    thumbnailDownloadPath: item.thmbDownloadPath || '',
    representativeImage: item.rprsImgYn || '',
    source: item.src || '',
  };
}

function extractDigitalContent(result, fetchedAt, sourceUrl) {
  const contents = Object.fromEntries(CONTENT_TYPES.map((type) => [type, []]));
  for (const item of result.content) {
    if (CONTENT_TYPES.includes(item.contsType)) {
      contents[item.contsType].push(normalizeContentItem(item));
    }
  }

  for (const type of CONTENT_TYPES) {
    contents[type].sort((a, b) =>
      [a.title, a.content, a.fileName].join(' ').localeCompare([b.title, b.content, b.fileName].join(' '))
    );
  }

  const thumbnail = pickThumbnail(result.content);
  return {
    cachedAt: fetchedAt,
    source: sourceUrl,
    totalElements: Number(result.pageInfo.totalElements || result.content.length || 0),
    totalPages: Number(result.pageInfo.totalPages || 1),
    thumbnailUrl: thumbnail.thumbnailUrl,
    thumbnail: thumbnail.source,
    contents,
  };
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function processFamilyFile(filePath, options, stats) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const insects = payload.insects || [];
  let changed = false;
  const fetchedAt = new Date().toISOString();
  const relative = path.relative(ROOT, filePath);

  const targets = insects
    .filter((insect) => insect.ktsn && (options.force || !contentHasData(insect.digitalContent)))
    .slice(0, options.limit || undefined);

  if (!targets.length) {
    stats.skippedFiles += 1;
    return;
  }

  console.log(`${relative}: ${targets.length}/${insects.length} records`);

  await runPool(targets, options.concurrency, async (insect, index) => {
    try {
      const result = await fetchAllContent(options, insect.ktsn);
      insect.digitalContent = extractDigitalContent(result, fetchedAt, options.baseUrl);
      changed = true;
      stats.fetched += 1;
      process.stdout.write(
        `\r  ${Math.min(index + 1, targets.length)}/${targets.length} · fetched ${stats.fetched} · failed ${stats.failed.length}`
      );
      if (options.delayMs) await sleep(options.delayMs);
    } catch (error) {
      insect.digitalContent = {
        cachedAt: fetchedAt,
        source: options.baseUrl,
        error: error.message,
        thumbnailUrl: insect.digitalContent?.thumbnailUrl ?? null,
        contents: insect.digitalContent?.contents || Object.fromEntries(CONTENT_TYPES.map((type) => [type, []])),
      };
      changed = true;
      stats.failed.push({
        file: relative,
        ktsn: insect.ktsn,
        commonName: insect.commonName,
        scientificName: insect.scientificName,
        error: error.message,
      });
    }
  });

  console.log('');
  if (changed) {
    payload.digitalContentUpdatedAt = fetchedAt;
    payload.digitalContentSource = options.baseUrl;
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    stats.updatedFiles += 1;
  }
}

async function main() {
  const options = parseArgs();
  const files = loadFamilyFiles(options.family);
  const stats = {
    startedAt: new Date().toISOString(),
    source: options.baseUrl,
    familyFiles: files.length,
    updatedFiles: 0,
    skippedFiles: 0,
    fetched: 0,
    failed: [],
  };

  console.log(`Digital content cache: ${files.length} family files`);
  for (const filePath of files) {
    await processFamilyFile(filePath, options, stats);
  }

  stats.finishedAt = new Date().toISOString();
  fs.writeFileSync(INDEX_FILE, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
  console.log(`Saved ${path.relative(ROOT, INDEX_FILE)}`);
  console.log(`Updated files: ${stats.updatedFiles}`);
  console.log(`Fetched records: ${stats.fetched}`);
  console.log(`Failed records: ${stats.failed.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
