/**
 * 국립생물자원관 API - 곤충 데이터 검색 및 캐싱
 * 
 * 사용법:
 *   node nibr_search.mjs 장수풍뎅이
 *   node nibr_search.mjs 사슴벌레
 *   node nibr_search.mjs 장수풍뎅이 사슴벌레 왕사마귀
 *   node nibr_search.mjs --list          (캐시된 곤충 목록 보기)
 *   node nibr_search.mjs --clear         (캐시 초기화)
 * 
 * 추출 항목:
 *  - egspcsYn: 멸종위기종 대상
 *  - phspYn: 생태계교란종 대상
 *  - hrmflSpecsYn: 위해우려종 대상
 *  - korUnqBispYn: 한국고유생물종 대상
 *  - ntmYn: 천연기념물 대상
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── 설정 ──
const API_KEY = '827b0667-8e97-4860-bf3d-8866c3abc017';
const BASE_URL = 'https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search';
const CACHE_FILE = path.join(__dirname, 'nibr_cache.json');
const CONCURRENCY = 20;

// ── 캐시 관리 ──
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { updatedAt: null, insects: {} };
}

function saveCache(cache) {
  cache.updatedAt = new Date().toISOString();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

function getCached(cache, name) {
  return cache.insects[name] || null;
}

function setCached(cache, name, rawData) {
  const extracted = extractFields(rawData);
  cache.insects[name] = {
    cachedAt: new Date().toISOString(),
    extracted,
    rawData,
  };
  saveCache(cache);
  return extracted;
}

// ── API 호출 ──
async function fetchPage(page) {
  const url = `${BASE_URL}?oapiAcsUnqNo=${API_KEY}&page=${page}&responseType=json&schTxgrpGroupCd=IN`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data;
}

function matchItem(item, name) {
  return item.ktsnKrnNm === name || item.specsKtsnKrnNm === name;
}

/**
 * API에서 곤충 이름으로 검색 (병렬 배치)
 */
async function searchInsect(name) {
  console.log(`\n🔍 "${name}" 검색 중...`);

  // 첫 페이지로 총 페이지 수 확인
  const first = await fetchPage(1);
  const totalPages = first.pageInfo.totalPages;
  const totalElements = first.pageInfo.totalElements;
  console.log(`   📊 곤충 총 ${totalElements.toLocaleString()}건 / ${totalPages}페이지`);

  // 첫 페이지 확인
  let found = first.content.find(i => matchItem(i, name));
  if (found) return found;

  // 병렬 배치 순회
  for (let start = 2; start <= totalPages; start += CONCURRENCY) {
    const end = Math.min(start + CONCURRENCY - 1, totalPages);
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    process.stdout.write(`\r   📡 ${start}~${end} / ${totalPages} (${Math.round(end / totalPages * 100)}%)`);

    const results = await Promise.allSettled(pages.map(p => fetchPage(p)));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.content) {
        found = r.value.content.find(i => matchItem(i, name));
        if (found) {
          console.log(`\n   ✅ 발견!`);
          return found;
        }
      }
    }

    await new Promise(r => setTimeout(r, 50));
  }

  return null;
}

// ── 데이터 추출 ──
function extractFields(data) {
  return {
    한국명: data.ktsnKrnNm,
    학명: data.stnm,
    KTSN: data.ktsn,
    분류: {
      문: `${data.phlmKtsnKrnNm} (${data.phlmKtsnLtnNm})`,
      강: `${data.classKtsnKrnNm} (${data.classKtsnLtnNm})`,
      목: `${data.orderKtsnKrnNm} (${data.orderKtsnLtnNm})`,
      과: `${data.fmlyKtsnKrnNm} (${data.fmlyKtsnLtnNm})`,
      속: `${data.gnusKtsnKrnNm} (${data.gnusKtsnLtnNm})`,
      종: `${data.specsKtsnKrnNm || '-'} (${data.specsKtsnLtnNm || '-'})`,
    },
    보전정보: {
      멸종위기종_egspcsYn: data.egspcsYn,
      생태계교란종_phspYn: data.phspYn,
      위해우려종_hrmflSpecsYn: data.hrmflSpecsYn,
      한국고유생물종_korUnqBispYn: data.korUnqBispYn,
      천연기념물_ntmYn: data.ntmYn,
    },
  };
}

