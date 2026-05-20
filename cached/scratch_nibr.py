import requests
import concurrent.futures
import json
import os
import sys

API_KEY = '827b0667-8e97-4860-bf3d-8866c3abc017'
BASE_URL = 'https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search'
JSON_FILE = 'korea_insect_orders.json'

session = requests.Session()
adapter = requests.adapters.HTTPAdapter(pool_connections=100, pool_maxsize=100, max_retries=3)
session.mount('https://', adapter)
session.headers.update({'User-Agent': 'Mozilla/5.0'})

def fetch_page(page):
    url = f"{BASE_URL}?oapiAcsUnqNo={API_KEY}&page={page}&responseType=json&schTxgrpGroupCd=IN"
    try:
        res = session.get(url, timeout=10)
        if res.status_code != 200:
           return []
        return res.json().get('data', {}).get('content', [])
    except Exception as e:
        return []

print('Fetching NIBR API for insect orders...')
try:
    first_page = session.get(f"{BASE_URL}?oapiAcsUnqNo={API_KEY}&page=1&responseType=json&schTxgrpGroupCd=IN").json()
except Exception as e:
    print(f"Failed to fetch first page: {e}")
    sys.exit(1)

total_pages = first_page.get('data', {}).get('pageInfo', {}).get('totalPages', 1)
print(f'Total pages to fetch: {total_pages}')

unique_orders = {}

def process_items(items):
    for item in items:
        cls_ltn = item.get('classKtsnLtnNm', '')
        cls_krn = item.get('classKtsnKrnNm', '')
        if cls_ltn == 'Insecta' or cls_krn == '곤충강' or not cls_ltn:
            sci = item.get('orderKtsnLtnNm')
            kr = item.get('orderKtsnKrnNm', '')
            if sci and sci.strip():
                if sci not in unique_orders or not unique_orders[sci]:
                    unique_orders[sci] = kr

# process first page
if 'data' in first_page and 'content' in first_page['data']:
    process_items(first_page['data']['content'])

pages = list(range(2, total_pages + 1))
print("Starting concurrent fetch...")

completed = 0
with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
    futures = {executor.submit(fetch_page, p): p for p in pages}
    for future in concurrent.futures.as_completed(futures):
        items = future.result()
        if items:
            process_items(items)
        completed += 1
        if completed % 100 == 0:
            print(f"Completed {completed} / {total_pages} pages...", end='\r', flush=True)

print(f"\nDone fetching. Found {len(unique_orders)} unique orders.")

existing_data = {"orders": []}
if os.path.exists(JSON_FILE):
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        existing_data = json.load(f)

added_count = 0
for sci, kr in sorted(unique_orders.items()):
    found = False
    for o in existing_data['orders']:
        if o.get('scientificName', '').lower() == sci.lower() or (kr and o.get('commonName') == kr):
            found = True
            if not o.get('commonName') and kr:
                o['commonName'] = kr
            break
    if not found:
        existing_data['orders'].append({
            "usageKey": None,
            "scientificName": sci,
            "commonName": kr,
            "koreaObservationCount": 0
        })
        added_count += 1
        print(f"Added: {sci} ({kr})")

existing_data['totalOrdersFound'] = len(existing_data['orders'])
with open(JSON_FILE, 'w', encoding='utf-8') as f:
    json.dump(existing_data, f, ensure_ascii=False, indent=2)

print(f"\nSaved to {JSON_FILE}. Added {added_count} new orders.")
