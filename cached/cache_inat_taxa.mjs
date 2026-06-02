#!/usr/bin/env node
// iNaturalist API에서 학명 기준 종 데이터를 캐싱한다.
// 대상: project/taxonomy/families/**/*.json의 모든 insect.
//
// 종당 최대 2 API 호출:
//   1) /v1/taxa?q={canonical}&iconic_taxa=Insecta — 검색 (이미지/속성)
//   2) /v1/taxa/{id}                              — 상세 (wikipedia_summary 등)
//
// 결과: insect.inatTaxon 필드(기존 insect.inat과 별도)
//   {
//     schemaVersion, fetchedAt,
//     taxonId, preferredCommonName, observationsCount, wikipediaUrl,
//     defaultPhoto: { mediumUrl, originalUrl, license, attribution, attributionName },
//     wikipediaSummary, // HTML 텍스트
//   }
//   또는 { status: 'not_found' }
//
// Rate limit: iNat 권장 ~100 req/min. 보수적으로 350ms delay (=~170/min).
// 일시정지/재개: state 파일 + 종별 skip 로직 → 어디서 끊겨도 다음 실행 시 이어짐.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FAMILIES_DIR = path.join(ROOT, 'project', 'taxonomy', 'families');
const STATE_FILE = path.join(__dirname, 'inat_taxa_state.json');

const INAT_BASE = 'https://api.inaturalist.org/v1';
const SCHEMA_VERSION = 1;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    delayMs: 350,
    timeoutMs: 20000,
    retries: 3,
    limit: 0,
    dryRun: false,
    skipDetail: false,  // true면 wikipedia_summary 호출 생략 (호출 절반)
    startOrder: '',
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--delay-ms') opts.delayMs = Number(args[++i] || opts.delayMs);
    else if (a === '--timeout-ms') opts.timeoutMs = Number(args[++i] || opts.timeoutMs);
    else if (a === '--retries') opts.retries = Number(args[++i] || opts.retries);
    else if (a === '--limit') opts.limit = Number(args[++i] || 0);
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--skip-detail') opts.skipDetail = true;
    else if (a === '--start-order') opts.startOrder = args[++i] || '';
  }
  return opts;
}

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
    return { totalCalls: 0, lastUpdated: null };
  }
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { totalCalls: 0, lastUpdated: null }; }
}
function saveState(s) {
  s.lastUpdated = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf8');
}

async function inatGet(url, opts) {
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
          'User-Agent': 'ENTOMA-KR/1.0 (https://github.com/C-Caffe1ne/insect; Korean Insect Encyclopedia research; respectful rate)',
        },
      });
      clearTimeout(timer);
      if (res.status === 429) {
        const wait = 3000 * attempt;
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
      await sleep(800 * attempt);
    }
  }
  throw lastErr;
}

async function searchTaxon(opts, canonical) {
  const url = new URL(`${INAT_BASE}/taxa`);
  url.searchParams.set('q', canonical);
  url.searchParams.set('rank', 'species');
  url.searchParams.set('is_active', 'true');
  url.searchParams.set('iconic_taxa', 'Insecta');
  url.searchParams.set('per_page', '1');
  return inatGet(url.toString(), opts);
}

async function fetchTaxonDetail(opts, id) {
  return inatGet(`${INAT_BASE}/taxa/${id}`, opts);
}

function extractSearchResult(payload, canonical) {
  if (!payload?.results?.length) return null;
  const r = payload.results[0];
  // 매칭 품질 확인 — name이 canonical과 (대소문자 무시) 일치해야 함
  if (!r.name) return null;
  if (r.name.toLowerCase() !== canonical.toLowerCase()) {
    // 부분 매칭은 신뢰도 낮음 — 거절
    return null;
  }
  return {
    taxonId: r.id,
    preferredCommonName: r.preferred_common_name || null,
    observationsCount: r.observations_count || 0,
    wikipediaUrl: r.wikipedia_url || null,
    defaultPhoto: r.default_photo ? {
      mediumUrl: r.default_photo.medium_url || r.default_photo.url,
      squareUrl: r.default_photo.square_url || null,
      originalDimensions: r.default_photo.original_dimensions || null,
      license: r.default_photo.license_code || null,
      attribution: r.default_photo.attribution || null,
      attributionName: r.default_photo.attribution_name || null,
    } : null,
  };
}

function extractDetailResult(payload) {
  if (!payload?.results?.length) return {};
  const r = payload.results[0];
  return {
    wikipediaSummary: r.wikipedia_summary || null,
    taxonPhotos: Array.isArray(r.taxon_photos) ? r.taxon_photos.slice(0, 5).map((tp) => ({
      mediumUrl: tp.photo?.medium_url || tp.photo?.url || null,
      largeUrl: tp.photo?.large_url || null,
      license: tp.photo?.license_code || null,
      attribution: tp.photo?.attribution || null,
      attributionName: tp.photo?.attribution_name || null,
    })).filter((p) => p.mediumUrl) : [],
  };
}

