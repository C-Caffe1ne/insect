#!/usr/bin/env node
// taxonomy/families/**/*.json의 모든 곤충을 목→과 순차로 EOL TraitBank에 캐싱한다.
//
// 정책:
//   - 일일 1000 API 호출 한도 (cached/eol_api_state.json에 일별 카운터 저장)
//   - family당 종 수 제한 없음 (모든 insect 처리)
//   - 이미 ok/not_found 캐시된 학명은 자동 skip
//   - error 캐시는 재시도
//   - 각 family 완료 시 통계 보고 + 해당 family JSON에 eol 필드 즉시 병합
//   - 한도 도달 또는 모든 family 완료 시 graceful exit
//
// 사용:
//   EOL_API_KEY=<JWT> node cached/cache_eol_taxonomy_full.mjs \
//     [--daily-limit 1000] [--delay-ms 200] [--retries 3] [--start-order coleoptera]
//
// 자동 재개: 매번 실행 시 처음부터 family를 순회하되, 이미 캐시된 종은 즉시 skip하므로
//           효율적으로 다음 미처리 family로 이동한다.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EOL_CACHE_FILE = path.join(__dirname, 'eol_species_cache.json');
const PROJECT_CACHE_FILE = path.join(ROOT, 'project', 'eol_species_cache.json');
const STATE_FILE = path.join(__dirname, 'eol_api_state.json');
const FAMILIES_DIR = path.join(ROOT, 'project', 'taxonomy', 'families');

const SCHEMA_VERSION = 1;
const CYPHER_URL = 'https://eol.org/service/cypher';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayStr = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    apiKey: process.env.EOL_API_KEY || '',
    dailyLimit: 1000,
    delayMs: 200,
    timeoutMs: 20000,
    retries: 3,
    startOrder: '',
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--daily-limit') opts.dailyLimit = Number(args[++i] || opts.dailyLimit);
    else if (a === '--delay-ms') opts.delayMs = Number(args[++i] || opts.delayMs);
    else if (a === '--timeout-ms') opts.timeoutMs = Number(args[++i] || opts.timeoutMs);
    else if (a === '--retries') opts.retries = Number(args[++i] || opts.retries);
    else if (a === '--start-order') opts.startOrder = args[++i] || '';
  }
  if (!opts.apiKey) {
    throw new Error('EOL_API_KEY 환경변수가 필요합니다.');
  }
  return opts;
}

// canonicalize — Node/브라우저/merge 스크립트와 동일
function canonicalize(raw) {
  if (!raw) return '';
  let s = String(raw).replace(/\([^)]*\)/g, ' ');
  s = s.replace(/,?\s*\d{4}\b.*$/, '');
  s = s.trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const tokens = s.split(' ');
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!t) continue;
    if (i === 0) out.push(t);
    else if (/^[a-z]/.test(t) && out.length < 3) out.push(t);
    else break;
  }
  return out.join(' ');
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { date: todayStr(), callsToday: 0, totalCalls: 0 };
  }
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (s.date !== todayStr()) {
      // 날짜가 바뀌면 일별 카운터 리셋
      console.log(`[state] 날짜 변경 (${s.date} → ${todayStr()}) — 일별 카운터 리셋`);
      s.date = todayStr();
      s.callsToday = 0;
    }
    s.totalCalls = s.totalCalls || 0;
    return s;
  } catch {
    return { date: todayStr(), callsToday: 0, totalCalls: 0 };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function loadCache() {
  if (!fs.existsSync(EOL_CACHE_FILE)) {
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      source: 'EOL TraitBank Cypher API (https://eol.org/service/cypher)',
      species: {},
    };
  }
  const obj = JSON.parse(fs.readFileSync(EOL_CACHE_FILE, 'utf8'));
  if (!obj.species) obj.species = {};
  return obj;
}

function saveCache(cache) {
  cache.savedAt = new Date().toISOString();
  const json = JSON.stringify(cache, null, 2);
  fs.writeFileSync(EOL_CACHE_FILE, json, 'utf8');
  try { fs.writeFileSync(PROJECT_CACHE_FILE, json, 'utf8'); }
  catch (err) { console.warn(`project/ 사본 저장 실패: ${err.message}`); }
}

