# 요구사항

## 사용자 요청

App Store 등록 준비 6번 항목: "개인정보처리방침 작성 후 Vercel 배포"
추가 지시: **"6번을 설정페이지 하단에 배치해줘"**

## 분류된 작업 유형

기능 추가 (신규 인앱 페이지 + 신규 정적 페이지)

## 사용자 결정 사항 (확정)

| 항목 | 결정 |
|------|------|
| 배치 방식 | 앱 내 페이지(`#pagePrivacy`) + 공개 `project/privacy.html` **둘 다** |
| 진입점 | 설정 페이지 **최하단** 신규 섹션 |
| 운영자 명의 | 앱 이름만 표기 — "KoIn Pedia" (실명 비공개) |
| 문의 이메일 | `hwanghs5290@gmail.com` (버그 제보와 동일) |
| 시행일 | 2026년 7월 10일 |

## 관련 파일

- `project/index.html` — 설정 하단 항목 + `#pagePrivacy` 페이지 + JS 배선
- `project/style.css` — 필요 시 스타일 (기존 `.credits-*` 재사용 우선)
- `project/privacy.html` — **신규 파일**. Vercel 정적 루트가 `project/` 이므로 `https://<도메인>/privacy.html` 로 공개된다. App Store Connect 의 필수 항목인 "개인정보처리방침 URL" 로 사용.

---

## 작업 항목

### A. 설정 페이지 최하단 진입 항목

`#pageSettings` 의 `.settings-container` 안, **"지원" 섹션 바로 다음**(= 최하단)에 신규 섹션을 추가한다.

```
설정
├─ 앱 정보
│   ├─ 버전            1.0
│   └─ 데이터 출처        >   (기존, #pageCredits)
├─ 지원
│   └─ 오류 및 버그 제보  [제보]
└─ 법적 고지                  ← 신규 (최하단)
    └─ 개인정보처리방침    >   (신규, #pagePrivacy)
```

- 섹션 제목: `법적 고지`
- 항목 제목: `개인정보처리방침`
- 우측 chevron 버튼: 기존 `creditsNavBtn` 과 동일한 마크업 패턴. `id="privacyNavBtn"`, `class="settings-button settings-nav-btn"`, `aria-label="개인정보처리방침 보기"`, SVG 에 `aria-hidden="true"`.
- 클릭 시 `showPage('pagePrivacy', { dir: 'forward' })`.

### B. 신규 인앱 페이지 `#pagePrivacy`

**배치**: `.app` 컨테이너 안, `#pageCredits` (`index.html:734` ~ 끝) **바로 다음**.

**마크업**: `#pageCredits` 구조를 그대로 따른다.
- `.profile-action-bar` + `<button class="action-btn" id="privacyBackBtn" aria-label="뒤로">` (뒤로 화살표 SVG는 `creditsBackBtn` 것 복사)
- `.settings-container` > `<h2 class="credits-title">개인정보처리방침</h2>`
- 각 조항은 `<section class="settings-section">` + `<h3 class="settings-section-title">` + `<p class="credits-body">`
- 시행일 등 보조 정보는 `.credits-source` 재사용
- 목록은 기존 `.credits-body` 안에서 처리하거나, 필요하면 `.credits-list` 를 신규 추가

**뒤로가기**: `showPage('pageSettings', { restoreScroll: true, dir: 'back' })`

### C. 페이지 등록 체크리스트 (누락 시 버그)

`#pageCredits` 를 추가할 때 손봤던 지점과 **정확히 동일한 곳**을 손봐야 한다. 하나라도 빠지면 조용히 깨진다.

1. `_subPageBackTarget` (`index.html:1024`) 에 `pagePrivacy: 'pageSettings'` 추가.
2. scroll-to-top FAB 숨김 조건 (`index.html:2252`):
   현재 `page.id === 'pageSettings' || page.id === 'pageCredits' || page.scrollTop < 200`
   → `pagePrivacy` 추가. 조건이 길어지므로 `const NO_FAB_PAGES = new Set([...])` 같은 형태로 정리해도 좋다 (단, 기존 동작 보존).
