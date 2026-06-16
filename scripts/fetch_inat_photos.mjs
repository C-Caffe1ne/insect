/**
 * iNaturalist 사진 캐싱 스크립트
 * 출력: project/inat_photo_cache.json
 *
 * 구조: { "Genus species": [{url, license, attribution}, ...] }
 * URL 크기: medium (500px)
 *
 * 전략:
 *  1) /v1/taxa?q=... → taxon_id + default_photo (license 포함)
 *  2) /v1/observations?taxon_id=...&license=...&photos=true → 추가 사진
 *  BATCH_SIZE=3, DELAY=900ms → rate limit 회피
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SEARCH_INDEX = path.join(ROOT, 'project/search_index.json');
const OUTPUT = path.join(ROOT, 'project/inat_photo_cache.json');

const INAT_BASE = 'https://api.inaturalist.org/v1';
const PHOTOS_PER_SPECIES = 3;
const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 900;
const TIMEOUT_MS = 12000;
const MAX_RETRY = 2;
const HEADERS = { 'User-Agent': 'ENTOMA-KR/1.0 (hwanghs5290@gmail.com)' };
const OPEN_LICENSES = 'cc-by,cc-by-nc,cc-by-sa,cc-by-nc-sa,cc0';

const anthropic = new Anthropic();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Claude 비전으로 이미지에 곤충 형태가 선명하게 보이는지 검증.
 * 네트워크/API 오류 시 true 반환 (수집 중단 방지).
 */
async function isInsectVisible(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const imgRes = await fetch(url, { signal: controller.signal, headers: HEADERS });
    clearTimeout(timer);
    if (!imgRes.ok) return false;

    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const rawType = imgRes.headers.get('content-type') || '';
    const mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      .find(t => rawType.includes(t)) || 'image/jpeg');

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: '이 사진에서 곤충의 몸 형태(머리·흉부·복부·다리·날개 등)가 명확하게 보이나요? 예 또는 아니오로만 답하세요.' },
        ],
      }],
    });

    const answer = (msg.content[0]?.text || '').trim();
    return answer.startsWith('예') || /^yes/i.test(answer);
  } catch {
    return true;
  }
}

async function apiFetch(url, retryCount = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: HEADERS });
    clearTimeout(timer);
    if (res.status === 429) {
      if (retryCount < MAX_RETRY) {
        await sleep(3000 * (retryCount + 1));
        return apiFetch(url, retryCount + 1);
      }
      return null;
    }
    return res.ok ? res.json() : null;
  } catch {
    clearTimeout(timer);
    if (retryCount < MAX_RETRY) {
      await sleep(1500 * (retryCount + 1));
      return apiFetch(url, retryCount + 1);
    }
    return null;
  }
}

function toMediumUrl(url) {
  if (!url) return null;
  return url
    .replace(/\/square(\.\w+)$/, '/medium$1')
    .replace(/\/square$/, '/medium')
    .replace(/square(\.\w+)$/, 'medium$1');
}

/** step1: taxa 검색으로 taxon_id + default_photo 획득 */
async function getTaxon(genusSpecies) {
  const data = await apiFetch(
    `${INAT_BASE}/taxa?q=${encodeURIComponent(genusSpecies)}&rank=species&per_page=5`
  );
  if (!data?.results?.length) return null;

  const [genus, species] = genusSpecies.toLowerCase().split(' ');
  const match = data.results.find(t => {
    const n = t.name.toLowerCase();
    return n === `${genus} ${species}` || n.startsWith(`${genus} ${species}`);
  }) || data.results[0];

  const dp = match.default_photo;
  return {
    id: match.id,
    defaultPhoto: dp ? {
      url: toMediumUrl(dp.medium_url || dp.url),
      license: dp.license_code || '',
      attribution: dp.attribution || '',
    } : null,
  };
}

function extractAuthor(attribution) {
  if (!attribution) return '';
  if (/^no rights reserved/i.test(attribution)) return 'cc0';
  const m = attribution.match(/^\(c\)\s+(.+?)(?:,\s+(?:some|all)\s+rights|$)/i);
  return m ? m[1].trim().toLowerCase() : attribution.toLowerCase();
}

