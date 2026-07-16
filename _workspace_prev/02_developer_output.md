## 구현 완료

내정보(`#pageProfile`) "최근 본 곤충" 섹션의 "전체 보기" 링크 → 전용 서브페이지 `#pageRecent` 신설.
`#pageSaved`(즐겨찾기 전체보기) 패턴을 그대로 복제했으며, **신규 CSS 클래스 없이** 기존 `.saved-*`/`.result-*`/`.empty-*` 클래스를 id만 바꿔 재사용했다.

### 생성/수정된 파일
- `project/index.html` (5곳 수정, 순수 추가 — 삭제 없음)
- `project/style.css` — **수정 없음**

### 수정 위치 (변경 후 기준 줄 번호대)
1. **`#pageRecent` 마크업 추가** (약 492~528행): `#pageSaved` 종료 직후, `#pageProfile` 주석 앞에 신규 `<div class="page" id="pageRecent">` 삽입.
2. **프로필 "최근 본 곤충" 전체보기 링크에 id 부여** (약 586행): `<a href="#" class="profile-view-all">` → `id="profileRecentViewAll"` 추가.
3. **`syncNavForPage()` 조건 확장** (약 1681행): `else if` 분기에 `|| pageId === 'pageRecent'` 추가 → 하단 네비 "내 정보" 탭 활성 유지.
4. **라우팅 리스너 2종 추가** (약 1932~1945행): `profileSavedViewAll` 리스너 블록 바로 뒤에 `recentBackBtn`(뒤로가기) + `profileRecentViewAll`(전체보기) 리스너 등록.
5. **`renderRecentPage()` 함수 + `pageshow:pageRecent` 등록 추가** (약 3478~3515행): 기존 "── 최근 본 곤충 ──" 섹션 내 `renderProfileRecent` 등록 직후에 배치.

### 추가한 HTML 마크업 요약 (id 목록)
- `pageRecent` — `<div class="page">` 서브페이지 컨테이너
- `recentBackBtn` — 뒤로가기 버튼 (`.saved-back-btn` 재사용)
- `recentResultList` — 결과 리스트 `<ul>` (`.saved-result-list` 재사용, `hidden` 초기값)
- 빈 상태 `.saved-empty-state` div — `hidden` 속성 없이 마크업 (JS 토글 컨벤션 동일), 문구만 최근-맥락으로 교체
- `profileRecentViewAll` — 프로필 섹션 "전체 보기" 링크 (기존 `<a>`에 id만 부여)

문구: 제목 "최근 본 곤충", 서브 "최근에 조회한 곤충들을 다시 확인해보세요.", 빈 상태 타이틀 "아직 조회한 곤충이 없습니다", 빈 상태 서브 "도감에서 곤충 상세 정보를 확인하면 여기에 기록됩니다."

### 추가/수정한 JS 함수 목록
- **`renderRecentPage()` (신규, async)** — `#recentResultList` 렌더. `loadRecent()` 배열을 **순서대로 순회**하며 각 항목을 `search_index`에서 매칭(`insects.find`)해 최근 조회 순서를 보존한다. 매칭 성공 항목만 `buildResultItem(ins, 'pageRecent')`로 카드 생성. `document.addEventListener('pageshow:pageRecent', renderRecentPage)`로 페이지 표시 시 자동 재렌더.
- **`syncNavForPage()` (수정)** — `pageId === 'pageRecent'` 조건 추가.
- **리스너 (신규 2종)** — `recentBackBtn` 클릭 → `showPage('pageProfile', { restoreScroll: true, dir: 'back' })`; `profileRecentViewAll` 클릭 → `e.preventDefault()` 후 `showPage('pageRecent', { dir: 'forward' })`. 둘 다 `navProfile.classList.add('active')` 동반 (기존 saved 패턴과 동일).

### 재사용한 기존 함수 (중복 구현하지 않음)
- `loadRecent()`, `saveRecent()`, `pushRecentEntry()` — 최근 목록 저장/조회 (index.html 기존 정의, 수정 없음)
- `canonicalizeSciName()` — 학명 정규화 매칭
- `loadSearchIndex()` — search_index 로드
- `buildResultItem(ins, fromPage)` — 결과 카드 `<li>` 생성 (두 번째 인자 `fromPage`가 `openSpeciesFromIndex` → `openSpeciesDetail`로 전파됨을 소스에서 확인)
- `openSpeciesFromIndex()` / `openSpeciesDetail()` — 종 상세 진입 (직접 호출 없이 `buildResultItem` 경유)
- `showPage()`, `syncNavForPage()` — 라우팅

