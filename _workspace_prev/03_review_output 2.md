## 코드 리뷰 결과

대상:
- `project/index.html` (1368줄, 인라인 script 757–1365)
- `project/style.css` (1807줄)

---

### Critical (즉시 수정 필요)

#### C-1. XSS — `renderOrders` 확장 카드에서 escapeHTML 우회
[index.html:882–899] `card.innerHTML`에 `${order.scientificName}`, `${order.commonName}`이 escape 없이 그대로 삽입된다. 학명/한글명은 `taxonomy/index.json`에서 오기에 즉각적인 위험은 낮지만, 같은 함수 내 다른 분기(870–875)에서는 `escapeHTML`을 사용하므로 일관성이 깨졌고, JSON이 외부 데이터로 교체되면 즉시 취약해진다.

수정 제안 (882–899):
```js
card.innerHTML = `
  <div class="expanded-img">
    <div class="placeholder-img" style="background: ${bg}"></div>
    <div class="order-img-overlay"></div>
    <span class="order-badge">ORDER</span>
    <button class="expanded-close" onclick="collapseOrder(event)">✕</button>
  </div>
  <div class="expanded-body">
    <h3 class="expanded-title">${escapeHTML(order.scientificName)}</h3>
    <p class="expanded-kr">${escapeHTML(order.commonName)}</p>
    <p class="order-count">${formatCount(order.familyCount)}개 과</p>
    <div class="family-divider">
      <span class="family-divider-label">FAMILIES · ${families.length}</span>
      <button class="see-all family-view-all" data-order-key="${escapeHTML(orderKey)}">전체보기</button>
    </div>
    <ul class="family-list">${familyListHTML}</ul>
  </div>
`;
```

#### C-2. XSS — `renderOrders` 미니 카드에서 escapeHTML 우회
[index.html:902–913] 위와 동일하게 `order.commonName`, `order.scientificName`이 비-escape 상태로 innerHTML에 삽입된다.

수정 제안 (902–913):
```js
card.innerHTML = `
  <div class="order-mini-img">
    <div class="placeholder-img" style="background: ${bg}"></div>
    <div class="order-img-overlay"></div>
    <span class="order-badge">ORDER</span>
  </div>
  <div class="order-mini-body">
    <h3 class="order-name-kr">${escapeHTML(order.commonName)}</h3>
    <p class="order-sci">${escapeHTML(order.scientificName)}</p>
    <p class="order-count">${formatCount(order.familyCount)}개 과</p>
  </div>
`;
```

#### C-3. `openFamilyDetail` fetch에 `.catch()` 누락
[index.html:1096–1102] `executeDetail()`만 호출하고 에러 핸들러가 없다. 네트워크 실패 시 사용자 피드백 없이 영구 정지(빈 페이지)된다.

수정 제안 (1096–1106):
```js
if (!order.families) {
  fetch(`taxonomy/${order.file}`)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      order.families = data.families || [];
      executeDetail();
    })
    .catch(err => {
      console.error('Error fetching order families:', err);
      order.families = order.families || [];
      executeDetail();
    });
} else {
  executeDetail();
}
```

#### C-4. `loadCachedSpecies` / 모든 fetch — HTTP 실패 응답 미감지
[index.html:816–822, 953–957, 1021–1025, 1097–1101, 1187–1190, 1223–1226] `fetch` 후 `r.json()`을 바로 호출한다. 서버가 404/500을 반환하면 `r.ok` 검사 없이 JSON 파싱이 시도되어 SyntaxError가 비동기 체인에서 swallow된다.

수정 제안 (예: 816–822):
```js
function loadCachedSpecies() {
  if (cachedSpeciesData) return Promise.resolve(cachedSpeciesData);
  return fetch('korea_insect_species_by_family.json')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      cachedSpeciesData = data.families || {};
      return cachedSpeciesData;
    });
}
```
다른 fetch도 동일하게 `if (!r.ok) throw …`를 추가하라.

#### C-5. `searchInput` 검색바 — 리스너 미연결
[index.html:46] `pageDiscover`의 검색 인풋(`<input id="searchInput">`)에 이벤트 리스너가 전혀 등록되어 있지 않다. 사용자가 입력해도 아무 동작이 없다(완전한 dead UI).

