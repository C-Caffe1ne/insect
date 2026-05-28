#!/usr/bin/env node
// GBIF Backbone Taxonomy의 잠자리목(Odonata) 종 데이터를 일괄 캐싱한다.
// 대상: project/taxonomy/families/odonata/*.json의 모든 insect.
//
// 각 종에 대해 최대 5개 엔드포인트 호출:
//   1) /species/match     — canonical 매칭 + usageKey
//   2) /species/{key}     — authorship, basionym, publishedIn 등 상세
//   3) /species/{key}/vernacularNames  — 다국어 통명
//   4) /species/{key}/distributions    — 분포 지역
//   5) /species/{key}/media            — 이미지 URL + 라이센스
//
// 결과는 각 family JSON의 insect.gbif 필드에 병합한다. rate limit 미상이라
// 보수적으로 종당 1초 (5콜 × 200ms) 간격으로 진행한다.
//
// 사용: node cached/cache_gbif_odonata.mjs [--delay-ms 200] [--limit N] [--dry-run]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ODONATA_DIR = path.join(ROOT, 'project', 'taxonomy', 'families', 'odonata');

const GBIF_BASE = 'https://api.gbif.org/v1';
// v2: descriptions 필드 추가
const SCHEMA_VERSION = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    delayMs: 200,
    timeoutMs: 15000,
    retries: 3,
    limit: 0,
    dryRun: false,
    mediaLimit: 5,
    vernacularLimit: 20,
    distributionLimit: 30,
    descriptionLimit: 30,
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--delay-ms') opts.delayMs = Number(args[++i] || opts.delayMs);
    else if (a === '--timeout-ms') opts.timeoutMs = Number(args[++i] || opts.timeoutMs);
    else if (a === '--retries') opts.retries = Number(args[++i] || opts.retries);
    else if (a === '--limit') opts.limit = Number(args[++i] || 0);
    else if (a === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

// 학명 정규화 — EOL 스크립트와 동일 로직
// "Adalia (Adalia) bipunctata (Linnaeus, 1758)" → "Adalia bipunctata"
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
          'User-Agent': 'ENTOMA-KR/1.0 (Korea Insect Encyclopedia; research use)',
        },
      });
      clearTimeout(timer);
      if (res.status === 429) {
        // Rate limit hit — exponential backoff
        const wait = 1000 * attempt;
        console.warn(`  [429] rate limit hit — ${wait}ms 대기`);
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
      await sleep(500 * attempt);
    }
  }
  throw lastErr;
}

async function matchSpecies(opts, canonical) {
  const url = `${GBIF_BASE}/species/match?name=${encodeURIComponent(canonical)}&kingdom=Animalia&class=Insecta`;
  return gbifGet(url, opts);
}

async function fetchSpeciesDetail(opts, key) {
  return gbifGet(`${GBIF_BASE}/species/${key}`, opts);
}

async function fetchVernaculars(opts, key, limit) {
  return gbifGet(`${GBIF_BASE}/species/${key}/vernacularNames?limit=${limit}`, opts);
}

async function fetchDistributions(opts, key, limit) {
  return gbifGet(`${GBIF_BASE}/species/${key}/distributions?limit=${limit}`, opts);
}

async function fetchMedia(opts, key, limit) {
  return gbifGet(`${GBIF_BASE}/species/${key}/media?limit=${limit}`, opts);
}

async function fetchDescriptions(opts, key, limit) {
  return gbifGet(`${GBIF_BASE}/species/${key}/descriptions?limit=${limit}`, opts);
}

// 다국어 통명을 언어별로 묶어서 압축
function summarizeVernaculars(payload) {
  if (!payload || !Array.isArray(payload.results)) return { ko: [], en: [], ja: [], byLang: {} };
  const byLang = {};
  for (const v of payload.results) {
    if (!v.language || !v.vernacularName) continue;
    const lang = v.language;
    if (!byLang[lang]) byLang[lang] = [];
    // 중복 제거
    if (!byLang[lang].includes(v.vernacularName)) byLang[lang].push(v.vernacularName);
  }
  return {
    ko: byLang.kor || [],
    en: byLang.eng || [],
    ja: byLang.jpn || [],
    byLang,
  };
}