/** step2: taxon_id 기반 관찰 사진 목록 획득 — 저작자 중복 없이 최대 PHOTOS_PER_SPECIES장 */
async function getObsPhotos(taxonId, excludeAuthors = new Set()) {
  const seenUrls = new Set();
  const seenAuthors = new Set(excludeAuthors);
  const photos = [];

  // 비전 검증으로 탈락하는 후보가 생기므로 최대 5페이지까지 탐색
  for (let page = 1; page <= 5 && photos.length < PHOTOS_PER_SPECIES; page++) {
    const params = new URLSearchParams({
      taxon_id: String(taxonId),
      license: OPEN_LICENSES,
      photos: 'true',
      per_page: '30',
      page: String(page),
      order: 'desc',
      order_by: 'votes',
    });
    const data = await apiFetch(`${INAT_BASE}/observations?${params}`);
    if (!data?.results?.length) break;

    for (const obs of data.results) {
      for (const photo of obs.photos || []) {
        const url = toMediumUrl(photo.url);
        if (!url || seenUrls.has(url)) continue;
        const author = extractAuthor(photo.attribution || '');
        if (seenAuthors.has(author)) continue;

        seenUrls.add(url);

        const visible = await isInsectVisible(url);
        if (!visible) {
          process.stdout.write(' [vision:skip]');
          continue;
        }

        seenAuthors.add(author);
        photos.push({
          url,
          license: photo.license_code || '',
          attribution: photo.attribution || '',
        });
        process.stdout.write(' [vision:ok]');
        if (photos.length >= PHOTOS_PER_SPECIES) return photos;
      }
    }
  }
  return photos;
}

async function fetchPhotosForSpecies(genusSpecies) {
  const taxon = await getTaxon(genusSpecies);
  if (!taxon) return [];

  const dp = taxon.defaultPhoto;
  const isOpen = dp?.license && dp.license !== 'c' && dp.license !== 'cc-by-nd';

  // default_photo 저작자를 먼저 등록해 obs 수집 시 중복 방지
  const defaultAuthor = (dp?.url && isOpen) ? extractAuthor(dp.attribution) : '';
  const excludeAuthors = defaultAuthor ? new Set([defaultAuthor]) : new Set();

  const obsPhotos = await getObsPhotos(taxon.id, excludeAuthors);

  // default_photo가 open license이면 앞에 삽입 (중복 URL 제외)
  const result = [...obsPhotos];
  if (dp?.url && isOpen && !result.some(p => p.url === dp.url)) {
    result.unshift(dp);
  }

  return result.slice(0, PHOTOS_PER_SPECIES);
}

async function main() {
  const raw = await fs.readFile(SEARCH_INDEX, 'utf-8');
  const { insects } = JSON.parse(raw);

  // 기존 캐시 로드 — 이미 새 구조({url,license,attribution})면 재사용, 구 구조(string[])면 재수집
  let cache = {};
  try {
    const existing = JSON.parse(await fs.readFile(OUTPUT, 'utf-8'));
    // 첫 번째 항목을 보고 구조 판별
    const firstVal = Object.values(existing)[0];
    if (Array.isArray(firstVal) && firstVal.length > 0 && typeof firstVal[0] === 'object') {
      cache = existing;
      console.log(`기존 캐시(새 구조) ${Object.keys(cache).length}종 로드됨`);
    } else {
      console.log('구 구조 캐시 감지 — 전체 재수집');
    }
  } catch {
    console.log('새 캐시 시작');
  }

  const todo = insects.filter(ins => {
    const key = [ins.g, ins.s].filter(Boolean).join(' ');
    return key && !(key in cache);
  });

  console.log(`처리 대상: ${todo.length}종 / 전체 ${insects.length}종`);
  console.log(`배치: ${BATCH_SIZE}개 병렬 / ${BATCH_DELAY_MS}ms 간격\n`);

  const startTime = Date.now();

  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async ins => {
      const key = [ins.g, ins.s].filter(Boolean).join(' ');
      cache[key] = await fetchPhotosForSpecies(key);
    }));

    const processed = i + batch.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = (processed / todo.length * 100).toFixed(1);
    const found = Object.values(cache).filter(v => v.length > 0).length;
    const eta = processed < todo.length
      ? Math.round((Date.now() - startTime) / processed * (todo.length - processed) / 1000)
      : 0;
    process.stdout.write(
      `\r[${elapsed}s] ${processed}/${todo.length} (${pct}%) | 사진 있음: ${found}종 | 남은 시간: ~${eta}s  `
    );

    if (i + BATCH_SIZE < todo.length) await sleep(BATCH_DELAY_MS);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const total = Object.keys(cache).length;
  const withPhotos = Object.values(cache).filter(v => v.length > 0).length;

  console.log(`\n\n=== 완료 (${elapsed}초) ===`);
  console.log(`총 ${total}종 | 사진 있음: ${withPhotos}종 | 없음: ${total - withPhotos}종`);

  // 라이선스 분포 통계
  const licDist = {};
  Object.values(cache).flat().forEach(p => {
    const l = p.license || 'unknown';
    licDist[l] = (licDist[l] || 0) + 1;
  });
  console.log('\n라이선스 분포:');
  Object.entries(licDist).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k.padEnd(20)} ${v}장`));

  await fs.writeFile(OUTPUT, JSON.stringify(cache, null, 2), 'utf-8');
  console.log(`\n저장: ${OUTPUT}`);

  const missing = Object.entries(cache).filter(([, v]) => v.length === 0).map(([k]) => k);
  if (missing.length) {
    console.log(`\n사진 없는 종 (${missing.length}개):`);
    missing.forEach(k => console.log(`  - ${k}`));
  }
}

main().catch(err => { console.error('\n오류:', err); process.exit(1); });
