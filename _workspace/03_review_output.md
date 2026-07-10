## 코드 리뷰 결과 — 개인정보처리방침 추가분

리뷰 대상: `project/index.html`, `project/style.css`, 신규 `project/privacy.html`
검증 방식: 실제 파일 Read + grep/diff/node 출력 근거. 추측 없음.

---

### Critical (즉시 수정 필요)

**없음.** 신규 코드에 XSS(innerHTML), 리스너 누수, null 접근, 접근성 차단 이슈가 발견되지 않았습니다.

---

### Warning (권장)

**없음.** CLAUDE.md 규칙(2칸 인덴트·세미콜론·`const`/`let`·외부 .js 금지·클래스 재사용·커스텀 프로퍼티) 위반이 없습니다. 신규 CSS `.credits-list`는 하드코딩 색상 없이 `--text-secondary` 토큰을 재사용합니다.

---

### Suggestion (선택)

- **[privacy.html:10] 미사용 CSS 변수** — `--bg-card: #1a1a1a` 를 선언했으나 문서 내에서 참조되지 않습니다(`grep -c "var(--bg-card)" privacy.html` → 0). 삭제하거나 실제로 사용하면 됩니다.
- **[privacy.html:10,15] 앱 팔레트와 미세 불일치** — 자립형 페이지라 색을 인라인 복제한 것은 요구사항(E)대로 올바르나, 값이 앱 원본과 약간 다릅니다. `--bg-card`는 앱 `#1a1d1b` vs 여기 `#1a1a1a`(미사용이라 무영향), `--border-subtle`는 앱 `rgba(255,255,255,0.05)` vs 여기 `0.08`(§경계선에 실제 사용, 살짝 더 진함). 팔레트 완전 일치를 원하면 `0.05`로 맞추세요. 시각적으로 무해한 수준입니다.
- **[privacy.html:155] 이메일 평문 처리** — `hwanghs5290@gmail.com` 을 평문으로 둔 것은 "http 0건" 요건과 무관하며(`mailto:`는 http 문자열이 아님), `mailto:` 링크로 바꾸면 http 카운트를 0으로 유지하면서 사용성이 개선됩니다. 개발자의 의도적 결정이므로 필수는 아닙니다.
- **[문서 정합성, 범위 밖] CLAUDE.md의 LocalStorage 키 표가 낡음** — CLAUDE.md는 `insectAppSettings`, `entoma_profile_photo`, `entoma_profile_bg` 를 키로 나열하지만, 실제 코드의 활성 키는 `entoma_favorites`, `entoma_recent`, `user_avatar`, `user_bg`, `user_profile_info` 입니다(`entoma_profile_*`는 `user_*`로 마이그레이션 후 삭제됨, `insectAppSettings`/`defaultHomeTab`은 코드에 0건). 방침 본문은 **실제 코드 기준으로 정확**하므로 이번 변경분에는 영향이 없으나, CLAUDE.md 갱신을 권합니다.

---

### 사실 정확성 검증 (법적 문서 — 최우선 항목)

**본문 대조 결과: 두 표면 모두 §F와 문구 단위로 완전 일치.**

- 조항 제목 1~10: §F == `#pagePrivacy` == `privacy.html` (모두 True).
- 본문/불릿 전체 33개 항목: 두 표면 모두 §F와 **EXACT MATCH** (정규화 후 프로그램 대조).
- 날조된 사실 스캔(`암호화`, `익명화`, `동의`, `보관 기간`, `SSL/TLS`, `쿠키`, `가명`): 두 표면 모두 **0건**. §F에 없는 문장 추가·사실 변경 없음.

**방침 주장 ↔ 실제 코드 교차 검증:**

| 방침 주장 | 검증 명령/근거 | 결과 |
|---|---|---|
| 회원가입·로그인·계정 없음 | 인증 로직 grep | 방침 문구 외 0건 ✓ |
| 광고 SDK·분석·추적 없음 | `gtag/analytics/firebase/sentry/facebook/fbq/mixpanel/amplitude` grep | `<img>` 오탐뿐, SDK 0건 ✓ |
| 기기 내부에만 저장(4종) | `localStorage.setItem` 전수 | `entoma_favorites`(즐겨찾기), `entoma_recent`(최근), `user_avatar`+`user_bg`(사진/배경), `user_profile_info`(이름/핸들/지역) → 방침 4개 항목과 1:1 매핑. **미공개 저장 흐름 없음** ✓ |
| 외부 서버 3곳 | `inat_photo_cache.json` 호스트 집계 | 이미지 다운로드 호스트 3개(`inaturalist-open-data.s3.amazonaws.com`, `static.inaturalist.org`, `species.nibr.go.kr`) 정확히 일치 ✓ (아래 참고) |
| 서체는 앱에 내장 | `@font-face src` | 전부 `url('fonts/*.woff2')` 로컬 번들, CDN 0건 ✓ |

