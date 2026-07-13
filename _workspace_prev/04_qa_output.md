## QA 검증 결과

검증 대상: `project/index.html`, `project/style.css`
검증 방식: 경계면 교차 비교 (HTML↔CSS↔JS 셀렉터/클래스/함수 정합성), JS 문법 파싱

### Pass ✅

**QA-1: 뱃지 제거**
- HTML 클래스 제거: `index.html`에서 `badge-item`, `badge-ring`, `badge-name`, `profile-badges-scroll` grep 결과 0건 (exit 1).
- CSS 선택자 제거: `style.css`에서 `.badge-item`, `.badge-ring`, `.badge-name`, `.profile-badges-scroll` grep 결과 0건 (exit 1).
- BADGES 텍스트 제거: `index.html` 전체에서 `BADGES`/`Badges`(주석 포함) grep 0건.
- 통계 캡슐 정상화: `#pageProfile` 통계 컨테이너(`index.html:641-651`)는 `조회`(127) | divider 1개 | `저장`(42) 구조. BADGES stat item 및 잉여 divider 제거 확인.
- "Badges Earned" 섹션 전체 삭제 확인: `#pageProfile`(588~733)에 `profile-section`이 「나의 컬렉션」(656)·「최근 만난 곤충」(688) 2개만 존재.

**QA-2: 영어→한글 번역 (#pageProfile 범위 588~733)**
- aria-label: `뒤로`(592), `설정`(599) — Go Back / Settings 없음.
- stat label: `조회`(644), `저장`(649) — VIEWED / SAVED / BADGES 없음.
- 섹션 제목/부제: `나의 컬렉션`(659) / `관심 있는 곤충들`(660), `최근 만난 곤충`(691) / `최근에 발견한 곤충들`(692).
- 링크: `전체 보기`(662, 694) — VIEW ALL 없음.
- collection-tag: `즐겨찾기`(670, 679) — FAVORITE 없음.
- recent-time-badge: `오늘`(705) / `어제`(716) / `2일 전`(727) — TODAY/YESTERDAY/2 DAYS AGO 없음.
- head: `<title>ENTOMA · KR — 한국 곤충도감`(11), meta description `한국 곤충 분류와 종 정보를 탐색하는 프리미엄 곤충도감입니다.`(13).
- 주의(비결함): 잔존 영어 grep 매치는 HTML 주석 `<!-- My Collection Section -->`(655), `<!-- Recently Encountered Section -->`(687) 및 태스크 범위 밖 Discover 페이지 `featured-tag` "TODAY"(94)뿐. 모두 렌더링 텍스트 아님 → 요구사항 범위 충족.

**QA-3: 즐겨찾기 페이지 JS 연결**
- `<ul id="savedResultList" class="saved-result-list" role="list" hidden>` 존재: `index.html:570`.
- `renderSavedPage` 정의: `index.html:3369` (async function).
- pageshow 리스너: `document.addEventListener('pageshow:pageSaved', renderSavedPage)` — `index.html:3403`.
- `pageshow:pageSaved` 이벤트 실제 발행 확인: `showPage()`가 모든 페이지 전환 시 `document.dispatchEvent(new CustomEvent('pageshow:' + pageId))` 발행 (`index.html:1582`) → Saved 진입 시마다 renderSavedPage 실행됨.
- `buildResultItem(ins, fromPage = 'pageSearch')` 시그니처 파라미터화: `index.html:1742`. 내부 click/keydown 핸들러가 `openSpeciesFromIndex(ins, fromPage)` 호출(1784) → fromPage 반영.
- renderSavedPage가 `buildResultItem(ins, 'pageSaved')` 호출: `index.html:3399`. (리스너 중복 부착 버그 없음 — 단일 버전 buildResultItem 재사용.)
- 의존 함수 전부 존재: `loadFavorites`(3359), `loadSearchIndex`(1663), `canonicalizeSciName`(3025), `.saved-empty-state`(573). 저자명 포함 학명 대응을 위해 `favs.has(ins.sci) || favs.has(canonicalizeSciName(ins.sci))` 필터 적용(3387-3388).

**QA-4: 폰트 설정 (style.css @font-face Line Seed KR, 7~12행)**
- `font-weight: 100 900` 범위로 변경 확인 (style.css:10) — 단일값(400/700) 아님.
- `font-display: swap` 추가 확인 (style.css:12).
- src 단일 `fonts/LINESeedKR-Rg.woff2`(9) 유지, 합성 볼드 허용 구성.

**QA-5: 기존 기능 회귀**
- pageSearch 호출부: `buildResultItem(ins)`(1737), `buildResultItem(ins)`(2185) — 2번째 인자 생략 시 기본값 `'pageSearch'` 적용 → 기존 동작 유지(호환).
- `openSpeciesFromIndex(ins, fromPage='pageSearch')`(1796)가 `openSpeciesDetail({...}, fromPage)`(1813~1848 영역, 35행째 `}, fromPage`)로 전달 → `openSpeciesDetail`(3285)이 `previousSpeciesPage = fromPage`(3287) 설정 → 뒤로가기 시 `showPage(previousSpeciesPage)`(3352)로 복귀. pageSaved 흐름 정상.
- 기존 호출 `openSpeciesFromIndex(ins)`(1935), `(ins, 'pageDiscover')`(1920-1921) 모두 시그니처 호환.
- JS 문법: 인라인 스크립트 블록 `new Function(code)` 파싱 통과 (errors: 0).

### Fail ❌
- 없음.

### 수동 테스트 필요
- 즐겨찾기 canonical 매칭 실제 동작: `localStorage('entoma_favorites')`에 저자명 제거형(예: `Anax parthenope`)으로 저장된 항목이 `search_index.json`의 저자명 포함 `ins.sci`와 canonical 비교로 매칭되는지는 런타임 데이터 의존 → 브라우저에서 실종 추가 후 Saved 진입 확인 권장.
- 합성 볼드 시각 품질: `font-weight: 100 900` 범위 선언으로 600/700 사용처(다수)가 합성 볼드로 렌더되는데, 실제 굵기 표현 품질은 브라우저 렌더링 육안 확인 필요(코드 레벨 검증 불가).
- pageshow 갱신 타이밍: 즐겨찾기 해제 후 재진입 시 목록 갱신은 이벤트 발행 경로상 정상이나, popstate(뒤로가기) 경유 진입에서도 `pageshow:pageSaved` 발행되는지 실브라우저 확인 권장.

### 종합: 전체 Pass
QA-1 ~ QA-5 전 항목 코드 레벨 정합성 통과. 끊긴 경계면(셀렉터-요소, 함수 정의-호출, 이벤트 발행-구독, CSS-HTML 클래스) 없음. Critical/일반 Fail 0건.
