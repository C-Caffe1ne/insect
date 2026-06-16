## 구현 완료

### 변경 파일
- **project/index.html**
  - 태스크 1: `#pageProfile`의 "Badges Earned" `<section>` 전체 삭제. 통계 캡슐에서 BADGES stat item + 인접 divider 1개 삭제 (이제 조회 | 저장, divider 1개).
  - 태스크 2: 영어 → 한글 번역 (aria-label, stat label, 섹션 제목/부제, VIEW ALL→전체 보기 3곳, FAVORITE→즐겨찾기 2곳, recent-time-badge 3개, `<title>`, meta description).
  - 태스크 4: `#pageSaved`에 `<ul id="savedResultList" hidden>` 추가. `buildResultItem(ins, fromPage='pageSearch')`로 파라미터화. `renderSavedPage()` + `pageshow:pageSaved` 리스너 추가.
- **project/style.css**
  - 태스크 1: `.profile-badges-scroll`, `.badge-item`, `.badge-ring`(및 `--leaf/--star/--moon/--beetle`), `.badge-name` 블록 전체 삭제.
  - 태스크 3: `@font-face`(Line Seed KR) `font-weight: 400` → `100 900`, `font-display: swap` 추가.
  - 태스크 4: `.saved-result-list` 규칙 추가.

### 데이터 바인딩 (태스크 4)
- 출처: `localStorage('entoma_favorites')` (학명 Set) + `search_index.json`의 `insects[]`.
- `renderSavedPage()`가 `pageshow:pageSaved` 이벤트(=Saved 페이지 진입 시마다, 클릭/popstate 모두)에서 실행 → 즐겨찾기 비어 있으면 empty-state, 있으면 매칭 종을 `buildResultItem(ins, 'pageSaved')`로 렌더.
- 카드 클릭 시 `openSpeciesFromIndex(ins, 'pageSaved')` → `openSpeciesDetail(..., 'pageSaved')` → `previousSpeciesPage='pageSaved'` → 종 상세에서 뒤로가기 시 즐겨찾기 페이지로 복귀.

### 주요 결정 사항 / 스펙 보완
1. **즐겨찾기 ID 정합성 버그 수정 (중요).** 요구사항 코드는 `favs.has(ins.sci)`로만 매칭하지만, 실제 데이터에서 `ins.sci`에는 저자명이 포함됨 (예: `"Anax parthenope (Selys)"`, 샘플 300종 중 183종이 괄호 포함). 반면 즐겨찾기 ID는 종 상세 진입 시 `getFavId → species.scientificName = canonical(저자/연도 제거)`로 저장됨 (예: `"Anax parthenope"`). 그대로면 저장된 즐겨찾기가 한 건도 매칭되지 않음. 따라서 `renderSavedPage`의 필터를 `favs.has(ins.sci) || favs.has(canonicalizeSciName(ins.sci))`로 보완함.
2. **Step B는 수정 불필요.** `openSpeciesFromIndex(ins, fromPage='pageSearch')`가 이미 `fromPage`를 받아 `openSpeciesDetail(..., fromPage)`로 전달하고, `openSpeciesDetail`이 `previousSpeciesPage = fromPage`를 설정함. 별도 수정 없이 'pageSaved' 흐름이 작동.
3. `loadSearchIndex()`가 캐시/네트워크 모두 항상 `{insects:[...]}` 데이터 객체로 resolve → `await loadSearchIndex()` 안전.
4. 라인 94의 `featured-tag` "TODAY"(Discover 페이지)는 태스크 범위(`recent-time-badge`)가 아니므로 그대로 둠.

### 검증 포인트 (qa-agent)
1. 즐겨찾기 추가 → 즐겨찾기 탭 진입 시 카드 노출 / 즐겨찾기 0건일 때 empty-state 노출, 리스트 `hidden`.
2. 즐겨찾기 카드 클릭 → 종 상세 → 뒤로가기 시 즐겨찾기 페이지로 복귀(검색/홈 아님).
3. 즐겨찾기 해제 후 페이지 재진입 시 목록에서 사라지는지 (pageshow마다 갱신).
4. 저자명 포함 학명 종(예: Anax parthenope)을 즐겨찾기해도 목록에 정상 표시되는지 (canonical 매칭).
5. 프로필 통계 캡슐: 조회 | 저장 2개 + divider 1개만 표시, BADGES/뱃지 흔적 없음.
6. 한글 번역 누락 없는지, `<title>`/meta description 한글 반영.
7. JS 문법 검증 완료 (`new Function(code)` 파싱 통과).