// 분포 — 한국 관련 + NATIVE 우선, 그 외는 establishmentMeans별로 묶음
function summarizeDistributions(payload) {
  if (!payload || !Array.isArray(payload.results)) return { native: [], introduced: [], other: [], korea: [] };
  const native = [];
  const introduced = [];
  const other = [];
  const korea = [];
  for (const d of payload.results) {
    const entry = {
      locality: d.locality || d.locationId || '',
      locationId: d.locationId || '',
      establishmentMeans: d.establishmentMeans || '',
      source: d.source || '',
    };
    const localityLow = (d.locality || '').toLowerCase();
    const isKorea = /korea|kor|south korea/.test(localityLow) || d.locationId === 'KR' || d.locationId === 'KOR';
    if (isKorea) korea.push(entry);
    if (d.establishmentMeans === 'NATIVE') native.push(entry);
    else if (d.establishmentMeans === 'INTRODUCED') introduced.push(entry);
    else other.push(entry);
  }
  return { native, introduced, other, korea };
}

// 이미지 — URL + 라이센스만 추출
function summarizeMedia(payload) {
  if (!payload || !Array.isArray(payload.results)) return [];
  return payload.results
    .filter((m) => m.type === 'StillImage' && m.identifier)
    .map((m) => ({
      url: m.identifier,
      format: m.format || '',
      license: m.license || '',
      rightsHolder: m.rightsHolder || '',
      source: m.source || '',
      created: m.created || '',
    }));
}

// 설명 — type별로 묶고 언어별 그룹핑
function summarizeDescriptions(payload) {
  const out = { byType: {}, all: [] };
  if (!payload || !Array.isArray(payload.results)) return out;
  for (const d of payload.results) {
    const type = d.type || 'unknown';
    const entry = {
      type,
      description: d.description || '',
      language: d.language || '',
      source: d.source || '',
    };
    if (!out.byType[type]) out.byType[type] = [];
    out.byType[type].push(entry);
    out.all.push(entry);
  }
  return out;
}

