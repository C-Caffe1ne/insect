## QA 검증 결과 — App Store 등록 준비 변경분

검증 대상: `project/index.html`, `project/style.css` (git diff HEAD 기준)
검증 방법: 실제 파일 Read + `grep` 전수 대조 + 인라인 스크립트 `new Function` 컴파일 검사. 개발자·리뷰어 보고를 신뢰하지 않고 독립 재검증.

---

### Pass ✅

**[1. 셀렉터 교차 검증]** — JS getElementById ↔ HTML id 6개 전부 1:1 일치
근거:
```
getElementById 호출 횟수 / HTML id 정의 횟수 (각 1회, 중복 없음):
  settingsVersion    JS 1 / HTML 1  (html:705, js:3621)
  creditsNavBtn      JS 1 / HTML 1  (html:713, js:3633)
  reportBug          JS 1 / HTML 1  (html:731, js:3625)
  creditsBackBtn     JS 1 / HTML 1  (html:742, js:3649)
  settingsBackBtn    JS 1 / HTML 1  (html:686, js:3641)
  profileSettingsBtn JS 1 / HTML 1  (html:506, js:3657)
  pageCredits        HTML 1 (html:739) / showPage 인자·_subPageBackTarget·FAB조건·allPages 자동포함
```
- JS가 조회하는데 HTML에 없는 id: 0건. 반대(HTML id인데 JS 미참조)는 정상(정적 값 노출용).
- 신규 CSS 전용 클래스(`settings-item-value` html:705, `settings-nav-btn` html:713, `credits-title/body/source/link` html:752~782)는 JS querySelector 대상이 아니며 style-only. HTML 사용 ↔ CSS 정의 모두 매치.

**[2. CSS ↔ HTML 교차 검증]** — 고아 규칙 0건, 미정의 클래스 0건
근거:
- `grep -n "toggle-switch\|toggle-slider" index.html` → exit=1 (매치 0)
- `grep -n "toggle-switch\|toggle-slider" style.css` → exit=1 (매치 0). 리뷰 W-1 지적(3823-3870 블록 + reduced-motion 잔존)이 완전 제거됨.
- reduced-motion 블록(style.css:3894-3898)은 `.settings-button { transition: none; }` 만 남아 리뷰 권고와 정확히 일치.
- 신규 클래스 전부 CSS 정의 확인: `.settings-item-value`(3824), `.settings-nav-btn`(3832)+`:hover`(3841), `.credits-title`(3845), `.credits-body`(3854), `.credits-source`(3863), `.credits-link`(3871)+`:hover`(3882).
- HTML #pageSettings/#pageCredits가 쓰는 재사용 클래스 전부 CSS 정의 확인: `.settings-container`(3708), `.settings-section`(3731), `.settings-section-title`(3735), `.settings-item`(3744), `.settings-item-content`(3756), `.settings-item-title`(3761), `.settings-control`(3767), `.settings-button`(3795), `.profile-action-bar .action-btn`(1274).
- 신규 CSS가 참조하는 커스텀 프로퍼티 전부 `:root` 정의 확인: `--green-soft`(30), `--green-mid`(29), `--text-primary`(32), `--text-secondary`(33), `--text-muted`(34), `--bg-input`(26), `--bg-card`(25, `.settings-button:hover`용), `--border-subtle`(37), `--radius-pill`(41), `--font-body`(44), `--font-display`(43). 하드코딩 색상 없음.

**[3. 페이지 전환 흐름 추적]** — profile→settings→credits→settings→discover 전 경로 코드상 정합
근거 (각 단계 showPage 인자·폴백 추적):
- profileSettingsBtn(3657) → `showPage('pageSettings',{dir:'forward'})`: `syncNavForPage`(1698)에서 pageSettings는 첫 두 분기 미매치 → else → `navDiscover` 활성(폴백). slide-forward. `_scrollPosCache`에 이전 pageProfile 스크롤 저장(1712).
- creditsNavBtn(3635) → `showPage('pageCredits',{dir:'forward'})`: pageCredits도 navDiscover 폴백. pageSettings 스크롤 캐시(1712). slide-forward.
- creditsBackBtn(3651) → `showPage('pageSettings',{restoreScroll:true,dir:'back'})`: `restoreScroll && _scrollPosCache.has('pageSettings')`=true → `restoredTop`=직전 저장값 → **설정 스크롤 정상 복원**. slide-back.
- settingsBackBtn(3643) → `showPage('pageDiscover',{restoreScroll:true,dir:'back'})`: navDiscover 활성, discover 스크롤 복원(캐시 없으면 0). slide-back.
- 하단 네비 활성 상태: 4단계 모두 `navDiscover`로 귀결(pageSettings·pageCredits는 폴백, pageDiscover는 직접 매치) — 일관됨.
- `history`: `PAGE_HASHES`(1671)에는 `pageFamilyDetail`,`pageSpeciesDetail`만 존재. pageSettings·pageCredits 모두 hash 없음 → showPage(1756-1766)에서 `keepNav&&hash` 미충족 → `history.replaceState`만 실행(pushState 없음). **pageCredits가 PAGE_HASHES/popstate에 없는 것은 pageSettings와 완전히 동일한 기존 패턴**이며, 신규 회귀 아님.
- popstate(1773): pageCredits/pageSettings 모두 `SWIPE_BACK_BLOCKED_PAGES`(1026, {discover,search,profile})에 없음. 두 페이지는 replaceState만 하므로 자체 히스토리 엔트리를 push하지 않아 이들 페이지 발(發) 앱 내 popstate가 발생하지 않음 → 뒤로가기 깨짐 없음. iOS 대상(하드웨어 back 없음)에서 back 수단은 화면 back 버튼이며 정상 동작.

