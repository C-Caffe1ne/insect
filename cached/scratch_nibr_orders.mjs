import fs from 'fs';

const API_KEY = '827b0667-8e97-4860-bf3d-8866c3abc017';
const BASE_URL = 'https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search';
const JSON_FILE = 'korea_insect_orders.json';

async function fetchPage(page) {
  const url = `${BASE_URL}?oapiAcsUnqNo=${API_KEY}&page=${page}&responseType=json&schTxgrpGroupCd=IN`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).data;
  } catch (e) {
    return null; // Return null on failure to be retried
  }
}

async function main() {
  console.log('Fetching NIBR API for insect orders (High Concurrency)...');
  
  const first = await fetchPage(1);
  const totalPages = first.pageInfo.totalPages;
  console.log(`Total Pages: ${totalPages}`);

  const uniqueOrders = new Map();
  
  function processItems(items) {
    for (const item of items) {
      if (item.classKtsnLtnNm === 'Insecta' || item.classKtsnKrnNm === '곤충강' || !item.classKtsnLtnNm) {
         const sciName = item.orderKtsnLtnNm;
         const krName = item.orderKtsnKrnNm;
         if (sciName && sciName.trim() !== '') {
           uniqueOrders.set(sciName, krName || uniqueOrders.get(sciName) || '');
         }
      }
    }
  }
  
  if (first.content) processItems(first.content);

  const CONCURRENCY = 200; // Super high concurrency
  const BATCH_SIZE = 500;
  
  let pagesToFetch = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  while (pagesToFetch.length > 0) {
     const batch = pagesToFetch.slice(0, BATCH_SIZE);
     pagesToFetch = pagesToFetch.slice(BATCH_SIZE);
     
     // Process batch with CONCURRENCY limit
     for (let i = 0; i < batch.length; i += CONCURRENCY) {
        const chunk = batch.slice(i, i + CONCURRENCY);
        process.stdout.write(`\rFetching pages ${chunk[0]}-${chunk[chunk.length-1]} / ${totalPages}... `);
        const results = await Promise.all(chunk.map(p => fetchPage(p)));
        
        for (let j = 0; j < results.length; j++) {
           if (results[j] && results[j].content) {
              processItems(results[j].content);
           } else {
              // Retry later
              pagesToFetch.push(chunk[j]);
           }
        }
     }
  }
  console.log('\nFinished fetching.');

  // Clean and prepare
  const orderList = Array.from(uniqueOrders.entries()).map(([sci, kr]) => ({ sci, kr }));
  orderList.sort((a, b) => a.sci.localeCompare(b.sci));

  console.log('Unique orders found in NIBR:', orderList.length);

  // Load existing data
  let existingData = { orders: [] };
  if (fs.existsSync(JSON_FILE)) {
    existingData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  }

  let addedCount = 0;
  for (const { sci, kr } of orderList) {
    const exists = existingData.orders.find(o => 
       o.scientificName.toLowerCase() === sci.toLowerCase() || 
       (kr && o.commonName === kr)
    );
    
    if (!exists) {
       existingData.orders.push({
          usageKey: null,
          scientificName: sci,
          commonName: kr,
          koreaObservationCount: 0
       });
       addedCount++;
    } else {
       if (!exists.commonName && kr) {
          exists.commonName = kr;
       }
    }
  }

  existingData.totalOrdersFound = existingData.orders.length;
  fs.writeFileSync(JSON_FILE, JSON.stringify(existingData, null, 2), 'utf-8');
  console.log(`\nUpdated ${JSON_FILE}. Added ${addedCount} new orders. Total: ${existingData.orders.length}`);
}

main().catch(console.error);
