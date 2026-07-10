## QA 검증 결과 — 개인정보처리방침 추가 (ENTOMA · KR / KoIn Pedia)

검증 대상: `project/index.html`, `project/style.css`, `project/privacy.html` (신규)
방식: `git diff` + `grep` + `Read` 교차 대조. `_workspace/03_review_output.md` 는 존재하지 않아 독립 검증.
환경 주의: 세션 중 Bash 안전성 분류기가 간헐 장애를 일으켜 일부 명령이 거부됨. 실행 못 한 항목은 아래에 명시하고 Read/grep 실측으로 대체·보강함.

---

### 1. 셀렉터 교차 검증 — Pass ✅

신규 심볼 3개 모두 HTML 정의 1건 + JS 참조가 정확히 매칭. 중복 `id` 없음.

```
$ grep -c 'id="..."' index.html
id="privacyNavBtn"  count: 1   (index.html:739, <button>)
id="privacyBackBtn" count: 1   (index.html:804, <button>)
id="pagePrivacy"    count: 1   (index.html:801, <div class="page">)

JS 참조:
  index.html:3757  const _privacyNavBtn  = document.getElementById('privacyNavBtn');
  index.html:3765  const _privacyBackBtn = document.getElementById('privacyBackBtn');
```

- `privacyNavBtn`: HTML 1 : JS 1 (getElementById) — 1:1 매칭.
- `privacyBackBtn`: HTML 1 : JS 1 (getElementById) — 1:1 매칭.
- `pagePrivacy`: HTML 정의 1건. JS는 문자열 인자(`showPage('pagePrivacy'...)`, `_subPageBackTarget`, FAB 조건)로만 참조 — `getElementById(pageId)` 경유로 정상 해석. querySelector 로 조회하는 미존재 셀렉터 없음.
- JS가 조회하는데 HTML에 없는 신규 id: 없음. HTML에만 있고 JS 미참조인 신규 상호작용 id: 없음.

### 2. CSS ↔ HTML 교차 검증 — Pass ✅ (Warning 1건)

**`.credits-list` (신규):** style.css:3951-3963 정의 → HTML 3곳(index.html:826, 842, 874, `#pagePrivacy` 조항 2·4·9)에서 사용. 정의·사용 양방향 매칭.

**`#pagePrivacy` 마크업이 쓰는 클래스의 CSS 정의:** 전부 존재.
- 신규 `.credits-list` = style.css:3951 정의됨.
- 나머지(`.page`, `.profile-action-bar`, `.action-btn`, `.settings-container`, `.credits-title`(3909), `.credits-source`(3927), `.credits-body`(3918), `.settings-section`, `.settings-section-title`)는 기존 `#pageCredits`(index.html:752-798)가 **동일 클래스 집합**으로 이미 정상 렌더 중 → 정의 확인. `#pagePrivacy` 는 `#pageCredits` 구조의 정확한 복제(추가 클래스는 `.credits-list` 뿐).
- 설정 진입 항목(index.html:731-747)은 기존 `데이터 출처` 항목(703-715)의 구조적 복제 — `.settings-item / -content / -title / .settings-control / .settings-button / .settings-nav-btn` 모두 기존 정의 재사용.

**신규 CSS의 커스텀 프로퍼티:** `.credits-list` 는 `var(--text-secondary)` 만 참조. 이 토큰은 기존 `.credits-body`(style.css:3921)가 이미 사용 중 → `:root` 정의 확인. 신규로 도입된 미정의 프로퍼티 없음. `pageFadeIn` 애니메이션은 변경 전에도 `#pageSettings, #pageCredits` 가 참조하던 기존 keyframe이라 `#pagePrivacy` 추가로 새 의존성 발생 없음.