**[4. 이벤트 리스너 등록 횟수]** — 중복 등록 경로 없음 (완료기준 5 충족)
근거:
- `grep -n "pageshow:pageSettings\|initSettingsPage" index.html` → exit=1. 재등록 루프 완전 제거.
- creditsNavBtn(3635)·settingsBackBtn(3643)·creditsBackBtn(3651)·profileSettingsBtn(3657) 리스너와 reportBug href 대입(3629)은 전부 인라인 `<script>`(928-4167) top-level 모듈 스코프에서 **로드 시 1회** 실행. 설정 페이지 재진입(showPage)은 이 블록을 재실행하지 않음. 5회·N회 열어도 리스너 1개 유지.

**[5. 경계값 / 예외]**
- 스크립트 실행 시점 DOM 존재: `<script>`는 928-4167행, #pageSettings(683-736)·#pageCredits(739-785) 마크업이 그 앞에 파싱됨 → getElementById(3621~) 시점에 대상 엘리먼트 이미 DOM 존재. null 반환 없음.
- 신규 DOM 조회 전부 `if (el)` 가드(3622,3626,3634,3642,3650). null 안전.
- scroll-to-top FAB: pageCredits에서 **이중 숨김** — showPage 전환마다 `fab.hidden=true`(1754-1755) + 스크롤 핸들러 조건에 `page.id==='pageCredits'` 포함(2257)해 스크롤해도 계속 숨김.
- mailto 폴백: HTML 기본 `href="mailto:hwanghs5290@gmail.com"`(731) — JS 미실행/실패 시에도 올바른 주소로 메일 작성 가능. JS 실행 시 subject/body 추가 덮어쓰기(3627-3629, `encodeURIComponent` 인코딩). `target="_blank"` 없음 → WKWebView 시스템 메일 위임 정상 가능.
- 인라인 스크립트 구문: `new Function(code)` 컴파일 성공 (length=134086). 구문 오류 0.

**[6. 완료 기준 6개 재검증]**
1. `grep -n "updateNav\|dailyNotification\|rateApp\|support@example.com" project/index.html` → **exit=1 (0건)** ✅
2. `grep -n "alert(" project/index.html` → **exit=1 (0건)** ✅
3. 버전 1.0 표시: `settingsVersion`(html:705) ← `APP_VERSION='1.0'`(js:3618) → `_settingsVersionEl.textContent=APP_VERSION`(js:3622) ✅
4. 설정>데이터 출처 → #pageCredits → 뒤로 → #pageSettings: creditsNavBtn→showPage('pageCredits',forward)(3636), creditsBackBtn→showPage('pageSettings',{restoreScroll,back})(3652) — 전 구간 연결 ✅
5. 5회 열어도 리스너 미중복: 항목 4 근거대로 top-level 1회 등록, pageshow 재등록 루프 제거 ✅
6. #pageCredits 셀렉터 1:1 정합: 항목 1 근거대로 id·CSS 클래스 누락/오타 0. `data-slot`은 미사용(정적 고지 페이지, 개발자 설계) — 정합 대상 없음 ✅

---

### Fail ❌

**없음.** Critical/Warning 급 Fail 0건. 리뷰 유일 지적(W-1 toggle 고아 CSS)은 오케스트레이터가 제거 완료했음을 재확인(style.css grep exit=1).

---

### 수동 테스트 필요 (코드 결함 아님 · 실기기 확인 권장)

- **네이티브 엣지 스와이프 백 @ #pageCredits / #pageSettings**: `_syncNativeSwipeGesture`(1687)는 `pageFamilyDetail`/`pageSpeciesDetail` 에서만 제스처를 켬 → pageCredits·pageSettings 모두 네이티브 엣지 스와이프 **비활성**. 따라서 `_subPageBackTarget.pageCredits='pageSettings'`(1029) 항목은 실제로는 호출 경로가 없어 휴면 상태(무해, pageSettings와 동일 동작). 코드상 회귀 근거 없으나, Capacitor 셸 동작이라 실기기에서 "credits에서 엣지 스와이프 → 아무 일 없음(화면 back 버튼만 동작)"을 확인 권장. (리뷰 S-3와 동일 결론)
- **외부 링크 `target="_blank"` @ #pageCredits**(html:760,768,769) 및 `mailto:` 앵커(html:731): `rel="noopener noreferrer"` 적절. WKWebView에서 시스템 브라우저/메일 앱으로 실제 열리는지는 실기기 확인 대상(구현은 스펙 준수).
- **`prefers-reduced-motion` @ #pageCredits**: `#pageSettings,#pageCredits { animation: pageFadeIn }`(css:3888-3890)은 reduced-motion에서 비활성화되지 않음. pageSettings에서 이미 존재하던 패턴을 그대로 계승한 것이라 신규 회귀 아님(경미한 a11y 관찰, Fail 아님).

---

### 종합: 전체 Pass

- Pass 6개 항목(셀렉터·CSS↔HTML·전환흐름·리스너·경계값·완료기준6) 전부 통과.
- Fail 0개. 삭제 회귀(toggle 고아 CSS 포함)·리스너 누수·미정의 셀렉터·구문 오류 전무.
- 신규 `#pageCredits`는 기존 pageSettings 패턴(allPages·replaceState·FAB·pageFadeIn·nav 폴백)에 정확히 정합. 잔여 항목은 실기기 QA 권장 사항뿐(코드 결함 아님).
