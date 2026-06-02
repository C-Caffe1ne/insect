## QA 회귀 검증 결과

> 검증 모드: 정적 분석 (grep / jq / node `new Function`). 실제 브라우저 런타임은 "수동 테스트 필요" 항목으로 분리.
> 입력: `_workspace/02_developer_output.md`, `_workspace/03_review_output.md`.
> 작업 대상: `project/index.html`, `project/style.css`, `cached/`.

---

### Pass

#### A. 데이터 무결성 (모두 OK)
- `project/eol_species_cache.json` (3,816,410 B) — JSON 파싱 OK
- `project/korea_insect_species_by_family.json` (1,023,813 B) — JSON 파싱 OK
- `project/search_index.json` (6,410,138 B) — JSON 파싱 OK
- `cached/eol_species_cache.json` (3,816,410 B) — 보존, JSON OK
- `cached/korea_insect_species_by_family.json` (1,023,813 B) — 보존, JSON OK
- `cached/eol_api_state.json` (70 B), `cached/inat_taxa_state.json` (69 B) — 보존, JSON OK
- `cached/ktsn_taxonomy_map.json` (144,830 B) — 보존, JSON OK
- `cached/digital_content_cache_index.json` (270 B) — 보존, JSON OK

#### B. 삭제 검증 — 22개 파일 모두 부재 확인
- `cached/`에서 `merge.log`, `gbif_names.json`, `korea_insect_families_by_order.json`, `insect_data.json`, `cached_families.json`, `cached_orders.json`, `cached_insect_orders.json`, `korea_insect_orders.json`, `korea_insect_all_species_by_family.json`, `ktsn_in_page1_raw.json`, `ktsn_in_page1_summary.json`, `nibr_cache.json`, `api.js`, `test_cypher.js`, `cache_orders.js`, `cache_taxonomy.js`, `korea_insects.js`, `merge_species.js`, `scratch_nibr.py`, `scratch_nibr2.py`, `scratch_nibr_orders.mjs`, `extract_hwp_text.py` — 22/22 모두 부재 확인
- cached/ 디렉토리 현재 파일 수: 24 (보고서 일치)

#### C. project/ 의존성 검증
- `project/index.html` fetch 호출 4건 모두 대상 파일 존재:
  - `fetch('korea_insect_species_by_family.json')` (line 1315) → 존재
  - `fetch('taxonomy/index.json')` (line 1888) → 존재
  - `fetch('search_index.json')` (line 2105) → 존재
  - `fetch('eol_species_cache.json')` (line 3093) → 존재
- `project/taxonomy/`: index.json + orders/(34) + families/(36 디렉토리) 모두 존재
- 인라인 `<script>` 1개(2,182줄) — Node `new Function(body)` syntax 통과. 중괄호 556/556 균형.

#### D. 텍스트/코드 잔존 검사
- `grep -c "GBIF 관측 기록" project/index.html` = 0
- `grep -c "popularOrderList" project/index.html` = 0
- 삭제된 CSS 클래스 21개 (`.trait-finder-*`, `.random-btn/-icon`, `.order-card-single`, `.order-card--expanded`, `.order-card-body`, `.order-card-kr`, `.order-body`, `.order-kr`, `.order-single-img`, `.placeholder-img--{beetle,bug,butterfly,dragonfly,grasshopper,iridescent}`, `.explore-card--random`, `.explore-card-sub`, `.popular-order-list`) → HTML/CSS 모두에서 grep 결과 0건
- 보존 권장된 GBIF 데이터 파이프라인은 정상 유지: 라인 1716/1719/1736-1744/1763-1764(이미지 폴백, source/license), 라인 3172-3174(enrichSpeciesWithGbif 함수 진입점), 3208-3215(분류 보강), 3247-3249(distribution), 3370(console.error)

#### E. cached/ 현역 스크립트 영향 — 모두 OK
삭제된 22개 파일을 입력으로 읽는 곳은 없음(모두 출력 대상이거나 optional cache):
- `fetch_orders.mjs:82` `existsSync()` 가드 후 read, `writeFileSync(JSON_FILE)`로 항상 출력 → optional 입력
- `fetch_species_by_family.mjs:365` `korea_insect_all_species_by_family.json`은 출력 전용
- `nibr_search.mjs:35` `existsSync()` 가드 후 read → optional 캐시
- `nibr_orders_fetch.mjs:18,123` `korea_insect_orders.json`은 출력 전용
- `fetch_ktsn_page1.mjs` 두 ktsn 파일 모두 출력 전용
- `process_ktsn_in_page1.mjs:74` `existsSync(RAW)` 가드 — RAW 없으면 종료 (fetch_ktsn_page1.mjs 선행 실행 필요, 정상 흐름)
- 결론: 어떤 .mjs도 깨지지 않음. 재실행 시 모두 정상 생성.

