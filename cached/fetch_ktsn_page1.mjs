#!/usr/bin/env node
// KTSN(국립생물자원관) API에서 schTxgrpGroupCd=IN page=1 데이터를 1회 호출.
// 응답 원본을 보존하면서, 한국고유종/멸종위기/생태계교란/유해/위해우려/천연기념물(KTSN
// 표기상 corsynSeYn 등 Yn 컬럼)을 종 단위로 정리해 새 JSON 파일로 저장한다.
//
// 출력:
//   cached/ktsn_in_page1_raw.json       — API 응답 원본 (감사·디버깅용)
//   cached/ktsn_in_page1_summary.json   — 정리된 종별 요약 + 플래그 집계
//
// 사용:
//   node cached/fetch_ktsn_page1.mjs
//
// 정책:
//   - 단 1회 호출만 수행 (page 1만 요청).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_SOURCE = path.join(__dirname, 'nibr_search.mjs');
const RAW_OUT = path.join(__dirname, 'ktsn_in_page1_raw.json');
const SUMMARY_OUT = path.join(__dirname, 'ktsn_in_page1_summary.json');

const BASE_URL = 'https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search';

function readApiKey() {
  const script = fs.readFileSync(KEY_SOURCE, 'utf8');
  const match = script.match(/API_KEY\s*=\s*'([^']+)'/);
  if (!match) throw new Error(`API key not found in ${KEY_SOURCE}`);
  return match[1];
}

function buildUrl(apiKey) {
  const url = new URL(BASE_URL);
  url.searchParams.set('oapiAcsUnqNo', apiKey);
  url.searchParams.set('page', '1');
  url.searchParams.set('responseType', 'json');
  url.searchParams.set('schTxgrpGroupCd', 'IN');
  return url;
}

// Yn → 한국어 라벨 (KTSN 컬럼 의미는 실데이터 검증 기반)
const FLAG_META = {
  egspcsYn:    { label: '멸종위기',   semantic: 'endangered' },
  dispYn:      { label: '생태계교란', semantic: 'invasive' },
  korUnqBispYn:{ label: '한국고유',   semantic: 'endemic' },
  ntmYn:       { label: '천연기념물', semantic: 'naturalMonument' },
  hrmflSpecsYn:{ label: '유해종',     semantic: 'harmful' },
  phspYn:      { label: '위해우려',   semantic: 'hazardousConcern' },
  corsynSeYn:  { label: '정명채택여부(추정)', semantic: 'acceptedName' },
};

function buildSpeciesSummary(item) {
  // 활성 플래그(Y) 목록
  const activeFlags = [];
  const flagsByLabel = {};
  for (const [key, meta] of Object.entries(FLAG_META)) {
    const value = item[key] || null;
    flagsByLabel[meta.label] = value;
    if (value === 'Y') activeFlags.push({ key, label: meta.label, semantic: meta.semantic });
  }

  return {
    ktsn: item.ktsn || null,
    scientificName: item.ktsnLtnNm || item.kornNm || '',
    commonName: item.ktsnKrnNm || '',
    taxonomy: {
      phylum:    { sci: item.phylumKtsnLtnNm || '', kr: item.phylumKtsnKrnNm || '' },
      class:     { sci: item.classKtsnLtnNm || '',  kr: item.classKtsnKrnNm || '' },
      order:     { sci: item.orderKtsnLtnNm || '',  kr: item.orderKtsnKrnNm || '' },
      family:    { sci: item.fmlyKtsnLtnNm || '',   kr: item.fmlyKtsnKrnNm || '' },
      genus:     { sci: item.genusKtsnLtnNm || '',  kr: item.genusKtsnKrnNm || '' },
      species:   { sci: item.speciesKtsnLtnNm || '', kr: item.speciesKtsnKrnNm || '' },
    },
    flagsRaw: {
      egspcsYn:     item.egspcsYn || null,
      dispYn:       item.dispYn || null,
      korUnqBispYn: item.korUnqBispYn || null,
      ntmYn:        item.ntmYn || null,
      hrmflSpecsYn: item.hrmflSpecsYn || null,
      phspYn:       item.phspYn || null,
      corsynSeYn:   item.corsynSeYn || null,
    },
    flagsByLabel,
    activeFlags,
  };
}

