#!/usr/bin/env node
// 모든 family JSON에서 곤충 정보를 추출해 단일 검색 인덱스를 빌드한다.
// 출력: project/search_index.json
//
// 인덱스 스키마 (per insect):
//   {
//     ktsn, sci, kr, lat,             // scientificName/commonName/terminalLatinName
//     o,  oKr,  os,                   // orderId, orderCommonName, orderScientific
//     f,  fKr,  fs,                   // familyId, familyCommonName, familyScientific
//     g,  s,                          // genus, species
//     flags: 3자리 문자열 — egspcsYn(멸종위기) | dispYn(생태계교란) | korUnqBispYn(한국고유)
//            (KTSN 데이터에 실제 분포가 있는 플래그만; 다른 Yn 컬럼은 모두 'N')
//     eolKo: 한국어 통명(있을 때)
//   }
//
// 검색 시 별도의 stop-word나 normalization은 프론트에서 처리한다.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const FAMILIES_DIR = path.join(ROOT, 'project', 'taxonomy', 'families');
const OUT_FILE = path.join(ROOT, 'project', 'search_index.json');

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.json')) out.push(full);
  }
  return out;
}

function yn(v) { return v === 'Y' ? '1' : '0'; }

function buildFlagsString(insect) {
  // 3자리 비트열: egspcs(멸종위기) | disp(생태계교란) | korUnq(한국고유)
  // KTSN 데이터셋에서 다른 Yn 컬럼은 전수 'N'이라 인덱스에 미포함.
  return [
    yn(insect.egspcsYn),
    yn(insect.dispYn),
    yn(insect.korUnqBispYn),
  ].join('');
}

function main() {
  const files = walk(FAMILIES_DIR).sort();
  console.log(`family JSON 파일: ${files.length}`);

  const insects = [];
  const orderIndex = new Map(); // orderId → { id, kr, sci, count }
  const familyIndex = new Map(); // orderId/familyId → { ... }

  let totalInsects = 0;
  let withKtsn = 0;
  let withEol = 0;
  let flagCounts = { endangered: 0, invasive: 0, endemic: 0 };

  for (const fp of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch (err) { console.warn(`SKIP ${fp}: ${err.message}`); continue; }

    const orderId = data.order?.id || 'unknown';
    const orderKr = data.order?.commonName || '';
    const orderSci = data.order?.scientificName || '';
    const familyId = data.family?.id || path.basename(fp, '.json');
    const familyKr = data.family?.commonName || '';
    const familySci = data.family?.scientificName || '';
    const familyKey = `${orderId}/${familyId}`;

    if (!orderIndex.has(orderId)) orderIndex.set(orderId, { id: orderId, kr: orderKr, sci: orderSci, count: 0 });
    if (!familyIndex.has(familyKey)) familyIndex.set(familyKey, { id: familyId, kr: familyKr, sci: familySci, order: orderId, count: 0 });

    for (const insect of (data.insects || [])) {
      totalInsects += 1;
      const flags = buildFlagsString(insect);
      if (flags[0] === '1') flagCounts.endangered += 1;
      if (flags[1] === '1') flagCounts.invasive += 1;
      if (flags[2] === '1') flagCounts.endemic += 1;

      const entry = {
        ktsn: insect.ktsn || null,
        sci: insect.scientificName || '',
        kr: insect.commonName || '',
        lat: insect.terminalLatinName || '',
        o: orderId,
        oKr: orderKr,
        os: orderSci,
        f: familyId,
        fKr: familyKr,
        fs: familySci,
        g: insect.taxonomy?.genus?.scientificName || '',
        s: insect.taxonomy?.species?.scientificName || '',
        flags,
      };
      if (insect.ktsn) withKtsn += 1;

      // EOL 한국어 통명 (있으면 보조 검색 키로 활용)
      if (insect.eol?.vernaculars?.ko && insect.eol.vernaculars.ko.length > 0) {
        entry.eolKo = insect.eol.vernaculars.ko[0];
        withEol += 1;
      }

      insects.push(entry);
      orderIndex.get(orderId).count += 1;
      familyIndex.get(familyKey).count += 1;
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'project/taxonomy/families/**/*.json',
    flagsLegend: {
      pos0: 'egspcsYn — 멸종위기',
      pos1: 'dispYn — 생태계교란',
      pos2: 'korUnqBispYn — 한국고유',
    },
    counts: {
      total: totalInsects,
      withKtsn,
      withEol,
      flags: flagCounts,
    },
    orders: [...orderIndex.values()].sort((a, b) => b.count - a.count),
    families: [...familyIndex.values()].sort((a, b) => b.count - a.count),
    insects,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out), 'utf8');
  const sizeMb = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);

  console.log('');
  console.log('━━━ 인덱스 빌드 완료 ━━━');
  console.log(`총 곤충: ${totalInsects}`);
  console.log(`목(order): ${orderIndex.size}`);
  console.log(`과(family): ${familyIndex.size}`);
  console.log(`KTSN ID 보유: ${withKtsn}`);
  console.log(`EOL 한국어 통명 보유: ${withEol}`);
  console.log('');
  console.log('카테고리별 종 수:');
  console.log(`  멸종위기:     ${flagCounts.endangered}`);
  console.log(`  생태계교란:    ${flagCounts.invasive}`);
  console.log(`  한국고유:     ${flagCounts.endemic}`);
  console.log('');
  console.log(`출력: ${path.relative(ROOT, OUT_FILE)} (${sizeMb} MB)`);
}

main();