- **참고(결함 아님):** 캐시에는 4번째 호스트 `www.inaturalist.org`(3건)가 있으나, 이는 이미지 `src`가 아니라 종 페이지 `pageUrl`(탭 시 브라우저로 열리는 링크)입니다. 방침 §4 마지막 문단("앱 내 링크… iNaturalist … 기본 브라우저가 열립니다")이 이를 별도로 고지하므로 방침은 정확합니다.
- `fetch()` 호출은 로컬 JSON 3개(`inat_photo_cache.json`, `nibr_cache.json`, `search_index.json`)뿐 — 외부 서버로의 데이터 전송 없음, 방침과 일치.

### privacy.html 자립성

- `grep -c "http" project/privacy.html` → **0** (완료 기준 5 충족).
- 외부 리소스 참조(src=/href=/`<link>`/`<script>`/`url()`/@import/CDN) **0건**.
- `<html lang="ko">`, `<meta charset="UTF-8">`, viewport, `<title>개인정보처리방침 — KoIn Pedia</title>` 모두 존재.
- heading 계층 정상: `<h1>` → `<h2>`×10, `<main>` 랜드마크 사용. 시스템 폰트 스택.

### 신규 페이지 통합 (3개 지점 재검증 — 개발자 보고 아닌 직접 grep)

1. `_subPageBackTarget` — index.html:1129 에 `pagePrivacy: 'pageSettings'` ✓
2. FAB 숨김 조건 — index.html:2357 에 `page.id === 'pagePrivacy'` ✓
3. 페이지 애니메이션 — style.css:3968 `#pagePrivacy` ✓
4. `allPages`(`querySelectorAll('.page')`) 자동 포함, `syncNavForPage` 미매칭→navDiscover 폴백 — `pageCredits`와 동일 경로, 별도 수정 불필요 ✓

### 이벤트 리스너 / XSS / 접근성

- `_privacyNavBtn`(3757)·`_privacyBackBtn`(3765)은 설정 1회성 초기화 블록(주석 3720 "pageshow마다 재등록하지 않아 리스너 누수 없음") 바로 뒤 **최상위**에 등록. `pageshow` 핸들러 밖 → 5회 반복해도 재등록 없음 ✓
- 둘 다 `if (el) { ... }` null 가드 유지, `getElementById` 참조가 HTML `id`와 1:1 ✓
- 신규 리스너 블록에 `innerHTML` 사용 0건 ✓
- `privacyNavBtn` `aria-label="개인정보처리방침 보기"` + chevron SVG `aria-hidden="true"`; `privacyBackBtn` `aria-label="뒤로"`. 뒤로 SVG는 `aria-hidden` 없으나 기존 `creditsBackBtn`과 동일 패턴이고 버튼이 라벨링되어 있어 결함 아님 ✓
- 신규 `id` 각 1건(중복 없음): `privacyNavBtn`/`privacyBackBtn`/`pagePrivacy` ✓
- 인라인 스크립트 `node --check` → **PASS** (완료 기준 7) ✓

### 범위 이탈

- `git status --porcelain` 상 `ios/`, `*.swift`, `Info.plist`, 데이터 JSON 변경 **0건** — 범위 클린 ✓

---

### 종합 평가

법적 문서로서 가장 중요한 "본문이 §F와 일치하고 코드 사실과 부합하는가"를 통과했습니다 — 두 표면 모두 문구 단위 완전 일치이고, 수집·저장·통신·서체 관련 모든 주장이 실제 코드와 교차 검증됩니다. 통합 3지점·리스너 1회 등록·자립성·범위 준수 전부 이상 없으며, Critical/Warning 0건입니다. 제안 사항은 privacy.html의 미사용/미세 불일치 CSS 변수와 문서(CLAUDE.md) 갱신 정도로, 배포를 막지 않습니다.
