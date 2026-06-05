#!/usr/bin/env node
// EOL TraitBank Cypher API에서 과(Family) 단위로 traits를 일괄 캐싱한다.
//
// Phase 1: IUCN status / 서식지 / 분포 / extinction / population trend
//
// 사용:
//   EOL_API_KEY=<JWT> node cached/cache_eol_family_traits.mjs [--delay-ms 2000]
//                                                              [--only "odonata/aeshnidae"]
//                                                              [--force]
//
// 입력:  project/taxonomy/families/{order}/{family}.json (611개)
// 상태:  cached/eol_family_traits_state.json (resumable)
// 출력:  각 family JSON의 insects[].eol 필드 확장
//
// 동작:
//   - family 1개당 Cypher 1콜로 모든 종의 traits를 일괄 조회
//   - 학명(canonical) 기준 매칭, 부속명·명명자·연도 제거 정규화
//   - 동일 family 안에서 종 카테고리 6개 predicate 모두 한 번에 회수

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FAM_ROOT = path.join(ROOT, 'project', 'taxonomy', 'families');
const STATE_FILE = path.join(__dirname, 'eol_family_traits_state.json');

const SCHEMA_VERSION = 1;
const CYPHER_URL = 'https://eol.org/service/cypher';

const TARGET_PREDICATES = [
  'habitat',
  'geographic distribution',
  'conservation status',
  'extinction status',
  'population trend',
  'introduced range includes',
  'native range includes',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    apiKey: process.env.EOL_API_KEY || '',
    delayMs: 2000,
    timeoutMs: 60000,
    retries: 3,
    only: '',
    force: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--force') opts.force = true;
    else if (a === '--delay-ms') opts.delayMs = Number(args[++i] || opts.delayMs);
    else if (a === '--timeout-ms') opts.timeoutMs = Number(args[++i] || opts.timeoutMs);
    else if (a === '--retries') opts.retries = Number(args[++i] || opts.retries);
    else if (a === '--only') opts.only = args[++i] || '';
  }
  if (!opts.apiKey) throw new Error('EOL_API_KEY 환경변수가 필요합니다 (JWT).');
  return opts;
}

// 학명 정규화 — "Adalia (Adalia) bipunctata (Linnaeus, 1758)" → "Adalia bipunctata"
function canonicalize(raw) {
  if (!raw) return '';
  let cleaned = String(raw).replace(/\([^)]*\)/g, ' ');
  cleaned = cleaned.replace(/,?\s*\d{4}\b.*$/, '');
  cleaned = cleaned.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';
  const tokens = cleaned.split(' ');
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
    return { schemaVersion: SCHEMA_VERSION, families: {}, totals: { calls: 0, matched: 0 } };
  }
  try {
    const obj = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (!obj.families) obj.families = {};
    if (!obj.totals) obj.totals = { calls: 0, matched: 0 };
    return obj;
  } catch (err) {
    console.warn('상태 파싱 실패, 새로 시작:', err.message);
    return { schemaVersion: SCHEMA_VERSION, families: {}, totals: { calls: 0, matched: 0 } };
  }
}

function saveState(state) {
  state.savedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function listFamilies() {
  const orders = fs.readdirSync(FAM_ROOT).filter((d) => fs.statSync(path.join(FAM_ROOT, d)).isDirectory());
  const out = [];
  for (const order of orders) {
    const files = fs.readdirSync(path.join(FAM_ROOT, order)).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      out.push({
        key: `${order}/${f.replace('.json', '')}`,
        order,
        familySlug: f.replace('.json', ''),
        path: path.join(FAM_ROOT, order, f),
      });
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
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
          'User-Agent': 'EntomaKR-Crawler/1.0 (mailto:hwanghs5290@gmail.com)',
        },
        body: JSON.stringify({ query }),
      });
      clearTimeout(timer);
      const text = await res.text();
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
        err.retryable = res.status === 429 || res.status >= 500;
        if (res.status === 429) {
          console.warn('  429 rate limit — 60초 대기');
          await sleep(60000);
        }
        throw err;
      }
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(`JSON 파싱 실패: ${text.slice(0, 200)}`); }
      return json;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err.retryable === false || attempt === retries) break;
      await sleep(2000 * attempt);
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