function walkFamilyFiles(rootDir) {
  // taxonomy/families/{order}/{family}.json 구조 가정
  // family.insects.length 오름차순으로 정렬 — 작은 family부터 처리 (가시적 진척 우선)
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  const orderDirs = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const orderId of orderDirs) {
    const orderPath = path.join(rootDir, orderId);
    const files = fs.readdirSync(orderPath).filter((n) => n.endsWith('.json'));
    for (const fname of files) {
      const fullPath = path.join(orderPath, fname);
      let insectCount = 0;
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        insectCount = Array.isArray(data.insects) ? data.insects.length : 0;
      } catch { /* 파싱 실패 family는 0종 취급 — 본 루프에서 skip됨 */ }
      out.push({ orderId, familyFile: fname, fullPath, insectCount });
    }
  }
  // 곤충 수 적은 순서, 동률이면 order/file 알파벳 안정 정렬
  out.sort((a, b) => {
    if (a.insectCount !== b.insectCount) return a.insectCount - b.insectCount;
    if (a.orderId !== b.orderId) return a.orderId.localeCompare(b.orderId);
    return a.familyFile.localeCompare(b.familyFile);
  });
  return out;
}

async function cypher(opts, query, state) {
  const retries = Math.max(1, opts.retries);
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      state.callsToday += 1;
      state.totalCalls += 1;
      const res = await fetch(CYPHER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `JWT ${opts.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      clearTimeout(timer);
      const text = await res.text();
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
        err.retryable = res.status === 429 || res.status >= 500;
        throw err;
      }
      return JSON.parse(text);
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err.retryable === false || attempt === retries) break;
      await sleep(500 * attempt);
    }
  }
  throw lastErr;
}

function rowsToObjects(result) {
  if (!result || !Array.isArray(result.columns) || !Array.isArray(result.data)) return [];
  const cols = result.columns;
  return result.data.map((row) => {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = row[i]; });
    return obj;
  });
}

const escapeCypher = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

async function fetchPageId(opts, canonical, state) {
  const q = `MATCH (p:Page) WHERE p.canonical = "${escapeCypher(canonical)}" RETURN p.page_id AS page_id, p.canonical AS canonical, p.rank AS rank LIMIT 1`;
  return rowsToObjects(await cypher(opts, q, state))[0] || null;
}

async function fetchTraits(opts, pageId, state) {
  const q = `MATCH (p:Page {page_id: ${pageId}})-[:trait]->(t:Trait)-[:predicate]->(pr:Term) OPTIONAL MATCH (t)-[:object_term]->(ot:Term) OPTIONAL MATCH (t)-[:units_term]->(ut:Term) RETURN pr.name AS predicate, pr.uri AS predicate_uri, t.literal AS literal, t.measurement AS measurement, t.source AS source, ot.name AS object_term, ot.uri AS object_uri, ut.name AS unit LIMIT 500`;
  return rowsToObjects(await cypher(opts, q, state));
}

async function fetchVernaculars(opts, pageId, state) {
  const q = `MATCH (p:Page {page_id: ${pageId}})-[:vernacular]->(v:Vernacular) RETURN v.string AS name, v.language_code AS lang, v.is_preferred_name AS preferred LIMIT 30`;
  return rowsToObjects(await cypher(opts, q, state));
}

function summarizeTraits(traits) {
  const out = { habitat: [], geographic: [], introduced: [], eats: [], visitsFlowersOf: [], pathogenOf: [], gbifRecords: null, others: [] };
  for (const t of traits || []) {
    const value = t.object_term || t.literal || t.measurement;
    if (value === null || value === undefined || value === '') continue;
    switch (t.predicate) {
      case 'habitat': out.habitat.push(t.object_term || t.literal); break;
      case 'geographic distribution': out.geographic.push(t.object_term || t.literal); break;
      case 'introduced range includes': out.introduced.push(t.object_term || t.literal); break;
      case 'eat': out.eats.push(t.object_term || t.literal); break;
      case 'visit flowers of': out.visitsFlowersOf.push(t.object_term || t.literal); break;
      case 'are pathogens of': out.pathogenOf.push(t.object_term || t.literal); break;
      case 'number of records in gbif': out.gbifRecords = Number(t.measurement) || null; break;
      default: out.others.push({ predicate: t.predicate, value });
    }
  }
  ['habitat', 'geographic', 'introduced', 'eats', 'visitsFlowersOf', 'pathogenOf'].forEach((k) => {
    out[k] = [...new Set(out[k].map(String))];
  });
  return out;
}

function summarizeVernaculars(vernaculars) {
  const byLang = {};
  for (const v of vernaculars || []) {
    if (!v.lang || !v.name) continue;
    if (!byLang[v.lang]) byLang[v.lang] = [];
    byLang[v.lang].push({ name: v.name, preferred: v.preferred === true || v.preferred === 't' });
  }
  return {
    ko: (byLang.kor || []).map((x) => x.name),
    en: (byLang.eng || []).map((x) => x.name),
    ja: (byLang.jpn || []).map((x) => x.name),
    raw: byLang,
  };
}

function buildEolEmbed(cacheEntry) {
  const t = cacheEntry.traitsSummary || {};
  const v = cacheEntry.vernaculars || {};
  return {
    pageId: cacheEntry.pageId,
    canonical: cacheEntry.canonical,
    fetchedAt: cacheEntry.fetchedAt,
    vernaculars: {
      ko: Array.isArray(v.ko) ? v.ko : [],
      en: Array.isArray(v.en) ? v.en : [],
      ja: Array.isArray(v.ja) ? v.ja : [],
    },
    habitat: Array.isArray(t.habitat) ? t.habitat : [],
    geographic: Array.isArray(t.geographic) ? t.geographic : [],
    introduced: Array.isArray(t.introduced) ? t.introduced : [],
    eats: Array.isArray(t.eats) ? t.eats : [],
    visitsFlowersOf: Array.isArray(t.visitsFlowersOf) ? t.visitsFlowersOf : [],
    pathogenOf: Array.isArray(t.pathogenOf) ? t.pathogenOf : [],
    gbifRecords: typeof t.gbifRecords === 'number' ? t.gbifRecords : null,
  };
}

async function processSpecies(opts, canonical, state, cache) {
  // 1 API call: page lookup
  const pageRow = await fetchPageId(opts, canonical, state);
  if (!pageRow || !pageRow.page_id) {
    return { status: 'not_found', canonical, fetchedAt: new Date().toISOString() };
  }
  if (opts.delayMs) await sleep(opts.delayMs);
  // 2nd API call: traits
  const traits = await fetchTraits(opts, pageRow.page_id, state);
  if (opts.delayMs) await sleep(opts.delayMs);
  // 3rd API call: vernaculars
  const vern = await fetchVernaculars(opts, pageRow.page_id, state);
  return {
    status: 'ok',
    fetchedAt: new Date().toISOString(),
    canonical: pageRow.canonical || canonical,
    pageId: pageRow.page_id,
    rank: pageRow.rank || null,
    traitsSummary: summarizeTraits(traits),
    vernaculars: summarizeVernaculars(vern),
    rawTraitCount: traits.length,
    rawVernacularCount: vern.length,
  };
}

function mergeEolIntoFamilyFile(familyData, cache) {
  let changed = false;
  let withData = 0;
  let withoutData = 0;
  for (const insect of (familyData.insects || [])) {
    const canonical = canonicalize(insect.scientificName);
    const entry = canonical ? cache.species[canonical] : null;
    if (entry && entry.status === 'ok') {
      const embed = buildEolEmbed(entry);
      if (JSON.stringify(insect.eol) !== JSON.stringify(embed)) {
        insect.eol = embed;
        changed = true;
      }
      withData += 1;
    } else {
      if (insect.eol !== undefined) {
        delete insect.eol;
        changed = true;
      }
      withoutData += 1;
    }
  }
  return { changed, withData, withoutData };
}

async function main() {
  const opts = parseArgs();
  const state = loadState();
  const cache = loadCache();

  const families = walkFamilyFiles(FAMILIES_DIR);
  console.log(`총 family 파일: ${families.length}`);
  console.log(`일일 한도: ${opts.dailyLimit} | 오늘 사용: ${state.callsToday} | 전체 누적: ${state.totalCalls}`);
  console.log('');

  if (opts.startOrder) {
    console.log(`--start-order ${opts.startOrder} → 해당 목까지 건너뜀`);
  }

  let stopped = false;
  let startSeen = !opts.startOrder;

  for (const { orderId, familyFile, fullPath } of families) {
    if (stopped) break;
    if (!startSeen) {
      if (orderId === opts.startOrder) startSeen = true;
      else continue;
    }

    // family 데이터 로드
    let familyData;
    try {
      familyData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch (err) {
      console.warn(`SKIP (parse): ${orderId}/${familyFile} — ${err.message}`);
      continue;
    }

    const familyKey = `${orderId}/${familyFile.replace('.json', '')}`;
    const insects = Array.isArray(familyData.insects) ? familyData.insects : [];
    const familyCommonName = familyData.family?.commonName || '';
    const familyScientific = familyData.family?.scientificName || familyKey;

    if (insects.length === 0) continue;

    // 캐시 필요한 unique canonical 목록 추출
    const targets = [];
    const seen = new Set();
    for (const insect of insects) {
      const canonical = canonicalize(insect.scientificName);
      if (!canonical || seen.has(canonical)) continue;
      seen.add(canonical);
      const existing = cache.species[canonical];
      if (existing && (existing.status === 'ok' || existing.status === 'not_found')) continue;
      targets.push(canonical);
    }

    if (targets.length === 0) {
      // 모두 이미 캐시됨 — 병합만 다시 (idempotent)
      const merge = mergeEolIntoFamilyFile(familyData, cache);
      if (merge.changed) {
        fs.writeFileSync(fullPath, JSON.stringify(familyData, null, 2) + '\n', 'utf8');
      }
      console.log(`✓ ${familyKey.padEnd(40)} ${familyCommonName} (${familyScientific}) — 캐시 적중만 (${insects.length}종 / 매칭 ${merge.withData})`);
      continue;
    }

    console.log(`\n▶ ${familyKey} ${familyCommonName} (${familyScientific}) — ${insects.length}종 (캐시 필요 ${targets.length}종)`);

    let ok = 0, notFound = 0, error = 0;

    for (const canonical of targets) {
      // 일일 한도 검사 (페이지 룩업 + 최악 2 콜)
      const callsNeededOptimistic = 1;
      if (state.callsToday + callsNeededOptimistic > opts.dailyLimit) {
        console.log(`\n⚠ 일일 한도 도달 (${state.callsToday}/${opts.dailyLimit}) — 종료`);
        stopped = true;
        break;
      }

      try {
        const result = await processSpecies(opts, canonical, state, cache);
        result.familyKey = familyKey;
        cache.species[canonical] = result;
        if (result.status === 'ok') ok += 1;
        else if (result.status === 'not_found') notFound += 1;
        process.stdout.write(`  ${canonical}: ${result.status === 'ok' ? `OK(traits=${result.rawTraitCount}, vern=${result.rawVernacularCount})` : 'NOT FOUND'}\n`);
      } catch (err) {
        error += 1;
        cache.species[canonical] = {
          status: 'error',
          canonical,
          error: err.message,
          attemptedAt: new Date().toISOString(),
        };
        process.stdout.write(`  ${canonical}: ERROR — ${err.message}\n`);
      }

      // 빈번한 incremental save
      saveCache(cache);
      saveState(state);

      if (opts.delayMs) await sleep(opts.delayMs);
    }

    // family 단위 병합 + 보고
    const merge = mergeEolIntoFamilyFile(familyData, cache);
    if (merge.changed) {
      fs.writeFileSync(fullPath, JSON.stringify(familyData, null, 2) + '\n', 'utf8');
    }

    console.log(`✓ family 완료: ok=${ok}, not_found=${notFound}, error=${error} | 누적 매칭: ${merge.withData}/${insects.length} (${(merge.withData / insects.length * 100).toFixed(1)}%) | 오늘 API: ${state.callsToday}/${opts.dailyLimit}`);
  }

  saveCache(cache);
  saveState(state);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`최종: 오늘 API 호출 ${state.callsToday}/${opts.dailyLimit} | 전체 누적 ${state.totalCalls}`);
  console.log(`캐시 종 수: ${Object.keys(cache.species).length}`);
  if (stopped) console.log('일일 한도 도달로 중단됨. 내일(또는 --daily-limit 상향) 재실행 시 다음 family부터 자동 이어 진행.');
  else console.log('전체 family 처리 완료.');
}

main().catch((err) => {
  console.error('치명적 오류:', err.message);
  process.exit(1);
});
