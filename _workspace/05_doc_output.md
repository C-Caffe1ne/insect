## 문서화 완료

### 생성/갱신된 파일
- `_workspace/05_doc_output.md` (본 문서) — 스와이프 백 제스처 확장 변경사항 요약

> CLAUDE.md는 직접 수정하지 않았습니다. 오케스트레이터가 아래 "변경 이력" 표 행을 검토 후 CLAUDE.md 반영 여부를 판단합니다.

### 문서화 범위
`#pageSaved`(즐겨찾기)·`#pageRecent`(최근 본 곤충) 페이지에 기존 iOS 엣지 스와이프 뒤로가기 인프라
(`EntomaSwipeNav` / Swift `SwipeBackController`)를 연결한 변경 — `project/index.html` 4곳 수정.
Swift·CSS(`style.css`) 변경 없음.

---

### CLAUDE.md "변경 이력" 표 추가 제안 행

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-07-16 | 즐겨찾기(`#pageSaved`)·최근 본 곤충(`#pageRecent`) 페이지에 iOS 엣지 스와이프 뒤로가기 확장 — 기존 `pageFamilyDetail`/`pageSpeciesDetail` 인프라(`EntomaSwipeNav`/`SwipeBackController`)를 두 페이지로 배선. ① `PAGE_HASHES`에 `pageSaved:'saved'`/`pageRecent:'recent'` 추가 ② `_syncNativeSwipeGesture` `enabled` 조건에 두 pageId 추가 ③ `profileSavedViewAll`/`profileRecentViewAll` 진입 핸들러의 `showPage()` 호출에 `keepNav:true` 추가(pushState + `_subPageBackTarget` 동적 등록 트리거) ④ `savedBackBtn`/`recentBackBtn` 뒤로가기 버튼을 `history.back()`으로 교체 | `project/index.html` | 사용자 요청 — "즐겨찾기·최근 본 곤충 페이지에서 화면 넘겨서 뒤로가기". 두 페이지도 family/species와 동일한 히스토리 기반 스와이프 백 흐름을 갖도록 확장 |

---

### 수정된 4곳 상세 설명 (모두 `project/index.html`)

1. **`PAGE_HASHES` 확장** (약 1682–1687행)
   - `pageSaved: 'saved'`, `pageRecent: 'recent'` 두 항목 추가.
   - 역할: 이 두 페이지가 해시(`#saved`/`#recent`)를 갖게 되어야 `showPage(..., { keepNav: true })`가
     `history.pushState`를 태우고 `_subPageBackTarget[pageId]`를 동적 등록할 수 있음
     (두 동작 모두 `PAGE_HASHES[pageId]` 존재가 전제 조건).

2. **`_syncNativeSwipeGesture` `enabled` 조건 확장** (약 1702–1703행)
   - 기존: `pageId === 'pageFamilyDetail' || pageId === 'pageSpeciesDetail'`
   - 추가: `|| pageId === 'pageSaved' || pageId === 'pageRecent'`
   - 역할: 두 페이지가 active일 때 네이티브 제스처 인식기(iOS `SwipeBackController`)를 ON.
     일반 브라우저에서는 `window.Capacitor?.isNativePlatform?.()`가 false라 이 함수가 즉시 return.

3. **'전체 보기' 진입 핸들러 2곳 → `keepNav: true` 추가** (약 1930·1942행)
   - `profileSavedViewAll`: `showPage('pageSaved', { dir:'forward' })` → `{ keepNav: true, dir:'forward' }`
   - `profileRecentViewAll`: `showPage('pageRecent', { dir:'forward' })` → `{ keepNav: true, dir:'forward' }`
   - 역할: `keepNav && hash` 분기로 진입해 `_subPageBackTarget`에 목적지(`pageProfile`) 등록 +
     `history.pushState`로 히스토리 항목을 실제로 쌓음(스와이프 백이 되돌아갈 목적지 확보).
   - 뒤이은 `navProfile.classList.add('active')` 줄은 그대로 유지(무해·안전망).

4. **뒤로가기 버튼 2곳 → `history.back()` 교체** (약 1923–1925·1935–1937행)
   - `savedBackBtn`/`recentBackBtn`: 기존 `showPage('pageProfile', { restoreScroll:true, dir:'back' })` 직접 호출
     → `history.back();` 한 줄로 교체 (family/species 백버튼과 동일 패턴).
   - 역할: pushState로 쌓인 히스토리 항목을 정확히 한 스텝 소비해 popstate 스택 정합성 유지.
     복귀 슬라이드 방향(`back`)·스크롤 복원은 popstate 핸들러(`_fromHistory:true` 경로)가 자동 적용하므로 인자 불필요.
   - 이유: pushState 후 뒤로가기 버튼이 `showPage()`(replaceState 경로)를 직접 부르면 방금 쌓은 항목이
     남아 "한 번 더 눌러야 실제로 나가지는" 스택 어긋남 버그가 발생.

### 설계 요지 (왜 4곳이 함께 필요한가)
스와이프 백 동작은 **진입 시 push(③·전제 ①) + 퇴장 시 back(④) + 제스처 인식기 ON(②)** 3박자가 모두 갖춰져야
성립한다. ①(`PAGE_HASHES`)은 ③의 pushState와 `_subPageBackTarget` 동적 등록이 실행되기 위한 전제 조건이다.
`_subPageBackTarget` 초기 리터럴과 popstate의 `isSubPage` 판정, `SWIPE_BACK_BLOCKED_PAGES`는
요구사항대로 변경하지 않았다(두 페이지 모두 `navProfile` 탭 소속 → 복귀 시 `syncNavForPage`가 도는 것이 의도된 동작).
