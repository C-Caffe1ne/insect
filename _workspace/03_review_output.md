## 코드 리뷰 결과

대상: `project/index.html` — `#pageSaved`(즐겨찾기)·`#pageRecent`(최근 본 곤충)로 iOS 엣지 스와이프 뒤로가기(`EntomaSwipeNav`) 인프라 확장.
요구사항이 지정한 정확히 4곳만 변경되었음을 git diff로 확인 (그 외 hunk = 이전 세션의 미커밋 `pageRecent`/콘텐츠 보호 스캐폴딩, 이번 작업 범위 아님).

### Critical (즉시 수정 필요)
- 없음.

### Warning (권장)
- 없음.

### Suggestion (선택)

- **[index.html:1923, 1935] 백버튼 null 가드 부재 (기존 패턴과 일치, 회귀 아님)**
  `document.getElementById('savedBackBtn').addEventListener(...)` / `recentBackBtn` 이 null 가드 없이 바로 `.addEventListener`를 호출한다. 두 요소는 정적 마크업(466, 498행, `id`+`aria-label="뒤로"` 모두 존재)이라 실제 위험은 없고, `familyDetailBackBtn`(1869)·`speciesDetailBackBtn`(3364)과 동일한 무가드 패턴이라 일관적이다. 다만 바로 위 `profileBackBtn`(1914-1920)은 `if (profileBackBtn)` 가드를 두므로 스타일이 엇갈린다. 통일하려면 백버튼도 가드로 감싸는 편이 낫다 — 필수는 아님.
  → 예: `const savedBackBtn = document.getElementById('savedBackBtn'); if (savedBackBtn) savedBackBtn.addEventListener('click', () => history.back());`

- **[index.html:1812-1813] popstate 복귀 시 `syncNavForPage` 이중 호출 (기존 구조, 무해)**
  `pageSaved`/`pageRecent`로 popstate 복귀할 때 `isSubPage=false → keepNav:false`이므로 `showPage()` 내부(1728)에서 `syncNavForPage`가 한 번 돌고, 이어 1813행에서 다시 명시적으로 호출된다. 멱등이라 부작용은 없고, 1813행은 원래 `keepNav:true`(family/species)일 때를 위한 것이라 이번 변경이 만든 문제가 아니다. 정리 대상으로만 참고.

### 중점 검토 항목 확인 결과

**1) 히스토리 스택 정합성 — 종 상세로 더 깊이 들어갔다 나오는 경로 (안전)**
- 진입 배선 추적: `pageSaved`의 결과 카드는 `buildResultItem(ins, 'pageSaved')`(3414)로 생성되고 클릭 시 `openSpeciesFromIndex(ins, 'pageSaved')`(2089) → `openSpeciesDetail(species, 'pageSaved')`(2136)로 이어진다. `pageRecent`도 동일(`'pageRecent'`, 3546). 여기서 `previousSpeciesPage='pageSaved'`가 되고, `showPage('pageSpeciesDetail', {keepNav:true})`(3343/3351/3357) 시 `prevActive.id='pageSaved'`가 `_subPageBackTarget.pageSpeciesDetail`에 동적 기록된다(1775).
- 스택 트레이스 (Profile→전체보기→Saved→종상세→back→back):
  `pageProfile`(replaceState) → `pageSaved`(pushState `#saved`, `_subPageBackTarget.pageSaved='pageProfile'`) → `pageSpeciesDetail`(pushState `#species`, `_subPageBackTarget.pageSpeciesDetail='pageSaved'`).
  종상세 back → popstate: `pageId='pageSaved'`, `isSubPage=false` → `showPage('pageSaved', {keepNav:false, _fromHistory:true, restoreScroll:true})`. `_fromHistory:true`라 pushState/replaceState 블록(1770)은 스킵되어 히스토리 변형 없음, `dir='back'` 슬라이드 적용. 재차 back → `pageId='pageProfile'` → 정상 복귀. 스택이 정확히 한 스텝씩 소비되며 어긋나는 지점 없음.
- 네이티브 스와이프 경로도 동일하게 안전: 종상세에서 `EntomaSwipeNav.begin()` → `_computeBackTarget()`가 `_subPageBackTarget.pageSpeciesDetail='pageSaved'`를 읽어 프리뷰 렌더 → `commit()`이 `_finalizingSwipe={to:'pageSaved'}` 후 `history.back()`. popstate의 `_finalizingSwipe` 분기(1790)가 재렌더 없이 `syncNavForPage('pageSaved')`만 수행하고 rAF로 `_syncNativeSwipeGesture('pageSaved')`를 다시 켠다 — `pageSaved`가 이제 enabled 목록에 포함되므로 프로필까지 연속 스와이프가 이어지고, 최종 `pageProfile` 도달 시 blocked/미enabled로 제스처가 꺼진다. family/species 흐름과 동형.
- `previousSpeciesPage='pageSaved'/'pageRecent'`이므로 `reopenModal` 조건(`=== 'featureModal'`)은 false → 스와이프/뒤로가기 시 featureModal이 오작동으로 재오픈되지 않음. 확인됨.