// ── 출력 ──
function printResult(ex, fromCache = false) {
  const tag = fromCache ? ' (캐시)' : ' (신규)';
  console.log('\n' + '═'.repeat(55));
  console.log(`  🪲 ${ex.한국명}${tag}`);
  console.log(`     ${ex.학명}`);
  console.log(`     KTSN: ${ex.KTSN}`);
  console.log('═'.repeat(55));

  console.log('\n📚 분류 체계:');
  for (const [k, v] of Object.entries(ex.분류)) console.log(`   ${k}: ${v}`);

  console.log('\n🛡️ 보전 상태:');
  const labels = {
    멸종위기종_egspcsYn: '멸종위기종',
    생태계교란종_phspYn: '생태계교란종',
    위해우려종_hrmflSpecsYn: '위해우려종',
    한국고유생물종_korUnqBispYn: '한국고유생물종',
    천연기념물_ntmYn: '천연기념물',
  };
  for (const [key, label] of Object.entries(labels)) {
    const v = ex.보전정보[key];
    console.log(`   ${label}: ${v === 'Y' ? '✅ 해당' : '❌ 비해당'} (${key.split('_')[1]}="${v}")`);
  }
  console.log('\n' + '═'.repeat(55));
}

function printList(cache) {
  const names = Object.keys(cache.insects);
  if (names.length === 0) {
    console.log('📭 캐시된 곤충 데이터가 없습니다.');
    return;
  }

  console.log(`\n📋 캐시된 곤충 목록 (총 ${names.length}종)\n`);
  console.log('─'.repeat(60));
  console.log(`  ${'한국명'.padEnd(15)}${'학명'.padEnd(35)}캐시일`);
  console.log('─'.repeat(60));

  for (const name of names) {
    const entry = cache.insects[name];
    const ex = entry.extracted;
    const date = entry.cachedAt.split('T')[0];
    console.log(`  ${ex.한국명.padEnd(14)} ${ex.학명.substring(0, 33).padEnd(34)} ${date}`);
  }
  console.log('─'.repeat(60));
}

function printUsage() {
  console.log(`
사용법:
  node nibr_search.mjs <곤충이름>           단일 검색
  node nibr_search.mjs <이름1> <이름2> ...  다중 검색
  node nibr_search.mjs --list              캐시 목록 보기
  node nibr_search.mjs --clear             캐시 초기화

예시:
  node nibr_search.mjs 장수풍뎅이
  node nibr_search.mjs 사슴벌레 왕사마귀 무당벌레
`);
}

// ── 메인 ──
async function main() {
  console.log('🏛️  국립생물자원관 API - 곤충 보전정보 검색');
  console.log('─'.repeat(55));

  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    return;
  }

  const cache = loadCache();

  // --list: 캐시 목록 보기
  if (args[0] === '--list') {
    printList(cache);
    return;
  }

  // --clear: 캐시 초기화
  if (args[0] === '--clear') {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
      console.log('🗑️  캐시가 초기화되었습니다.');
    } else {
      console.log('📭 캐시 파일이 없습니다.');
    }
    return;
  }

  // 곤충 이름 목록 검색
  const names = args;
  let successCount = 0;
  let failCount = 0;

  for (const name of names) {
    // 캐시 확인
    const cached = getCached(cache, name);
    if (cached) {
      console.log(`\n💾 "${name}" → 캐시에서 로드`);
      printResult(cached.extracted, true);
      successCount++;
      continue;
    }

    // API 검색
    try {
      const result = await searchInsect(name);

      if (result) {
        const extracted = setCached(cache, name, result);
        console.log(`   💾 캐시 저장 완료`);
        printResult(extracted, false);
        successCount++;
      } else {
        console.log(`\n   ❌ "${name}"을(를) 찾지 못했습니다.`);
        failCount++;
      }
    } catch (err) {
      console.error(`\n   ❌ "${name}" 검색 오류: ${err.message}`);
      failCount++;
    }
  }

  // 요약
  if (names.length > 1) {
    console.log('\n' + '━'.repeat(55));
    console.log(`📊 검색 완료: 성공 ${successCount}건, 실패 ${failCount}건`);
    console.log(`💾 캐시 파일: ${CACHE_FILE}`);
    console.log('━'.repeat(55));
  }
}

main().catch(e => { console.error('❌ 오류:', e.message); process.exit(1); });
