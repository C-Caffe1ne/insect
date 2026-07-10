## 코드 리뷰 결과 — App Store 등록 준비 변경분

리뷰 대상: `project/index.html`, `project/style.css` (git diff 기준)
검증 방법: 실제 파일 Read + 프로젝트 전역 `grep` + 인라인 스크립트 파싱 검사. 개발자 보고를 신뢰하지 않고 재검증함.

---

### Critical (즉시 수정 필요)

**없음.**

핵심 리스크였던 **삭제 회귀는 전수 재검증 결과 깨끗하다.** 아래 심볼 전부 `project/` 전역(`*.html/*.js/*.mjs/*.css`)에서 잔존 참조 0건(grep exit=1):

```
updateNav  dailyNotification  rateApp  support@example.com
DEFAULT_SETTINGS  loadSettings  saveSettings  applySettings
initSettingsPage  insectAppSettings  navSettings  alert(  pageshow:pageSettings
```

- 런타임 ReferenceError 유발 경로 없음. `showPage()` 내부 `syncNavForPage()` 가 네비 동기화를 대체하므로 `updateNav` 호출 2곳 삭제는 안전.
- 인라인 `<script>` 블록 전체 파싱 성공(`new Function` 검사 통과) — 구문 오류 없음.
- XSS: 신규 코드는 `_settingsVersionEl.textContent = APP_VERSION`(상수)와 `href` 대입뿐. `innerHTML` 사용 없음. 안전.
- null 가드: 신규 DOM 조회(`settingsVersion`, `reportBug`, `creditsNavBtn`, `settingsBackBtn`, `creditsBackBtn`) 전부 `if (el)` 가드 적용됨.
- 범위 이탈 없음: `git status` 상 변경은 `project/index.html`, `project/style.css`, `_workspace/*` 뿐. `ios/`·`*.json`·`*.swift`·`Info.plist` 미변경(grep exit=1).
- mailto 앵커(index.html:731): `encodeURIComponent`로 subject/body 정상 인코딩. `target="_blank"` 없음 → WKWebView에서 시스템 메일 앱으로 정상 위임(요구사항 6 충족). HTML 폴백 `href="mailto:..."` 존재로 JS 미실행 시에도 동작.
- 페이지 통합: `#pageCredits` 는 `allPages`(querySelectorAll('.page')) 자동 포함, `_subPageBackTarget.pageCredits='pageSettings'`(index.html:1029) 등록, FAB 숨김 조건(index.html:2257) 추가, `syncNavForPage`(1698)는 pageCredits를 navDiscover로 폴백. `slide-forward/back`·`pageFadeIn`(#pageSettings,#pageCredits)까지 정상 연결. **pageSettings와 완전히 동일한 패턴을 따르므로 회귀 없음.**
- 이벤트 리스너 누수: `pageshow:pageSettings` 재등록 루프 제거 확인. 신규 리스너는 전부 top-level 모듈 스코프에서 1회 등록 → 페이지 재진입 시 재등록 경로 없음. A-2 누수 해소됨.

---

### Warning (권장 수정)

**W-1. 고아 CSS `.toggle-switch`/`.toggle-slider` — 개발자 판단 오류. 실제로는 전부 죽은 코드.**
- 위치: `style.css:3823-3870` (`.toggle-switch`, `.toggle-slider`, `:before`, `input:checked` 규칙 전체) + `style.css:3945-3946` (reduced-motion 블록 내 `.toggle-slider, .toggle-slider:before`).
- 근거: 알림 섹션 삭제로 `toggle-switch`/`toggle-slider` 는 `index.html` 에서 **매치 0건**(grep exit=1). 참조하는 HTML 요소가 존재하지 않음.
- **개발자 보고의 판단이 틀렸다.** 개발자는 "reduced-motion 미디어 쿼리가 `.toggle-slider`를 참조하고 있어 제거 시 부수효과 위험"이라며 유지했으나, 그 reduced-motion 규칙(3945-3946) 자체가 **존재하지 않는 요소를 겨냥하는 또 하나의 죽은 규칙**이다. "참조"가 아니라 "동반 사망". 제거해도 매칭되는 DOM이 없어 부수효과가 발생할 수 없다.
- 영향: 런타임 오류·기능 문제 없음(미매칭 규칙은 무시됨). 다만 CLAUDE.md "미사용 선택자 없음" 위반이며, App Store 심사 정리 취지상 죽은 UI 코드는 걷어내는 것이 옳다.
- 수정 제안: `.toggle-switch`~`input:checked + .toggle-slider:before` 블록(3823-3870) 삭제. reduced-motion 블록(3943-3948)은 `.toggle-slider, .toggle-slider:before` 두 셀렉터를 빼고 `.settings-button { transition: none; }` 만 남긴다.
  ```css
  @media (prefers-reduced-motion: reduce) {
    .settings-button {
      transition: none;
    }
  }
  ```

---

### Suggestion (선택 개선)

**S-1. `profileSettingsBtn` null 가드 부재 — 신규 패턴과 불일치**
- `index.html:3657`: `document.getElementById('profileSettingsBtn').addEventListener(...)` — 이번에 같은 블록을 수정(updateNav 제거)했으나 null 가드 없이 유지. 신규 코드는 전부 `if (el)` 가드를 적용했는데 이 한 줄만 예외.
- 실사용상 `profileSettingsBtn`(index.html:506)은 항상 존재해 위험은 낮음(기존 코드). 일관성 차원에서 `const _btn = document.getElementById('profileSettingsBtn'); if (_btn) _btn.addEventListener(...)` 로 통일 권장.

**S-2. `creditsBackBtn` SVG에 `aria-hidden="true"` 부재**
- `index.html:743`의 뒤로가기 SVG는 `aria-hidden`이 없다. 다만 기존 `settingsBackBtn`(686-691) SVG도 동일하게 없어 **기존 관례와는 일치**한다. 버튼에 `aria-label="뒤로"`가 있어 실접근성 문제는 경미. 아이콘 전용 `creditsNavBtn`은 SVG에 `aria-hidden="true"`를 올바르게 넣었으므로, 일관성을 위해 back 버튼 SVG에도 추가하는 것을 권장(선택).

**S-3. 네이티브 엣지 스와이프 백은 on-device QA 검증 필요(코드 결함 아님)**
- `pageCredits`는 `PAGE_HASHES`에 없어 forward 진입 시 `history.replaceState`만 하고 `pushState`는 하지 않는다(showPage 1756-1766). 이는 `pageSettings`와 **완전히 동일한 기존 동작**이며, `_subPageBackTarget`에는 등록돼 있어 스와이프 프리뷰 목적지는 pageSettings로 잡힌다. 정적 분석상 회귀 근거는 없으나, 네이티브 셸 동작이라 실기기에서 "credits에서 엣지 스와이프 백 → settings 복귀"를 QA가 실제로 확인할 것을 권장.

**S-4. 외부 링크 `target="_blank"` WKWebView 동작 확인(요구사항 스펙대로 구현됨)**
- credits 외부 링크 3곳(index.html:760, 768, 769)은 요구사항 D-3 지시대로 `target="_blank" rel="noopener noreferrer"` 적용. `rel` 조합은 보안상 적절. Capacitor WKWebView에서 새 창/시스템 브라우저로 실제 열리는지는 QA 확인 대상(구현 자체는 스펙 준수).

**S-5. 잔여 `insectAppSettings` LocalStorage(무해) — 개발자 이미 인지**
- 구버전 사용자 단말에 남은 `insectAppSettings` 값은 더 이상 읽지/쓰지 않아 무해. 마이그레이션/클린업은 선택. 이번 범위 밖 처리 타당.

---

### 종합 평가

삭제 비중이 큰 변경임에도 **런타임 회귀·XSS·리스너 누수·범위 이탈이 전무한 견고한 작업**이다. 신규 `#pageCredits`는 기존 pageSettings 패턴(allPages·_subPageBackTarget·FAB·애니메이션·nav 폴백)에 정확히 맞물리고, mailto 앵커·null 가드·접근성 라벨도 요구사항을 충실히 충족한다. 유일한 실질 지적은 개발자가 "유지"로 판단한 toggle 고아 CSS가 사실은 전부 죽은 코드라는 점(W-1)이며, 이는 기능이 아닌 정리 이슈다.

**Critical 0개 / Warning 1개 / Suggestion 5개**
