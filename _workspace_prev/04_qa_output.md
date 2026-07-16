## QA 검증 결과

검증 대상: `project/index.html` 의 `#pageRecent`(최근 본 곤충 전체보기) 신규 서브페이지.
방식: HTML id ↔ JS `getElementById`/`querySelector` 철자 단위 교차 비교, 이벤트 흐름 추적, 라우팅 상수 grep 재확인, 경계값 코드 흐름 추적. (빌드 도구 없는 정적 HTML — 소스 정합성 검증)

---

### Pass ✅

- **[1] `#pageRecent` DOM 등록**: `<div class="page" id="pageRecent">`(496행)가 `#pageSaved`(490행 종료) 뒤·`#pageProfile`(527행) 앞에 형제 `.page` 로 존재. 세 페이지 모두 `.app` 컨테이너 내부 형제이며 `class="page"` 를 가지므로 `allPages = document.querySelectorAll('.page')`(런타임 조회)에 자동 포함. `showPage`/`popstate` 가 별도 등록 없이 인식.

- **[2] `recentBackBtn` / `recentResultList` 철자 일치**: HTML `id="recentBackBtn"`(498행) ↔ JS `document.getElementById('recentBackBtn')`(1933행) 정확히 일치. HTML `id="recentResultList"`(509행) ↔ JS `document.getElementById('recentResultList')`(3525행) 정확히 일치. 오타·대소문자 불일치 없음. 각 id 문서 내 유일(정의 1회).

- **[3] `profileRecentViewAll` 부여 및 충돌 없음**: 프로필 "최근 본 곤충" 섹션(613~625행) 헤더의 `<a href="#" class="profile-view-all" id="profileRecentViewAll">전체 보기</a>`(618행) ↔ JS 리스너 `document.getElementById('profileRecentViewAll')`(1939행) 일치. 즐겨찾기 섹션의 `profileSavedViewAll`(603행 HTML / 1926행 JS)과 id·리스너가 완전히 분리 — 각각 다른 섹션·다른 목적지(`pageSaved` vs `pageRecent`)로 배선되어 혼동/충돌 없음.

- **[4] `pageshow:pageRecent` 바인딩 ↔ dispatch 경로 일치**: `document.addEventListener('pageshow:pageRecent', renderRecentPage)`(3560행)로 등록. `showPage()`가 전환 시 `document.dispatchEvent(new CustomEvent('pageshow:' + pageId))`(1764행)를 호출 → `pageId==='pageRecent'` 이면 `'pageshow:pageRecent'` 발생 → 리스너 발화. 리스너 등록(3560)·dispatch(1764) 모두 스크립트 최초 파싱 시 실행, 실제 전환(클릭)은 그 이후이므로 타이밍 문제 없음.

- **[5] `syncNavForPage()` 분기 확장 정합**: 1713행 `else if (pageId === 'pageProfile' || pageId === 'pageSaved' || pageId === 'pageRecent') activeId = 'navProfile';` — 기존 `pageProfile || pageSaved` OR 체인에 `|| pageId === 'pageRecent'` 만 추가. 문법 정상, 앞선 `pageSearch` 분기·뒤 `else` 분기와 독립. pageRecent가 이전엔 `else → navDiscover`(오작동)로 빠지던 것을 navProfile로 교정. 다른 페이지 분기 결과 불변.

- **[6] 뒤로가기 목적지 실존**: `recentBackBtn` 클릭(1933~1936) → `showPage('pageProfile', { restoreScroll: true, dir: 'back' })`. `id="pageProfile"`(527행) 실존. 동반 `document.getElementById('navProfile')`(1935) → `id="navProfile"`(817행) 실존. `savedBackBtn`(1920) 패턴과 바이트 단위 동일. `history.back()` 미사용 — replaceState 서브페이지 특성에 맞는 직접 호출.

- **[7] 함수 정의 순서 / 호이스팅**: `renderRecentPage`(3524)가 호출하는 5개 함수 전부 **함수 선언(function declaration)** — `loadRecent`(3423), `loadSearchIndex`(1967), `canonicalizeSciName`(3275), `buildResultItem`(2046), `openSpeciesFromIndex`(2100, 간접). 화살표/`const` 할당 아님 → 스크립트 스코프 전체로 호이스팅. 게다가 `renderRecentPage`는 이벤트 발화(런타임) 시점에만 실행되므로 파싱 순서와 무관하게 모든 참조 함수가 정의 완료 상태. `renderRecentPage` 자신도 선언식이라 3560행 리스너 등록 시 참조 안전.

- **[8] `hidden` 초기 상태 ↔ JS 토글 정합**: 마크업에서 `#recentResultList` 은 `hidden` 속성 보유(509행), `.saved-empty-state` 는 `hidden` 없이 시작(512행) — `#pageSaved` 원본(477/480행)과 동일 컨벤션. JS(`renderRecentPage`)는 데이터 있을 때 `emptyState.setAttribute('hidden','')` + `list.hidden=false`, 없을 때 `emptyState.removeAttribute('hidden')` + `list.hidden=true` 로 상호 배타 토글. 초기값(리스트 숨김·빈상태 표시)과 렌더 후 상태가 모순 없이 맞물림.