**2) `keepNav:true`로 `syncNavForPage`가 스킵되는 부수효과 — 의도대로 (안전)**
- 정방향 진입(`showPage('pageSaved', {keepNav:true})`)에서 `if (!options.keepNav) syncNavForPage()`(1728)가 스킵된다. 그러나 출발점 `pageProfile`과 목적지 `pageSaved`/`pageRecent`는 모두 `navProfile` 탭에 속하므로(1716) nav 상태·네이티브 탭바(`_syncNativeTabBar`)가 바뀔 필요가 없다. 스킵은 무해하며 family/species(navDiscover 유지) 패턴과 정확히 대칭이다.
- 뒤이은 `document.getElementById('navProfile').classList.add('active')`(1931/1943)는 이미 활성인 탭을 재활성화하는 안전망 no-op으로, 요구사항 지시대로 유지됨.
- 복귀(popstate)에서는 `isSubPage=false → keepNav:false`라 `syncNavForPage`가 정상 실행되어 `navProfile`이 확실히 활성화된다. `isSubPage` 판정에 두 페이지를 넣지 않은 것이 옳다는 요구사항 판단과 일치.

**3) `_subPageBackTarget` 미충전 시 `begin()`의 안전성 (안전)**
- `_computeBackTarget()`(1821)은 `_subPageBackTarget[_activePageId]`가 falsy면 `null`을 반환하고, `begin()`(1842)은 `if (!t) return false`로 프리뷰를 렌더하지 않고 그대로 false를 반환한다 → 네이티브가 깨진 프리뷰 없이 제스처를 무시. 목적지 부재 시 그레이스풀.
- 목적지 없이 제스처만 켜지는 창(window)도 없음: 초기 로드는 `history.replaceState({page:'pageDiscover'}, cleanUrl)`(1785)로 해시를 제거하고 `pageDiscover`로 강제 부팅하므로 `#saved` 직접 딥링크로 `pageSaved`에 바로 진입할 수 없다. 또한 `showPage` 내부에서 `_subPageBackTarget` 등록·pushState는 동기 실행(1775-1776)이고 `_syncNativeSwipeGesture`(제스처 ON)는 rAF로 지연 실행(1766)되므로, 제스처가 켜질 때는 항상 목적지가 이미 채워져 있다.

**4) 코드 스타일 (CLAUDE.md 준수 확인)**
- 2칸 인덴트, 세미콜론, `const`/`let` 유지(`var` 신규 도입 0건 — grep 확인). 한글 `// ── … ──` 주석 스타일 일관. JS는 `index.html` 인라인 유지, 외부 `.js` 미추가. `project/` 범위 준수(`style.css` 무변경).
- 구 `savedBackBtn` 본문(`showPage('pageProfile', {restoreScroll, dir:'back'})` + `navProfile.classList.add`)이 잔여 없이 `history.back();` 한 줄로 완전 교체됨을 diff로 확인. `recentBackBtn`/`profileRecentViewAll`도 `savedBackBtn`/`profileSavedViewAll`과 동일 패턴.

**5) XSS·이벤트 리스너 누수 (이번 변경 범위에 없음)**
- 변경분은 순수 네비게이션/히스토리 배선으로 `innerHTML`·외부 데이터 삽입이 없다. 결과 카드 렌더(`buildResultItem`)는 `textContent`/`createElement`만 사용(2064·2071·2074·2082) — 안전.
- 백버튼·전체보기 핸들러 4종은 모두 초기화 블록에서 1회만 등록되며 `renderSavedPage`/`renderRecentPage` 렌더 루프 밖에 있어 리스너 누적 없음. `history.back()` 교체로 오히려 핸들러가 단순해짐.

### 종합 평가
요구사항의 4개 수정 지점이 정확히·최소 diff로 반영되었고, 종 상세로 내려갔다 올라오는 심화 경로와 네이티브 스와이프/버튼 뒤로가기 양쪽 모두에서 히스토리 스택이 어긋나지 않음을 코드 경로 추적으로 확인했다. Critical·Warning 0건이며, 지적한 두 Suggestion(백버튼 null 가드·popstate 이중 syncNav)은 모두 기존 코드에 이미 존재하던 스타일 사안으로 이번 변경이 유발한 결함이 아니다. 머지 가능 상태로 판단한다.
