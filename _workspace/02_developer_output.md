## 구현 완료

즐겨찾기(`#pageSaved`)·최근 본 곤충(`#pageRecent`) 페이지에 iOS 엣지 스와이프 뒤로가기를 켜기 위해,
기존 `pageFamilyDetail`/`pageSpeciesDetail` 스와이프 백 인프라(`EntomaSwipeNav` / Swift `SwipeBackController`)를
두 페이지로 확장했다. 요구사항 문서의 4개 수정 지점만 최소 diff로 반영. **Swift·CSS 변경 없음.**

### 수정된 파일
- `project/index.html` — (유일한 수정 대상. CLAUDE.md 규칙 준수: JS 인라인 유지, 2칸 인덴트, 세미콜론, `const`/`let`.)

### 각 수정의 diff 요약 (라인 번호는 수정 후 기준)

1. **`PAGE_HASHES` 확장** (index.html 1682–1687)
   - `pageSaved: 'saved'`, `pageRecent: 'recent'` 두 항목 추가.
   - 효과: `showPage(..., { keepNav: true })`가 `history.pushState(..., '#saved'/'#recent')`를 태우고
     `_subPageBackTarget[pageId]`를 동적 등록할 수 있게 됨(둘 다 `PAGE_HASHES[pageId]` 존재가 전제).

2. **`_syncNativeSwipeGesture` enabled 조건 확장** (index.html 1702–1703)
   - 기존: `pageId === 'pageFamilyDetail' || pageId === 'pageSpeciesDetail'`
   - 변경: 위에 `|| pageId === 'pageSaved' || pageId === 'pageRecent'` 추가.
   - 효과: 두 페이지가 active일 때 네이티브 `NavigationGestureBridge.setEnabled({enabled:true})` 호출 → 엣지 제스처 인식기 ON.

3. **뒤로가기 버튼 2곳 → `history.back()` 교체** (index.html 1923–1925, 1935–1937)
   - `savedBackBtn` / `recentBackBtn`: 기존 `showPage('pageProfile', { restoreScroll:true, dir:'back' })` + `navProfile.classList.add('active')`
     → `history.back();` 한 줄로 교체 (family/species 백버튼과 동일 패턴).
   - 효과: pushState로 쌓인 히스토리 항목을 정상 소비. 복귀 슬라이드 방향(`back`)과 스크롤 복원은
     popstate 핸들러(index.html 1809, `_fromHistory:true`)가 자동 적용하므로 인자 불필요.

4. **'전체 보기' 진입 핸들러 2곳 → `keepNav: true` 추가** (index.html 1930, 1942)
   - `profileSavedViewAll`: `showPage('pageSaved', { dir:'forward' })` → `{ keepNav: true, dir:'forward' }`
   - `profileRecentViewAll`: `showPage('pageRecent', { dir:'forward' })` → `{ keepNav: true, dir:'forward' }`
   - 뒤이은 `navProfile.classList.add('active')` 줄은 그대로 유지(무해, 안전망).
   - 효과: `keepNav && hash` 분기로 진입해 `_subPageBackTarget` 등록 + `history.pushState`가 실행됨.

### 데이터 바인딩
- 이번 작업은 순수 네비게이션/히스토리 배선 확장으로 JSON 데이터 바인딩 변경 없음.
- 관련 렌더링(`renderSavedPage`/`renderRecentPage` — `pageshow:pageSaved`/`pageshow:pageRecent`)은 기존 그대로.

### 주요 설계 결정 (왜 3가지가 모두 필요한가)
1. **push(진입) + back(퇴장) + enable(제스처) 3박자.** 스와이프 백이 되돌아갈 목적지를 가지려면
   진입 시 히스토리 항목이 실제로 쌓여야(`pushState`, 항목 4) 하고, 그 항목을 뒤로가기 버튼이 정확히
   한 스텝 소비해야(`history.back()`, 항목 3) popstate 스택이 어긋나지 않는다. 마지막으로 제스처
   인식기 자체가 켜져야(항목 2) 한다. 항목 1(`PAGE_HASHES`)은 항목 4의 push와 `_subPageBackTarget`
   동적 등록이 실행되기 위한 전제 조건이다.
2. **`showPage()` 직접 호출을 `history.back()`으로 교체한 이유.** pushState로 항목을 쌓아둔 채
   뒤로가기 버튼이 `showPage()`(replaceState 경로)를 직접 부르면 방금 쌓은 항목이 그대로 남아
   "한 번 더 눌러야 실제로 나가지는" 스택 어긋남 버그가 생긴다. `history.back()`은 그 항목을
   정확히 소비하고 popstate → `showPage(..., {_fromHistory:true})`로 목적지를 재렌더한다.