3. `style.css` 의 `#pageSettings, #pageCredits { animation: pageFadeIn ... }` (`style.css:3951` 근처) 에 `#pagePrivacy` 추가.
4. `allPages` 는 `querySelectorAll('.page')` 라 자동 포함. `syncNavForPage()` 는 미매칭 pageId 를 `navDiscover` 로 폴백하므로 별도 수정 불필요 (`pageSettings`/`pageCredits` 와 동일).
5. `SWIPE_BACK_BLOCKED_PAGES` 는 탭 루트 전용. **추가하지 말 것.**

### D. JS 배선

`index.html` 하단 인라인 `<script>` 의 설정 페이지 블록(`APP_VERSION` 선언 이후, `_creditsBackBtn` 등록 근처)에 추가한다.

- 최상위 **1회성 등록**. `pageshow:` 이벤트 안에서 등록하지 말 것 (리스너 누수 재발 방지).
- 기존 패턴대로 `const _privacyNavBtn = document.getElementById('privacyNavBtn'); if (_privacyNavBtn) { ... }` 형태의 null 가드 유지.
- `_privacyBackBtn` 도 동일.

### E. 공개 정적 페이지 `project/privacy.html`

App Store Connect 는 데이터를 수집하지 않는 앱에도 **개인정보처리방침 URL 을 필수로 요구**한다. Vercel 이 `project/` 를 정적 루트로 서빙하므로 이 파일이 그 URL 이 된다.

요건:
- **완전 자립형(self-contained)**. `style.css` 를 링크하지 말 것 — `style.css` 는 `.app` 컨테이너 전제로 작성되어 있다. CSS 는 `<style>` 블록에 인라인.
- **외부 리소스 0개.** 웹폰트 CDN, 이미지, 스크립트 금지. 시스템 폰트 스택 사용.
- `<html lang="ko">`, `<meta charset="UTF-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`
- `<title>개인정보처리방침 — KoIn Pedia</title>`
- 다크 배경(`#121212` 계열) + 밝은 본문. 앱 팔레트와 어울리게. 모바일에서 읽기 좋은 `max-width` 와 `line-height`.
- 본문은 아래 §F 와 **동일한 문구**를 사용한다.

### F. 개인정보처리방침 본문 (아래 문구를 그대로 사용할 것)

> 이 문구는 실제 코드를 검증해 작성했다. **임의로 문장을 추가하거나 사실을 바꾸지 말 것.**
> 특히 "수집하지 않는다"는 서술은 코드 검증 결과다: `fetch()` 는 로컬 JSON 3개만 호출하고,
> 분석·추적·광고 SDK 는 0건이며, 프로필 사진은 LocalStorage 에만 저장된다.

---

**개인정보처리방침**

시행일: 2026년 7월 10일

KoIn Pedia(이하 "앱")는 이용자의 개인정보를 수집하지 않습니다. 이 방침은 앱이 어떤 정보를 다루고 다루지 않는지를 설명합니다.

**1. 수집하는 개인정보**

앱에는 회원가입, 로그인, 계정 생성 기능이 없습니다. 앱은 이름, 이메일, 전화번호, 위치, 기기 식별자를 포함한 어떠한 개인정보도 수집하거나 서버로 전송하지 않습니다. 앱에는 광고 SDK, 분석 도구, 추적 기술이 포함되어 있지 않습니다.

**2. 기기 내부에만 저장되는 정보**

다음 정보는 이용자 기기 내부 저장소에만 저장되며 외부로 전송되지 않습니다. 개발자는 이 정보에 접근할 수 없습니다.

- 즐겨찾기한 곤충 목록
- 최근 본 곤충 목록
- 프로필 사진 및 배경 이미지
- 프로필에 입력한 이름, 핸들, 지역

**3. 카메라 및 사진 접근 권한**

프로필 사진과 배경 이미지를 설정할 때에만 카메라와 사진 라이브러리에 접근합니다. 선택한 이미지는 기기 내부에만 저장되며 어디에도 업로드되지 않습니다. 권한은 iOS 설정에서 언제든 철회할 수 있습니다.

**4. 외부 서버와의 통신**

앱은 곤충 사진을 다음 외부 서버에서 내려받아 표시합니다. 이 과정에서 이용자의 IP 주소가 해당 서버에 전달됩니다. 이는 인터넷상 이미지 표시에 기술적으로 수반되는 것으로, 이용자를 식별하거나 추적하기 위한 목적이 아닙니다.

