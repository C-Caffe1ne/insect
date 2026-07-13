# 요구사항

## 사용자 요청

App Store 등록 준비 작업 중 3번 항목:
"더미 핸들러 4곳 수정 + 설정 페이지 빈 항목 채우기 + 출처·라이선스 고지 페이지 추가"

## 분류된 작업 유형

기능 추가(신규 페이지) + 버그 수정

## 관련 파일

- `project/index.html` (HTML + 인라인 JS)
- `project/style.css`

## 사용자 결정 사항 (확정)

| 항목 | 결정 |
|------|------|
| 지원 이메일 | `hwanghs5290@gmail.com` |
| 오늘의 곤충 알림 토글 | **완전 제거** (섹션째 삭제) |
| 앱 평가하기 버튼 | **완전 제거** |

## 작업 항목

### A. 깨진 코드 수정 (App Store 심사 리젝 사유)

**A-1. `updateNav()` — 정의되지 않은 함수 (ReferenceError)**
- 호출 위치: `index.html:3636`, `index.html:3648`
- `updateNav`는 프로젝트 전체 어디에도 정의되어 있지 않다 (`grep -n "updateNav"` 결과 호출 3곳뿐, 정의 0곳).
- `navSettings` 엘리먼트도 존재하지 않는다 (`id="navSettings"` 매치 0건).
- 두 호출 모두 각 이벤트 핸들러의 마지막 문장이라 눈에 띄지 않았을 뿐, 실행될 때마다 uncaught ReferenceError를 던진다.
- **조치**: `updateNav(...)` 호출 2곳을 삭제한다. `showPage()`가 내부에서 이미 `syncNavForPage(pageId)`를 호출하므로 네비 동기화는 이미 처리된다. 주석 처리된 `index.html:3653-3655` 죽은 블록도 함께 삭제.

**A-2. `initSettingsPage()` 이벤트 리스너 누수**
- `index.html:3641` 에서 `pageshow:pageSettings` 마다 `initSettingsPage()` 호출.
- `initSettingsPage()` 내부(`3611`, `3623`, `3628`)에서 매번 `addEventListener` 재등록 → 설정 페이지를 N번 열면 리스너 N개 누적.
- **조치**: 리스너 등록을 1회성으로 만든다. 모듈 스코프 플래그(`let _settingsInited = false`) 가드를 쓰거나, 리스너 등록 블록을 `pageshow` 밖 초기화 구간으로 옮긴다. CLAUDE.md의 "모달/오버레이 내부 리스너는 해당 초기화 블록 안에서 등록" 규칙과 충돌하지 않게 할 것.

**A-3. `reportBug` — 더미 이메일**
- 현재: `window.open('mailto:support@example.com?subject=곤충도감 버그 제보')` (`index.html:3623-3626`)
- **조치**: 지원 이메일 `hwanghs5290@gmail.com` 으로 교체.
- WKWebView에서 `window.open('mailto:')`는 신뢰성이 낮다. `<button>` 대신 **`<a href="mailto:...">`** 앵커를 `.settings-button` 클래스로 스타일링해 사용할 것. Capacitor의 네비게이션 델리게이트가 `mailto:` 스킴을 시스템 메일 앱으로 넘긴다.
- 제목/본문에 앱 버전을 넣으면 지원에 유용하다: `?subject=[KoIn Pedia] 오류 제보&body=%0A%0A---%0A앱 버전: 1.0`
- `encodeURIComponent`로 인코딩할 것.

### B. 더미 UI 제거

