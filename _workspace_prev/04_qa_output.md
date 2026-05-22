## QA 재검증 결과

대상: `project/index.html`(1529줄, 인라인 JS 757~1526), `project/style.css`(1811줄)
방법: web-developer가 보고한 17개 패치를 코드에서 직접 grep/Read로 교차 확인. 추가로 회귀·경계면 검증.

---

### 적용 확인 ✅ (패치별 코드 grep/Read 결과)

- **C-1 (renderOrders 확장 카드 XSS)** — index.html:895, 896, 900
  - `expanded-title`: `${escapeHTML(order.scientificName)}` 적용 (line 895)
  - `expanded-kr`: `${escapeHTML(order.commonName)}` 적용 (line 896)
  - `data-order-key="${escapeHTML(orderKey)}"` 유지 (line 900)
  - raw `${order.commonName}`/`${order.scientificName}` 잔존 grep 결과 0건.

- **C-2 (renderOrders 미니 카드 XSS)** — index.html:914, 915
  - `order-name-kr`: `${escapeHTML(order.commonName)}` (line 914)
  - `order-sci`: `${escapeHTML(order.scientificName)}` (line 915)

- **C-3 / F-11 (openFamilyDetail fetch catch)** — index.html:1109~1126
  - `fetch(\`taxonomy/${order.file}\`)` 체인에 `if (!r.ok) throw new Error('HTTP ' + r.status)` (line 1112), `.catch(err => { ...; executeDetail(); })` (line 1119~1123) 모두 존재. 폴백으로 `order.families = order.families || []` 후 `executeDetail()` 호출.

- **C-4 (모든 fetch에 r.ok 검사)** — 6개 fetch 호출 모두 일관 적용 확인
  - line 818 `loadCachedSpecies` → r.ok 검사 (line 820)
  - line 958 `expandOrder` → r.ok 검사 (line 960) + catch (line 967)
  - line 1030 `openFamilyPage` → r.ok 검사 (line 1032) + catch (line 1039)
  - line 1110 `openFamilyDetail` → r.ok 검사 (line 1112) + catch (line 1119)
  - line 1227 `renderFamilyDetail` 종 fetch → r.ok 검사 (line 1229) + catch (line 1247)
  - line 1266 `taxonomy/index.json` 최초 로드 → r.ok 검사 (line 1268) + catch (line 1277)

- **C-5 / F-1 (searchInput 라우팅)** — index.html:1402~1411
  - `getElementById('searchInput')` + focus 리스너 부착
  - `showPage('pageSearch')` + navSearch.active 추가 + navDiscover.active 제거 + globalSearchInput 포커스 이동

- **C-6 / F-3 (btnRandom 핸들러)** — index.html:1435~1446
  - `getElementById('btnRandom')` null 가드 + 클릭 핸들러
  - `ordersData.length === 0` 가드 → 랜덤 선택 → `expandedOrderKey` 설정 → pageDiscover 이동 + `switchDiscoverTab('taxonomy')` + 재렌더

- **C-6 / F-4 (.filter-btn 핸들러)** — index.html:1449~1453
  - `querySelectorAll('.filter-btn').forEach` 부착
  - 클릭 시 `getElementById('sortBtn')?.click()` 위임. 옵셔널 체이닝으로 sortBtn 부재 시에도 안전.

- **C-7 (캐러셀 mouseup window 등록)** — index.html:1499~1525
  - `window.addEventListener('mouseup', stopDrag)` 적용 (line 1514)
  - `stopDrag` 헬퍼로 mouseleave/mouseup 동일 처리 (line 1503~1506, 1515)
  - 윈도우 밖 mouseup도 isDown=false 복귀 보장.

- **C-8 (검색 input aria-label)** — 3개 모두 적용
  - line 46 `searchInput`: `aria-label="곤충 학명 또는 이름 검색"`
  - line 290 `familySearchInput`: `aria-label="과 이름 검색"`
  - line 359 `globalSearchInput`: `aria-label="곤충 이름, 목, 과 검색"` + 신규 `id="globalSearchInput"` 부여

- **C-9 (a.see-all / a.profile-view-all preventDefault)** — index.html:1493~1496
  - `querySelectorAll('a.see-all, a.profile-view-all').forEach` + preventDefault 부착
  - 7개 정적 링크 + 동적 `family-view-all`(이미 button 태그) 커버.

- **F-2 (globalSearchInput id + 필터링)** — index.html:359, 1414~1432
  - `id="globalSearchInput"` 부여 확인 (line 359)
  - input 이벤트 핸들러로 `ordersData.filter` (commonName/scientificName 부분일치) → placeholder 갱신. 빈 값일 때 원래 placeholder 복귀(line 1418~1421).