수정 제안: 입력 시 `pageSearch`로 라우팅하거나 분류 보기 탭에서 즉시 필터링한다.
```js
// Page Navigation 섹션 끝부분에 추가
document.getElementById('searchInput').addEventListener('focus', () => {
  showPage('pageSearch');
  document.getElementById('navSearch').classList.add('active');
  document.getElementById('navDiscover').classList.remove('active');
  const target = document.querySelector('#pageSearch input[type="text"]');
  if (target) setTimeout(() => target.focus(), 0);
});
```
(혹은 `keyup`에서 `ordersData` 필터 후 `renderOrders` 호출)

#### C-6. dead 버튼: `#btnRandom`, `.filter-btn`, `.action-btn[aria-label="Settings"]`
[index.html:47, 413, 517] 어떤 곳에서도 리스너가 부착되지 않은 버튼들. 클릭해도 반응이 없어 사용자가 깨진 기능으로 인식한다.

수정 제안 — 최소한 플레이스홀더 핸들러를 부착하고, 동작 미정 시 disabled 처리하라.
```js
const randomBtn = document.getElementById('btnRandom');
if (randomBtn) {
  randomBtn.addEventListener('click', () => {
    if (!ordersData.length) return;
    const order = ordersData[Math.floor(Math.random() * ordersData.length)];
    expandedOrderKey = getOrderKey(order);
    showPage('pageDiscover');
    document.getElementById('navDiscover').classList.add('active');
    switchDiscoverTab('taxonomy');
    renderOrders(ordersData);
  });
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // TODO: 필터 모달 — 임시로 정렬 토글 사용
    document.getElementById('sortBtn')?.click();
  });
});
```

#### C-7. 캐러셀 mouseup이 윈도우 밖에서 발생하면 드래그 잠김
[index.html:1346–1364] `mousedown` 후 사용자가 카드 영역 밖에서 손을 떼면 `mouseup`이 발화하지 않아 `isDown=true` 상태가 유지된다. 다음 클릭 시 즉시 드래그가 시작되며 `hasDragged` 로직이 어긋난다.

수정 제안 — `window`에 `mouseup`을 등록하고, 가능하면 Pointer Events로 통합:
```js
const familyCarousel = document.getElementById('otherFamilyCarousel');
if (familyCarousel) {
  let isDown = false, startX = 0, scrollLeft = 0, hasDragged = false;

  const stopDrag = () => {
    isDown = false;
    familyCarousel.classList.remove('dragging');
  };

  familyCarousel.addEventListener('mousedown', (e) => {
    isDown = true; hasDragged = false;
    startX = e.pageX - familyCarousel.offsetLeft;
    scrollLeft = familyCarousel.scrollLeft;
    familyCarousel.classList.add('dragging');
  });
  window.addEventListener('mouseup', stopDrag);
  familyCarousel.addEventListener('mouseleave', stopDrag);
  familyCarousel.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - familyCarousel.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) hasDragged = true;
    familyCarousel.scrollLeft = scrollLeft - walk;
  });
  familyCarousel.addEventListener('click', (e) => { if (hasDragged) e.stopPropagation(); }, true);
}
```

#### C-8. `<input>` 폼 접근성 — label 누락
[index.html:46, 290, 359] 세 개의 검색 인풋 모두 `<label>` 연결이 없고 `aria-label`도 없다. 스크린리더가 입력 필드의 목적을 알 수 없다.

수정 제안:
```html
<!-- 46 -->
<input id="searchInput" type="text" placeholder="학명, 이름으로 검색" aria-label="곤충 학명 또는 이름 검색" />
<!-- 290 -->
<input id="familySearchInput" type="text" placeholder="Search family name..." aria-label="과 이름 검색" />
<!-- 359 -->
<input id="globalSearchInput" type="text" placeholder="곤충 이름, 목, 과 검색..." aria-label="곤충 이름, 목, 과 검색" />
```
(라인 359 입력에는 `id`도 없어 추가 필요)

