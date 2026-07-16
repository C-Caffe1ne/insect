## 요구사항

### 사용자 요청
내정보(#pageProfile) 페이지의 "최근 본 곤충" 섹션에 있는 "전체 보기" 링크를 눌렀을 때, 최근 조회한 곤충 전체 목록(최대 30개)을 볼 수 있는 새 페이지를 구성해줘.

### 분류된 작업 유형
기능 추가 (신규 서브페이지 + 라우팅 배선)

### 관련 파일
- `project/index.html` (신규 `<div class="page" id="pageRecent">` 마크업 + JS 라우팅/렌더 함수 추가)
- `project/style.css` — 원칙적으로 **신규 CSS 불필요**. 아래 "기존 자산 재사용" 참조.

---

### 배경 조사 결과 (기존 코드 실측)

즐겨찾기(favorites) 기능이 이미 동일한 패턴("프로필 미리보기 → 전체 보기 버튼 → 전용 서브페이지")으로 구현되어 있다 (`#pageSaved`). 신규 "최근 본 곤충 전체보기" 페이지는 **이 패턴을 그대로 복제**하면 된다.

#### 1. HTML 참고 대상 — `#pageSaved` (index.html 464~490행)
```html
<div class="page" id="pageSaved">
  <div class="saved-page-header">
    <button class="saved-back-btn" id="savedBackBtn" aria-label="뒤로">
      <svg ...>...</svg>
    </button>
    <h2 class="saved-page-title">즐겨찾는 곤충</h2>
    <p class="saved-page-sub">관심 있는 곤충들이 여기에 저장됩니다.</p>
  </div>
  <ul class="saved-result-list" id="savedResultList" role="list" hidden></ul>
  <div class="saved-empty-state">
    <div class="empty-icon-glow"><svg ...>...</svg></div>
    <p class="empty-title">저장된 곤충이 없습니다</p>
    <p class="empty-sub">도감에서 마음에 드는 곤충을 발견하면 하트를 눌러보세요.</p>
  </div>
</div>
```
- `.saved-empty-state` div는 마크업에 `hidden` 속성이 없다 (JS가 `removeAttribute`/`setAttribute('hidden','')`로 토글). 신규 페이지도 동일한 컨벤션을 따를 것.
- **클래스는 그대로 재사용**하고 `id`만 신규로 부여 (`pageRecent`, `recentBackBtn`, `recentResultList`). 이렇게 하면 `style.css` 수정이 전혀 필요 없다.
- `<h2>`/`<p>` 문구만 "최근 본 곤충" 맥락으로 교체 (예: 제목 "최근 본 곤충", 서브 "최근에 조회한 곤충들을 다시 확인해보세요.", 빈 상태 타이틀 "아직 조회한 곤충이 없습니다", 빈 상태 서브 "도감에서 곤충 상세 정보를 확인하면 여기에 기록됩니다.")
- 삽입 위치: `#pageSaved` 뒤, `#pageProfile` 앞 (기존 페이지 순서 컨벤션 유지).

#### 2. 라우팅/렌더 JS 참고 대상

**(a) 프로필 → 전체보기 링크 연결** (index.html 1894~1898행, `profileSavedViewAll` 패턴):
```js
document.getElementById('profileSavedViewAll').addEventListener('click', (e) => {
  e.preventDefault();
  showPage('pageSaved', { dir: 'forward' });
  document.getElementById('navProfile').classList.add('active');
});
```
- 프로필 페이지의 "최근 본 곤충" 섹션 헤더(index.html 583~586행)의 `<a href="#" class="profile-view-all">전체 보기</a>` 에는 **id가 없다** — `id="profileRecentViewAll"` 를 추가하고 위와 동일한 패턴으로 `pageRecent`를 열도록 리스너 등록.

**(b) 서브페이지 뒤로가기** (index.html 1888~1891행, `savedBackBtn` 패턴):
```js
document.getElementById('savedBackBtn').addEventListener('click', () => {
  showPage('pageProfile', { restoreScroll: true, dir: 'back' });
  document.getElementById('navProfile').classList.add('active');
});
```
- `recentBackBtn`에 동일 패턴 적용 (목적지도 `pageProfile`).
- **주의**: `pageSaved`/`pageRecent`는 `pageFamilyDetail`/`pageSpeciesDetail`과 달리 `keepNav:true`로 열리지 않는다 (history push 없이 `replaceState`만 발생 — `showPage()` 1735~1746행 로직 확인). 따라서 뒤로가기 버튼은 `history.back()`이 아니라 **직접 `showPage('pageProfile', ...)` 호출**이어야 한다 (`familyDetailBackBtn`처럼 `history.back()`을 쓰면 안 됨 — 히스토리 스택이 다른 패턴이므로 오작동).

**(c) 네비게이션 하이라이트 동기화** (`syncNavForPage`, index.html 1677~1685행):
```js
function syncNavForPage(pageId) {
  allNavItems.forEach(n => n.classList.remove('active'));
  let activeId;
  if (pageId === 'pageSearch') activeId = 'navSearch';
  else if (pageId === 'pageProfile' || pageId === 'pageSaved') activeId = 'navProfile';
  else activeId = 'navDiscover';
  ...
}
```
- 조건문에 `pageId === 'pageRecent'` 를 추가해 하단 네비 "내 정보" 탭이 계속 활성 상태로 표시되도록 한다.

**(d) 목록 렌더링 함수** — `renderSavedPage()` 참고 (index.html 3338~3370행):
```js
async function renderSavedPage() {
  const list = document.getElementById('savedResultList');
  const emptyState = document.querySelector('#pageSaved .saved-empty-state');
  if (!list) return;
  const favs = loadFavorites();
  list.innerHTML = '';
  if (favs.size === 0) { emptyState?.removeAttribute('hidden'); list.hidden = true; return; }
  const data = await loadSearchIndex();
  const insects = data?.insects || [];
  const canonicalFavs = new Set([...favs].map(id => canonicalizeSciName(id)));
  const matched = insects.filter(ins => canonicalFavs.has(canonicalizeSciName(ins.sci)));
  if (matched.length === 0) { emptyState?.removeAttribute('hidden'); list.hidden = true; return; }
  emptyState?.setAttribute('hidden', '');
  list.hidden = false;
  const frag = document.createDocumentFragment();
  matched.forEach(ins => frag.appendChild(buildResultItem(ins, 'pageSaved')));
  list.appendChild(frag);
}
document.addEventListener('pageshow:pageSaved', renderSavedPage);
```

새로 만들 `renderRecentPage()`는 **즐겨찾기와 달리 순서가 중요**하다 (최근 조회 순, `loadRecent()` 배열이 이미 최신순 정렬됨 — `pushRecentEntry`가 `unshift` 사용, index.html 3388~3396행). 따라서 `insects.filter()`가 아니라 **`loadRecent()` 배열을 순회하며 각 항목을 `search_index`에서 매칭**해야 순서가 보존된다:

```js
async function renderRecentPage() {
  const list = document.getElementById('recentResultList');
  const emptyState = document.querySelector('#pageRecent .saved-empty-state');
  if (!list) return;
  const arr = loadRecent();
  list.innerHTML = '';
  if (arr.length === 0) { emptyState?.removeAttribute('hidden'); list.hidden = true; return; }
  const data = await loadSearchIndex();
  const insects = data?.insects || [];
  const frag = document.createDocumentFragment();
  arr.forEach(entry => {
    const canonical = canonicalizeSciName(entry.sci);
    const ins = insects.find(i => canonicalizeSciName(i.sci) === canonical);
    if (ins) frag.appendChild(buildResultItem(ins, 'pageRecent'));
  });
  if (!frag.childElementCount) { emptyState?.removeAttribute('hidden'); list.hidden = true; return; }
  emptyState?.setAttribute('hidden', '');
  list.hidden = false;
  list.appendChild(frag);
}
document.addEventListener('pageshow:pageRecent', renderRecentPage);
```
- `loadRecent`, `canonicalizeSciName`, `loadSearchIndex`, `buildResultItem`, `openSpeciesFromIndex` 는 모두 기존 함수 재사용 (신규 정의 금지, 중복 로직 추가 금지).
- `buildResultItem(ins, 'pageRecent')` 의 두 번째 인자(`fromPage`)는 `openSpeciesFromIndex` → `openSpeciesDetail` 로 전달되어 종 상세 페이지의 뒤로가기 목적지로 쓰인다 (`pageSpeciesDetail` 뒤로가기 시 `pageRecent`로 복귀). 반드시 `'pageRecent'` 로 넘길 것 (`'pageSaved'`를 그대로 두면 종 상세에서 뒤로가기 시 엉뚱한 페이지로 이동하는 버그가 생김).
- 이 함수 배치 위치: 기존 "── 최근 본 곤충 ──" 섹션(index.html 3374행 부근, `renderProfileRecent` 함수 근처)에 함께 둘 것.

#### 3. 신규 페이지 삽입 시 자동으로 해결되는 것
- `allPages`(`document.querySelectorAll('.page')`, index.html 1648행)는 스크립트 실행 시점에 DOM을 조회하므로, `<div class="page" id="pageRecent">`를 body 안에 추가하기만 하면 `showPage()`/`popstate` 로직이 자동으로 인식한다. 별도 등록 불필요.
- `pageSaved`가 `SWIPE_BACK_BLOCKED_PAGES`(index.html 998행)와 `PAGE_HASHES`(1650행), `_subPageBackTarget`(1001행)에 **포함되어 있지 않다** — `pageRecent`도 동일하게 **어디에도 추가하지 말 것** (네이티브 엣지 스와이프 대상이 아닌 단순 replaceState 페이지로 유지, pageSaved와 동일 취급).

### 예외 처리 / 엣지 케이스
- `entoma_recent`에 저장된 항목의 학명이 현재 `search_index.json`에 없는 경우(데이터 갱신으로 종이 빠졌거나 오염된 경우) 해당 항목은 조용히 스킵 (`if (ins) frag.appendChild(...)`) — 에러 throw 금지.
- 최근 목록은 있으나 전부 매칭 실패로 `frag`가 비는 경우도 빈 상태(empty state)로 처리.
- 콘텐츠 보호 로직(`_protectRoot` 위임 리스너, CLAUDE.md "콘텐츠 보호" 섹션 참고)은 `.app` 컨테이너 전체에 이벤트 위임으로 걸려 있으므로 신규 페이지에 별도 처리 불필요 (자동 커버).

### 구현 방식 제약 (CLAUDE.md 준수)
- JS는 `index.html` 최하단 인라인 `<script>` 블록에만 작성. 외부 `.js` 파일 생성 금지.
- **`project/style.css` 신규 규칙 추가 금지** — 기존 `.saved-*`/`.result-*`/`.empty-*` 클래스를 id만 바꿔 재사용하는 것이 이번 작업의 핵심 설계 의도. 만약 실제 작업 중 재사용이 불가능한 시각적 차이가 발견되면(예: 아이콘을 다르게 하고 싶은 경우) 최소한으로만 CSS를 추가하고 사유를 `02_developer_output.md`에 남길 것.
- 인덴트 공백 2칸, 세미콜론, `const`/`let`(`var` 금지).
- 기존 주석 스타일(한글+영문 혼용) 유지, 불필요한 주석 추가 금지.
- 코드 삭제 전 `grep` 로 참조처 확인 (이번 작업은 삭제 없음, 순수 추가).
- 한 응답에서 같은 파일을 두 번 수정하지 말 것.

### 참고 사항
- `RECENT_KEY = 'entoma_recent'`, `RECENT_MAX = 30`, `loadRecent()`/`saveRecent()`/`pushRecentEntry()` 는 이미 구현되어 있음 (index.html 3374~3400행) — 그대로 사용, 수정 불필요.
- 기존 프로필 페이지의 "최근 본 곤충" 미리보기(`renderProfileRecent`, 최대 5장)는 이번 작업과 무관하게 그대로 유지 (건드리지 말 것). 이번 작업은 그 옆의 "전체 보기" 링크가 실제로 동작하게 만드는 것.
