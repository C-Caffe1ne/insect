## 구현 완료 — App Store 6번: 개인정보처리방침

### 생성/수정된 파일

- **`project/index.html`** (수정)
  - A. `#pageSettings`의 `.settings-container` 최하단(지원 섹션 다음)에 "법적 고지" 섹션 + `privacyNavBtn` chevron 항목 추가. `creditsNavBtn` 마크업 패턴 그대로 복제.
  - B. `#pageCredits` 바로 다음에 신규 인앱 페이지 `#pagePrivacy` 추가. `.profile-action-bar` + `privacyBackBtn`, `.settings-container` > `.credits-title` / `.credits-source` / `.settings-section` × 10 (조항 1~10) 구조. 목록은 신규 `.credits-list` 사용.
  - C1. `_subPageBackTarget`에 `pagePrivacy: 'pageSettings'` 추가.
  - C2. scroll-to-top FAB 숨김 조건에 `page.id === 'pagePrivacy'` 추가.
  - D. `_creditsBackBtn` 배선 다음에 `_privacyNavBtn`(→`showPage('pagePrivacy', { dir: 'forward' })`), `_privacyBackBtn`(→`showPage('pageSettings', { restoreScroll: true, dir: 'back' })`)를 **최상위 1회성**으로 등록. 둘 다 null 가드 유지.

- **`project/style.css`** (수정)
  - C3. `#pageSettings, #pageCredits` 페이지 애니메이션 셀렉터에 `#pagePrivacy` 추가.
  - 신규 `.credits-list` / `.credits-list li` 클래스 추가 (기존 `/* credits */` 섹션 내, `.credits-link:hover` 다음). 색·폰트·`word-break`는 `.credits-body`와 동일 토큰 재사용, 하드코딩 색상 없음.

- **`project/privacy.html`** (신규 생성)
  - E. 완전 자립형 정적 페이지. `<html lang="ko">`, `<meta charset="UTF-8">`, viewport, `<title>개인정보처리방침 — KoIn Pedia</title>`. CSS는 `<style>` 인라인, 시스템 폰트 스택, 다크 배경(`#121212`) + 밝은 본문. **외부 리소스 0개.** 호스트명은 평문(링크 아님). `<meta http-equiv>` 미사용 — "http" 문자열 0건 보장.

### 데이터 바인딩

이 작업은 JSON 데이터 바인딩이 아닌 정적 법적 문서 렌더링이다. 본문 문구는 요구사항 §F를 **그대로** 사용했고, 사실을 추가·변경하지 않았다. `#pagePrivacy`와 `privacy.html`의 조항 제목·본문은 동일하다.

### 신규 id / CSS 클래스 (QA 셀렉터 교차 검증용)

| 유형 | 이름 | 정의 위치 |
|------|------|-----------|
| id | `privacyNavBtn` | index.html:739 (button), JS 3757 |
| id | `privacyBackBtn` | index.html:804 (button), JS 3765 |
| id | `pagePrivacy` | index.html (`.page` div) |
| CSS class | `.credits-list`, `.credits-list li` | style.css (신규) |

재사용 클래스: `.settings-section`, `.settings-section-title`, `.settings-item`, `.settings-item-content`, `.settings-item-title`, `.settings-control`, `.settings-button`, `.settings-nav-btn`, `.settings-container`, `.credits-title`, `.credits-body`, `.credits-source`, `.profile-action-bar`, `.action-btn`.

### C의 3개 등록 지점 — 실제 반영 내용

1. **`_subPageBackTarget`** (index.html:1129)
   `const _subPageBackTarget = { pageFamilyDetail: 'pageDiscover', pageSpeciesDetail: 'pageFamilyDetail', pageCredits: 'pageSettings', pagePrivacy: 'pageSettings' };`
2. **FAB 숨김 조건** (index.html:2357)
   `scrollTopBtn.hidden = page.id === 'pageSettings' || page.id === 'pageCredits' || page.id === 'pagePrivacy' || page.scrollTop < 200;`
