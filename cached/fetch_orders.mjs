import fs from 'fs';

const API_KEY = '827b0667-8e97-4860-bf3d-8866c3abc017';
const BASE_URL = 'https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search';
const JSON_FILE = 'korea_insect_orders.json';
const CACHE_PAGES = 'nibr_pages.json'; // Cache to resume if failed

async function fetchPage(page, retries = 3) {
  const url = `${BASE_URL}?oapiAcsUnqNo=${API_KEY}&page=${page}&responseType=json&schTxgrpGroupCd=IN`;
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
         return (await res.json()).data;
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

async function main() {
  console.log('Fetching NIBR API for insect orders...');
  
  const first = await fetchPage(1);
  if (!first) {
     console.error("Failed to fetch first page.");
     return;
  }
  const totalPages = first.pageInfo.totalPages;
  console.log(`Total Pages: ${totalPages}`);

  const uniqueOrders = new Map();
  // Map structure: sciName => { krName, ktsn }

  function processItems(items) {
    for (const item of items) {
       const sciName = item.orderKtsnLtnNm;
       const krName = item.orderKtsnKrnNm;
       const ktsn = item.orderKtsn;
       if (sciName && sciName.trim() !== '') {
          if (!uniqueOrders.has(sciName)) {
             uniqueOrders.set(sciName, { kr: krName, ktsn: ktsn });
          } else {
             const existing = uniqueOrders.get(sciName);
             if (!existing.kr && krName) existing.kr = krName;
             if (!existing.ktsn && ktsn) existing.ktsn = ktsn;
          }
       }
    }
  }

  processItems(first.content);

  const CONCURRENCY = 25;
  let pagesToFetch = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  let failedPages = [];

  while (pagesToFetch.length > 0) {
     const chunk = pagesToFetch.splice(0, CONCURRENCY);
     process.stdout.write(`\rFetching pages ${chunk[0]}-${chunk[chunk.length-1]} / ${totalPages}... `);
     const results = await Promise.all(chunk.map(p => fetchPage(p)));
     
     for (let j = 0; j < results.length; j++) {
        if (results[j] && results[j].content) {
           processItems(results[j].content);
        } else {
           failedPages.push(chunk[j]);
        }
     }
     await new Promise(r => setTimeout(r, 500)); // Sleep between batches
  }
  
  console.log(`\nFinished fetching. Failed pages: ${failedPages.length}`);

  // Load existing data
  let existingData = { orders: [] };
  if (fs.existsSync(JSON_FILE)) {
    existingData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  }

  let addedCount = 0;
  for (const [sci, data] of uniqueOrders.entries()) {
    const exists = existingData.orders.find(o => 
       o.scientificName.toLowerCase() === sci.toLowerCase() || 
       (data.kr && o.commonName === data.kr)
    );
    
    if (!exists) {
       existingData.orders.push({
          usageKey: null,
          scientificName: sci,
          commonName: data.kr,
          koreaObservationCount: 0,
          ktsn: data.ktsn
       });
       addedCount++;
       console.log(`Added: ${sci} (${data.kr}, KTSN: ${data.ktsn})`);
    } else {
       if (!exists.commonName && data.kr) exists.commonName = data.kr;
       exists.ktsn = data.ktsn; // Update KTSN
    }
  }

  existingData.totalOrdersFound = existingData.orders.length;
  fs.writeFileSync(JSON_FILE, JSON.stringify(existingData, null, 2), 'utf-8');
  console.log(`\nUpdated ${JSON_FILE}. Added ${addedCount} new orders. Total: ${existingData.orders.length}`);
}

main().catch(console.error);
