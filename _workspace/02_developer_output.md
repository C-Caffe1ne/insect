## 정리 작업 완료

`_workspace/01_requirements.md`(사용자 요구사항)과 `_workspace/03_review_output.md`(인벤토리)을 입력으로, 사용자 일괄 승인 하에 다음 네 단계를 순차 실행했다. 모든 단계 전후로 grep 기반 안전 검사를 수행했다.

### A. GBIF 텍스트 제거

- **대상**: `project/index.html` 함수 `enrichSpeciesWithEol(species)` 내부 description 합성 블록
- **변경**: 라인 3194의 1줄 제거
  ```diff
    if (Array.isArray(t.visitsFlowersOf) && t.visitsFlowersOf.length > 0) desc.push(`방문 꽃: ...`);
  - if (t.gbifRecords) desc.push(`GBIF 관측 기록: ${Number(t.gbifRecords).toLocaleString('ko-KR')}건`);
    if (Array.isArray(t.introduced) && t.introduced.length > 0) desc.push(`도입 지역: ...`);
  ```
- **부수 영향 없음**: 인접 4개 `desc.push(...)` 분기는 독립적으로 동작
- **재확인**: `grep -c "GBIF 관측 기록" project/index.html` → **0**
- **보존(범위 밖)**: 이미지 출처 메타데이터(`source: 'GBIF'`, `species-credit-source--gbif`), GBIF 라이선스 폴백, 디버그 console.error, 주석류 9곳은 03 문서 지침대로 모두 유지

### B. 빈 JS 제거

- **대상**: `project/index.html`의 인기 목 Top 6 블록 (라인 2139~2181, 약 43줄)
- **근거**: `popularOrderList`라는 ID를 가진 HTML 요소가 존재하지 않아 `if (popList)` 가드가 영구적으로 false → dead code
- **변경**: 주석 라인부터 닫는 중괄호까지 전체 블록 제거. `setCount('count-natural-monument', ...)` 직후 바로 함수 종료 블록으로 이어짐
- **인라인 `<script>` 구문 검증**: `new Function(scriptBody)` 통과 → **OK (2182줄)**
- **재확인**: `grep -c "popularOrderList" project/index.html` → **0**

### C. 빈 CSS 제거

#### C-1. 미사용 클래스 21개 (HTML/JS 0 hit 재확인 후 제거)

| 클래스 셀렉터 | 제거 위치(원래 라인) | 비고 |
|---|---|---|
| `.placeholder-img--iridescent` | 145 | 그룹 전체 단일 블록 |
| `.placeholder-img--beetle` | 153 | 〃 |
| `.placeholder-img--butterfly` | 159 | 〃 |
| `.placeholder-img--dragonfly` | 165 | 〃 |
| `.placeholder-img--bug` | 171 | 〃 |
| `.placeholder-img--grasshopper` | 183 | 〃 |
| `.order-card--expanded` | 558 | + 주석 1줄 |
| `.order-body` | 577 | 단일 룰 블록 |
| `.order-kr` | 589 | + `.order-mini-body .order-kr` 자식 셀렉터(632)도 사용처 없어 함께 제거 |
| `.order-card-single` | 1167 | + 주석 1줄 |
| `.order-single-img` | 1174 | 03 문서 추가 후보(동반 미사용) |
| `.order-card-single .order-mini-body .order-name` | 1179 | 부모(`.order-card-single`)와 동반 제거 |
| `.trait-finder-card` | 1301 | + 주석 1줄 |
| `.trait-icons` | 1309 | 〃 |
| `.trait-icon` | 1316 | 〃 |
| `.trait-finder-title` | 1327 | 〃 |
| `.trait-finder-sub` | 1334 | 〃 |
| `.explore-card-sub` | 1365 | 단일 룰 |
| `.random-btn` | 1388 | + `.random-btn:active` 의사클래스(1405) 동반 제거 + 주석 1줄 |
| `.random-icon` | 1410 | 단일 룰 |
| `.explore-card--random` | 2900 | 1줄 inline |
| `.popular-order-list` 계열 | 2903~2950 | `list`, `row`, `row:hover`, `rank`, `name`, `sci`, `count` 일괄 제거 + 주석 1줄 |

- 모든 클래스에 대해 제거 전후 `grep -c <cls> project/index.html` → **0** 재확인
- 사용자 지시문에 명시된 `.order-card-body` / `.order-card-kr`은 style.css에 존재하지 않음. 03 문서의 실제 매칭(`.order-body` / `.order-kr`)을 처리했고, 03이 추가로 식별한 `.order-single-img`도 동반 제거(동일 컨텍스트)
- 잔재 보조 셀렉터(`.order-card-single .order-mini-body .order-name`, `.order-mini-body .order-kr`)는 부모 클래스가 사라져 의미가 없어 함께 제거(보수적으로 단독 `.order-name`/`.order-mini-body` 셀렉터는 보존)

#### C-2. 미사용 CSS 변수

- **실제 제거**: `--bg-elevated`(라인 26), `--green-pale`(라인 31) — 2개
- **정의 자체 없음(따라서 제거 불필요)**: `--ghost`, `--leaf`, `--primary` — style.css에 `var(--xxx)` 호출도 정의도 모두 없음. 03 문서 표에 변수로 표기되어 있으나, grep 결과 단지 BEM modifier 접미사(`.feature-btn--ghost`, `.badge-ring--leaf`, `.feature-btn--primary`)였음. 03의 변수 분류가 부정확한 항목으로 판단해 보고