function escapeCypher(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// family 안의 모든 canonical 종에 대해 traits를 한 번에 조회
async function fetchTraitsForCanonicals(opts, canonicals, predicates) {
  if (!canonicals.length) return [];
  const namesList = canonicals.map((c) => `"${escapeCypher(c)}"`).join(', ');
  const predsList = predicates.map((p) => `"${escapeCypher(p)}"`).join(', ');
  const q = `
    MATCH (p:Page)-[:trait]->(t:Trait)-[:predicate]->(pr:Term)
    WHERE p.canonical IN [${namesList}] AND pr.name IN [${predsList}]
    OPTIONAL MATCH (t)-[:object_term]->(ot:Term)
    RETURN
      p.canonical AS canonical,
      p.page_id   AS page_id,
      pr.name     AS predicate,
      t.literal   AS literal,
      t.measurement AS measurement,
      ot.name     AS object_term
    LIMIT 5000
  `.trim().replace(/\s+/g, ' ');
  return rowsToObjects(await cypher(opts, q));
}

// rows → canonical 별 trait 집계
function buildPerSpecies(rows) {
  const map = new Map(); // canonical -> { habitat: [], geographic: [], ... }
  for (const r of rows) {
    const can = r.canonical;
    if (!can) continue;
    if (!map.has(can)) {
      map.set(can, {
        pageId: r.page_id || null,
        habitat: new Set(),
        geographic: new Set(),
        introduced: new Set(),
        native: new Set(),
        iucnStatus: null,
        extinctionStatus: null,
        populationTrend: null,
      });
    }
    const entry = map.get(can);
    const value = r.object_term || r.literal;
    if (value === null || value === undefined || value === '') continue;
    switch (r.predicate) {
      case 'habitat': entry.habitat.add(String(value)); break;
      case 'geographic distribution': entry.geographic.add(String(value)); break;
      case 'introduced range includes': entry.introduced.add(String(value)); break;
      case 'native range includes': entry.native.add(String(value)); break;
      case 'conservation status': entry.iucnStatus = String(value); break;
      case 'extinction status': entry.extinctionStatus = String(value); break;
      case 'population trend': entry.populationTrend = String(value); break;
    }
  }
  const out = {};
  for (const [can, e] of map.entries()) {
    out[can] = {
      pageId: e.pageId,
      habitat: [...e.habitat],
      geographic: [...e.geographic],
      introduced: [...e.introduced],
      native: [...e.native],
      iucnStatus: e.iucnStatus,
      extinctionStatus: e.extinctionStatus,
      populationTrend: e.populationTrend,
    };
  }
  return out;
}

function mergeIntoFamilyFile(famPath, perSpecies) {
  const fam = JSON.parse(fs.readFileSync(famPath, 'utf8'));
  let matched = 0;
  for (const sp of (fam.insects || [])) {
    const can = canonicalize(sp.scientificName);
    if (!can) continue;
    const data = perSpecies[can];
    if (!data) continue;
    matched += 1;
    if (!sp.eol || typeof sp.eol !== 'object') sp.eol = {};
    if (data.pageId && !sp.eol.pageId) sp.eol.pageId = data.pageId;
    sp.eol.canonical = can;
    if (data.habitat.length) sp.eol.habitat = data.habitat;
    if (data.geographic.length) sp.eol.geographic = data.geographic;
    if (data.introduced.length) sp.eol.introduced = data.introduced;
    if (data.native.length) sp.eol.nativeRange = data.native;
    if (data.iucnStatus) sp.eol.iucnStatus = data.iucnStatus;
    if (data.extinctionStatus) sp.eol.extinctionStatus = data.extinctionStatus;
    if (data.populationTrend) sp.eol.populationTrend = data.populationTrend;
    sp.eol.traitsFetchedAt = new Date().toISOString();
    sp.eol.traitsSchemaVersion = SCHEMA_VERSION;
  }
  fs.writeFileSync(famPath, JSON.stringify(fam, null, 2), 'utf8');
  return matched;
}

async function processFamily(opts, fam, idx, total) {
  const data = JSON.parse(fs.readFileSync(fam.path, 'utf8'));
  const insects = data.insects || [];
  const canSet = new Set();
  for (const sp of insects) {
    const c = canonicalize(sp.scientificName);
    if (c) canSet.add(c);
  }
  const canonicals = [...canSet];
  if (!canonicals.length) {
    console.log(`[${idx}/${total}] ${fam.key} (${data.family?.scientificName || ''}, 0종) — skip`);
    return { matched: 0, withIucn: 0, withHabitat: 0, withGeo: 0 };
  }
  const rows = await fetchTraitsForCanonicals(opts, canonicals, TARGET_PREDICATES);
  const perSpecies = buildPerSpecies(rows);
  const matched = mergeIntoFamilyFile(fam.path, perSpecies);

  // 통계
  let withIucn = 0, withHabitat = 0, withGeo = 0;
  for (const v of Object.values(perSpecies)) {
    if (v.iucnStatus) withIucn += 1;
    if (v.habitat.length) withHabitat += 1;
    if (v.geographic.length) withGeo += 1;
  }
  console.log(`[${idx}/${total}] ${fam.key} (${data.family?.scientificName || ''}, ${insects.length}종) ... OK 매칭=${matched}/${insects.length}, IUCN=${withIucn}, 서식지=${withHabitat}, 분포=${withGeo}`);
  return { matched, withIucn, withHabitat, withGeo };
}

async function main() {
  const opts = parseArgs();
  const families = listFamilies();
  console.log(`총 family: ${families.length}, delay: ${opts.delayMs}ms`);

  const state = loadState();

  let totalMatched = 0, totalIucn = 0, totalHabitat = 0, totalGeo = 0, totalCalls = 0;

  for (let i = 0; i < families.length; i += 1) {
    const fam = families[i];
    if (opts.only && fam.key !== opts.only) continue;
    if (!opts.force && state.families[fam.key]?.completed) {
      const s = state.families[fam.key];
      totalMatched += s.matched || 0;
      totalIucn += s.withIucn || 0;
      totalHabitat += s.withHabitat || 0;
      totalGeo += s.withGeo || 0;
      console.log(`[${i + 1}/${families.length}] ${fam.key} — 캐시됨 skip`);
      continue;
    }

    try {
      const r = await processFamily(opts, fam, i + 1, families.length);
      state.families[fam.key] = {
        completed: true,
        completedAt: new Date().toISOString(),
        ...r,
      };
      totalCalls += 1;
      totalMatched += r.matched;
      totalIucn += r.withIucn;
      totalHabitat += r.withHabitat;
      totalGeo += r.withGeo;
      state.totals.calls = (state.totals.calls || 0) + 1;
      state.totals.matched = (state.totals.matched || 0) + r.matched;
      saveState(state);
    } catch (err) {
      console.error(`[${i + 1}/${families.length}] ${fam.key} — ERROR: ${err.message}`);
      state.families[fam.key] = {
        completed: false,
        error: err.message,
        failedAt: new Date().toISOString(),
      };
      saveState(state);
    }

    await sleep(opts.delayMs);
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('EOL family traits 캐싱 완료');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('이번 세션 호출:', totalCalls);
  console.log('총 매칭 종    :', totalMatched.toLocaleString());
  console.log('  IUCN 등급   :', totalIucn.toLocaleString());
  console.log('  서식지      :', totalHabitat.toLocaleString());
  console.log('  분포        :', totalGeo.toLocaleString());
}

main().catch((err) => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