function walkFamilyFiles(rootDir) {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  for (const order of fs.readdirSync(rootDir).sort()) {
    const orderPath = path.join(rootDir, order);
    if (!fs.statSync(orderPath).isDirectory()) continue;
    for (const fname of fs.readdirSync(orderPath).filter((n) => n.endsWith('.json')).sort()) {
      out.push({ orderId: order, familyFile: fname, fullPath: path.join(orderPath, fname) });
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs();
  const state = loadState();
  const families = walkFamilyFiles(FAMILIES_DIR);
  console.log(`family JSON 파일: ${families.length}개`);
  console.log(`옵션: delay=${opts.delayMs}ms / 종당 최대 ${opts.skipDetail ? 1 : 2}콜 / 누적 호출: ${state.totalCalls}`);
  console.log('');

  let processedCount = 0;
  let okCount = 0, nfCount = 0, errCount = 0, skipCount = 0;
  let apiCalls = 0;
  const startTime = Date.now();

  const stats = {
    withPhoto: 0,
    withWikiSummary: 0,
    withKoreanCommonName: 0,
  };

  let startSeen = !opts.startOrder;

  outer: for (const { orderId, familyFile, fullPath } of families) {
    if (!startSeen) {
      if (orderId === opts.startOrder) startSeen = true;
      else continue;
    }

    let data;
    try { data = JSON.parse(fs.readFileSync(fullPath, 'utf8')); }
    catch (err) { console.warn(`SKIP (parse): ${orderId}/${familyFile} — ${err.message}`); continue; }

    const insects = Array.isArray(data.insects) ? data.insects : [];
    if (insects.length === 0) continue;

    let familyChanged = false;
    let familyOk = 0, familyNf = 0;
    const familyName = `${data.family?.commonName || ''} (${data.family?.scientificName || familyFile})`;
    process.stdout.write(`\n▶ ${orderId}/${familyName} — ${insects.length}종\n`);

    for (let i = 0; i < insects.length; i += 1) {
      const ins = insects[i];
      processedCount += 1;
      if (opts.limit > 0 && processedCount > opts.limit) {
        process.stdout.write(`\n[limit ${opts.limit} 도달 — 중단]\n`);
        break outer;
      }

      // 이미 캐시된 종은 skip
      if (ins.inatTaxon?.schemaVersion === SCHEMA_VERSION) {
        skipCount += 1;
        continue;
      }

      const canonical = canonicalize(ins.scientificName);
      if (!canonical) continue;

      process.stdout.write(`  [${i + 1}/${insects.length}] ${canonical} ... `);
      try {
        // 1) 검색
        const searchPayload = await searchTaxon(opts, canonical);
        apiCalls += 1;
        state.totalCalls = (state.totalCalls || 0) + 1;
        const searchHit = extractSearchResult(searchPayload, canonical);

        if (!searchHit) {
          ins.inatTaxon = {
            schemaVersion: SCHEMA_VERSION,
            status: 'not_found',
            attemptedAt: new Date().toISOString(),
          };
          familyChanged = true;
          nfCount += 1; familyNf += 1;
          process.stdout.write('NOT FOUND\n');
          if (opts.delayMs) await sleep(opts.delayMs);
          continue;
        }

        // 2) 상세 (옵션: skip 가능)
        let detail = {};
        if (!opts.skipDetail) {
          if (opts.delayMs) await sleep(opts.delayMs);
          const detailPayload = await fetchTaxonDetail(opts, searchHit.taxonId);
          apiCalls += 1;
          state.totalCalls += 1;
          detail = extractDetailResult(detailPayload);
        }

        ins.inatTaxon = {
          schemaVersion: SCHEMA_VERSION,
          fetchedAt: new Date().toISOString(),
          ...searchHit,
          ...detail,
        };
        familyChanged = true;
        okCount += 1; familyOk += 1;

        if (ins.inatTaxon.defaultPhoto?.mediumUrl) stats.withPhoto += 1;
        if (ins.inatTaxon.wikipediaSummary) stats.withWikiSummary += 1;
        if (/[가-힣]/.test(ins.inatTaxon.preferredCommonName || '')) stats.withKoreanCommonName += 1;

        const imgFlag = ins.inatTaxon.defaultPhoto ? 'P' : '-';
        const sumFlag = ins.inatTaxon.wikipediaSummary ? 'S' : '-';
        process.stdout.write(`OK [${imgFlag}${sumFlag}] taxon=${searchHit.taxonId} (obs=${searchHit.observationsCount})\n`);
      } catch (err) {
        errCount += 1;
        ins.inatTaxon = {
          schemaVersion: SCHEMA_VERSION,
          status: 'error',
          error: err.message,
          attemptedAt: new Date().toISOString(),
        };
        process.stdout.write(`ERROR — ${err.message}\n`);
      }

      // family 단위로 incremental save (3종마다)
      if (familyChanged && (i % 3 === 2 || i === insects.length - 1)) {
        if (!opts.dryRun) {
          fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
        }
      }

      if (opts.delayMs) await sleep(opts.delayMs);
    }

    // family 완료 후 최종 저장 + 상태 저장
    if (familyChanged && !opts.dryRun) {
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    }
    saveState(state);
    process.stdout.write(`  ✓ family 완료: ok=${familyOk}, nf=${familyNf} | 누적: ok=${okCount}, nf=${nfCount}, err=${errCount}, skip=${skipCount} | calls=${apiCalls}\n`);
  }

  saveState(state);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('iNaturalist 캐싱 완료');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`처리:           ${processedCount}종`);
  console.log(`  ok:           ${okCount}`);
  console.log(`  not_found:    ${nfCount}`);
  console.log(`  error:        ${errCount}`);
  console.log(`  skipped:      ${skipCount} (이미 캐시됨)`);
  console.log(`API 호출:       ${apiCalls}`);
  console.log(`소요 시간:       ${elapsed}s`);
  console.log('');
  console.log('데이터 보유:');
  console.log(`  사진 보유 종:        ${stats.withPhoto}`);
  console.log(`  wikipedia_summary:   ${stats.withWikiSummary}`);
  console.log(`  한국어 통명(iNat):   ${stats.withKoreanCommonName}`);
}

main().catch((err) => {
  console.error('치명적 오류:', err.message);
  process.exit(1);
});