#### F. CSS 변수 검증
- `--bg-elevated`, `--green-pale`: 정의 0건, var() 호출 0건 — 정상 제거 확인
- `--ghost`, `--leaf`, `--primary`: 정의 0건, var() 호출 0건 — web-developer 보고대로 원래 정의가 없었음을 재확인
- `:root`에 정의된 CSS custom property 정상 (--bg-deep, --bg-app, --bg-card, --bg-input, --green-dim/-mid/-soft, --text-primary/-secondary/-muted/-faint, --border-*, --radius-*, --font-*, --status-*, --section-*, --search-card-* 등)

#### G. 회귀 시나리오 — 정적 분석 Pass
- **시나리오 1 (분류 보기 탭 → 목 카드 펼치기)**: `.order-card-mini` (1363), `.order-card-mini.expanded` (1493/2914/2926 등) 셀렉터-요소-JS 핸들러 매칭 정상. popularOrderList 블록 제거가 영향 주지 않음 (블록 자체가 dead code였음).
- **시나리오 2 (종 상세 description 합성)**: `enrichSpeciesWithEol` 내부 `desc.push` 분기 5개 (영명/일본어/먹이/방문 꽃/도입 지역) 정상 존재 (line 3147-3151). ' · ' join 정상 동작. GBIF 라인만 제거됨. 다른 EOL/GBIF 보강 경로(이미지, vernaculars.ko 통명, authorship 명명자, taxonomy 보강, distributions habitat 보강)는 모두 그대로.
- **시나리오 3 (검색 카테고리 카드 → 필터 → 제거 버튼)**: `#searchResultArea`/`#searchResultHeader`/`#searchResultSummary`/`#searchResultList`/`#searchResultSort`/`#searchClearFilterBtn` HTML-JS 셀렉터 모두 매칭. `.explore-card--danger/-endemic/-invasive/-heritage` 4종 모두 CSS 정의 + HTML 사용 + JS data-category 처리 정상.

---

### Fail
없음. (작업으로 생긴 새 버그·깨진 셀렉터·잘못된 파싱 0건)

---

### 회귀 (작업으로 인한 새 버그)
없음. 22개 파일 삭제, 1줄 텍스트 제거, dead JS 블록 제거, 미사용 CSS 21클래스/2변수 제거가 사용처 영향 없이 완료됨.

---

### 정리 미흡 (Critical 아님, 정보성)
다음은 회귀 버그가 아니라 web-developer가 함께 정리할 수 있었던 잔재 후보. 03 리뷰 문서의 "2-E. Medium / Low (조심)" 절에서도 동반 제거 후보로 언급됨.

1. **`--search-cat-random` 변수가 고아로 남음** (`project/style.css:2357`)
   - `.explore-card--random` 클래스를 제거했기 때문에 이 CSS 변수의 사용처가 0건이 됨.
   - 다른 동일 그룹(`--search-cat-endangered/-endemic/-invasive`)은 모두 `.explore-card--*` 룰(2746-2748)에서 사용 중.
   - 영향: 없음(미사용 변수일 뿐, 런타임 동작에 영향 없음). 차회 정리 시 함께 제거 가능.

2. **`cached/package.json`의 `"main": "api.js"` 깨진 참조** (`cached/package.json:5`)
   - `api.js`가 삭제됐는데 package.json은 그대로.
   - 영향: 없음(npm 실행 진입점이 아니라 metadata. `node cached/cache_*.mjs` 같은 직접 실행에 영향 없음). 차회 정리 시 `"main"` 필드 삭제 또는 보존 mjs 중 하나로 교체 권장.

3. **web-developer 보고의 cached/ 시작 파일수 불일치** (지시문 47 vs 실측 46)
   - 보고서에서 명시. 검증 결과 현재 24개로 차분(-22)은 정확. 결과 정상.

---

### 수동 테스트 필요
정적 분석으로 충분히 검증되지 않는 항목:
- **시각적 회귀**: 21개 클래스 제거로 인한 카드 레이아웃·간격·여백 미세 변화는 브라우저로 직접 비교 필요 (특히 `.order-mini-body` 자식 셀렉터 일부 제거된 후 mini 카드 텍스트 정렬)
- **종 상세 다이얼로그**: GBIF 관측 기록 라인 제거 후 description 영역이 짧아진 경우의 시각적 균형 (다른 4개 분기가 모두 비어있는 종에서 description 자체가 empty가 될 수 있음 — 단, 이는 기존부터 가능한 상태)
- **EOL 캐시 미로드 시 폴백**: 네트워크 실패 또는 캐시 파일 누락 시 enrich 함수의 catch 경로 동작
- **인기 목 Top 6 기획 부활 시**: 블록을 제거했으므로 향후 기능 재도입 시 HTML 요소 추가 + JS 블록 재작성 필요

---

### 종합: 전체 Pass

정리 작업은 의도한 범위를 정확히 수행했고, 회귀 부작용이 정적 분석 수준에서 발견되지 않음. 데이터 무결성, 셀렉터 일관성, 인라인 script syntax, 시나리오 코드 흐름 모두 통과. `--search-cat-random` 고아 변수와 `cached/package.json`의 `main` 필드는 사소한 정리 잔재로 차회 처리 권장(차단 사유 아님).