- **F-5 (species-tab 정렬)** — index.html:329~331, 812~813, 1129~1160, 1455~1471
  - HTML: 3개 탭 모두 `data-sort`(popular/az/color) + `role="button"` + `tabindex="0"` 부여
  - 모듈 상태 `currentSpeciesList`/`currentSpeciesSort` 도입 (line 812~813)
  - `renderSpeciesSorted()` 헬퍼: 'az'는 scientificName localeCompare 오름차순, 'color'는 Fisher-Yates 셔플, 'popular'는 원본 순서
  - 클릭/Enter/Space 모두 active 토글 + 재렌더 (line 1464~1470)

- **F-6 (explore-card)** — index.html:431, 443, 453, 464, 1473~1491
  - 4개 카드 모두 `role="button"` + `tabindex="0"` + `data-category` 부여
  - 클릭/Enter/Space → globalSearchInput에 카테고리명 prefill + `dispatchEvent(new Event('input'))` + 포커스

- **F-7 (정렬 라벨 의미 통일)** — index.html:1282~1304
  - 코드 주석으로 "라벨은 현재 적용 중인 정렬" 명시 (line 1283~1285)
  - 'ㄱ → ㅎ' → commonName localeCompare('ko') (line 1292)
  - 'A → Z' → scientificName localeCompare (line 1295)
  - 기존 `b.familyCount - a.familyCount`(숫자 정렬) **완전 제거 확인** (grep `familyCount` 결과 정렬 컨텍스트에서 0건)

- **F-9 (profile 백버튼)** — index.html:510, 1392~1399
  - inline `onclick="showPage('pageDiscover')"` **완전 제거 확인** (grep `onclick`은 line 892 `collapseOrder(event)` 1건만 남음)
  - `id="profileBackBtn"` 부여 (line 510)
  - JS 핸들러에서 `showPage('pageDiscover')` + `navDiscover.active` 동기화

- **F-10 (이미지 alt)** — 3개 위치 모두 적용
  - line 1062 `family-photo-card`: `alt="${escapeHTML(family.commonName || family.scientificName)}"` + `loading="lazy"`
  - line 1153 `species-detail-card`: `alt="${escapeHTML(item.commonName || item.scientificName)}"` + `loading="lazy"`
  - line 1181 `family-carousel-card`: `alt="${escapeHTML(item.commonName || item.scientificName)}"` + `loading="lazy"`

- **W-5 (.family-detail-title 줄바꿈)** — style.css:878~893
  - `word-break: keep-all` (line 886)
  - `overflow-wrap: anywhere` (line 887)
  - `white-space: normal` (line 888)
  - `display: -webkit-box` + `-webkit-line-clamp: 2` + `-webkit-box-orient: vertical` + `overflow: hidden` (line 889~892)
  - 기존 `white-space: nowrap; text-overflow: ellipsis` 완전 대체.

- **W-8 (data.orders 방어)** — index.html:1272~1274
  - `ordersData = Array.isArray(data?.orders) ? data.orders : []`
  - `totalOrders` → `data?.totalOrders ?? ordersData.length`
  - `totalFamilies` → `data?.totalFamilies ?? 0`

---

### 미적용/불완전 ❌

**없음.** 보고된 17개 패치 모두 코드에 정확히 반영되었다.

다만 web-developer가 "Skip"으로 명시한 항목은 의도된 미적용:
- W-1, W-2, W-3, W-4, W-6, W-7, W-9, S-1~S-10, F-8 — 별도 작업 분리로 명시. 검증 범위 밖.

---

### 회귀 버그

**발견된 회귀: 없음**. 다음 항목들을 직접 확인했다.

- **escapeHTML 추가로 인한 HTML 구조 손상**: 학명/한글명은 평문(영문/한글)이므로 escapeHTML 후에도 클래스/id 속성 따옴표를 깨뜨리지 않음. 단, `data-order-key="${escapeHTML(orderKey)}"`는 orderKey가 scientificName(예: "Coleoptera")이라 안전.
- **빈 배열 정렬**: `(a.commonName || '').localeCompare(b.commonName || '', 'ko')` → 빈 문자열 처리 안전. `ordersData = []`일 때 sort는 no-op, renderOrders는 forEach 0회 → 안전.
- **searchInput focus 무한 루프 위험**: focus 핸들러가 `showPage('pageSearch')` 호출 → searchInput(pageDiscover 내부)은 비활성 페이지가 되므로 focus 이벤트 재발생 없음. 무한 루프 회피.
- **searchInput → globalSearchInput 포커스 이동의 focus 재발생**: globalSearchInput에는 별도 focus 핸들러가 없고 input 핸들러만 있음 → 연쇄 focus 호출 없음.
- **explore-card → input dispatch 이벤트 영향**: `dispatchEvent(new Event('input', { bubbles: true }))`는 `globalSearchInput`의 input 핸들러(filter)만 트리거. searchInput에는 input 핸들러가 없어 무해.
- **모듈 상태 dead code 여부**: `currentSpeciesList`는 line 1221에서 할당, `renderSpeciesSorted`(line 1134)에서 읽힘. `currentSpeciesSort`도 line 1459에서 할당, line 1135/1137에서 읽힘. **dead code 아님**.
- **`<a href="#">` preventDefault 의도치 않은 차단**: line 1494 셀렉터가 `a.see-all, a.profile-view-all`로 매우 좁아 다른 a 태그(nav 등)에 영향 없음.
- **filter-btn → sortBtn 위임의 순환 위험**: filter-btn 클릭 → sortBtn.click() → sortBtn 핸들러 실행 → 정렬+재렌더만 수행. filter-btn에는 sortBtn 클릭 후 추가 동작 없음 → 순환 없음.
- **새 ID `globalSearchInput`/`profileBackBtn`의 HTML-JS 경계면**:
  - `globalSearchInput`: HTML(line 359) ↔ JS(line 1408, 1414, 1477) — 모두 일치.
  - `profileBackBtn`: HTML(line 510) ↔ JS(line 1393) — 일치.