**`privacy.html` 인라인 `<style>` 변수 정합성:**
```
정의된 변수(7): --bg-app --bg-card --border-subtle --green-soft --text-muted --text-primary --text-secondary
var()로 참조(6): --bg-app --border-subtle --green-soft --text-muted --text-primary --text-secondary
```
- 미정의 변수를 참조하는 곳: **없음** (참조 6개 전부 정의됨). 기능적 문제 없음.
- **⚠ Warning:** `--bg-card`(#1a1a1a)는 정의되어 있으나 `var(--bg-card)` 로 어디에서도 참조되지 않는 **사용되지 않는(dead) 변수**. 렌더 영향 0, 순수 미사용 코드 약 25바이트. 삭제 권장이나 기능·완료기준에 영향 없음 → Critical 아님.

### 3. 페이지 등록 3지점 재확인 — Pass ✅

개발자 보고와 무관하게 직접 확인:
```
index.html:1129  const _subPageBackTarget = { ..., pageCredits: 'pageSettings', pagePrivacy: 'pageSettings' };
index.html:2357  scrollTopBtn.hidden = page.id === 'pageSettings' || page.id === 'pageCredits' || page.id === 'pagePrivacy' || page.scrollTop < 200;
style.css:3966-3968  #pageSettings, #pageCredits, #pagePrivacy { animation: pageFadeIn ...; }
```
3곳 모두 `pagePrivacy` 등록 확인. `pageCredits` 와 동일한 3지점 세트.
(4번 `allPages`=`querySelectorAll('.page')` 자동 포함, `syncNavForPage()` 미매칭→`navDiscover` 폴백 — 수정 불요. 5번 `SWIPE_BACK_BLOCKED_PAGES` 는 탭 루트 전용이라 미추가 — 요구사항 지침대로 정확.)

### 4. 스크롤 위치 복원 — Pass ✅

`privacyBackBtn` 핸들러(index.html:3767): `showPage('pageSettings', { restoreScroll: true, dir: 'back' })` — 사양과 일치.

`_scrollPosCache` 코드 경로 추적(index.html:1808-1848):
1. **정방향 진입**: `privacyNavBtn` → `showPage('pagePrivacy', { dir: 'forward' })`. 진입 시 line 1812 `if (prevActive && prevActive.id !== pageId) _scrollPosCache.set(prevActive.id, prevActive.scrollTop)` 로 **떠나는 pageSettings의 scrollTop 저장**.
2. **뒤로가기**: `showPage('pageSettings', { restoreScroll:true })`. line 1816 `restoredTop = (options.restoreScroll && _scrollPosCache.has('pageSettings')) ? _scrollPosCache.get('pageSettings') : 0` → 저장값 복원. `_fromHistory` 미설정이므로 line 1841 else 분기: `target.scrollTop = restoredTop`.
→ pageSettings 스크롤 위치 복원 경로 정상. `pageCredits` 와 완전 동일 경로(회귀 없음).

### 5. 네이티브 스와이프 백 경로 — Pass ✅

`_subPageBackTarget.pagePrivacy = 'pageSettings'` 소비 지점: `_computeBackTarget()`(index.html:1907-1912) `const to = _subPageBackTarget[_activePageId]`. `_activePageId==='pagePrivacy'` 일 때 `to='pageSettings'` 반환 → 스와이프 프리뷰 목적지 정상.

`_syncNativeSwipeGesture(pageId)`(index.html:1787-1791):
```
const enabled = pageId === 'pageFamilyDetail' || pageId === 'pageSpeciesDetail';
```
제스처가 켜지는 페이지 = `pageFamilyDetail`, `pageSpeciesDetail` **뿐**. `#pagePrivacy` 에서는 **켜지지 않음(disabled)**.
→ 판정: `pageCredits` 도 이 목록에 없어 동일하게 **disabled**. 두 페이지의 네이티브 스와이프 제스처 상태가 **정확히 동일**(둘 다 꺼짐, `_subPageBackTarget` 항목은 방어적으로 존재). 요구된 "pageCredits 와 동일 상태" 충족.

### 6. `privacy.html` 정합성 — Pass ✅

실측 출력:
```
$ grep -c "http"      privacy.html → 0
$ grep -c "<script"   privacy.html → 0
$ grep -c "<img"      privacy.html → 0
$ grep -c "<link"     privacy.html → 0
$ grep -cE "src=|href=" privacy.html → 0
$ wc -c privacy.html → 5778
```
- 외부 리소스 참조 0, `http` 문자열 0(호스트명은 평문, 이메일도 평문 — mailto 아님), `<meta http-equiv>` 미사용.
- `<!DOCTYPE html>`, `<html lang="ko">`, `<meta charset="UTF-8">`, viewport, `<title>개인정보처리방침 — KoIn Pedia</title>` 모두 존재. CSS는 `<style>` 인라인, 시스템 폰트 스택, 다크 배경(`--bg-app:#121212`).
- **cap sync 복사 여부**: `capacitor.config.json` 의 `"webDir": "project"` 확인. `privacy.html` 이 `project/` 직하위이므로 `npx cap sync` 시 `ios/App/App/public/privacy.html` 로 포함됨. (빌드 산출물 직접 변경 금지 준수 위해 cap sync 는 실행하지 않고 config로 판정.)

### 7. 완료 기준 8개 재검증 — Pass ✅ (8/8)

| # | 기준 | 판정 | 근거 |
|---|------|------|------|
| 1 | 설정 최하단 항목 → `#pagePrivacy` 진입 | Pass | `법적 고지` 섹션이 `.settings-container` 최종 섹션(index.html:731-747, 지원 섹션 바로 뒤). `privacyNavBtn`→`showPage('pagePrivacy',{dir:'forward'})`(3760). |
| 2 | 뒤로 → `#pageSettings` + 스크롤 복원 | Pass | 항목 4 참조. `restoreScroll:true` 경로 코드 추적 완료. |
| 3 | 3지점 등록 | Pass | 항목 3: 1129 / 2357 / style.css:3968 실측. |
| 4 | 리스너 1회 등록(누수 없음) | Pass | 배선(3756-3770)이 `_creditsBackBtn` 등과 동일한 **최상위 스코프**(pageshow/함수 밖). 오케스트레이터 실측 `pageshow:pagePrivacy` 5회 왕복=정확히 5회. |
| 5 | `privacy.html` 존재 + 외부 리소스 0 | Pass | 항목 6: 5778 bytes, `grep -c http`=0, script/img/link=0. |
| 6 | 본문·조항 §F 일치 | Pass | 조항 제목 1~10 및 본문을 §F 원문과 대조 — `#pagePrivacy`(index.html:812-887)·`privacy.html`(93-162) 모두 일치. 사실 추가/변경 없음. 오케스트레이터도 제목 10개 완전일치 확인. |
| 7 | 인라인 스크립트 `node --check` | Pass* | *직접 `node --check` 실행은 세션 Bash 분류기 장애로 반복 거부됨(아래 "수동 재확인" 참조). 보강 근거: 오케스트레이터가 헤드리스 브라우저로 설정↔방침 5회 왕복을 **실행**했고 정상 동작 — 스크립트가 파싱+실행됨을 의미(구문검사의 상위집합). diff상 추가 JS(3756-3770 등)는 균형 잡힌 well-formed 블록. |
| 8 | 신규 id HTML/JS 1:1 | Pass | 항목 1: `privacyNavBtn`, `privacyBackBtn` 각 HTML 1 : JS 1. |

---

### 수동 테스트 필요 (환경 제약)

- **`node --check` 직접 실행**: 이 QA 세션에서 Bash 안전성 분류기가 간헐 장애(`temporarily unavailable`)를 일으켜 `node -e ...` / 스크립트 실행이 반복 거부됨(`node --version` 만 통과). 코드 레벨·브라우저 실행 근거로 구문 정상이 강하게 뒷받침되나, 릴리스 전 다음 한 줄로 재확인 권장:
  `node -e "const fs=require('fs');new Function([...fs.readFileSync('project/index.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n'));console.log('OK')"`
  (developer 보고는 이미 PASS로 기재.)

---

### Fail 목록

- Critical Fail: **없음**.
- Warning: **1건** — `project/privacy.html` `:root` 의 `--bg-card` 변수 미사용(dead code). 기능·완료기준 영향 0.

### 종합: 전체 Pass ✅ (Warning 1건, Critical 0건)

검증 섹션 7/7 Pass · 완료기준 8/8 Pass. 셀렉터·CSS·페이지등록·스크롤복원·스와이프·정적페이지 모든 경계면 정합. 유일한 지적은 비기능적 미사용 CSS 변수 1건. 배포 차단 요인 없음.
