#!/usr/bin/env node
// EOL TraitBank Cypher API에서 종별 데이터를 일괄 캐싱한다.
//
// 사용:
//   EOL_API_KEY=<JWT> node cached/cache_eol_species.mjs [--limit N] [--force]
//                                                      [--delay-ms 200] [--retries 3]
//                                                      [--only "Papilio xuthus"]
//
// 입력:  cached/korea_insect_species_by_family.json
// 출력:  cached/eol_species_cache.json
//
// 동작:
//   - 종마다 1) page_id + canonical, 2) traits + vernaculars를 Cypher로 조회
//   - 응답을 정규화하여 캐시에 머지 (incremental save)
//   - 실패 또는 미발견도 status로 기록 → 재실행 시 건너뜀
//   - --force 또는 SCHEMA_VERSION 변경 시 재요청

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const INPUT_FILE = path.join(__dirname, 'korea_insect_species_by_family.json');
const OUTPUT_FILE = path.join(__dirname, 'eol_species_cache.json');
const PROJECT_OUTPUT_FILE = path.join(ROOT, 'project', 'eol_species_cache.json');

const SCHEMA_VERSION = 1;
const CYPHER_URL = 'https://eol.org/service/cypher';
const SAVE_EVERY = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    apiKey: process.env.EOL_API_KEY || '',
    limit: 0,
    force: false,
    delayMs: 200,
    timeoutMs: 20000,
    retries: 3,
    only: '',
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--force') opts.force = true;
    else if (a === '--limit') opts.limit = Number(args[++i] || 0);
    else if (a === '--delay-ms') opts.delayMs = Number(args[++i] || opts.delayMs);
    else if (a === '--timeout-ms') opts.timeoutMs = Number(args[++i] || opts.timeoutMs);
    else if (a === '--retries') opts.retries = Number(args[++i] || opts.retries);
    else if (a === '--only') opts.only = args[++i] || '';
  }
  if (!opts.apiKey) {
    throw new Error('EOL_API_KEY 환경변수가 필요합니다. (JWT 토큰)');
  }
  return opts;
}

// 학명 정규화 — 부속명/명명자/연도 제거하여 EOL canonical 형식으로 변환
// 예) "Adalia (Adalia) bipunctata (Linnaeus, 1758)" → "Adalia bipunctata"
//     "Papilio xuthus Linnaeus, 1767"               → "Papilio xuthus"
//     "Apteroloma kozlovi kozlovi"                   → "Apteroloma kozlovi kozlovi" (subspecies 보존)
function canonicalize(raw) {
  if (!raw) return '';
  // 1) 모든 괄호 절 제거: (Subgenus), (Author, YYYY) 등
  let cleaned = String(raw).replace(/\([^)]*\)/g, ' ');
  // 2) 끝의 ", YYYY" 또는 " YYYY" 같은 연도 잔존 제거
  cleaned = cleaned.replace(/,?\s*\d{4}\b.*$/, '');
  // 3) 공백 정규화
  cleaned = cleaned.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  // 4) 토큰 분리 후 binomial/trinomial만 유지
  //    - 첫 토큰은 Genus (대문자 시작) — 강제로 받아들임
  //    - 두 번째 토큰부터는 소문자 시작 토큰만 받아들이고, 대문자 시작 토큰이 나오면 중단
  const tokens = cleaned.split(' ');
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!t) continue;
    if (i === 0) {
      out.push(t);
    } else if (/^[a-z]/.test(t) && out.length < 3) {
      out.push(t);
    } else {
      break;
    }
  }
  return out.join(' ');
}

function loadInputSpecies() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`입력 파일이 없습니다: ${INPUT_FILE}`);
  }
  const raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  const families = raw.families || {};
  const set = new Map(); // canonical → first occurrence metadata

  for (const [familyKey, family] of Object.entries(families)) {
    const list = Array.isArray(family.species) ? family.species : [];
    for (const sp of list) {
      const canonical = canonicalize(sp.scientificName);
      if (!canonical) continue;
      if (!set.has(canonical)) {
        set.set(canonical, {
          canonical,
          rawScientificName: sp.scientificName || '',
          commonName: sp.commonName || '',
          familyKey,
          orderScientificName: family.orderScientificName || '',
          familyScientificName: family.familyScientificName || '',
        });
      }
    }
  }
  return [...set.values()];
}

