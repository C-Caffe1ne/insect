#!/usr/bin/env node
// 캐시된 ktsn_in_page1_raw.json을 읽어 모든 Yn 컬럼(17개)을 정리.
// 추가 API 호출 없이 raw → summary 재가공만 수행.
//
// 출력: cached/ktsn_in_page1_summary.json (덮어쓰기)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW = path.join(__dirname, 'ktsn_in_page1_raw.json');
const OUT = path.join(__dirname, 'ktsn_in_page1_summary.json');

// KTSN Yn 컬럼 17종 — 명칭은 응답에서 추출, 한국어 라벨은 컬럼명·기존 검증·국립생물자원관
// 통상 분류 명칭 기반 추정. 정확 정의가 불명확한 항목은 "(추정)" 표기.
const FLAG_META = {
  // ─ 보전·관리 ─
  egspcsYn:                    { label: '멸종위기종',                 semantic: 'endangered' },
  ntmYn:                       { label: '천연기념물',                 semantic: 'naturalMonument' },
  korUnqBispYn:                { label: '한국고유종',                 semantic: 'endemic' },
  dispYn:                      { label: '생태계교란생물',             semantic: 'invasive' },
  hrmflSpecsYn:                { label: '유해야생생물(추정)',         semantic: 'harmfulWildlife' },
  phspYn:                      { label: '위해우려종(추정)',           semantic: 'hazardousConcern' },
  mprsCrtureDsgnSpecsYn:       { label: '해양보호생물(추정)',         semantic: 'marineProtected' },
  ntnClimtVartnIdctSpecsYn:    { label: '국가 기후변화 지표종(추정)', semantic: 'climateIndicator' },
  // ─ 포획·채집·수출입 규제 ─
  cptrPckngPrhbSpecsYn:        { label: '포획·채집 금지(추정)',       semantic: 'captureProhibited' },
  artfcPrlrtCptrPrmsnSpecsYn:  { label: '인공증식 포획 허가(추정)',   semantic: 'artificialProliferationPermit' },
  expIncmPrmsnTrgtSpecsYn:     { label: '수출·수입 허가 대상(추정)',  semantic: 'exportImportPermitTarget' },
  ovseaShpgotAprvTrgtSpecsYn:  { label: '해외 반출 승인 대상(추정)',  semantic: 'overseasShipApprovalTarget' },
  eatprhbSpecsYn:              { label: '식용 금지(추정)',            semantic: 'eatingProhibited' },
  // ─ 분류 메타 ─
  hntgAnmlYn:                  { label: '수렵 동물(추정)',            semantic: 'huntableAnimal' },
  wldflwAnmlYn:                { label: '야생 동물(추정)',            semantic: 'wildAnimal' },
  sttyMngSpecsYn:              { label: '상태 관리종(추정)',          semantic: 'statusManaged' },
  corsynSeYn:                  { label: '정명 채택 여부(추정)',       semantic: 'acceptedName' },
};

function buildSpecies(item) {
  const flags = {};
  const flagsLabeled = {};
  const activeFlags = [];
  for (const [key, meta] of Object.entries(FLAG_META)) {
    const v = item[key] || null;
    flags[key] = v;
    flagsLabeled[meta.label] = v;
    if (v === 'Y') activeFlags.push({ key, label: meta.label, semantic: meta.semantic });
  }

  return {
    ktsn: item.ktsn || null,
    scientificName: item.ktsnLtnNm || '',
    commonName: item.ktsnKrnNm || '',
    nomenclaturalAuthor: item.nmcltrNm || '',
    namingYear: item.nmngYr || '',
    taxonomy: {
      phylum: { sci: item.phlmKtsnLtnNm || '', kr: item.phlmKtsnKrnNm || '', ktsn: item.phlmKtsn || null },
      class:  { sci: item.classKtsnLtnNm || '', kr: item.classKtsnKrnNm || '', ktsn: item.classKtsn || null },
      order:  { sci: item.orderKtsnLtnNm || '', kr: item.orderKtsnKrnNm || '', ktsn: item.orderKtsn || null },
      family: { sci: item.fmlyKtsnLtnNm || '',  kr: item.fmlyKtsnKrnNm || '',  ktsn: item.fmlyKtsn || null },
      genus:  { sci: item.gnusKtsnLtnNm || '',  kr: item.gnusKtsnKrnNm || '',  ktsn: item.gnusKtsn || null },
      species:{ sci: item.specsKtsnLtnNm || '', kr: item.specsKtsnKrnNm || '', ktsn: item.specsKtsn || null },
      subspecies: item.sspecsKtsnLtnNm ? { sci: item.sspecsKtsnLtnNm, kr: item.sspecsKtsnKrnNm || '' } : null,
      variety:    item.vrtyKtsnLtnNm ? { sci: item.vrtyKtsnLtnNm, kr: item.vrtyKtsnKrnNm || '' } : null,
    },
    flags,
    flagsLabeled,
    activeFlags,
  };
}