3. **`_subPageBackTarget` 초기 리터럴·popstate `isSubPage` 판정은 손대지 않음(요구사항대로).**
   `pageSaved`/`pageRecent`는 `showPage`의 `keepNav && hash` 분기에서 런타임 동적 등록되므로 초기값
   불필요. popstate에서 `isSubPage=false`가 되어 `syncNavForPage()`가 도는 것이 의도된 동작(두 페이지
   모두 `navProfile` 탭 소속). `SWIPE_BACK_BLOCKED_PAGES`(Discover/Search/Profile)도 그대로 둠.

### 완료 후 필수 확인 결과

**grep 검증 (의도한 4곳만 변경, 다른 참조처 없음 확인):**
- `PAGE_HASHES` — 1683 family / 1684 species / **1685 saved(신규)** / **1686 recent(신규)**.
  별개 객체 `_subPageBackTarget`(1033)는 초기 리터럴 그대로(pageFamilyDetail/pageSpeciesDetail만) — 요구사항대로 미변경.
- `_syncNativeSwipeGesture` enabled — 1702–1703에 `pageSaved`/`pageRecent` 추가 확인.
  (1716의 `syncNavForPage` pageRecent 분기는 이전 pageRecent 작업의 기존 코드로, 이번에 건드리지 않음.)
- `savedBackBtn`(1923)/`recentBackBtn`(1935) 클릭 핸들러 = `history.back();` 단일 호출로 교체 확인.
  마크업 정의(466, 498)는 그대로.
- `profileSavedViewAll`(1928)/`profileRecentViewAll`(1940) 핸들러의 `showPage` 호출에 `keepNav: true` 추가 확인.
  마크업 앵커(603, 618)는 그대로.

**정적 검증:**
- 인라인 `<script>` 블록 `new Function()` 파싱 OK (3363줄, 문법 오류 없음).
- `git diff --stat`: 내 4개 편집 외의 hunk(pageRecent HTML 블록·`renderRecentPage`·콘텐츠 보호 로직·
  `profileRecentViewAll` id 부여)는 **세션 시작 전부터 워킹트리에 있던 미커밋 변경**(CLAUDE.md 2026-07-16
  changelog의 pageRecent/콘텐츠 보호 항목)이며 이번 작업에서 추가·수정하지 않았다.

**로직 트레이스 (브라우저 관찰 가능 범위, 코드 경로 수기 추적):**
- 프로필에서 '전체 보기' 클릭 → `showPage('pageSaved', {keepNav:true, dir:'forward'})`
  → `_subPageBackTarget.pageSaved = 'pageProfile'` 등록 + `pushState({page:'pageSaved'}, '', '#saved')` → 주소창 `#saved` 부착.
- `savedBackBtn` 클릭 → `history.back()` → popstate: `_activePageId('pageSaved')`는 BLOCKED 아님 → `e.state.page='pageProfile'`,
  `isSubPage=false` → `showPage('pageProfile', {_fromHistory:true, restoreScroll:true})` → 프로필 복귀(back 슬라이드), 해시 제거.
- 히스토리 1스텝만 소비: 복귀 지점 `pageProfile`은 `SWIPE_BACK_BLOCKED_PAGES`에 속해, 이후 추가 뒤로가기 popstate는
  재-pushState로 무효화되어 프로필에서 멈춘다(연속 입력에도 이탈 없음). `pageRecent`도 `#recent`로 동일.

**미실행 항목(정직한 고지):**
- 네이티브 엣지 스와이프 제스처 자체는 iOS 네이티브 셸에서만 동작(`window.Capacitor?.isNativePlatform?.()`가
  false면 `_syncNativeSwipeGesture` 즉시 return). 일반 브라우저·시뮬레이터 외 환경에서 스와이프 제스처는 검증 불가 — 요구사항이 명시한 제약.
- 헤드리스 브라우저 클릭 스루는 실제로 구동하지 않았고, 위 '전체 보기→뒤로가기→해시 push/pop' 흐름은 코드 경로 수기 트레이스로 확인.

### 코드 리뷰어 확인 요청 사항
- popstate 핸들러(1808)의 `isSubPage` 판정에 `pageSaved`/`pageRecent`가 포함되지 않아,
  뒤로가기 시 `showPage(..., { keepNav: false })`로 복귀한다. 이는 목적지가 `pageProfile`(탭 루트)이므로
  `syncNavForPage`가 도는 것이 옳다는 요구사항 판단과 일치 — 이 판정을 그대로 두는 것이 맞는지 교차 확인 요청.
- `savedBackBtn`/`recentBackBtn`에서 `history.back()`으로 바꾸며 `navProfile.classList.add('active')`를 제거했는데,
  복귀 시 nav 활성화는 popstate → `syncNavForPage('pageProfile')`가 담당하므로 중복 불필요하다고 판단. 누락 아님을 확인 요청.
- family/species 백버튼과 완전히 동일 패턴(`history.back()` 단독)인지, 스크롤 복원·슬라이드 방향이 자동 적용되는 경로가 두 신규 페이지에도 동일하게 성립하는지 확인 요청.