async function processSpecies(opts, insect) {
  const raw = insect.scientificName || '';
  const canonical = canonicalize(raw);
  if (!canonical) {
    return { status: 'skip', reason: 'canonical empty' };
  }

  // ── Top-up 모드: 이미 GBIF 매칭이 있고 descriptions만 누락된 경우 ──
  // 1콜만 추가로 받아 기존 캐시에 descriptions 필드를 병합한다.
  if (insect.gbif && insect.gbif.usageKey && !insect.gbif.descriptions) {
    const key = insect.gbif.usageKey;
    const descPayload = await fetchDescriptions(opts, key, opts.descriptionLimit);
    return {
      status: 'topup',
      canonical,
      apiCalls: 1,
      fetchedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      patch: {
        descriptions: summarizeDescriptions(descPayload),
        descriptionsRaw: Array.isArray(descPayload?.results) ? descPayload.results.length : 0,
      },
    };
  }

  // ── 풀 처리 모드 ──
  // 1) match
  let apiCalls = 1;
  const matched = await matchSpecies(opts, canonical);
  if (!matched || !matched.usageKey || matched.matchType === 'NONE') {
    return { status: 'not_found', canonical, apiCalls };
  }
  if (opts.delayMs) await sleep(opts.delayMs);

  const key = matched.usageKey;

  // 2~6) detail + vernacular + distribution + media + descriptions (순차)
  const detail = await fetchSpeciesDetail(opts, key);
  apiCalls += 1;
  if (opts.delayMs) await sleep(opts.delayMs);

  const vernPayload = await fetchVernaculars(opts, key, opts.vernacularLimit);
  apiCalls += 1;
  if (opts.delayMs) await sleep(opts.delayMs);

  const distPayload = await fetchDistributions(opts, key, opts.distributionLimit);
  apiCalls += 1;
  if (opts.delayMs) await sleep(opts.delayMs);

  const mediaPayload = await fetchMedia(opts, key, opts.mediaLimit);
  apiCalls += 1;
  if (opts.delayMs) await sleep(opts.delayMs);

  const descPayload = await fetchDescriptions(opts, key, opts.descriptionLimit);
  apiCalls += 1;

  return {
    status: 'ok',
    canonical,
    apiCalls,
    fetchedAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    gbif: {
      usageKey: key,
      matchType: matched.matchType,
      confidence: matched.confidence,
      scientificName: detail?.scientificName || matched.scientificName,
      canonicalName: detail?.canonicalName || matched.canonicalName,
      authorship: detail?.authorship || '',
      basionym: detail?.basionym || null,
      publishedIn: detail?.publishedIn || null,
      rank: detail?.rank || matched.rank,
      taxonomicStatus: detail?.taxonomicStatus || matched.status,
      vernacularName: detail?.vernacularName || null,
      numDescendants: detail?.numDescendants ?? null,
      taxonomy: {
        kingdom: detail?.kingdom || matched.kingdom || null,
        phylum: detail?.phylum || matched.phylum || null,
        class: detail?.class || matched.class || null,
        order: detail?.order || matched.order || null,
        family: detail?.family || matched.family || null,
        genus: detail?.genus || matched.genus || null,
        species: detail?.species || matched.species || null,
      },
      vernaculars: summarizeVernaculars(vernPayload),
      distributions: summarizeDistributions(distPayload),
      media: summarizeMedia(mediaPayload),
      descriptions: summarizeDescriptions(descPayload),
      counts: {
        vernacularsRaw: Array.isArray(vernPayload?.results) ? vernPayload.results.length : 0,
        distributionsRaw: Array.isArray(distPayload?.results) ? distPayload.results.length : 0,
        mediaRaw: Array.isArray(mediaPayload?.results) ? mediaPayload.results.length : 0,
        descriptionsRaw: Array.isArray(descPayload?.results) ? descPayload.results.length : 0,
      },
    },
  };
}