#### C-9. `<a href="#">` 위주 의사 링크 — 페이지 점프 + 접근성 문제
[index.html:114, 148, 182, 216, 585, 646, 678] `see-all`, `profile-view-all` 등 다수의 `<a href="#">`이 클릭 시 페이지 상단으로 스크롤하고, 실제 동작은 없다.

수정 제안 — 의미상 버튼이라면 `<button>`으로 교체 또는 클릭 시 `preventDefault`:
```js
document.querySelectorAll('a.see-all, a.profile-view-all').forEach(a => {
  a.addEventListener('click', (e) => { e.preventDefault(); });
});
```

---

### Warning (권장)

#### W-1. `selectedOrder` 모듈 스코프 가정 — null 가드 보강
[index.html:1058, 1063, 1315] `card.addEventListener('click', () => openFamilyDetail(selectedOrder.scientificName, ...))` 형태로 클로저가 `selectedOrder`를 캡처한다. `filterFamilyPage`로 인해 카드가 재생성되는 동안 빠르게 다른 페이지로 이동하면 `selectedOrder`가 다른 값이거나 null이 될 수 있다.

수정 제안 — 클로저 시점에 `order` 참조를 고정:
```js
function renderFamilyPage(families) {
  const grid = document.getElementById('familyCardGrid');
  const empty = document.getElementById('familyEmpty');
  if (!grid || !empty) return;
  grid.innerHTML = '';
  empty.classList.toggle('visible', families.length === 0);

  const order = selectedOrder; // 캡처 고정
  if (!order) return;

  families.forEach((family, index) => {
    const card = document.createElement('article');
    /* ... */
    card.addEventListener('click', () => {
      openFamilyDetail(order.scientificName, family.scientificName, 'pageFamilyList');
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFamilyDetail(order.scientificName, family.scientificName, 'pageFamilyList');
      }
    });
    grid.appendChild(card);
  });
}
```
또한 1315 줄에서도 `if (selectedOrder) openFamilyPage(selectedOrder.scientificName);` 가드가 있으나 그 윗블록 `tabTaxonomy.click()`가 `selectedOrder=null` 상태에서도 호출되므로 무해.

#### W-2. `showPage`에 존재하지 않는 페이지 ID 전달 시 silent fail
[index.html:1291–1297] `const target = document.getElementById(pageId); if (target) target.classList.add('active');` — target이 없으면 모든 페이지가 비활성화된 채 화면이 빈다. 모든 페이지(`pageDiscover/Search/Saved/Profile/FamilyList/FamilyDetail`)는 실제 HTML에 존재함을 확인했으나, 향후 페이지 추가/제거 시 디버깅이 어렵다.

수정 제안:
```js
function showPage(pageId, options = {}) {
  const target = document.getElementById(pageId);
  if (!target) {
    console.warn(`showPage: unknown page "${pageId}"`);
    return;
  }
  allPages.forEach(p => p.classList.remove('active'));
  if (!options.keepNav) allNavItems.forEach(n => n.classList.remove('active'));
  target.classList.add('active');
  window.scrollTo({ top: 0 });
}
```

#### W-3. 하단 네비 active 동기화 — sub-page 진입 시 누락
[index.html:1299–1321] `pageFamilyList`, `pageFamilyDetail`에 들어갈 때 `keepNav: true`라서 active가 그대로 유지되지만, 첫 진입 경로가 `pageSearch`에서 시작되는 다른 흐름이 생기면 `navDiscover`가 활성화되어야 하는데 다른 nav가 active로 남는다. 현재는 모두 분류 탭에서 진입하므로 무해하지만 명시적으로 동기화 권장.

수정 제안 — `openFamilyPage`/`openFamilyDetail`에서 활성 nav를 명시적으로 동기화:
```js
function syncBottomNav(navId) {
  allNavItems.forEach(n => n.classList.toggle('active', n.id === navId));
}
// openFamilyPage 안 executeOpen() 시작부에:
syncBottomNav('navDiscover');
```

#### W-4. 인라인 `style="..."` 남용
[index.html:412, 533–541, 672, 706] `style="padding-top: 0;"`, `style="position: absolute; top: -40px; left: 50%; transform: translateX(-50%); pointer-events: none; color: var(--green-mid);"`, `style="margin-bottom: 24px;"`, `style="filter: hue-rotate(180deg);"` 등 다수.