function loadCache() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      source: 'EOL TraitBank Cypher API (https://eol.org/service/cypher)',
      species: {},
    };
  }
  try {
    const obj = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    if (!obj.species || typeof obj.species !== 'object') obj.species = {};
    return obj;
  } catch (err) {
    console.warn(`기존 캐시 파싱 실패, 새로 시작: ${err.message}`);
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      source: 'EOL TraitBank Cypher API (https://eol.org/service/cypher)',
      species: {},
    };
  }
}

function saveCache(cache) {
  cache.savedAt = new Date().toISOString();
  const json = JSON.stringify(cache, null, 2);
  fs.writeFileSync(OUTPUT_FILE, json, 'utf8');
  // 프론트엔드에서 fetch 가능하도록 project/ 디렉토리에도 동일 사본 저장
  try {
    fs.writeFileSync(PROJECT_OUTPUT_FILE, json, 'utf8');
  } catch (err) {
    console.warn(`project/ 사본 저장 실패: ${err.message}`);
  }
}

async function cypher(opts, query) {
  const retries = Math.max(1, opts.retries);
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
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
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`JSON 파싱 실패: ${text.slice(0, 200)}`);
      }
      return json;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err.retryable === false || attempt === retries) break;
      await sleep(500 * attempt);
    }
  }
  throw lastErr;
}

// 결과 행을 컬럼명 keyed 객체로 변환
function rowsToObjects(result) {
  if (!result || !Array.isArray(result.columns) || !Array.isArray(result.data)) return [];
  const cols = result.columns;
  return result.data.map((row) => {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = row[i]; });
    return obj;
  });
}

