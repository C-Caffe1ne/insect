// ENTOMA · KR — family JSON cleanup
// 7개 패턴 정리: digitalContent, Yn 3개, taxonomy.order/family 중복, subgenus 빈 객체,
// EOL 빈 배열, gbif.vernacularName 빈/falsy, inat.imageUrl 빈 문자열
//
// 사용: node cached/cleanup_empty_duplicate.mjs
// 사전 조건: project/taxonomy/families/ 백업 완료 (_backup_taxonomy_*)

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const FAMILIES_DIR = join(ROOT, 'project/taxonomy/families');

const counters = {
  files: 0,
  insects: 0,
  digitalContent: 0,
  hrmflSpecsYn: 0,
  phspYn: 0,
  ntmYn: 0,
  taxonomyOrder: 0,
  taxonomyFamily: 0,
  subgenusEmpty: 0,
  eolEats: 0,
  eolVisitsFlowersOf: 0,
  eolPathogenOf: 0,
  gbifVernacularName: 0,
  inatImageUrlEmpty: 0,
};

let sizeBefore = 0;
let sizeAfter = 0;

function isEmptySubgenus(sg) {
  if (!sg || typeof sg !== 'object') return false;
  const ktsn = sg.ktsn;
  const sci = sg.scientificName;
  const kr = sg.commonName;
  const emptyKtsn = ktsn === undefined || ktsn === null || ktsn === '';
  const emptySci = sci === undefined || sci === null || sci === '';
  const emptyKr = kr === undefined || kr === null || kr === '';
  return emptyKtsn && emptySci && emptyKr;
}

function cleanInsect(insect) {
  // #1 digitalContent
  if ('digitalContent' in insect) {
    delete insect.digitalContent;
    counters.digitalContent++;
  }

  // #2 Yn 3개
  if ('hrmflSpecsYn' in insect) {
    delete insect.hrmflSpecsYn;
    counters.hrmflSpecsYn++;
  }
  if ('phspYn' in insect) {
    delete insect.phspYn;
    counters.phspYn++;
  }
  if ('ntmYn' in insect) {
    delete insect.ntmYn;
    counters.ntmYn++;
  }

  // #3 taxonomy.order / family 중복 + #4 subgenus 빈 객체
  if (insect.taxonomy && typeof insect.taxonomy === 'object') {
    if ('order' in insect.taxonomy) {
      delete insect.taxonomy.order;
      counters.taxonomyOrder++;
    }
    if ('family' in insect.taxonomy) {
      delete insect.taxonomy.family;
      counters.taxonomyFamily++;
    }
    if ('subgenus' in insect.taxonomy && isEmptySubgenus(insect.taxonomy.subgenus)) {
      delete insect.taxonomy.subgenus;
      counters.subgenusEmpty++;
    }
  }

  // #5 EOL 빈 배열 3개
  if (insect.eol && typeof insect.eol === 'object') {
    if (Array.isArray(insect.eol.eats) && insect.eol.eats.length === 0) {
      delete insect.eol.eats;
      counters.eolEats++;
    }
    if (Array.isArray(insect.eol.visitsFlowersOf) && insect.eol.visitsFlowersOf.length === 0) {
      delete insect.eol.visitsFlowersOf;
      counters.eolVisitsFlowersOf++;
    }
    if (Array.isArray(insect.eol.pathogenOf) && insect.eol.pathogenOf.length === 0) {
      delete insect.eol.pathogenOf;
      counters.eolPathogenOf++;
    }
  }

  // #6 gbif.vernacularName falsy/빈
  if (insect.gbif && typeof insect.gbif === 'object' && 'vernacularName' in insect.gbif) {
    const v = insect.gbif.vernacularName;
    if (v === null || v === undefined || v === '') {
      delete insect.gbif.vernacularName;
      counters.gbifVernacularName++;
    }
  }

  // #7 inat.imageUrl 빈 문자열
  if (insect.inat && typeof insect.inat === 'object' && 'imageUrl' in insect.inat) {
    const u = insect.inat.imageUrl;
    if (u === '' || u === null) {
      delete insect.inat.imageUrl;
      counters.inatImageUrlEmpty++;
    }
  }
}

function processFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  sizeBefore += Buffer.byteLength(raw, 'utf8');

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`JSON parse fail: ${filePath} - ${e.message}`);
    return;
  }

  if (!data || !Array.isArray(data.insects)) {
    // 형식 다르면 그대로 재출력
    sizeAfter += Buffer.byteLength(raw, 'utf8');
    return;
  }

  for (const insect of data.insects) {
    counters.insects++;
    cleanInsect(insect);
  }

  const out = JSON.stringify(data, null, 2) + '\n';
  writeFileSync(filePath, out, 'utf8');
  sizeAfter += Buffer.byteLength(out, 'utf8');
  counters.files++;
}

function walk(dir) {
  const entries = readdirSync(dir);
  for (const name of entries) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (s.isFile() && name.endsWith('.json')) processFile(p);
  }
}

console.log('Cleanup started...');
console.log(`Target: ${FAMILIES_DIR}`);
walk(FAMILIES_DIR);

const mb = (b) => (b / 1024 / 1024).toFixed(2);
const saved = sizeBefore - sizeAfter;
const pct = sizeBefore > 0 ? ((saved / sizeBefore) * 100).toFixed(2) : '0';

console.log('\n=== Result ===');
console.log(`Files processed: ${counters.files}`);
console.log(`Insects processed: ${counters.insects}`);
console.log('--- Pattern counts ---');
console.log(`#1 digitalContent removed:        ${counters.digitalContent}`);
console.log(`#2 hrmflSpecsYn removed:          ${counters.hrmflSpecsYn}`);
console.log(`   phspYn removed:                ${counters.phspYn}`);
console.log(`   ntmYn removed:                 ${counters.ntmYn}`);
console.log(`#3 taxonomy.order removed:        ${counters.taxonomyOrder}`);
console.log(`   taxonomy.family removed:       ${counters.taxonomyFamily}`);
console.log(`#4 taxonomy.subgenus empty:       ${counters.subgenusEmpty}`);
console.log(`#5 eol.eats removed:              ${counters.eolEats}`);
console.log(`   eol.visitsFlowersOf removed:   ${counters.eolVisitsFlowersOf}`);
console.log(`   eol.pathogenOf removed:        ${counters.eolPathogenOf}`);
console.log(`#6 gbif.vernacularName removed:   ${counters.gbifVernacularName}`);
console.log(`#7 inat.imageUrl empty removed:   ${counters.inatImageUrlEmpty}`);
console.log('--- Size ---');
console.log(`Before: ${mb(sizeBefore)} MB`);
console.log(`After:  ${mb(sizeAfter)} MB`);
console.log(`Saved:  ${mb(saved)} MB (${pct}%)`);