### `buildResultItem(ins, 'pageRecent')` — 뒤로가기 복귀 경로 검증
- `buildResultItem(ins, 'pageRecent')`(2046행) → 클릭 시 `openSpeciesFromIndex(ins, 'pageRecent')`(2088행) → `openSpeciesDetail(species, 'pageRecent')`(2152행) → `previousSpeciesPage = 'pageRecent'` 저장 후 `showPage('pageSpeciesDetail', { keepNav: true })`.
- `pageSpeciesDetail`은 `PAGE_HASHES`에 있으므로 `keepNav` 진입 시 `_subPageBackTarget['pageSpeciesDetail'] = prevActive.id`(= `pageRecent`)가 기록되고 `pushState` 발생.
- 종 상세 뒤로가기(`speciesDetailBackBtn`)는 `history.back()` → `popstate`에서 `e.state.page === 'pageRecent'`로 복귀, `showPage('pageRecent', ...)` + `syncNavForPage('pageRecent')` 실행 → navProfile 활성 유지 + `pageshow:pageRecent`로 `renderRecentPage()` 재렌더. **엉뚱한 페이지 복귀 버그 없음 확인.**

### 예외 처리 반영
- **매칭 실패 항목 조용히 스킵**: `arr.forEach` 내부 `if (ins) frag.appendChild(...)` — search_index에 없는(데이터 갱신·오염) 학명은 throw 없이 건너뜀.
- **전부 매칭 실패로 frag가 빈 경우**: `if (!frag.childElementCount)` 가드로 빈 상태(empty state) 표시 + `list.hidden = true`.
- **최근 목록 자체가 빈 경우**: `arr.length === 0` 조기 반환으로 빈 상태 표시.
- **콘텐츠 보호**: `_protectRoot` 위임 리스너가 `.app` 전체를 커버하므로 신규 페이지 별도 처리 불필요 (자동 적용).

### 라우팅 등록 관련 확인
- `SWIPE_BACK_BLOCKED_PAGES`(1030행), `PAGE_HASHES`(1650행 부근), `_subPageBackTarget`(1033행) **어디에도 `pageRecent`를 추가하지 않음** — `pageSaved`와 동일하게 `replaceState`만 발생하는 단순 서브페이지로 유지. 뒤로가기도 `history.back()`이 아닌 직접 `showPage('pageProfile', ...)` 호출.
- `allPages`(`document.querySelectorAll('.page')`)가 런타임 조회이므로 신규 `.page` div는 `showPage`/`popstate`가 자동 인식 — 별도 등록 불필요.

### style.css 수정 사유
- **수정 없음.** 요구사항대로 기존 `.saved-*`/`.result-*`/`.empty-*` 클래스를 id만 바꿔 100% 재사용.
- 단, 빈 상태 아이콘 SVG는 즐겨찾기의 **하트** 대신 **시계(원+시침/분침)** path로 교체했다. 이는 `.empty-icon-glow` 컨테이너 내부의 인라인 SVG path 변경일 뿐 **CSS 규칙 추가·수정이 전혀 없으며**, "최근 본 곤충" 맥락상 하트(=즐겨찾기 의미) 아이콘이 부적절하기 때문이다. 색·크기·글로우 스타일은 기존 클래스 그대로 상속된다.

### 검증 완료 사항
- 신규 id 4종(`pageRecent`/`recentBackBtn`/`recentResultList`/`profileRecentViewAll`) 모두 문서 내 유일(grep `-c` = 1).
- 신규 JS 참조 4건(함수 정의·리스너 2종·이벤트 등록) 존재 확인.

### 코드 리뷰어 확인 요청 사항
- `renderRecentPage()`의 `insects.find()` O(n) 순회가 최근 항목 최대 30개 × insects 300종 규모에서 성능상 허용 범위인지 (즐겨찾기 `renderSavedPage`는 `filter` 단일 순회, 이쪽은 순서 보존 위해 항목별 `find`). 실사용 규모에선 무해하다고 판단했으나 확인 요청.
- 빈 상태 아이콘을 시계로 교체한 판단(CSS 무수정, semantic 개선)이 프로젝트 디자인 컨벤션과 상충하지 않는지.
