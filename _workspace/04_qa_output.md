## QA 검증 결과

대상: `project/index.html` — `#pageSaved`(즐겨찾기)·`#pageRecent`(최근 본 곤충)로 iOS 엣지 스와이프 뒤로가기(`EntomaSwipeNav`) 인프라 확장. 요구사항 4개 수정 지점을 코드 경로 추적으로 교차 검증.

### Pass ✅

- **셀렉터 정합성 (4개 id 전부 HTML ↔ JS 일치)**
  - `savedBackBtn`: HTML `<button id="savedBackBtn">`(466행) ↔ JS `getElementById('savedBackBtn')`(1923행). ✓
  - `recentBackBtn`: HTML(498행) ↔ JS(1935행). ✓
  - `profileSavedViewAll`: HTML `<a id="profileSavedViewAll">`(603행) ↔ JS(1928행). ✓
  - `profileRecentViewAll`: HTML(618행) ↔ JS(1940행). ✓
  - 페이지 컨테이너 id `pageSaved`(464행)·`pageRecent`(496행)가 `PAGE_HASHES`(1685-1686)·`_syncNativeSwipeGesture` enabled(1703)·`syncNavForPage` navProfile 분기(1716)의 문자열과 정확히 일치. 오타·대소문자 불일치 없음.

- **PAGE_HASHES 확장 (1682-1687)**
  - `pageSaved: 'saved'`, `pageRecent: 'recent'` 추가 확인. `showPage(..., {keepNav:true})`의 `keepNav && hash` 분기(1772) 진입 전제 조건 충족.

- **`_syncNativeSwipeGesture` enabled 조건 (1700-1705)**
  - `pageId === 'pageSaved' || pageId === 'pageRecent'` OR절 추가 확인. 기존 family/species 조건은 그대로 → 두 페이지 active 시 `NavigationGestureBridge.setEnabled({enabled:true})` 호출됨.

- **흐름 1 — Profile → (전체보기) → Saved → (백버튼) → Profile: 히스토리 1 push / 1 pop 정확**
  - 진입: `profileSavedViewAll` 클릭 → `e.preventDefault()`(href="#" 해시 억제) → `showPage('pageSaved', {keepNav:true, dir:'forward'})` → `keepNav && hash` 분기(1772-1776)에서 `_subPageBackTarget.pageSaved = 'pageProfile'` 등록 + `history.pushState({page:'pageSaved'}, '#saved')`. 스택 [pageProfile]→[pageSaved].
  - 퇴장: `savedBackBtn` → `history.back()` → popstate. 이 시점 `_activePageId==='pageSaved'`는 `SWIPE_BACK_BLOCKED_PAGES`에 없어 1801 블록 통과 → `pageId='pageProfile'`, `isSubPage=false` → `showPage('pageProfile', {keepNav:false, _fromHistory:true, restoreScroll:true})`(back 슬라이드, `syncNavForPage`로 navProfile 활성, 해시 제거). `_fromHistory:true`라 히스토리 재변형 없음. 스택 [pageProfile] 복귀.
  - 반복 클릭 이탈 없음: 복귀 지점 `pageProfile`이 `SWIPE_BACK_BLOCKED_PAGES`에 속해, 이후 back popstate는 1801-1805 블록이 `pageProfile`을 재-pushState하여 프로필 밑으로 내려가지 않음.

