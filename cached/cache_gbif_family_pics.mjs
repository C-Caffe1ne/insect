#!/usr/bin/env node
// GBIF occurrence API에서 family 단위로 학명·이미지·라이센스를 일괄 수집한다.
// 각 family마다:
//   1) /species/match (1콜) — family 학명 → familyKey
//   2) /occurrence/search?taxonKey=familyKey&mediaType=StillImage&country=KR (1콜)
//   3) (선택) 매칭 종이 family 종수의 30% 미만이면 글로벌(country 미지정)로 1콜 추가
// 응답을 species canonical로 그룹핑해 각 insect의 학명과 매칭, taxonomy 폴더의
// family JSON insects[]에 insect.gbifPics 필드를 추가한다.
//
// 출력 필드 (insect.gbifPics):
//   { schemaVersion, fetchedAt, country, photos:[{url, license, rightsHolder,
//     recordedBy, datasetName, occurrenceKey, occurrenceUrl, country, eventDate}] }
//
// 사용:
//   node cached/cache_gbif_family_pics.mjs [--delay-ms 400] [--limit-per-family 300]
//                                          [--global-only] [--kr-only]
//                                          [--limit-families N] [--force]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FAMILIES_DIR = path.join(ROOT, 'project', 'taxonomy', 'families');
const STATE_FILE = path.join(__dirname, 'gbif_family_pics_state.json');

const GBIF = 'https://api.gbif.org/v1';
const SCHEMA = 1;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    delayMs: 400,
    timeoutMs: 30000,
    retries: 3,
    limitPerFamily: 300,
    globalOnly: false,
    krOnly: false,
    limitFamilies: 0,
    force: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--delay-ms') opts.delayMs = Number(args[++i] || opts.delayMs);
    else if (a === '--timeout-ms') opts.timeoutMs = Number(args[++i] || opts.timeoutMs);
    else if (a === '--retries') opts.retries = Number(args[++i] || opts.retries);
    else if (a === '--limit-per-family') opts.limitPerFamily = Number(args[++i] || opts.limitPerFamily);
    else if (a === '--global-only') opts.globalOnly = true;
    else if (a === '--kr-only') opts.krOnly = true;
    else if (a === '--limit-families') opts.limitFamilies = Number(args[++i] || 0);
    else if (a === '--force') opts.force = true;
  }
  return opts;
}

// canonical 정규화 (다른 스크립트와 동일)
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

async function gbifGet(url, opts) {
  const retries = Math.max(1, opts.retries);
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ENTOMA-KR/1.0 (Korean Insect Encyclopedia research; family-level image collection)',
        },
      });
      clearTimeout(timer);
      if (res.status === 429) {
        const wait = 2000 * attempt;
        console.warn(`  [429] rate limit — ${wait}ms 대기`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt === retries) break;
      await sleep(700 * attempt);
    }
  }
  throw lastErr;
}

async function matchFamilyKey(opts, familySci) {
  if (!familySci) return null;
  const u = new URL(`${GBIF}/species/match`);
  u.searchParams.set('name', familySci);
  u.searchParams.set('rank', 'family');
  u.searchParams.set('kingdom', 'Animalia');
  const data = await gbifGet(u, opts);
  if (data?.usageKey && data.rank === 'FAMILY') return data.usageKey;
  return null;
}

async function fetchFamilyOccurrences(opts, familyKey, country) {
  const u = new URL(`${GBIF}/occurrence/search`);
  u.searchParams.set('taxonKey', String(familyKey));
  u.searchParams.set('mediaType', 'StillImage');
  u.searchParams.set('limit', String(opts.limitPerFamily));
  if (country) u.searchParams.set('country', country);
  const data = await gbifGet(u, opts);
  return data?.results || [];
}

