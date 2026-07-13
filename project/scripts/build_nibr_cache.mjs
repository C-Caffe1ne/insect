import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const dataPath = path.join(projectDir, 'data', 'nibr_insects.json');
const cachePath = path.join(projectDir, 'nibr_cache.json');
const searchPath = path.join(projectDir, 'search_index.json');

function canonicalize(raw) {
  let value = String(raw || '').replace(/\([^)]*\)/g, ' ');
  value = value.replace(/,?\s*\[?\d{4}\]?\b.*$/, '').trim().replace(/\s+/g, ' ');
  const tokens = value.split(' ');
  const result = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (index === 0 || (/^[a-z]/.test(token) && result.length < 3)) result.push(token);
    else break;
  }
  return result.join(' ');
}

function slug(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const nibrSpecies = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const sourceIndex = JSON.parse(fs.readFileSync(searchPath, 'utf8'));
const cache = {};

for (const species of nibrSpecies) {
  const key = canonicalize(species.scientific_name);
  if (!key) continue;
  cache[key] = { ...species };
}

const ordersByScientific = new Map(
  (sourceIndex.orders || []).map(order => [order.sci, order])
);
const familiesByScientific = new Map(
  (sourceIndex.families || []).map(family => [`${family.order}::${family.sci}`, family])
);
const indexByCanonical = new Map();

for (const insect of sourceIndex.insects || []) {
  const key = canonicalize(insect.sci);
  if (key && !indexByCanonical.has(key)) indexByCanonical.set(key, insect);
  const binomial = key.split(/\s+/).slice(0, 2).join(' ');
  if (binomial && !indexByCanonical.has(binomial)) indexByCanonical.set(binomial, insect);
}

const insects = [];
const orderMeta = new Map();
const familyMeta = new Map();

for (const species of nibrSpecies) {
  const canonical = canonicalize(species.scientific_name);
  const binomial = canonical.split(/\s+/).slice(0, 2).join(' ');
  const sourceOrder = ordersByScientific.get(species.order_latin);
  const orderId = sourceOrder?.id || slug(species.order_latin);
  const familyKey = `${orderId}::${species.family_latin}`;
  const sourceFamily = familiesByScientific.get(familyKey);
  const sourceInsect = indexByCanonical.get(canonical) || indexByCanonical.get(binomial) || {};
  const tokens = canonical.split(/\s+/);

  orderMeta.set(orderId, {
    id: orderId,
    kr: species.order_korean || sourceOrder?.kr || '',
    sci: species.order_latin || sourceOrder?.sci || '',
    count: 0
  });
  familyMeta.set(familyKey, {
    id: sourceFamily?.id || slug(species.family_latin),
    kr: species.family_korean || sourceFamily?.kr || '',
    sci: species.family_latin || sourceFamily?.sci || '',
    order: orderId,
    count: 0
  });

  insects.push({
    ...(sourceInsect.ktsn ? { ktsn: sourceInsect.ktsn } : {}),
    sci: species.scientific_name,
    kr: species.korean_name,
    lat: sourceInsect.lat || tokens[1] || '',
    o: orderId,
    oKr: species.order_korean || sourceOrder?.kr || '',
    os: species.order_latin || sourceOrder?.sci || '',
    f: sourceFamily?.id || slug(species.family_latin),
    fKr: species.family_korean || sourceFamily?.kr || '',
    fs: species.family_latin || sourceFamily?.sci || '',
    g: sourceInsect.g || tokens[0] || '',
    s: sourceInsect.s || tokens[1] || '',
    ...(sourceInsect.img ? { img: sourceInsect.img } : {}),
    nibr: 1,
    page: species.page
  });
}

const orderCounts = new Map();
const familyCounts = new Map();
for (const insect of insects) {
  orderCounts.set(insect.o, (orderCounts.get(insect.o) || 0) + 1);
  familyCounts.set(`${insect.o}::${insect.fs}`, (familyCounts.get(`${insect.o}::${insect.fs}`) || 0) + 1);
}

const orders = [...orderMeta.values()]
  .map(order => ({ ...order, count: orderCounts.get(order.id) || 0 }))
  .sort((a, b) => Math.min(...insects.filter(x => x.o === a.id).map(x => x.page))
    - Math.min(...insects.filter(x => x.o === b.id).map(x => x.page)));
const families = [...familyMeta.values()]
  .map(family => ({ ...family, count: familyCounts.get(`${family.order}::${family.sci}`) || 0 }))
  .sort((a, b) => a.order.localeCompare(b.order) || a.sci.localeCompare(b.sci));
const searchIndex = {
  generatedAt: new Date().toISOString(),
  source: 'project/data/nibr_insects.json',
  counts: {
    total: insects.length,
    withKtsn: insects.filter(x => x.ktsn).length,
    nibr: insects.length
  },
  orders,
  families,
  insects: insects.sort((a, b) => a.page - b.page)
};

fs.writeFileSync(cachePath, `${JSON.stringify(cache)}\n`);
fs.writeFileSync(searchPath, `${JSON.stringify(searchIndex)}\n`);

console.log(`NIBR cache: ${Object.keys(cache).length} species`);
console.log(`Search index: ${searchIndex.insects.length} species / ${searchIndex.orders.length} orders`);