async function main() {
  const apiKey = readApiKey();
  const url = buildUrl(apiKey);
  console.log('KTSN API 호출:', url.toString().replace(apiKey, '***'));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();

  // 원본 저장
  fs.writeFileSync(RAW_OUT, JSON.stringify(raw, null, 2), 'utf8');
  console.log(`원본 저장: ${path.relative(path.resolve(__dirname, '..'), RAW_OUT)}`);

  // 응답 형태 파악 — KTSN은 result/data 안에 list가 들어있는 게 일반적
  const data = raw?.data || raw?.result || raw || {};
  const list =
    data.taxons ||
    data.items ||
    data.list ||
    data.content ||
    (Array.isArray(data) ? data : []) ||
    (Array.isArray(raw) ? raw : []);

  const items = Array.isArray(list) ? list : [];
  console.log(`수신 종 수: ${items.length}`);

  // 종별 요약
  const speciesSummary = items.map(buildSpeciesSummary);

  // 플래그별 통계
  const flagStats = {};
  for (const [, meta] of Object.entries(FLAG_META)) {
    flagStats[meta.label] = { Y: 0, N: 0, other: 0, samples: [] };
  }
  for (const sp of speciesSummary) {
    for (const [label, val] of Object.entries(sp.flagsByLabel)) {
      const bucket = flagStats[label];
      if (!bucket) continue;
      if (val === 'Y') {
        bucket.Y += 1;
        if (bucket.samples.length < 5) bucket.samples.push({ kr: sp.commonName, sci: sp.scientificName });
      } else if (val === 'N') bucket.N += 1;
      else bucket.other += 1;
    }
  }

  // 카테고리별 종 모음 (Y인 종만)
  const categorized = {};
  for (const meta of Object.values(FLAG_META)) {
    if (meta.semantic === 'acceptedName') continue;  // 거의 모든 종이라 별도 분류 의미 없음
    categorized[meta.semantic] = {
      label: meta.label,
      flagKey: Object.entries(FLAG_META).find(([, m]) => m === meta)?.[0],
      species: speciesSummary.filter((sp) =>
        sp.flagsByLabel[meta.label] === 'Y'
      ).map((sp) => ({
        ktsn: sp.ktsn,
        scientificName: sp.scientificName,
        commonName: sp.commonName,
        order: sp.taxonomy.order.kr || sp.taxonomy.order.sci,
        family: sp.taxonomy.family.kr || sp.taxonomy.family.sci,
      })),
    };
  }

  const summary = {
    fetchedAt: new Date().toISOString(),
    source: 'KTSN API /gwsvc/openapi/rest/ktsn/taxons/search?schTxgrpGroupCd=IN&page=1',
    requestParams: {
      schTxgrpGroupCd: 'IN',
      page: 1,
      responseType: 'json',
    },
    counts: {
      receivedItems: items.length,
      withKorUnqBisp: speciesSummary.filter((s) => s.flagsByLabel['한국고유'] === 'Y').length,
      withEgspcs:     speciesSummary.filter((s) => s.flagsByLabel['멸종위기'] === 'Y').length,
      withDisp:       speciesSummary.filter((s) => s.flagsByLabel['생태계교란'] === 'Y').length,
      withNtm:        speciesSummary.filter((s) => s.flagsByLabel['천연기념물'] === 'Y').length,
      withHrmfl:      speciesSummary.filter((s) => s.flagsByLabel['유해종'] === 'Y').length,
      withPhsp:       speciesSummary.filter((s) => s.flagsByLabel['위해우려'] === 'Y').length,
    },
    flagStats,
    categorized,
    species: speciesSummary,
  };

  fs.writeFileSync(SUMMARY_OUT, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`정리 저장: ${path.relative(path.resolve(__dirname, '..'), SUMMARY_OUT)}`);

  console.log('');
  console.log('━━━ 카테고리 집계 ━━━');
  for (const [, c] of Object.entries(categorized)) {
    console.log(`  ${c.label.padEnd(12)} ${c.species.length} 종`);
  }
}

main().catch((err) => {
  console.error('치명적 오류:', err.message);
  process.exit(1);
});
