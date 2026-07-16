## 요구사항

### 사용자 요청
"즐겨찾기, 최근 본 곤충 페이지에서 화면 넘겨서 뒤로가기 가능하게 해줘"
→ `#pageSaved`(즐겨찾기), `#pageRecent`(최근 본 곤충) 페이지에서 iOS 엣지 스와이프(오른쪽으로 화면을 넘기는) 제스처로 뒤로가기(`#pageProfile`로 복귀)가 되도록 구현.

### 분류된 작업 유형
기능 추가 (기존 스와이프 백 인프라를 `pageSaved`/`pageRecent`로 확장)

### 배경 — 기존 스와이프 백 아키텍처 (오케스트레이터 사전 조사)

이 앱은 이미 `pageFamilyDetail`/`pageSpeciesDetail`에 대해 네이티브(iOS) 엣지 스와이프 뒤로가기를 지원한다.
Swift(`ios/App/App/EntomaBridgeViewController.swift`의 `SwipeBackController`)가 팬 제스처를 구동하고,
`window.EntomaSwipeNav.begin()/commit()/cancel()` (JS, index.html)을 호출해 웹 DOM을 제어한다.
**Swift 쪽은 페이지에 종속되지 않은 범용 구현**이라 이번 작업은 **`project/index.html`만 수정하면 된다** (Swift 변경 불필요).

스와이프 백이 동작하려면 아래 3가지가 모두 갖춰져야 한다:
1. `_syncNativeSwipeGesture(pageId)` (index.html:1698) 의 `enabled` 조건에 해당 pageId가 포함되어야 네이티브 제스처 인식기가 켜진다.
2. `_subPageBackTarget[pageId]` (index.html:1033, 동적 갱신은 1772) 에 "뒤로 갈 목적지"가 등록되어 있어야 `EntomaSwipeNav.begin()`이 프리뷰를 렌더할 수 있다. 이 등록은 `showPage(pageId, { keepNav: true })` 호출 시, `PAGE_HASHES[pageId]`에 해시가 있어야만 실행된다 (index.html:1767-1773 `if (options.keepNav && hash) { ...; history.pushState(...) }`).
3. 뒤로가기 버튼은 **직접 `showPage()`를 호출하지 않고 `history.back()`을 호출**해야 한다 (기존 `familyDetailBackBtn`/`speciesDetailBackBtn` 패턴, 주석: index.html:1863-1865, 3361-3363). `pushState`로 히스토리 항목을 쌓아놓고 뒤로가기 버튼이 `history.back()` 대신 `showPage()`를 직접 불러 `replaceState`를 태우면, 방금 쌓인 히스토리 항목이 그대로 남아 popstate 스택이 어긋난다 ("한 번 더 눌러야 실제로 나가지는" 버그).

현재 `pageSaved`/`pageRecent`는 `PAGE_HASHES`에 없고, "전체 보기" 진입 시 `keepNav`도 안 넘기며, 뒤로가기 버튼(`savedBackBtn`/`recentBackBtn`)도 `history.back()` 대신 `showPage('pageProfile', ...)`를 직접 호출한다 — 즉 현재는 `replaceState`만 타서 히스토리 스택에 쌓이지 않으므로 스와이프 백을 켜도 되돌아갈 목적지가 없다.

### 구체적 수정 지점 (모두 `project/index.html`)

1. **`PAGE_HASHES`** (index.html:1682-1685) — `pageSaved: 'saved'`, `pageRecent: 'recent'` 두 항목 추가.
   ```js
   const PAGE_HASHES = {
     pageFamilyDetail: 'family',
     pageSpeciesDetail: 'species',
     pageSaved: 'saved',
     pageRecent: 'recent'
   };
   ```

2. **`_syncNativeSwipeGesture`** (index.html:1698-1701) — `enabled` 조건에 `pageSaved`/`pageRecent` 추가.
   ```js
   const enabled = pageId === 'pageFamilyDetail' || pageId === 'pageSpeciesDetail'
     || pageId === 'pageSaved' || pageId === 'pageRecent';
   ```