async function main() {
  const opts = parseArgs();

  if (!fs.existsSync(ODONATA_DIR)) {
    console.error('odonata family 디렉토리가 없습니다:', ODONATA_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(ODONATA_DIR).filter((f) => f.endsWith('.json')).sort();
  console.log(`잠자리목(Odonata) family 파일: ${files.length}개`);
  console.log(`옵션: delay=${opts.delayMs}ms / retries=${opts.retries} / dryRun=${opts.dryRun}`);
  console.log('');

  let totalSpecies = 0;
  let okCount = 0;
  let nfCount = 0;
  let errCount = 0;
  let totalApiCalls = 0;
  const startTime = Date.now();

  // 종 데이터 통계 집계
  const stats = {
    withMedia: 0,
    withKoreanVernacular: 0,
    withDistribution: 0,
    withPublishedIn: 0,
    withBasionym: 0,
    withDescriptions: 0,
    totalMediaImages: 0,
    totalDescriptions: 0,
    descriptionTypes: new Map(),
    distinctLanguages: new Set(),
  };

  outer: for (const file of files) {
    const fp = path.join(ODONATA_DIR, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch (err) {
      console.warn(`SKIP (parse error): ${file} — ${err.message}`);
      continue;
    }

    const insects = Array.isArray(data.insects) ? data.insects : [];
    if (insects.length === 0) continue;

    const familyName = `${data.family?.commonName || ''} (${data.family?.scientificName || file})`;
    console.log(`\n▶ ${familyName} — ${insects.length}종`);

    let familyChanged = false;
    for (let i = 0; i < insects.length; i += 1) {
      const insect = insects[i];
      totalSpecies += 1;
      if (opts.limit > 0 && totalSpecies > opts.limit) {
        console.log(`\n[limit ${opts.limit} 도달 — 중단]`);
        break outer;
      }

      const canonical = canonicalize(insect.scientificName);
      // 이미 ok 캐시가 있고 schemaVersion이 동일하며 descriptions가 있으면 skip
      const hasFullV2 = insect.gbif && insect.gbifSchemaVersion === SCHEMA_VERSION && insect.gbif.usageKey && insect.gbif.descriptions;
      if (hasFullV2) {
        process.stdout.write(`  [${i + 1}/${insects.length}] ${canonical} ... cached(skip)\n`);
        okCount += 1;
        // 통계도 집계 (이미 저장된 데이터 기준)
        if (insect.gbif.media?.length > 0) stats.withMedia += 1;
        stats.totalMediaImages += insect.gbif.media?.length || 0;
        if (insect.gbif.vernaculars?.ko?.length > 0) stats.withKoreanVernacular += 1;
        const distAll = (insect.gbif.distributions?.native?.length || 0) + (insect.gbif.distributions?.introduced?.length || 0) + (insect.gbif.distributions?.other?.length || 0);
        if (distAll > 0) stats.withDistribution += 1;
        if (insect.gbif.publishedIn) stats.withPublishedIn += 1;
        if (insect.gbif.basionym) stats.withBasionym += 1;
        const descCount = insect.gbif.descriptions?.all?.length || 0;
        if (descCount > 0) stats.withDescriptions += 1;
        stats.totalDescriptions += descCount;
        for (const t of Object.keys(insect.gbif.descriptions?.byType || {})) {
          stats.descriptionTypes.set(t, (stats.descriptionTypes.get(t) || 0) + 1);
        }
        for (const lang of Object.keys(insect.gbif.vernaculars?.byLang || {})) stats.distinctLanguages.add(lang);
        continue;
      }

      process.stdout.write(`  [${i + 1}/${insects.length}] ${canonical} ... `);
      try {
        const result = await processSpecies(opts, insect);
        totalApiCalls += result.apiCalls || 0;
        if (result.status === 'ok') {
          okCount += 1;
          insect.gbif = result.gbif;
          insect.gbifFetchedAt = result.fetchedAt;
          insect.gbifSchemaVersion = SCHEMA_VERSION;
          familyChanged = true;
          const descCount = result.gbif.descriptions?.all?.length || 0;
          process.stdout.write(`OK (img=${result.gbif.media.length}, vern=${Object.keys(result.gbif.vernaculars.byLang).length}lang, dist=${result.gbif.distributions.native.length + result.gbif.distributions.introduced.length + result.gbif.distributions.other.length}, desc=${descCount})\n`);

          // 통계 집계
          if (result.gbif.media.length > 0) stats.withMedia += 1;
          stats.totalMediaImages += result.gbif.media.length;
          if (result.gbif.vernaculars.ko.length > 0) stats.withKoreanVernacular += 1;
          if (result.gbif.distributions.native.length + result.gbif.distributions.introduced.length + result.gbif.distributions.other.length > 0) stats.withDistribution += 1;
          if (result.gbif.publishedIn) stats.withPublishedIn += 1;
          if (result.gbif.basionym) stats.withBasionym += 1;
          if (descCount > 0) stats.withDescriptions += 1;
          stats.totalDescriptions += descCount;
          for (const t of Object.keys(result.gbif.descriptions.byType)) {
            stats.descriptionTypes.set(t, (stats.descriptionTypes.get(t) || 0) + 1);
          }
          for (const lang of Object.keys(result.gbif.vernaculars.byLang)) stats.distinctLanguages.add(lang);
        } else if (result.status === 'topup') {
          okCount += 1;
          insect.gbif.descriptions = result.patch.descriptions;
          if (insect.gbif.counts) insect.gbif.counts.descriptionsRaw = result.patch.descriptionsRaw;
          insect.gbifFetchedAt = result.fetchedAt;
          insect.gbifSchemaVersion = SCHEMA_VERSION;
          familyChanged = true;
          const descCount = result.patch.descriptions.all.length;
          process.stdout.write(`TOPUP desc=${descCount}\n`);

          // 통계 집계 (이미 캐시된 데이터 + 신규 desc)
          if (insect.gbif.media?.length > 0) stats.withMedia += 1;
          stats.totalMediaImages += insect.gbif.media?.length || 0;
          if (insect.gbif.vernaculars?.ko?.length > 0) stats.withKoreanVernacular += 1;
          const distAll = (insect.gbif.distributions?.native?.length || 0) + (insect.gbif.distributions?.introduced?.length || 0) + (insect.gbif.distributions?.other?.length || 0);
          if (distAll > 0) stats.withDistribution += 1;
          if (insect.gbif.publishedIn) stats.withPublishedIn += 1;
          if (insect.gbif.basionym) stats.withBasionym += 1;
          if (descCount > 0) stats.withDescriptions += 1;
          stats.totalDescriptions += descCount;
          for (const t of Object.keys(result.patch.descriptions.byType)) {
            stats.descriptionTypes.set(t, (stats.descriptionTypes.get(t) || 0) + 1);
          }
          for (const lang of Object.keys(insect.gbif.vernaculars?.byLang || {})) stats.distinctLanguages.add(lang);
        } else if (result.status === 'not_found') {
          nfCount += 1;
          insect.gbif = { status: 'not_found', canonical: result.canonical, attemptedAt: new Date().toISOString() };
          familyChanged = true;
          process.stdout.write('NOT FOUND\n');
        } else {
          process.stdout.write(`SKIP (${result.reason})\n`);
        }
      } catch (err) {
        errCount += 1;
        process.stdout.write(`ERROR — ${err.message}\n`);
      }

      // 다음 종 전 추가 휴식 (전체 5콜이 끝난 후)
      if (opts.delayMs) await sleep(opts.delayMs);
    }

    if (familyChanged && !opts.dryRun) {
      fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
      process.stdout.write(`  ✓ 저장됨: ${file}\n`);
    } else if (familyChanged && opts.dryRun) {
      process.stdout.write(`  (DRY-RUN — 저장 안 함)\n`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('잠자리목(Odonata) GBIF 캐싱 완료');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`처리 종:              ${totalSpecies}`);
  console.log(`  ok(매칭+상세):     ${okCount}`);
  console.log(`  not_found:         ${nfCount}`);
  console.log(`  error:             ${errCount}`);
  console.log(`API 호출 합계:        ${totalApiCalls}`);
  console.log(`평균 콜/종:           ${(totalApiCalls / Math.max(totalSpecies, 1)).toFixed(2)}`);
  console.log(`소요 시간:           ${elapsed}s`);
  console.log('');
  console.log('데이터 보유 분포:');
  console.log(`  이미지 보유 종:     ${stats.withMedia} (총 ${stats.totalMediaImages}장)`);
  console.log(`  한국어 통명 보유:   ${stats.withKoreanVernacular}`);
  console.log(`  분포 정보 보유:    ${stats.withDistribution}`);
  console.log(`  publishedIn 보유:  ${stats.withPublishedIn}`);
  console.log(`  basionym 보유:    ${stats.withBasionym}`);
  console.log(`  descriptions 보유: ${stats.withDescriptions} (총 ${stats.totalDescriptions}건)`);
  console.log(`  통명 언어 종류:    ${stats.distinctLanguages.size}개 (${[...stats.distinctLanguages].sort().slice(0, 15).join(', ')}${stats.distinctLanguages.size > 15 ? ' ...' : ''})`);
  if (stats.descriptionTypes.size > 0) {
    console.log(`  description 유형 분포 (상위 10):`);
    const sortedTypes = [...stats.descriptionTypes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [type, cnt] of sortedTypes) console.log(`    ${type.padEnd(35)} ${cnt} 종`);
  }
}

main().catch((err) => {
  console.error('치명적 오류:', err.message);
  process.exit(1);
});