3. **style.css 페이지 애니메이션** (style.css:3966~3968)
   `#pageSettings,` / `#pageCredits,` / `#pagePrivacy {` → 공통 `pageFadeIn`.

(4번 `allPages`는 `querySelectorAll('.page')`로 자동 포함, `syncNavForPage()`는 미매칭 시 navDiscover 폴백 — 별도 수정 불필요. 5번 `SWIPE_BACK_BLOCKED_PAGES`는 탭 루트 전용이라 추가하지 않음.)

### 완료 기준 8개 자체 검증 (실제 명령 출력 근거)

1. **설정 하단 항목 → #pagePrivacy 진입**: `privacyNavBtn`(index.html:739) → JS 3757 `showPage('pagePrivacy', { dir: 'forward' })`. PASS.
2. **뒤로 → #pageSettings 스크롤 복원**: `privacyBackBtn`(index.html:804) → JS 3765 `showPage('pageSettings', { restoreScroll: true, dir: 'back' })`. PASS.
3. **3개 등록 지점**: `grep -n "pagePrivacy: 'pageSettings'" index.html` → 1129 / `grep -n "page.id === 'pagePrivacy'" index.html` → 2357 / `grep -n "pagePrivacy" style.css` → 3968. 3곳 모두 확인. PASS.
4. **리스너 누수 없음 (1회 등록)**: `_privacyNavBtn`/`_privacyBackBtn` 배선이 `pageshow:` 밖, 설정 초기화 블록(APP_VERSION 근처) 최상위에 위치. 5회 반복해도 재등록 없음. PASS.
5. **privacy.html 존재 + 외부 리소스 0**: 파일 존재(5778 bytes). `grep -c "http" project/privacy.html` → **0**. PASS.
6. **본문·조항 §F 일치**: 두 페이지 조항 제목(1~10) 대조 결과 완전 일치. 본문 §F 그대로. PASS.
7. **node --check 통과**: 인라인 스크립트(1029~4282행) 추출 후 `node --check` → 오류 없음(PASS 출력). PASS.
8. **신규 id HTML/JS 1:1**: `privacyNavBtn`, `privacyBackBtn` 각각 HTML 정의 1건 + JS `getElementById` 참조 1건. PASS.

### 주요 설계 결정

1. **`.credits-list` 신규 추가**: §B가 허용한 대로, 조항 2·4·9의 목록을 시멘틱 `<ul>`로 처리. `.credits-body`와 동일 토큰(`--text-secondary`, `font-size:13px`, `line-height:1.7`, `word-break:keep-all`)을 써 시각 위계를 통일했다.
2. **§4 호스트명을 인앱 페이지에서도 평문 리스트로**: §F 원문이 불릿이고, 링크 목적이 아닌 "통신 대상 고지"이므로 `<a>`가 아닌 `<li>` 평문으로 표기 (privacy.html의 http 0건 요건과도 일관).
3. **privacy.html에서 `<meta http-equiv>` 회피**: charset은 `<meta charset="UTF-8">`만 사용해 "http" 문자열이 문서 전체에서 0건이 되도록 했다. 이메일도 평문(mailto 링크 아님).

### 코드 리뷰어 확인 요청 사항

- `#pagePrivacy` 뒤로가기 시 `restoreScroll: true`가 설정 스크롤 위치를 실제로 복원하는지(`_scrollPosCache`가 forward 진입 시 pageSettings의 scrollTop을 저장하는 흐름) — `pageCredits`와 동일 경로이므로 회귀 없음이 예상되나 교차 확인 요청.
- 네이티브 스와이프-백 프리뷰가 `_subPageBackTarget.pagePrivacy`를 참조해 pageSettings를 미리 렌더하는 경로가 정상 동작하는지.

### 범위 밖 (미조치)

- `ios/App/App/public/`는 빌드 산출물이라 미수정. 실제 기기 반영은 `npx cap sync` 필요(개발자 범위 밖).
- `ios/` 네이티브 파일, `Info.plist`, 데이터 JSON은 이번 범위 밖으로 미수정.
