#!/usr/bin/env node
// Wikipedia(영문판) API에서 이미지 없는 곤충의 이미지를 학명 기준으로 캐싱.
// 대상: project/taxonomy/families/**/*.json의 insect 중 inat.imageUrl 및
//      gbif.media[0].url, wiki.imageUrl 모두 없는 종.
//
// 호출: action=query&titles=A|B|C&prop=pageimages|pageterms (batch up to 50)
// 한 batch = 1 API 호출. 16,726종을 batch 20 기준 ~836콜로 처리.
//
// 결과는 각 family JSON의 insect.wiki 필드에 저장:
//   { title, imageUrl, originalUrl, pageUrl, description, fetchedAt }
//   { status: 'not_found', attemptedAt } (페이지 없음)
//   { status: 'no_image',  attemptedAt } (페이지는 있지만 이미지 없음)
//
// 사용: node cached/cache_wiki_images.mjs [--batch 20] [--delay-ms 300] [--limit N] [--dry-run]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FAMILIES_DIR = path.join(ROOT, 'project', 'taxonomy', 'families');

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const SCHEMA_VERSION = 1;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    batch: 20,
    delayMs: 300,
    timeoutMs: 20000,
    retries: 3,
    limit: 0,
    dryRun: false,
    thumbnailPx: 500,
  };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--batch') opts.batch = Math.min(50, Number(args[++i] || opts.batch));
    else if (a === '--delay-ms') opts.delayMs = Number(args[++i] || opts.delayMs);
    else if (a === '--timeout-ms') opts.timeoutMs = Number(args[++i] || opts.timeoutMs);
    else if (a === '--retries') opts.retries = Number(args[++i] || opts.retries);
    else if (a === '--limit') opts.limit = Number(args[++i] || 0);
    else if (a === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

// 학명 정규화 (EOL/GBIF 스크립트와 동일)
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

function hasAnyImage(insect) {
  if (insect.inat?.imageUrl) return true;
  if ((insect.gbif?.media?.length || 0) > 0) return true;
  if (insect.wiki?.imageUrl) return true;
  return false;
}

function alreadyChecked(insect) {
  // wiki 캐시가 있고(이미지든 not_found/no_image든) 동일 스키마면 skip
  return !!insect.wiki && insect.wiki.schemaVersion === SCHEMA_VERSION;
}

async function wikiBatch(opts, titles) {
  const url = new URL(WIKI_API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('titles', titles.join('|'));
  url.searchParams.set('prop', 'pageimages|pageterms');
  url.searchParams.set('piprop', 'original|thumbnail|name');
  url.searchParams.set('pithumbsize', String(opts.thumbnailPx));
  url.searchParams.set('pilimit', '50');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('redirects', '1'); // 자동 리디렉트 추적

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
          'User-Agent': 'ENTOMA-KR/1.0 (https://github.com/C-Caffe1ne/insect; Korean Insect Encyclopedia research)',
        },
      });
      clearTimeout(timer);
      if (res.status === 429) {
        const wait = 1500 * attempt;
        console.warn(`  [429] rate limit — ${wait}ms 대기`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

// API 응답 → canonical → {title, thumbnail, original, description, status} 매핑
function parseWikiResponse(payload, requestedTitles) {
  const result = new Map();
  // 모든 요청 title을 not_found로 초기화
  for (const t of requestedTitles) result.set(t, { status: 'not_found' });

  if (!payload?.query?.pages) return result;

  // 정규화 매핑(공백 → 언더스코어 등)을 위한 보조
  const normalized = new Map();
  for (const n of (payload.query.normalized || [])) normalized.set(n.to, n.from);
  for (const r of (payload.query.redirects || [])) normalized.set(r.to, r.from);

  for (const page of payload.query.pages) {
    // page.title이 정규화된 형태일 수 있으므로 원래 요청 title을 역추적
    const apiTitle = page.title;
    let requestKey = apiTitle;
    if (normalized.has(apiTitle)) requestKey = normalized.get(apiTitle);
    if (!requestedTitles.includes(requestKey)) requestKey = apiTitle;

    if (page.missing) {
      result.set(requestKey, { status: 'not_found' });
      continue;
    }
    if (!page.thumbnail) {
      result.set(requestKey, {
        status: 'no_image',
        title: page.title,
        description: page.terms?.description?.[0] || null,
      });
      continue;
    }
    result.set(requestKey, {
      status: 'ok',
      title: page.title,
      imageUrl: page.thumbnail.source,
      thumbnailWidth: page.thumbnail.width,
      thumbnailHeight: page.thumbnail.height,
      originalUrl: page.original?.source || null,
      originalWidth: page.original?.width || null,
      originalHeight: page.original?.height || null,
      filename: page.pageimage || null,
      description: page.terms?.description?.[0] || null,
      pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    });
  }
  return result;
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
  const families = walkFamilyFiles(FAMILIES_DIR);
  console.log(`family JSON 파일: ${families.length}개`);
  console.log(`옵션: batch=${opts.batch} / delay=${opts.delayMs}ms / dryRun=${opts.dryRun}`);
  console.log('');

  // 1) 대상 종 수집 — canonical 학명 기준 dedupe
  // canonical → [{ filePath, insectIdx }]
  const targets = new Map();
  let totalInsects = 0;
  let alreadyHasImage = 0;
  let alreadyCheckedWiki = 0;

  for (const { fullPath } of families) {
    let data;
    try { data = JSON.parse(fs.readFileSync(fullPath, 'utf8')); }
    catch (err) { console.warn(`SKIP (parse): ${fullPath} — ${err.message}`); continue; }
    const insects = data.insects || [];
    for (let i = 0; i < insects.length; i += 1) {
      const ins = insects[i];
      totalInsects += 1;
      if (hasAnyImage(ins)) { alreadyHasImage += 1; continue; }
      if (alreadyChecked(ins)) { alreadyCheckedWiki += 1; continue; }
      const canonical = canonicalize(ins.scientificName);
      if (!canonical) continue;
      if (!targets.has(canonical)) targets.set(canonical, []);
      targets.get(canonical).push({ filePath: fullPath, insectIdx: i });
    }
  }

  console.log(`전체 종: ${totalInsects}`);
  console.log(`이미 이미지 보유: ${alreadyHasImage}`);
  console.log(`이미 wiki 체크됨: ${alreadyCheckedWiki}`);
  console.log(`Wiki 조회 대상(unique canonical): ${targets.size}`);
  console.log('');

  // 2) batch 처리
  const canonicalList = [...targets.keys()];
  const totalTargets = opts.limit > 0 ? Math.min(opts.limit, canonicalList.length) : canonicalList.length;
  const batches = [];
  for (let i = 0; i < totalTargets; i += opts.batch) {
    batches.push(canonicalList.slice(i, Math.min(i + opts.batch, totalTargets)));
  }
  console.log(`batch ${opts.batch}개씩 → ${batches.length} API 호출 예정`);
  console.log('');

  let apiCalls = 0;
  let ok = 0;
  let notFound = 0;
  let noImage = 0;
  let errors = 0;
  const startTime = Date.now();
  const changedFiles = new Set();

  // family별 데이터를 메모리에 유지하면서 batch 처리, family 단위로 incremental save
  const familyCache = new Map(); // filePath → { data, dirty }

  function getFamily(filePath) {
    if (!familyCache.has(filePath)) {
      familyCache.set(filePath, { data: JSON.parse(fs.readFileSync(filePath, 'utf8')), dirty: false });
    }
    return familyCache.get(filePath);
  }
  function flushFamilies() {
    if (opts.dryRun) return;
    for (const [filePath, entry] of familyCache.entries()) {
      if (entry.dirty) {
        fs.writeFileSync(filePath, JSON.stringify(entry.data, null, 2) + '\n', 'utf8');
        changedFiles.add(filePath);
        entry.dirty = false;
      }
    }
  }

  for (let bi = 0; bi < batches.length; bi += 1) {
    const titles = batches[bi];
    process.stdout.write(`[${bi + 1}/${batches.length}] ${titles.length}건 ... `);
    let result;
    try {
      const payload = await wikiBatch(opts, titles);
      result = parseWikiResponse(payload, titles);
      apiCalls += 1;
    } catch (err) {
      errors += 1;
      process.stdout.write(`ERROR — ${err.message}\n`);
      if (opts.delayMs) await sleep(opts.delayMs);
      continue;
    }

    let bOk = 0, bNf = 0, bNi = 0;
    for (const canonical of titles) {
      const r = result.get(canonical) || { status: 'not_found' };
      const refs = targets.get(canonical) || [];
      for (const { filePath, insectIdx } of refs) {
        const entry = getFamily(filePath);
        const ins = entry.data.insects[insectIdx];
        if (r.status === 'ok') {
          ins.wiki = {
            schemaVersion: SCHEMA_VERSION,
            fetchedAt: new Date().toISOString(),
            title: r.title,
            imageUrl: r.imageUrl,
            originalUrl: r.originalUrl,
            thumbnailSize: { width: r.thumbnailWidth, height: r.thumbnailHeight },
            originalSize: r.originalWidth && r.originalHeight ? { width: r.originalWidth, height: r.originalHeight } : null,
            filename: r.filename,
            description: r.description,
            pageUrl: r.pageUrl,
            license: 'see Wikimedia Commons',  // 일괄 imageinfo 호출 비용 절약 — 정확 라이센스는 Commons 페이지에서 확인
            source: 'Wikipedia',
          };
        } else {
          ins.wiki = {
            schemaVersion: SCHEMA_VERSION,
            status: r.status,
            attemptedAt: new Date().toISOString(),
          };
          if (r.title) ins.wiki.title = r.title;
          if (r.description) ins.wiki.description = r.description;
        }
        entry.dirty = true;
      }
      if (r.status === 'ok') { ok += 1; bOk += 1; }
      else if (r.status === 'no_image') { noImage += 1; bNi += 1; }
      else { notFound += 1; bNf += 1; }
    }
    process.stdout.write(`OK=${bOk}/no_image=${bNi}/not_found=${bNf}\n`);

    // 매 batch 후 메모리 캐시를 디스크에 flush (충돌 시 부분 저장 보장)
    flushFamilies();

    if (opts.delayMs) await sleep(opts.delayMs);
  }

  // 최종 flush
  flushFamilies();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Wikipedia 이미지 캐싱 완료');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`API 호출:           ${apiCalls}`);
  console.log(`처리 canonical:     ${ok + notFound + noImage} / ${totalTargets}`);
  console.log(`  ok(이미지 획득): ${ok}`);
  console.log(`  no_image:        ${noImage}`);
  console.log(`  not_found:       ${notFound}`);
  console.log(`  error:           ${errors}`);
  console.log(`업데이트 파일:      ${changedFiles.size}`);
  console.log(`소요 시간:          ${elapsed}s`);
  console.log('');
  console.log('이미지 획득 가능 종(중복 포함):',
    [...targets.entries()].filter(([k]) => {
      const r = batches.flat().includes(k);
      return r;
    }).length);
}

main().catch((err) => {
  console.error('치명적 오류:', err.message);
  process.exit(1);
});