#### C-3. 파일 크기 변화

- `project/style.css`: **3401줄 → 3198줄 (−203줄)**

### D. cached/ 파일 삭제 (22개)

#### D-1. 로그 (1)
- `merge.log`

#### D-2. 고아 데이터 JSON (8)
- `gbif_names.json`, `korea_insect_families_by_order.json`, `insect_data.json`, `cached_families.json`, `cached_orders.json`, `cached_insect_orders.json`, `korea_insect_orders.json`, `korea_insect_all_species_by_family.json`

#### D-3. 재생성 가능 캐시 (3)
- `ktsn_in_page1_raw.json`, `ktsn_in_page1_summary.json`, `nibr_cache.json` (`ktsn_taxonomy_map.json`은 보존)

#### D-4. 보안 위험 + 구버전 스크립트 (10)
- `api.js`, `test_cypher.js`, `cache_orders.js`, `cache_taxonomy.js`, `korea_insects.js`, `merge_species.js`, `scratch_nibr.py`, `scratch_nibr2.py`, `scratch_nibr_orders.mjs`, `extract_hwp_text.py`

#### D-5. 파일 수 변화

- **cached/ 46 → 24 (−22)**
- (지시문은 "47 → 25"라 명시했으나, 작업 시작 시점의 실제 ls 결과는 46개였음. 차분(-22)은 일치)

#### D-6. 보존 파일 확인 (모두 존재)

- `eol_species_cache.json`, `korea_insect_species_by_family.json` (frontend 의존)
- `eol_api_state.json`, `inat_taxa_state.json` (API 카운터)
- `package.json`, `package-lock.json`
- `ktsn_taxonomy_map.json` (재생성 비용 큼)
- `digital_content_cache_index.json` (NIBR 재캐싱 회피)
- 현역 `.mjs` API 스크립트 16개(`build_search_index.mjs`, `cache_*.mjs`, `fetch_*.mjs`, `merge_*.mjs`, `process_*.mjs`, `nibr_*.mjs`) 모두 보존

### 안전 검사 결과

- [x] `grep -c "GBIF 관측 기록" project/index.html` = **0**
- [x] `grep -c "popularOrderList" project/index.html` = **0** (HTML/JS 모두)
- [x] inline `<script>` syntax — `new Function(body)` 통과 (2182줄)
- [x] 제거된 CSS 클래스 21개 각각 HTML/JS 참조 = 0 (개별 grep 통과)
- [x] 제거된 CSS 변수 2개(`--bg-elevated`, `--green-pale`) `var(--…)` 사용 = 0
- [x] cached/ 파일 22개 줄어듦 (46 → 24)
- [x] 핵심 보존 파일 8종 무손실 확인

### 의도와 어긋날 위험 / 의문점 보고

1. **사용자 지시 vs 03 문서 셀렉터 불일치**
   - 지시문은 `.order-card-body`, `.order-card-kr`를 명시했으나 style.css에 그 이름의 룰은 없음. 03 문서가 식별한 실제 미사용 셀렉터(`.order-body`, `.order-kr`)를 보수적으로 정리함. 지시문이 03 문서를 참조하라 명시했으므로 03의 실제 셀렉터를 우선했다.

2. **CSS 변수 5개 중 3개는 정의 자체가 없었음**
   - `--ghost`, `--leaf`, `--primary`는 BEM modifier 접미사(클래스 변형)였으며, `:root`에 정의된 CSS 커스텀 프로퍼티가 아님. 따라서 "제거" 작업이 무의미했고 실행하지 않음. 실제 미사용 변수는 `--bg-elevated`, `--green-pale` 2개만 처리됨.

3. **`order-mini-body` 컨텍스트 잔재 정리**
   - 부모 `.order-kr` / `.order-card-single`를 제거하면서, 동일 컨텍스트의 자식 셀렉터 2개(`.order-mini-body .order-kr`, `.order-card-single .order-mini-body .order-name`)도 함께 정리. 단독 `.order-mini-body` 및 `.order-name`은 보존하여 다른 사용처에 영향 없음.

4. **cached/ 시작 시점 파일 수**
   - 지시문 명시 47개 vs 실측 46개. 그러나 삭제 대상 22개 전부 존재 확인 후 제거하였으므로 결과는 정상(46-22=24).

### 다음 단계 권고

- `qa-agent`에게 회귀 재검증 요청:
  - 종 상세 다이얼로그(`enrichSpeciesWithEol`)에서 description 합성이 정상 동작하는지(GBIF 라인 제거 후에도 4개 분기로 ' · ' 구분자 유지)
  - 검색/Discover 페이지의 통계 카드(`count-endangered/endemic/invasive/natural-monument`) 렌더링 정상
  - Discover의 분류 보기 탭(`order-mini-*` 컴포넌트), Explore 카드(`--danger/heritage/endemic/invasive`)가 시각적으로 그대로인지
- HTML 셀렉터/JS querySelector 교차 비교는 위에서 grep 기반으로 1차 통과했으나, 런타임 회귀(클릭/탭 전환) 검증은 QA 영역으로 남김
