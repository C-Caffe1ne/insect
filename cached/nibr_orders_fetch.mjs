/**
 * 국립생물자원관 API — 곤충강(IN) 하위 목(Order) 전수조사
 * 
 * 21,395건(2,140페이지)을 병렬로 스캔하여
 * 고유한 (orderKtsn, orderKtsnKrnNm, orderKtsnLtnNm) 조합을 추출합니다.
 * 
 * 결과: korea_insect_orders.json 에 중복 제거 후 저장
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = '827b0667-8e97-4860-bf3d-8866c3abc017';
const BASE_URL = 'https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search';
const OUT_FILE = path.join(__dirname, 'korea_insect_orders.json');

// ── 페이지 요청 (최대 3회 재시도) ──
async function fetchPage(page) {
  const url = `${BASE_URL}?oapiAcsUnqNo=${API_KEY}&page=${page}&responseType=json&schTxgrpGroupCd=IN`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) { await sleep(300); continue; }
      const json = await res.json();
      return json?.data?.content ?? [];
    } catch {
      await sleep(300);
    }
  }
  return null; // 실패
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 병렬 배치 처리 ──
async function fetchAllPages(totalPages, concurrency = 100) {
  const uniqueOrders = new Map(); // orderKtsn → { ktsn, krName, sciName }
  let completed = 0;
  let failed = 0;

  // 페이지 배열 생성 (1 ~ totalPages)
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  // 동시성 제한 실행기
  async function runBatch(batch) {
    const results = await Promise.all(batch.map(p => fetchPage(p)));
    for (let i = 0; i < results.length; i++) {
      completed++;
      if (results[i] === null) {
        failed++;
        continue;
      }
      for (const item of results[i]) {
        const ktsn = item.orderKtsn;
        const krName = item.orderKtsnKrnNm || '';
        const sciName = item.orderKtsnLtnNm || '';
        if (ktsn && !uniqueOrders.has(ktsn)) {
          uniqueOrders.set(ktsn, { ktsn, krName, sciName });
        }
      }
    }
    process.stdout.write(`\r  📡 ${completed} / ${totalPages} 페이지 완료 (실패: ${failed}) — 목 ${uniqueOrders.size}종 발견`);
  }

  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);
    await runBatch(batch);
  }

  console.log('');
  return uniqueOrders;
}

// ── 메인 ──
async function main() {
  console.log('🏛️  국립생물자원관 API — 곤충강 하위 목(Order) 전수 추출');
  console.log('─'.repeat(55));

  // 1) 첫 페이지에서 총 페이지 수 확인
  const firstUrl = `${BASE_URL}?oapiAcsUnqNo=${API_KEY}&page=1&responseType=json&schTxgrpGroupCd=IN`;
  const firstRes = await fetch(firstUrl);
  const firstJson = await firstRes.json();
  const totalPages = firstJson.data.pageInfo.totalPages;
  const totalElements = firstJson.data.pageInfo.totalElements;
  console.log(`📊 총 ${totalElements.toLocaleString()}건 / ${totalPages}페이지`);
  console.log(`🚀 동시 100 요청으로 스캔 시작...\n`);

  // 2) 전체 스캔
  const startTime = Date.now();
  const uniqueOrders = await fetchAllPages(totalPages, 100);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n⏱️  소요시간: ${elapsed}초`);
  console.log(`✅ 고유 목(Order) ${uniqueOrders.size}종 발견\n`);

  // 3) 결과 출력
  const orderList = [...uniqueOrders.values()].sort((a, b) => a.sciName.localeCompare(b.sciName));
  
  console.log('─'.repeat(55));
  console.log(`  ${'학명'.padEnd(25)}${'한국명'.padEnd(12)}KTSN`);
  console.log('─'.repeat(55));
  for (const o of orderList) {
    console.log(`  ${o.sciName.padEnd(24)} ${o.krName.padEnd(11)} ${o.ktsn}`);
  }
  console.log('─'.repeat(55));

  // 4) JSON 파일 저장 (기존 형식 유지, 중복 제거)
  const output = {
    cachedAt: new Date().toISOString(),
    source: '국립생물자원관 KTSN API (schTxgrpGroupCd=IN)',
    totalOrdersFound: orderList.length,
    orders: orderList.map(o => ({
      orderKtsn: o.ktsn,
      scientificName: o.sciName,
      commonName: o.krName,
      koreaObservationCount: 0
    }))
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n💾 ${OUT_FILE} 저장 완료 (${orderList.length}종)`);
}

main().catch(e => { console.error('❌ 오류:', e); process.exit(1); });