수정 제안 — CSS 클래스로 옮긴다:
```css
/* style.css 끝에 추가 */
.section--flush-top { padding-top: 0; }
.profile-dragonfly-svg {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: none;
  color: var(--green-mid);
}
.recent-encounter-card--mb-24 { margin-bottom: 24px; }
.recent-img--blue-shift { filter: hue-rotate(180deg); }
```
그리고 `<section class="section" style="padding-top: 0;">` → `<section class="section section--flush-top">` 등으로 교체.

#### W-5. 긴 한글 컨테이너 `word-break` 누락 — 학명/한글명 절단
[style.css:878–889] `.family-detail-title { white-space: nowrap; text-overflow: ellipsis; }`. `${family.commonName} (${family.scientificName})`이 길면 그냥 잘린다. 모바일 폭(430px)에서 자주 잘림.

수정 제안:
```css
.family-detail-title {
  grid-column: 2;
  min-width: 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.28;
  text-align: center;
  word-break: keep-all;       /* 한글 단어 단위 줄바꿈 */
  overflow-wrap: anywhere;    /* 학명도 강제 줄바꿈 */
  white-space: normal;        /* nowrap 해제, 2줄 허용 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

#### W-6. `inert` 속성 — 구형 브라우저 폴리필 없음
[index.html:248, JS 1278–1279] `inert`는 Safari 15.4+, Chrome 102+. 구형 모바일 Safari/Firefox 112 미만에서는 미동작 — 비활성 탭 패널의 키보드/스크린리더 접근이 차단되지 않는다.

수정 제안 — 폴리필 또는 명시적 `tabindex=-1` + `aria-hidden`:
```js
function switchDiscoverTab(tabName) {
  if (discoverTabPanels.dataset.activeTab === tabName) return;
  const isTaxonomy = tabName === 'taxonomy';
  /* ... 기존 동일 ... */
  panelCurated.inert = isTaxonomy;
  panelTaxonomy.inert = !isTaxonomy;
  // 폴리필
  panelCurated.querySelectorAll('a, button, input, [tabindex]').forEach(el => {
    if (isTaxonomy) el.setAttribute('tabindex', '-1');
    else el.removeAttribute('tabindex');
  });
  panelTaxonomy.querySelectorAll('a, button, input, [tabindex]').forEach(el => {
    if (!isTaxonomy) el.setAttribute('tabindex', '-1');
    else el.removeAttribute('tabindex');
  });
}
```

#### W-7. `tabTaxonomy.click()` 모듈 스코프 의존
[index.html:1302, 1311, 1319] 핸들러 안에서 `tabTaxonomy.click()`을 직접 호출. `tabTaxonomy`가 스크립트 상단에서 캐시되므로 안전하나, 같은 함수를 직접 호출하는 편이 의도가 명확하다.

수정 제안:
```js
// .click() 대신:
switchDiscoverTab('taxonomy');
```
세 곳 모두 교체. 추가로 `switchDiscoverTab('taxonomy')`로 호출하면 `dataset.activeTab`이 이미 'taxonomy'일 때 early-return하므로 동작이 동일하고 의존 그래프가 단순해진다.

#### W-8. `ordersData = data.orders` — 미정의 시 throw
[index.html:1226] `data.orders`가 없으면 이후 `ordersData.find(...)` 호출이 모두 `TypeError`. defensive 코드 필요.

수정 제안:
```js
.then(data => {
  ordersData = Array.isArray(data?.orders) ? data.orders : [];
  document.getElementById('orderSubtitle').textContent =
    `한국 서식 ${data?.totalOrders ?? ordersData.length}개 목 · ${formatCount(data?.totalFamilies ?? 0)}개 과`;
  renderOrders(ordersData);
})
```

#### W-9. View Transition 콜백이 `key`를 캡처 — race condition
[index.html:984, 998, 1251] `document.startViewTransition(() => updateDOM())`. 사용자가 빠르게 두 번 expand하면 두 transition이 큐잉되고 두 번째 transition 동안 `expandedOrderKey`가 첫 번째 값으로 잠시 보이는 깜빡임이 있을 수 있다.

수정 제안 — 진행 중 transition이 있으면 await:
```js
let currentTransition = null;
function runTransition(fn) {
  if (!document.startViewTransition) return fn();
  if (currentTransition) {
    currentTransition.finished.finally(() => {
      currentTransition = document.startViewTransition(fn);
    });
  } else {
    currentTransition = document.startViewTransition(fn);
    currentTransition.finished.finally(() => { currentTransition = null; });
  }
}
// 사용: runTransition(updateDOM);
```

---

### Suggestion (선택)

- **S-1.** [index.html:837–942] `renderOrders` 90줄 초과 — 확장 카드 HTML 생성과 미니 카드 HTML 생성을 `renderExpandedCard(order, bg)`, `renderMiniCard(order, bg)` 두 헬퍼로 분리.
- **S-2.** [index.html:1108–1220] `renderFamilyDetail` 110줄 — `renderOtherFamilies`, `renderOrderTags`, `renderSpeciesGrid`(이미 내부 함수)로 3분할.
- **S-3.** [index.html:759–768] `ORDER_GRADIENTS` 색상이 `style.css`의 `.placeholder-img--beetle/butterfly/...`와 거의 동일하다. CSS 클래스 인덱스를 사용하면 JS에서 큰 문자열을 들고 다니지 않아도 된다 — `card.classList.add('order-grad-' + (index % 8))` + CSS에서 8개 변형 정의.
- **S-4.** [index.html] 매직 넘버 `80`(scroll offset, 977), `50`(setTimeout, 980), `34`(translateX, 360), `1.5`(drag 가속, 1359). 상수 추출:
  ```js
  const SCROLL_TOP_OFFSET = 80;
  const SCROLL_DELAY_MS = 50;
  const DRAG_ACCELERATION = 1.5;
  const DRAG_THRESHOLD_PX = 5;
  ```
- **S-5.** [style.css:530–586] `.order-card--expanded`, `.order-img`, `.order-name`, `.order-kr`, `.order-body` 등 구버전 클래스가 HTML 어디에서도 참조되지 않는다 — 데드 코드 제거.
- **S-6.** [style.css:280–281, 1290 등] `rgba(255,255,255,0.05)`가 `--border-subtle`와 동일 — 토큰화하라.
- **S-7.** [index.html:790] `speciesCache`는 무한 성장. 사용자가 모든 과를 탐색하면 메모리 누적. LRU(최대 50개) 도입 또는 명시적 invalidation.
- **S-8.** [index.html:1175] `<img src="${getFamilyImage(index)}" alt="" />` — 장식 이미지로 alt=""는 올바르나, `loading="lazy"` 추가로 초기 페인트 가속:
  ```html
  <img src="${getFamilyImage(index)}" alt="" loading="lazy" decoding="async" />
  ```
- **S-9.** [index.html:1041] `empty.classList.toggle('visible', families.length === 0)`만으로 비어 있는 그리드 자체는 보이지 않게 처리되지 않는다 — `grid.style.display`를 같이 조작하거나 grid가 0개일 때 다른 시각 효과 추가.
- **S-10.** [style.css] `body { padding: 20px; min-height: 100vh; }`인데 `.app { padding-bottom: 80px; }` 위에 절대배치된 `.bottom-nav`가 있다. iOS Safe Area를 위해 `padding-bottom: calc(80px + env(safe-area-inset-bottom));` 권장.

---

### 종합 평가

전반적으로 인라인 script + 페이지 토글 SPA 구조가 일관되고 escapeHTML 헬퍼와 View Transitions fallback도 잘 짜여 있으나, **escapeHTML 적용이 두 핵심 분기(`renderOrders`)에서 누락**되어 있고, **fetch 에러 처리가 부분적**(`openFamilyDetail` 등 일부 분기에서 누락), **dead UI 컨트롤이 5개 이상** 존재한다. C-1~C-9까지 우선 처리하면 안정성과 보안 기준선이 충족되며, W-1~W-9는 코드 신뢰성과 한글/접근성을 한 단계 끌어올린다.