3. **"전체 보기" 진입 핸들러 2곳** — `showPage(...)` 호출에 `keepNav: true` 추가 (히스토리 push + `_subPageBackTarget` 등록 트리거).
   - `profileSavedViewAll` 클릭 핸들러 (index.html:1926-1930):
     ```js
     showPage('pageSaved', { keepNav: true, dir: 'forward' });
     ```
   - `profileRecentViewAll` 클릭 핸들러 (index.html:1938-1943):
     ```js
     showPage('pageRecent', { keepNav: true, dir: 'forward' });
     ```
   (뒤이은 `document.getElementById('navProfile').classList.add('active')` 줄은 그대로 유지 — 무해하며 안전망 역할.)

4. **뒤로가기 버튼 2곳** — `history.back()`으로 교체 (히스토리 스택 정합성 유지, 기존 family/species 백버튼과 동일 패턴).
   - `savedBackBtn` (index.html:1920-1923):
     ```js
     document.getElementById('savedBackBtn').addEventListener('click', () => {
       history.back();
     });
     ```
   - `recentBackBtn` (index.html:1932-1936):
     ```js
     document.getElementById('recentBackBtn').addEventListener('click', () => {
       history.back();
     });
     ```
   (`restoreScroll`/`dir:'back'` 은 popstate 핸들러가 `_fromHistory:true`일 때 자동으로 `back` 슬라이드 방향과 `restoreScroll:true`를 적용하므로 동일하게 동작한다 — index.html:1809 `showPage(pageId, { keepNav: isSubPage, _fromHistory: true, restoreScroll: true })`.)

### 명시적으로 변경하지 않아야 하는 부분

- `_subPageBackTarget` 초기값 객체 리터럴(index.html:1033)에 `pageSaved`/`pageRecent`를 미리 넣을 필요 없음 — `showPage()`가 `keepNav && hash` 조건일 때 동적으로 채운다(항목 3 적용 시 자동 등록됨).
- popstate 핸들러의 `isSubPage` 판정(index.html:1808, `pageFamilyDetail`/`pageSpeciesDetail`만 체크)은 그대로 둘 것 — `pageSaved`/`pageRecent`가 팝 목적지일 때 `isSubPage=false`가 되어 `syncNavForPage()`가 정상적으로 도는 것이 의도된 동작(두 페이지 모두 `navProfile` 탭에 속하므로).
- `SWIPE_BACK_BLOCKED_PAGES`(index.html:1030, `pageDiscover`/`pageSearch`/`pageProfile`만 포함)는 그대로 둘 것 — 이 세 탭 루트만 엣지 스와이프를 차단해야 한다.
- CSS(`style.css`) 변경 불필요 — `dir:'forward'`/`dir:'back'` 슬라이드 애니메이션은 이미 이 두 페이지에 적용되어 있다.
- Swift(`ios/App/App/*.swift`) 변경 불필요 — 브릿지가 페이지에 종속되지 않는 범용 구현.

### 완료 후 필수 확인 (web-developer 자체 점검)

- `savedBackBtn`/`recentBackBtn`/`profileSavedViewAll`/`profileRecentViewAll`/`_syncNativeSwipeGesture`/`PAGE_HASHES`를 grep해 다른 참조처가 없는지, 의도한 4곳만 바뀌었는지 확인.
- 시뮬레이터(iOS 네이티브 셸)가 아닌 일반 브라우저에서는 `window.Capacitor?.isNativePlatform?.()`가 false라 `_syncNativeSwipeGesture`가 즉시 리턴하므로 스와이프 자체는 테스트 불가하다 — 대신 "전체 보기" → 즐겨찾기/최근 본 곤충 진입 → 뒤로가기 버튼 클릭 → 프로필로 정상 복귀 & 브라우저 주소창 해시가 `#saved`/`#recent`로 붙었다가 뒤로가기 시 사라지는지, 히스토리가 한 스텝만 소모되는지(연속으로 여러 번 눌러도 프로필에서 멈추는지) 확인할 것.

### 관련 파일
- `project/index.html` (유일한 수정 대상)

### 참고 사항
- CLAUDE.md 규칙: 도감 앱 변경은 `project/` 안에서만, JS는 `index.html` 인라인 유지, 인덴트 2칸, 세미콜론, `const`/`let`.
- 이번 작업은 새 함수/로직 추가가 아니라 **기존 스와이프 백 배선을 두 페이지로 확장**하는 것 — 최소 diff로 위 4곳만 수정.