- **흐름 2 — Profile → Saved → (항목 클릭) → SpeciesDetail → (백) → Saved → (백) → Profile: `_subPageBackTarget` 단계별 정확**
  - `pageSaved`의 결과 카드는 `buildResultItem(ins, 'pageSaved')`(3414) → 클릭 시 `openSpeciesFromIndex(ins, 'pageSaved')`(2089) → `openSpeciesDetail(species, 'pageSaved')`(3310)로 `previousSpeciesPage='pageSaved'` 설정 후 `showPage('pageSpeciesDetail', {keepNav:true})`(3343/3351/3357).
  - 이때 `keepNav && hash` 분기에서 `_subPageBackTarget.pageSpeciesDetail = 'pageSaved'`(prevActive.id) 기록 + `pushState('#species')`. 스택 [profile]→[saved #saved]→[species #species]. 백타깃: `pageSpeciesDetail→pageSaved`, `pageSaved→pageProfile`.
  - species 백버튼 `history.back()`(3366) → popstate: `pageId='pageSaved'`, `isSubPage=false` → `showPage('pageSaved', {keepNav:false, _fromHistory:true, restoreScroll:true})` → `pageshow:pageSaved` 재발화로 목록 재렌더 + navProfile 활성, back 슬라이드. `_subPageBackTarget.pageSaved`는 push 경로를 안 타므로 `'pageProfile'` 유지.
  - 재차 백 → `pageId='pageProfile'` 정상 복귀. 각 단계 백타깃이 올바른 목적지를 가리키며 스택이 한 스텝씩 정확히 소비됨.

- **흐름 2(네이티브 스와이프) — `_finalizingSwipe`/`isSubPage` 분기 무결**
  - species에서 `EntomaSwipeNav.begin()` → `_computeBackTarget()`가 `_subPageBackTarget.pageSpeciesDetail='pageSaved'` 읽어 프리뷰 렌더 → `commit()`이 `_finalizingSwipe={to:'pageSaved', reopenModal:false}` 후 `history.back()`. popstate의 `_finalizingSwipe` 분기(1790-1798)가 재렌더 없이 `syncNavForPage('pageSaved')` + rAF `_syncNativeSwipeGesture('pageSaved')`(이제 enabled) 수행 → saved에서 연속 스와이프 가능.
  - saved에서 재차 스와이프 → 백타깃 `pageProfile` 프리뷰 → commit → finalizing `to:'pageProfile'` → rAF `_syncNativeSwipeGesture('pageProfile')`=disabled로 제스처 종료. 프로필에서 정확히 멈춤. family/species 흐름과 동형.
  - `reopenModal`은 `_activePageId==='pageSpeciesDetail' && previousSpeciesPage==='featureModal'`일 때만 true. saved/recent 경유 진입은 `previousSpeciesPage='pageSaved'/'pageRecent'`라 false → featureModal 오작동 재오픈 없음.

- **흐름 3 — pageRecent 동일 구조 검증**
  - `profileRecentViewAll`(1940)→`showPage('pageRecent', {keepNav:true, dir:'forward'})`, `recentBackBtn`(1935)→`history.back()`, 결과 카드 `buildResultItem(ins, 'pageRecent')`(3546), `pageshow:pageRecent`→`renderRecentPage`(3561). `_subPageBackTarget.pageRecent='pageProfile'` 동적 등록. saved와 완전 대칭으로 동작.

- **SWIPE_BACK_BLOCKED_PAGES 오염 없음 (1030)**
  - `new Set(['pageDiscover', 'pageSearch', 'pageProfile'])` 그대로 — `pageSaved`/`pageRecent` 미포함 확인. 두 페이지가 blocked에 들어갔다면 백버튼 popstate가 1801 블록에 걸려 "뒤로가기 안 됨"이 됐을 것이나, 그런 회귀 없음.

- **기존 family/species 스와이프 백 회귀 없음 (공유 인프라)**
  - 공유 지점 변경분이 전부 순수 additive: `PAGE_HASHES`는 family/species 항목 불변 + 2개 추가, `_syncNativeSwipeGesture` enabled는 기존 조건에 OR절만 추가, `_subPageBackTarget` 초기 리터럴(1033)·popstate `isSubPage` 판정(1811, family/species만)·`SWIPE_BACK_BLOCKED_PAGES` 모두 무변경. `showPage`의 pushState/replaceState 로직(1770-1781) 자체 미변경 → family/species 경로 영향 없음.

- **다른 진입점 / `_subPageBackTarget` 미충전 안전성 (교차검증 항목 4)**
  - `showPage('pageSaved'/'pageRecent')` 호출부는 두 view-all 핸들러(1930, 1942)뿐이며 **둘 다 `keepNav:true`** → 진입 시 항상 백타깃 충전. grep으로 딥링크·검색결과 등 다른 호출부 없음 확인.
  - 해시 라우터 부재: `location.hash`/`hashchange` 사용처 0건. 콜드 로드 시 1785행 `history.replaceState({page:'pageDiscover'}, cleanUrl)`가 해시를 제거하고 `pageDiscover`로 강제 부팅 → `#saved`/`#recent` 직접 딥링크로 두 페이지에 바로 진입 불가.
  - 만에 하나 백타깃 미충전 상태로 제스처가 켜져도 `_computeBackTarget()`가 `null` 반환 → `begin()`이 `if (!t) return false`(1844)로 프리뷰 없이 안전 무시. 또한 `_subPageBackTarget` 등록·pushState는 동기(1775-1776), 제스처 ON은 rAF 지연(1766)이라 제스처가 켜질 땐 항상 백타깃이 이미 채워져 있음.

- **코드 스타일 / 범위 준수**
  - 구 `savedBackBtn` 본문(`showPage('pageProfile', {restoreScroll, dir:'back'})` + `navProfile.classList.add`)이 잔여 없이 `history.back();`으로 완전 교체됨을 git diff로 확인. 2칸 인덴트·세미콜론·`const`/`let` 유지, JS 인라인 유지, `style.css` 무변경. `git diff HEAD` 결과 이번 4개 편집 외 hunk는 세션 이전부터 있던 pageRecent/콘텐츠 보호 미커밋 스캐폴딩(작업 범위 밖).

### Fail ❌

- 없음.

### 수동 테스트 필요

- **실제 네이티브 엣지 스와이프 제스처**: `_syncNativeSwipeGesture`는 `window.Capacitor?.isNativePlatform?.()`가 false면 즉시 return하므로 일반 브라우저·헤드리스에서 검증 불가. iOS 네이티브 셸(시뮬레이터/기기)에서 (1) saved/recent 좌측 엣지 스와이프로 profile 복귀, (2) species에서 연속 스와이프가 saved→profile로 이어지다 profile에서 멈추는지, (3) 스와이프 중 스냅백 렉 여부를 직접 확인 요망. 위 흐름들은 코드 경로 수기 트레이스로 정합성만 확인함.
- **(참고, Fail 아님) 네이티브 스와이프 commit 시 목적지 `pageProfile` 콘텐츠 갱신**: `_finalizingSwipe` 분기(1790)는 `showPage`를 거치지 않아 `pageshow:pageProfile`를 재발화하지 않는다(프로필 즐겨찾기/최근 미리보기 재렌더 없음). 단 이는 기존 family/species→pageDiscover 스와이프 commit과 동일한 선(先)존재 동작이며 이번 변경이 유발한 것이 아니다. 버튼 백(`history.back()`)은 정상 popstate 경로로 `pageshow:pageProfile`가 발화되어 갱신됨. 즐겨찾기 변경 직후 스와이프로 복귀하는 극단 케이스에서 프로필 미리보기가 한 박자 늦게 갱신될 수 있는지 육안 확인 시 참고.

### 종합: 전체 Pass

요구사항의 4개 수정 지점(PAGE_HASHES / `_syncNativeSwipeGesture` enabled / view-all `keepNav:true` / 백버튼 `history.back()`)이 정확히 반영되었고, 셀렉터 4종이 HTML↔JS에서 완전 일치한다. Profile↔Saved↔SpeciesDetail 및 Recent 심화 경로에서 버튼·네이티브 스와이프 양쪽 모두 히스토리 스택이 한 스텝씩 정확히 소비되며 `_subPageBackTarget`/`_finalizingSwipe`/`isSubPage` 분기가 어긋나지 않음을 코드 경로 추적으로 확인했다. `SWIPE_BACK_BLOCKED_PAGES` 오염·family/species 회귀·미충전 begin() 위험 모두 없음. Fail 0건. 네이티브 제스처 자체의 실기기 감각(렉/연속성)만 수동 확인 대상.