function groupBySpecies(occurrences) {
  const map = new Map();
  for (const oc of occurrences) {
    const sci = oc.species || oc.acceptedScientificName || oc.scientificName || '';
    const canon = canonicalize(sci);
    if (!canon) continue;
    if (!Array.isArray(oc.media)) continue;
    for (const m of oc.media) {
      if (m.type !== 'StillImage' || !m.identifier) continue;
      if (!map.has(canon)) map.set(canon, []);
      const list = map.get(canon);
      if (list.some((x) => x.url === m.identifier)) continue;
      list.push({
        url: m.identifier,
        license: oc.license || null,
        rightsHolder: oc.rightsHolder || oc.recordedBy || null,
        recordedBy: oc.recordedBy || null,
        datasetName: oc.datasetName || null,
        datasetKey: oc.datasetKey || null,
        occurrenceKey: oc.key,
        occurrenceUrl: oc.key ? `https://www.gbif.org/occurrence/${oc.key}` : null,
        country: oc.country || null,
        eventDate: oc.eventDate || null,
      });
    }
  }
  return map;
}

function mergePics(familyData, picsBySpecies, country) {
  let matched = 0;
  let totalImg = 0;
  for (const insect of (familyData.insects || [])) {
    const canon = canonicalize(insect.scientificName);
    if (!canon) continue;
    const pics = picsBySpecies.get(canon);
    if (!pics || pics.length === 0) continue;
    const photos = pics.slice(0, 3);
    insect.gbifPics = {
      schemaVersion: SCHEMA,
      fetchedAt: new Date().toISOString(),
      country: country || 'global',
      photos,
    };
    matched += 1;
    totalImg += photos.length;
  }
  return { matched, totalImg };
}

function walkFamilyFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const order of fs.readdirSync(dir).sort()) {
    const op = path.join(dir, order);
    if (!fs.statSync(op).isDirectory()) continue;
    for (const fname of fs.readdirSync(op).filter((n) => n.endsWith('.json')).sort()) {
      out.push({ orderId: order, familyFile: fname, fullPath: path.join(op, fname) });
    }
  }
  return out;
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) return { families: {}, totalCalls: 0 };
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { families: {}, totalCalls: 0 }; }
}
function saveState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
}

