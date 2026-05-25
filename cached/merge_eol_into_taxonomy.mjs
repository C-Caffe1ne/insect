#!/usr/bin/env node
// EOL 캐시(cached/eol_species_cache.json)를 taxonomy/families/**/*.json의 각 insect에 학명 기준으로 병합한다.
//
// 사용:
//   node cached/merge_eol_into_taxonomy.mjs [--dry-run]
//
// 동작:
//   1) cached/eol_species_cache.json 로드 (canonical → EOL 데이터)
//   2) project/taxonomy/families/**/*.json 순회
//   3) 각 insect.scientificName → canonicalize → EOL 캐시에서 조회
//   4) 적중 + status='ok'면 insect 객체에 `eol` 필드 부여(불변 KTSN 필드는 건드리지 않음)
//   5) 통계 출력 (전체/매칭/미매칭, 목별 분포)
//
// 결과 필드 (insect.eol):
//   {
//     pageId, canonical, fetchedAt,
//     vernaculars: { ko: [...], en: [...], ja: [...] },
//     habitat: [...], geographic: [...], introduced: [...],
//     eats: [...], visitsFlowersOf: [...], pathogenOf: [...],
//     gbifRecords: number | null
//   }
// 기존 EOL 객체가 있어도 매번 덮어쓴다(idempotent, 캐시 갱신 반영).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EOL_CACHE_FILE = path.join(__dirname, 'eol_species_cache.json');
const FAMILIES_DIR = path.join(ROOT, 'project', 'taxonomy', 'families');

const DRY_RUN = process.argv.includes('--dry-run');

// canonicalize — Node/브라우저와 동일 로직
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

function walkJsonFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walkJsonFiles(full));
    else if (name.endsWith('.json')) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function buildEolEntry(cacheEntry) {
  // 캐시 엔트리 → 가벼운 insect.eol 객체로 정규화
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

function isRichEol(eol) {
  if (!eol) return false;
  return (
    (eol.habitat && eol.habitat.length > 0) ||
    (eol.geographic && eol.geographic.length > 0) ||
    (eol.vernaculars && (eol.vernaculars.ko.length > 0 || eol.vernaculars.en.length > 0)) ||
    eol.gbifRecords !== null
  );
}

function main() {
  console.log('=== EOL → taxonomy/families 병합 ===\n');

  if (!fs.existsSync(EOL_CACHE_FILE)) {
    throw new Error(`EOL 캐시 파일이 없습니다: ${EOL_CACHE_FILE}`);
  }
  const cache = JSON.parse(fs.readFileSync(EOL_CACHE_FILE, 'utf8'));
  const cacheSpecies = cache.species || {};
  const okCanonicals = new Set(
    Object.entries(cacheSpecies)
      .filter(([, v]) => v.status === 'ok')
      .map(([k]) => k)
  );
  console.log(`EOL 캐시 로드: 전체 ${Object.keys(cacheSpecies).length}건 (ok ${okCanonicals.size}건)`);

  const familyFiles = walkJsonFiles(FAMILIES_DIR);
  console.log(`family JSON 파일: ${familyFiles.length}개\n`);

  // 통계
  let totalInsects = 0;
  let matched = 0;
  let matchedRich = 0;
  let notInCache = 0;       // 캐시에 canonical 키가 아예 없음 (입력 누락)
  let inCacheNotFound = 0;  // EOL에 페이지 미등재
  let inCacheError = 0;     // EOL 호출 오류
  let filesChanged = 0;

  const perOrder = new Map(); // order id → { total, matched, matchedRich }

  for (const filePath of familyFiles) {
    const rel = path.relative(ROOT, filePath);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.warn(`SKIP (parse error): ${rel} — ${err.message}`);
      continue;
    }

    const orderId = data.order?.id || path.basename(path.dirname(filePath));
    if (!perOrder.has(orderId)) perOrder.set(orderId, { total: 0, matched: 0, matchedRich: 0 });
    const orderStat = perOrder.get(orderId);

    const insects = Array.isArray(data.insects) ? data.insects : [];
    let changed = false;

    for (const insect of insects) {
      totalInsects += 1;
      orderStat.total += 1;

      const canonical = canonicalize(insect.scientificName);
      const cacheEntry = canonical ? cacheSpecies[canonical] : null;

      if (!cacheEntry) {
        notInCache += 1;
        // 기존 eol 필드 있으면 제거 (idempotent)
        if (insect.eol !== undefined) {
          delete insect.eol;
          changed = true;
        }
        continue;
      }

      if (cacheEntry.status === 'not_found') {
        inCacheNotFound += 1;
        if (insect.eol !== undefined) {
          delete insect.eol;
          changed = true;
        }
        continue;
      }
      if (cacheEntry.status === 'error') {
        inCacheError += 1;
        if (insect.eol !== undefined) {
          delete insect.eol;
          changed = true;
        }
        continue;
      }
      if (cacheEntry.status !== 'ok') continue;

      const newEol = buildEolEntry(cacheEntry);
      const before = JSON.stringify(insect.eol);
      const after = JSON.stringify(newEol);
      if (before !== after) {
        insect.eol = newEol;
        changed = true;
      } else if (insect.eol === undefined) {
        insect.eol = newEol;
        changed = true;
      }

      matched += 1;
      orderStat.matched += 1;
      if (isRichEol(newEol)) {
        matchedRich += 1;
        orderStat.matchedRich += 1;
      }
    }

    if (changed) {
      filesChanged += 1;
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      }
    }
  }

  // ── 보고 ─────────────────────────────
  console.log('━━━ 매칭 통계 ━━━');
  console.log(`전체 곤충 수:        ${totalInsects}`);
  console.log(`데이터 매칭:         ${matched}  (${(matched / totalInsects * 100).toFixed(1)}%)`);
  console.log(`  └ 풍부 데이터:     ${matchedRich}  (habitat/geo/vern/gbif 중 1+ 보유)`);
  console.log(`데이터 없음:         ${totalInsects - matched}`);
  console.log(`  ├ 캐시 미수록:     ${notInCache}`);
  console.log(`  ├ EOL not_found:   ${inCacheNotFound}`);
  console.log(`  └ EOL error:       ${inCacheError}`);
  console.log('');
  console.log(`파일 갱신:           ${filesChanged} / ${familyFiles.length}${DRY_RUN ? ' (DRY-RUN — 실제 저장 안 함)' : ''}`);
  console.log('');

  console.log('━━━ 목(order)별 분포 (매칭률 기준 내림차순, 상위 15개) ━━━');
  const sortedOrders = [...perOrder.entries()]
    .filter(([, s]) => s.total > 0)
    .map(([id, s]) => ({ id, ...s, rate: s.matched / s.total }))
    .sort((a, b) => b.rate - a.rate);
  for (const o of sortedOrders.slice(0, 15)) {
    const bar = '█'.repeat(Math.round(o.rate * 20));
    console.log(`  ${o.id.padEnd(20)} ${o.matched}/${o.total} (${(o.rate * 100).toFixed(1)}%)  ${bar}  rich:${o.matchedRich}`);
  }

  if (sortedOrders.length > 15) {
    console.log(`  ... (${sortedOrders.length - 15}개 목 생략)`);
  }
  console.log('');
  console.log('━━━ 매칭률 낮은 5개 목 ━━━');
  for (const o of sortedOrders.slice(-5).reverse()) {
    console.log(`  ${o.id.padEnd(20)} ${o.matched}/${o.total} (${(o.rate * 100).toFixed(1)}%)`);
  }
}

main();