function escapeCypher(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function fetchPageId(opts, canonical) {
  const q = `MATCH (p:Page) WHERE p.canonical = "${escapeCypher(canonical)}" RETURN p.page_id AS page_id, p.canonical AS canonical, p.rank AS rank LIMIT 1`;
  const rows = rowsToObjects(await cypher(opts, q));
  return rows[0] || null;
}

async function fetchTraits(opts, pageId) {
  // 한 번에 직접 trait과 inferred trait 모두 조회
  const q = `
    MATCH (p:Page {page_id: ${pageId}})-[:trait]->(t:Trait)-[:predicate]->(pr:Term)
    OPTIONAL MATCH (t)-[:object_term]->(ot:Term)
    OPTIONAL MATCH (t)-[:units_term]->(ut:Term)
    RETURN
      pr.name AS predicate,
      pr.uri  AS predicate_uri,
      t.literal AS literal,
      t.measurement AS measurement,
      t.source AS source,
      ot.name AS object_term,
      ot.uri  AS object_uri,
      ut.name AS unit,
      "direct" AS origin
    LIMIT 500
  `.trim().replace(/\s+/g, ' ');
  return rowsToObjects(await cypher(opts, q));
}

async function fetchVernaculars(opts, pageId) {
  const q = `MATCH (p:Page {page_id: ${pageId}})-[:vernacular]->(v:Vernacular) RETURN v.string AS name, v.language_code AS lang, v.is_preferred_name AS preferred LIMIT 30`;
  return rowsToObjects(await cypher(opts, q));
}

// trait 배열 → 사용자 페이지 친화 구조
function summarizeTraits(traits) {
  const out = {
    habitat: [],
    geographic: [],
    introduced: [],
    eats: [],
    visitsFlowersOf: [],
    pathogenOf: [],
    gbifRecords: null,
    others: [],
  };
  for (const t of traits || []) {
    const value = t.object_term || t.literal || t.measurement;
    if (value === null || value === undefined || value === '') continue;
    switch (t.predicate) {
      case 'habitat':
        out.habitat.push(t.object_term || t.literal);
        break;
      case 'geographic distribution':
        out.geographic.push(t.object_term || t.literal);
        break;
      case 'introduced range includes':
        out.introduced.push(t.object_term || t.literal);
        break;
      case 'eat':
        out.eats.push(t.object_term || t.literal);
        break;
      case 'visit flowers of':
        out.visitsFlowersOf.push(t.object_term || t.literal);
        break;
      case 'are pathogens of':
        out.pathogenOf.push(t.object_term || t.literal);
        break;
      case 'number of records in gbif':
        out.gbifRecords = Number(t.measurement) || null;
        break;
      default:
        out.others.push({ predicate: t.predicate, value });
    }
  }
  // 중복 제거
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

async function processOne(opts, sp) {
  // 1) page lookup
  const pageRow = await fetchPageId(opts, sp.canonical);
  if (!pageRow || !pageRow.page_id) {
    return { status: 'not_found', canonical: sp.canonical };
  }
  if (opts.delayMs) await sleep(opts.delayMs);
  // 2) traits
  const traits = await fetchTraits(opts, pageRow.page_id);
  if (opts.delayMs) await sleep(opts.delayMs);
  // 3) vernaculars
  const vern = await fetchVernaculars(opts, pageRow.page_id);

  return {
    status: 'ok',
    fetchedAt: new Date().toISOString(),
    canonical: pageRow.canonical || sp.canonical,
    pageId: pageRow.page_id,
    rank: pageRow.rank || null,
    traitsSummary: summarizeTraits(traits),
    vernaculars: summarizeVernaculars(vern),
    rawTraitCount: traits.length,
    rawVernacularCount: vern.length,
  };
}

async function main() {
  const opts = parseArgs();
  const inputSpecies = loadInputSpecies();
  console.log(`총 유니크 종 수(canonical 기준): ${inputSpecies.length}`);

  const cache = loadCache();
  if (cache.schemaVersion !== SCHEMA_VERSION) {
    console.warn(`스키마 버전 불일치 (cache=${cache.schemaVersion}, code=${SCHEMA_VERSION}) — 모든 종 재요청`);
    cache.schemaVersion = SCHEMA_VERSION;
    cache.species = {};
  }
  cache.source = 'EOL TraitBank Cypher API (https://eol.org/service/cypher)';

  let targets = inputSpecies;
  if (opts.only) {
    targets = targets.filter((s) => s.canonical === opts.only || s.rawScientificName === opts.only);
    if (targets.length === 0) {
      console.error(`--only "${opts.only}"에 일치하는 종이 없습니다.`);
      process.exit(1);
    }
  }
  if (opts.limit > 0) targets = targets.slice(0, opts.limit);
  console.log(`처리 대상: ${targets.length}건 (limit=${opts.limit || 'none'})`);

  let ok = 0, notFound = 0, errors = 0, skipped = 0;
  let processedSinceSave = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const sp = targets[i];
    const existing = cache.species[sp.canonical];
    if (!opts.force && existing && (existing.status === 'ok' || existing.status === 'not_found')) {
      skipped += 1;
      continue;
    }

    process.stdout.write(`[${i + 1}/${targets.length}] ${sp.canonical} ... `);
    try {
      const result = await processOne(opts, sp);
      // 입력에서 유래한 정보 보존
      result.korCommonName = sp.commonName;
      result.familyKey = sp.familyKey;
      cache.species[sp.canonical] = result;
      if (result.status === 'ok') {
        ok += 1;
        console.log(`OK (page_id=${result.pageId}, traits=${result.rawTraitCount}, vern=${result.rawVernacularCount})`);
      } else {
        notFound += 1;
        console.log('NOT FOUND');
      }
    } catch (err) {
      errors += 1;
      cache.species[sp.canonical] = {
        status: 'error',
        canonical: sp.canonical,
        error: err.message,
        attemptedAt: new Date().toISOString(),
        korCommonName: sp.commonName,
        familyKey: sp.familyKey,
      };
      console.log(`ERROR — ${err.message}`);
    }

    processedSinceSave += 1;
    if (processedSinceSave >= SAVE_EVERY) {
      saveCache(cache);
      processedSinceSave = 0;
    }

    if (opts.delayMs) await sleep(opts.delayMs);
  }

  saveCache(cache);
  console.log(`\n완료: ok=${ok}, not_found=${notFound}, error=${errors}, skipped(cache hit)=${skipped}`);
  console.log(`출력: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('치명적 오류:', err.message);
  process.exit(1);
});