- inaturalist-open-data.s3.amazonaws.com (Amazon Web Services)
- static.inaturalist.org (iNaturalist)
- species.nibr.go.kr (국립생물자원관)

곤충 분류와 종 정보 데이터, 그리고 서체는 앱에 내장되어 있어 네트워크 통신 없이 이용할 수 있습니다.

앱 내 링크(국립생물자원관, iNaturalist, Creative Commons)를 누르면 기기의 기본 브라우저가 열립니다. 이후의 정보 처리는 해당 사이트의 개인정보처리방침을 따릅니다.

**5. 제3자 제공 및 처리 위탁**

앱이 수집하는 개인정보가 없으므로, 제3자에게 제공하거나 처리를 위탁하는 개인정보가 없습니다.

**6. 보유 및 파기**

기기에 저장된 정보는 이용자가 앱 내에서 해당 항목을 삭제하거나 앱을 삭제하면 함께 삭제됩니다. 개발자가 별도로 보유하는 정보는 없습니다.

**7. 이용자의 권리**

앱이 개인정보를 수집하지 않으므로 열람·정정·삭제·처리정지를 요청할 대상 정보가 없습니다. 기기에 저장된 정보는 이용자가 직접 관리할 수 있습니다.

**8. 만 14세 미만 아동**

앱은 만 14세 미만 아동을 포함한 모든 이용자로부터 개인정보를 수집하지 않습니다.

**9. 문의**

개인정보 처리에 관한 문의는 아래로 연락해 주십시오.

- 운영자: KoIn Pedia 개발자
- 이메일: hwanghs5290@gmail.com

**10. 방침의 변경**

이 방침이 변경되는 경우 앱 내 본 화면과 공개 페이지를 통해 고지합니다.

---

## 제약 (CLAUDE.md 준수 필수)

- 변경은 `project/` 안에서만. `.app` 컨테이너 외부 DOM 접근 금지. (`privacy.html` 은 앱 셸과 무관한 별도 정적 페이지이므로 예외)
- 인앱 JS 는 `index.html` 최하단 `<script>` 블록에 인라인. **외부 `.js` 파일 추가 금지.**
- 인덴트 공백 2칸, 세미콜론, `const`/`let` (var 금지), 함수명 camelCase, 내부 변수는 `_` 접두사.
- 신규 CSS 는 최소화하고 기존 `.credits-*` / `.settings-*` 클래스를 재사용. 커스텀 프로퍼티 재사용, 하드코딩 색상 금지.
- `z-index` 계층: 신규 페이지는 페이지 레이어(1).
- 코드 삭제 전 `grep -n` 으로 참조처 확인.
- `ios/App/App/public/` 은 빌드 산출물. **직접 수정 금지** (`npx cap sync` 가 처리).
- `ios/App/App/*.swift`, `Info.plist`, Xcode 설정, 데이터 JSON 은 이번 범위 밖.
- 줄 번호는 수정 전 기준이다. 편집을 시작하면 밀리므로 각 편집 직전에 해당 코드를 다시 읽을 것.

## 완료 기준

1. 설정 페이지 최하단에 "법적 고지 > 개인정보처리방침" 항목이 보이고, 눌러서 `#pagePrivacy` 로 진입한다.
2. `#pagePrivacy` 의 뒤로가기가 `#pageSettings` 로 복귀하고, 설정 스크롤 위치가 복원된다.
3. `_subPageBackTarget`, FAB 숨김 조건, 페이지 애니메이션 CSS 세 곳에 `pagePrivacy` 가 모두 등록되어 있다.
4. 설정 → 개인정보처리방침 → 뒤로 를 5회 반복해도 리스너가 중복 등록되지 않는다 (최상위 1회 등록).
5. `project/privacy.html` 이 존재하고, 외부 리소스 참조가 0건이다.
   `grep -c "http" project/privacy.html` 이 0 이어야 한다 (문서 내 호스트명은 링크가 아닌 평문으로 적을 것).
6. `#pagePrivacy` 본문과 `privacy.html` 본문의 조항 제목·문구가 §F 와 일치한다.
7. 인라인 스크립트가 `node --check` 를 통과한다.
8. 신규 `id` 가 HTML 과 JS 사이에서 1:1 로 일치한다 (`privacyNavBtn`, `privacyBackBtn`).