**B-1. 알림 설정 섹션 전체 삭제**
- HTML: `index.html:697-711` 의 `<section class="settings-section">` (알림 설정) 통째로 삭제.
- 근거: `Notification.requestPermission()` (`index.html:3617`)은 iOS WKWebView에서 동작하지 않는다. 토글은 켜지지만 알림은 절대 발송되지 않음 → Guideline 2.1 (App Completeness) 리젝 사유.
- JS 연쇄 삭제:
  - `dailyNotification` 참조 전부 (`3583`, `3608`, `3611-3619`)
  - `DEFAULT_SETTINGS` 에 `dailyNotification` 외 키가 없으므로, 설정 저장 스캐폴딩이 전부 죽은 코드가 된다:
    - `DEFAULT_SETTINGS` (`3581-3583`)
    - `loadSettings()` (`3586-3589`)
    - `saveSettings()` (`3592-3594`)
    - `applySettings()` (`3597-3600`) 및 앱 시작 시 호출부 (`3657-3658`)
  - **삭제 전 반드시 `grep -n` 으로 각 심볼의 참조처를 재확인할 것.** 확인 결과 `insectAppSettings` localStorage 키는 `loadSettings`/`saveSettings` 안에서만 쓰인다.
  - ⚠️ CLAUDE.md 는 `insectAppSettings` 가 `defaultHomeTab` 을 담는다고 적고 있으나 **실제 코드에는 `defaultHomeTab` 이 존재하지 않는다**. 문서 드리프트이므로 doc-writer 가 CLAUDE.md 를 정정해야 한다.
- 섹션 삭제 후 `initSettingsPage()` 가 할 일이 없어지면 함수와 `pageshow:pageSettings` 리스너도 함께 정리한다.

**B-2. 앱 평가하기 항목 삭제**
- HTML: `index.html:740-746` 의 "앱 평가하기" `.settings-item` 삭제.
- JS: `rateApp` 핸들러 (`3628-3631`, `alert()` 더미) 삭제.

### C. 설정 페이지 빈 항목 채우기

현재 두 항목이 제목만 있고 값이 없는 빈 껍데기다 (`index.html:716-726`).

**C-1. 버전**
- `<span class="settings-item-value">1.0</span>` 형태로 값 표시.
- 하드코딩 대신 JS 상수 `const APP_VERSION = '1.0';` 를 두고 렌더 시 주입. `ios/App/App.xcodeproj/project.pbxproj` 의 `MARKETING_VERSION = 1.0` 과 일치시킬 것.

**C-2. 데이터 출처**
- 값 표시가 아니라 **새 페이지(`#pageCredits`)로 진입하는 항목**으로 만든다.
- 우측에 chevron(`>`) SVG 아이콘을 넣어 이동 가능함을 표시. 기존 `.settings-item` 마크업 패턴과 `.settings-button` 스타일 재사용.
- 클릭 시 `showPage('pageCredits', { dir: 'forward' })`.

### D. 신규 페이지 — 출처 및 라이선스 (`#pageCredits`)

**D-1. 배치**
- `.app` 컨테이너 안, `#pageSettings` (`index.html:683-749`) 바로 다음에 `<div class="page" id="pageCredits">` 추가.
- 상단 액션바는 `#pageSettings` 의 `.profile-action-bar` + `#settingsBackBtn` 패턴을 그대로 따른다 (`id="creditsBackBtn"`).
- 뒤로가기 → `showPage('pageSettings', { restoreScroll: true, dir: 'back' })`.

**D-2. 페이지 등록 체크리스트 (누락 시 버그)**
- `allPages` 는 `document.querySelectorAll('.page')` (`index.html:1633`) 이므로 자동 포함된다.
- `syncNavForPage()` (`1662-1670`) 는 매칭되지 않는 pageId를 `navDiscover` 로 폴백한다. `pageSettings` 도 동일하게 동작하므로 별도 수정 불필요.
- **`_subPageBackTarget`** (`index.html:993`) 에 `pageCredits: 'pageSettings'` 추가 — 네이티브 엣지 스와이프 백이 목적지를 미리 렌더할 때 참조한다. (`pageSettings` 가 여기 없는 것은 별개 이슈이므로 이번 작업에서 건드리지 않는다.)
- **scroll-to-top FAB** (`index.html:2221`): 현재 `scrollTopBtn.hidden = page.id === 'pageSettings' || page.scrollTop < 200;` → `pageCredits` 도 FAB을 숨기도록 조건에 추가.
- `SWIPE_BACK_BLOCKED_PAGES` (`index.html:990`) 는 탭 루트 전용이므로 추가하지 않는다.