function main() {
  if (!fs.existsSync(RAW)) {
    throw new Error(`먼저 fetch_ktsn_page1.mjs를 실행해 ${path.basename(RAW)}를 생성하세요.`);
  }
  const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
  const items = raw?.data?.content || [];
  console.log(`raw items: ${items.length}`);

  const species = items.map(buildSpecies);

  // Yn 컬럼별 Y/N/other 분포
  const flagStats = {};
  for (const [key, meta] of Object.entries(FLAG_META)) {
    const Y = species.filter((s) => s.flags[key] === 'Y');
    flagStats[meta.label] = {
      key,
      semantic: meta.semantic,
      Y: Y.length,
      N: species.filter((s) => s.flags[key] === 'N').length,
      other: species.filter((s) => s.flags[key] !== 'Y' && s.flags[key] !== 'N').length,
      YsamplesKr: Y.slice(0, 5).map((s) => s.commonName || s.scientificName),
    };
  }

  // 사용자가 요청한 6개 카테고리 분류
  const categorized = {
    endangered:        species.filter((s) => s.flags.egspcsYn === 'Y'),
    naturalMonument:   species.filter((s) => s.flags.ntmYn === 'Y'),
    endemic:           species.filter((s) => s.flags.korUnqBispYn === 'Y'),
    invasive:          species.filter((s) => s.flags.dispYn === 'Y'),
    harmfulWildlife:   species.filter((s) => s.flags.hrmflSpecsYn === 'Y'),
    hazardousConcern:  species.filter((s) => s.flags.phspYn === 'Y'),
  };

  const out = {
    fetchedAt: raw?.timestamp || null,
    processedAt: new Date().toISOString(),
    source: 'KTSN /gwsvc/openapi/rest/ktsn/taxons/search?schTxgrpGroupCd=IN&page=1',
    apiResponseStatus: raw?.status || null,
    apiResponseMessage: raw?.message || null,
    pageInfo: raw?.data?.pageInfo || null,
    receivedItems: items.length,
    flagsLegend: Object.fromEntries(Object.entries(FLAG_META).map(([k, v]) => [k, v.label])),
    flagStats,
    categorized: Object.fromEntries(Object.entries(categorized).map(([k, arr]) => [k, {
      label: FLAG_META[Object.entries(FLAG_META).find(([, m]) => m.semantic === k)?.[0]]?.label || k,
      count: arr.length,
      species: arr.map((s) => ({
        ktsn: s.ktsn,
        scientificName: s.scientificName,
        commonName: s.commonName,
        order: s.taxonomy.order.kr || s.taxonomy.order.sci,
        family: s.taxonomy.family.kr || s.taxonomy.family.sci,
      })),
    }])),
    species,
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
  console.log(`출력: ${path.relative(path.resolve(__dirname, '..'), OUT)}`);

  console.log('');
  console.log('━━━ 사용자 요청 카테고리 (page 1 한정) ━━━');
  for (const [k, c] of Object.entries(out.categorized)) {
    console.log(`  ${c.label.padEnd(25)} ${c.count} 종`);
  }
  console.log('');
  console.log('━━━ 전체 17개 Yn 컬럼 Y 분포 ━━━');
  for (const [label, s] of Object.entries(flagStats)) {
    if (s.Y > 0) console.log(`  ${label.padEnd(28)} Y=${s.Y}  N=${s.N}  other=${s.other}`);
  }
}

main();