- **`data-sort`/`data-category` 속성 읽기**: JS에서 `tab.dataset.sort`(line 1458), `card.dataset.category`(line 1476) — HTML 속성과 정확히 매칭.
- **aria-label 빈 값 여부**: 3개 모두 한글 의미 있는 텍스트로 채워짐.
- **renderSpeciesSorted 호출 위치**: line 1222(데이터 로드 시), line 1462(탭 클릭 시) 두 곳 모두 안전. 호출 순서상 currentSpeciesList가 먼저 세팅된 후에만 호출됨.
- **inline onclick 잔존**: grep 결과 `collapseOrder(event)`(line 892) 1건만 남음. 이는 동적 카드 내부 닫기 버튼으로 의도된 잔존(F-9의 백버튼은 깨끗하게 제거됨).

---

### 잔여 수동 테스트 필요

- **XSS 페이로드 실증**: `taxonomy/index.json`의 `commonName`을 임시로 `<img src=x onerror=alert(1)>`로 교체하고 분류 보기 탭 → 카드 확장 → DOM에 텍스트로만 표시되는지 브라우저 콘솔에서 확인.
- **fetch 404 시각 확인**: DevTools Network 패널에서 `taxonomy/coleoptera.json`을 차단 → 카드 확장 시 "과 데이터 없음" 폴백 + 콘솔 unhandled rejection 없는지.
- **searchInput focus 라우팅 UX**: 홈에서 검색바 클릭 → 즉시 pageSearch 이동 + globalSearchInput 포커스 + 키보드 입력 가능 여부. iOS Safari에서 setTimeout 0 포커스 이동 성공률 확인.
- **species-tab 'BY COLOR'**: 셔플이라 순서가 매번 다른지, 빈 species 리스트일 때 빈 그리드만 표시되고 에러 없는지.
- **explore-card prefill 후 placeholder UX**: 카테고리명 prefill 시 placeholder가 즉시 "N개 목 일치" 또는 "일치하는 결과 없음"으로 갱신되는지 (현 데이터에 "멸종위기종" 등은 매치 없을 가능성 높음).
- **View Transition 동작**: Chrome 111+에서 카드 확장/정렬 변경 시 부드러운 전환. Safari/Firefox는 폴백 분기.
- **모바일 터치 동작**: 캐러셀에 mouse 이벤트만 바인딩. touchstart 미적용 — OS 기본 가로 스크롤로 대체되지만, 실기기에서 `hasDragged` 차단 누락 영향 확인.
- **family-detail-title 2줄 line-clamp**: 모바일 폭(430px)에서 긴 commonName + scientificName 조합 시 실제 2줄 표시 + 말줄임표 동작 확인.
- **VoiceOver/NVDA**: 동적 카드의 한국어 alt가 정확히 읽히는지.
- **profile/saved 진입 → 백버튼 → 다시 그 페이지 진입** 등의 반복 네비게이션에서 nav-item active 상태가 일관되는지.
- **W-8 빈 index.json**: index.json을 `{}`로 교체 후 콘솔 TypeError 없이 "데이터 로드 실패" 또는 빈 그리드 표시 여부.

---

### 종합 평가: 전체 Pass

- **Pass 17개 / Fail 0개 / 회귀 0개**
- 모든 Critical(C-1~C-9), Warning 핵심(W-5, W-8), Fail 보강(F-1~F-7, F-9~F-11) 항목이 코드에 정확히 반영됨.
- 새로 추가된 핸들러·모듈 상태가 기존 흐름과 충돌하지 않으며, dead code 없음.
- HTML-JS 경계면(신규 ID, data 속성, aria-label) 모두 양방향 일치.
- "코드 정합성" 측면에서는 Critical Fail 없음. 잔여 검증은 실제 브라우저·실기기 환경에서의 UX·접근성 시각 확인에 한정됨.