**D-3. 페이지 내용**

섹션 4개. 모든 외부 링크는 `<a href="..." target="_blank" rel="noopener noreferrer">`.

1. **데이터 출처**
   - 국립생물자원관(NIBR) — 「한반도의 생물다양성」 eCatalog
   - 본 앱의 종별 형태·생태·서식지 정보 300종은 국립생물자원관 자료를 바탕으로 합니다.
   - 링크: `https://species.nibr.go.kr`
   - ⚠️ 공공누리(KOGL) 유형이 아직 확인되지 않았으므로 **특정 유형(제1유형 등)을 명시하지 말 것.** "출처: 국립생물자원관" 수준의 출처 표시만 한다.

2. **이미지 출처**
   - iNaturalist 커뮤니티가 Creative Commons 라이선스로 공개한 사진을 사용합니다.
   - 개별 사진의 저작자와 라이선스는 각 종 상세 화면의 "이미지 출처"에 표시됩니다.
   - 링크: `https://www.inaturalist.org`, `https://creativecommons.org/licenses/`

3. **서체**
   - LINE Seed KR — © LINE Corporation
   - Cormorant Garamond, Inter — SIL Open Font License 1.1

4. **오픈소스**
   - Capacitor — MIT License, © Ionic

**D-4. 스타일 (`style.css`)**
- 기존 `.settings-*` 클래스를 최대한 재사용한다 (`.settings-container`, `.settings-section`, `.settings-section-title`, `.settings-item`).
- 신규 클래스가 필요하면 `/* ── 출처 및 라이선스 ── */` 섹션 주석 블록을 만들어 그 아래 추가.
- 커스텀 프로퍼티(`--green-soft`, `--text-primary` 등) 재사용. 하드코딩 색상 금지.
- 본문 텍스트용 `.credits-body` 같은 클래스는 `.settings-item-title` 보다 작은 폰트/연한 색으로.
- `.settings-item-value` 클래스가 없으면 신규 추가 (C-1에서 사용).

## 참고 사항 / 제약

- **CLAUDE.md 규칙 준수 필수**:
  - 모든 변경은 `project/` 안에서만. `.app` 컨테이너 외부 DOM 접근 금지.
  - JS는 `index.html` 최하단 `<script>` 블록에 인라인. 외부 `.js` 파일 추가 금지.
  - 인덴트 공백 2칸, 세미콜론, `const`/`let` (var 금지), 함수명 camelCase.
  - 주석은 기존 한글+영문 혼용 스타일 유지. 불필요한 주석 추가 금지.
  - DOM 조회는 초기화 시점에 캐싱.
  - `z-index` 계층 유지. 신규 페이지는 페이지 레이어(1).
  - 코드 삭제 전 반드시 `grep` 으로 참조처 확인.
- **한 응답에서 같은 파일 두 번 수정 금지** (충돌 방지).
- 데이터 JSON 직접 수정 금지 (이번 작업엔 해당 없음).
- 이 작업은 웹 자산만 건드린다. `ios/App/App/public/` 은 `npx cap sync` 로 동기화되므로 **직접 수정하지 말 것.**
- 네이티브 Swift 파일(`ios/App/App/*.swift`), `Info.plist`, Xcode 프로젝트 설정은 **이번 작업 범위 밖**이다.

## 완료 기준

1. `grep -n "updateNav\|dailyNotification\|rateApp\|support@example.com" project/index.html` → 매치 0건
2. `grep -n "alert(" project/index.html` → 더미 alert 0건
3. 설정 페이지에 "버전 1.0" 값이 실제로 표시된다
4. 설정 > "데이터 출처" 탭 → `#pageCredits` 진입 → 뒤로가기 → `#pageSettings` 복귀
5. 설정 페이지를 5회 열었다 닫아도 리스너가 중복 등록되지 않는다
6. `#pageCredits` 의 모든 `data-slot`/`id` 셀렉터가 JS 참조와 1:1 일치한다