- **[9] 라우팅 상수 3종 미등록 (독립 재확인)**: grep 재실행 결과 —
  - `SWIPE_BACK_BLOCKED_PAGES`(1030행) = `{'pageDiscover','pageSearch','pageProfile'}` → **pageRecent 없음**
  - `_subPageBackTarget`(1033행 초기값) = `{pageFamilyDetail, pageSpeciesDetail}` → **pageRecent 없음**
  - `PAGE_HASHES`(1682~1685행) = `{pageFamilyDetail, pageSpeciesDetail}` → **pageRecent 없음**
  세 상수 전체 `pageRecent` 매치 0건. `pageSaved` 와 동일하게 hash 없는 단순 replaceState 서브페이지로 유지 확인. `showPage('pageRecent',{dir:'forward'})`(1941)은 hash 미존재 → replaceState 경로(1774~1777) 진입.

- **[10] 경계값 코드 흐름**:
  - **빈 배열(`entoma_recent`=[])**: `loadRecent()`(3423)가 `[]` 반환 → `arr.length===0` 조기 반환(3532~3536) → 빈 상태 표시, `list.hidden=true`. 크래시·루프 없음.
  - **30개 만재**: `pushRecentEntry`(3440)가 `RECENT_MAX=30` 로 slice 유지 → `arr.forEach`(3542)가 최대 30회 순회. 항목당 `insects.find`(≤300종) O(n) — 최악 9,000회 정규식 실행이나 유한·결정적. 무한루프 없음(리뷰 Suggestion의 Map 최적화는 성능 개선일 뿐 정확성 무관).
  - **search_index 매칭 실패**: `insects.find(...)` → `undefined` → `if (ins)`(3545) 가드로 조용히 스킵(throw 없음). 전부 실패 시 `frag.childElementCount===0` → 빈 상태 처리(3549~3553).
  - **로드 실패 fallback**: `loadSearchIndex()`(1967)가 fetch 실패를 catch 하고 `{insects:[],...}`(1981) 반환 → `data?.insects || []` = `[]` → 전 항목 미매칭 → 빈 상태. 예외 전파 없음.
  - **`entry.sci` 결측**: `canonicalizeSciName(raw)` 가 `if(!raw) return ''`(3276) 가드 보유. 단, `pushRecentEntry`(3437)가 `/^[A-Z][a-z]+/` 통과 학명만 저장하므로 실사용에서 빈 sci 진입 불가. 오염 저장소라도 최악은 오매칭/미매칭일 뿐 크래시 없음.

**부가 확인**: `entry.sci` 필드 정합 — `pushRecentEntry`(3439)가 `{ sci, kr, img }` 로 저장, `renderRecentPage`(3543)가 `entry.sci` 참조 → 스키마 일치. XSS 회피(리뷰 재확인) — 카드는 raw `entry` 가 아닌 search_index `ins` 로 `buildResultItem(ins,'pageRecent')` 생성. `fromPage='pageRecent'` 전파 → 종 상세 뒤로가기 복귀 경로 정확(리뷰 항목 3과 일치).

### Fail ❌

- **없음.** 검증 10개 항목 전부 통과. 셀렉터-요소 불일치, 리스너-DOM 단절, 상수 오등록, 경계값 크래시 경로 없음.

### 수동 테스트 필요

- **전환 애니메이션 시각 확인**: `dir:'forward'`/`dir:'back'` slide 클래스 토글(1736~1739)의 실제 슬라이드 방향·프레임 부드러움은 코드로 방향만 검증 가능, 시각적 품질은 실기기(iOS WKWebView) 확인 권장.
- **empty-state 순간 노출**: 첫 진입 시 `await loadSearchIndex()` 이전 빈 상태가 한 프레임 보였다 사라질 수 있음(리뷰 Suggestion과 동일, `renderSavedPage` 상속 패턴 — 회귀 아님). 캐시 미적재 상태에서의 실제 깜빡임 여부는 실기기 확인 대상.
- **네이티브 엣지 스와이프 동작**: `pageRecent` 는 `_subPageBackTarget` 미등록으로 `_computeBackTarget`(1818)이 `null` 반환 → 네이티브 스와이프 백 프리뷰 대상 아님(pageSaved 동일 설계). 실제 Capacitor 셸에서 스와이프가 무반응인지(의도된 동작)는 실기기 확인 권장.

### 종합: 전체 Pass

10개 검증 항목 전부 통과. `#pageSaved` 패턴을 셀렉터·라우팅 상수 제외·리스너 배선·접근성·경계처리까지 정확히 복제했고, 신규 id 4종(`pageRecent`/`recentBackBtn`/`recentResultList`/`profileRecentViewAll`) 모두 HTML 실존 ↔ JS 참조 철자 일치. Critical/Fail 0건. 현 구현 배포 가능.