async function main() {
  const opts = parseArgs();
  const families = walkFamilyFiles(FAMILIES_DIR);
  console.log(`family 파일: ${families.length} / limitPerFamily=${opts.limitPerFamily} / delay=${opts.delayMs}ms`);
  console.log(`모드: ${opts.globalOnly ? 'global only' : (opts.krOnly ? 'KR only' : 'KR + global 폴백')}`);
  console.log('');

  const state = loadState();
  state.families = state.families || {};

  let processed = 0;
  let totalApiCalls = 0;
  let totalFamilyKey = 0;
  let totalMatchedSpecies = 0;
  let totalImages = 0;
  let totalNoMatch = 0;
  const licenseDist = {};

  for (const { orderId, familyFile, fullPath } of families) {
    if (opts.limitFamilies > 0 && processed >= opts.limitFamilies) break;
    processed += 1;

    const familyKey = `${orderId}/${familyFile.replace('.json', '')}`;
    let data;
    try { data = JSON.parse(fs.readFileSync(fullPath, 'utf8')); }
    catch (err) { console.warn(`SKIP (parse): ${familyKey} — ${err.message}`); continue; }

    const familySci = data.family?.scientificName || '';
    const insectCount = (data.insects || []).length;
    if (!familySci || insectCount === 0) continue;

    // 기존 캐시 (force가 아니면 skip)
    const cachedState = state.families[familyKey];
    if (!opts.force && cachedState && cachedState.schemaVersion === SCHEMA && cachedState.completed) {
      console.log(`[${processed}/${families.length}] ${familyKey} (${familySci}) — 캐시됨 skip`);
      continue;
    }

    process.stdout.write(`[${processed}/${families.length}] ${familyKey} (${familySci}, ${insectCount}종) ... `);

    let fkey = cachedState?.familyKey;
    try {
      if (!fkey) {
        fkey = await matchFamilyKey(opts, familySci);
        totalApiCalls += 1;
        if (opts.delayMs) await sleep(opts.delayMs);
      }
      if (!fkey) {
        process.stdout.write('NO familyKey\n');
        state.families[familyKey] = { schemaVersion: SCHEMA, attemptedAt: new Date().toISOString(), familyKey: null, completed: true, matched: 0 };
        saveState(state);
        continue;
      }
      totalFamilyKey += 1;

      // 1차: KR
      let allOcc = [];
      let chosenCountry = null;
      if (!opts.globalOnly) {
        const krOcc = await fetchFamilyOccurrences(opts, fkey, 'KR');
        totalApiCalls += 1;
        if (opts.delayMs) await sleep(opts.delayMs);
        allOcc = allOcc.concat(krOcc);
        chosenCountry = 'KR';
      }

      // 1차 매칭 평가
      const insectCanons = new Set((data.insects || []).map((i) => canonicalize(i.scientificName)).filter(Boolean));
      const matchedAfterKr = new Set(allOcc
        .map((oc) => canonicalize(oc.species || oc.acceptedScientificName || oc.scientificName || ''))
        .filter((c) => insectCanons.has(c))).size;
      const krCoverage = insectCanons.size > 0 ? matchedAfterKr / insectCanons.size : 0;

      // 2차: 글로벌 (KR 매칭이 30% 미만이거나 globalOnly)
      if (opts.globalOnly || (!opts.krOnly && krCoverage < 0.30)) {
        const globalOcc = await fetchFamilyOccurrences(opts, fkey, null);
        totalApiCalls += 1;
        if (opts.delayMs) await sleep(opts.delayMs);
        allOcc = allOcc.concat(globalOcc);
        chosenCountry = chosenCountry === 'KR' ? 'KR+global' : 'global';
      }

      const picsBySpecies = groupBySpecies(allOcc);
      const { matched, totalImg } = mergePics(data, picsBySpecies, chosenCountry);

      // 라이센스 분포 집계 (3장 캡 일치)
      for (const [, pics] of picsBySpecies.entries()) {
        for (const p of pics.slice(0, 3)) {
          const lic = p.license || '(unknown)';
          licenseDist[lic] = (licenseDist[lic] || 0) + 1;
        }
      }

      if (matched > 0) {
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      }
      state.families[familyKey] = {
        schemaVersion: SCHEMA, completed: true,
        familyKey: fkey, matched, totalImg, country: chosenCountry,
        completedAt: new Date().toISOString(),
      };
      state.totalCalls = totalApiCalls + (state.totalCalls || 0);
      saveState(state);

      totalMatchedSpecies += matched;
      totalImages += totalImg;
      if (matched === 0) totalNoMatch += 1;

      process.stdout.write(`OK [${chosenCountry}] 매칭=${matched}/${insectCount}, 이미지=${totalImg}\n`);
    } catch (err) {
      process.stdout.write(`ERROR — ${err.message}\n`);
      state.families[familyKey] = {
        schemaVersion: SCHEMA, error: err.message,
        attemptedAt: new Date().toISOString(),
      };
      saveState(state);
    }
  }

  // 최종 통계
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('GBIF family 이미지 수집 완료');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`처리 family: ${processed}`);
  console.log(`API 호출: ${totalApiCalls}`);
  console.log(`familyKey 매칭: ${totalFamilyKey}/${processed}`);
  console.log(`매칭 종: ${totalMatchedSpecies}`);
  console.log(`수집 이미지: ${totalImages}`);
  console.log(`매칭 0 family: ${totalNoMatch}`);
  console.log('');
  console.log('라이센스 분포 (상위 10):');
  Object.entries(licenseDist)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([k, v]) => console.log(`  ${(k || '').slice(0, 60).padEnd(60)} ${v}`));
}

main().catch((err) => {
  console.error('치명적 오류:', err.message);
  process.exit(1);
});
