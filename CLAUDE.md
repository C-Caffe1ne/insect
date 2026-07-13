# CLAUDE.md — ENTOMA · KR (한국 곤충도감)

## 프로젝트 개요

- **목적**: 한국 곤충 분류와 종 정보를 큐레이션·탐색하는 정적 웹 도감 (ENTOMA · KR)
- **기술 스택**: 순수 Vanilla HTML / CSS / JavaScript — 빌드 툴·프레임워크 전혀 없음
- **데이터 규모**: 16목 / 94과 / NIBR eCatalog 300종
- **작업 디렉토리**: `project/` (모든 소스 파일과 JSON 캐시)
- **진입점**: `project/index.html` (HTML + 모든 JS 인라인) + `project/style.css`

---

## 주요 아키텍처 및 데이터 흐름

### 페이지 구조 (단일 HTML, 페이지 전환 방식)

모든 페이지는 `.app` 컨테이너 안에 `.page` div로 존재. `active` 클래스를 토글하여 전환.

| ID | 설명 |
|----|------|
| `#pageDiscover` | 메인 탐색 (테마 보기 / 분류 보기 탭) |
| `#pageFamilyDetail` | 목(Order) 내 종 목록 |
| `#pageSpeciesDetail` | 종 상세 인포그래픽 |
| `#pageSearch` | 검색 결과 |
| `#pageSaved` | 즐겨찾기 |
| `#pageProfile` | 내 정보 (프로필·배경 편집 포함) |
| `#pageSettings` | 설정 |
| `#pageCredits` | 출처 및 라이선스 고지 (데이터·이미지·서체·오픈소스) |
| `#pagePrivacy` | 개인정보처리방침 (시행일 2026-07-10, 10개 절) |

> `#pageCredits` 와 `#pagePrivacy` 의 본문은 공개 지원 사이트(`infoURL/`)의 `credits.html` / `privacy.html` 과 **문구가 일치해야 한다.** 방침 10조가 "변경 시 앱 내 화면과 공개 페이지를 통해 고지한다"고 명시하고 있다. 한쪽만 고치지 말 것.

### JSON 캐시 파일

| 파일 | 역할 | 생성 방법 |
|------|------|-----------|
| `search_index.json` | 전체 검색 인덱스 (`insects[]`, `orders[]`, `families[]`) | `build_nibr_cache.mjs` 가 재생성 |
| `nibr_cache.json` | 학명(canonical) → NIBR 상세 데이터 매핑 | `build_nibr_cache.mjs` 가 생성 |
| `inat_photo_cache.json` | iNaturalist 사진 메타데이터 캐시 | 별도 수집 스크립트 |
| `data/nibr_insects.json` | NIBR 원본 300종 (빌드 소스) | 수동 관리 |
| `data/nibr_section*.json` | NIBR 섹션별 원본 분할본 | 수동 관리 |

### 캐시 빌드 방법

```bash
node project/scripts/build_nibr_cache.mjs
```

`data/nibr_insects.json` → `nibr_cache.json` + `search_index.json` 재생성.
학명 정규화(`canonicalize`) 기준: 속·종·아종 토큰만 추출, 연도·저자·괄호 제거.

### LocalStorage 키

| 키 | 용도 |
|----|------|
| `entoma_favorites` | 즐겨찾기 학명 배열 (JSON, 상수 `FAV_KEY`) |
| `entoma_recent` | 최근 본 곤충 목록 (JSON, 최대 30개, 상수 `RECENT_KEY`) |
| `user_avatar` | 프로필 사진 DataURL (상수 `PROFILE_PHOTO_KEY`) |
| `user_bg` | 배경 이미지 DataURL (상수 `PROFILE_BG_KEY`) |
| `user_profile_info` | 프로필 텍스트 정보 `{name, handle, location}` (JSON, 상수 `PROFILE_INFO_KEY`) |

> 구 키 `entoma_profile_photo` / `entoma_profile_bg` 는 1회성 마이그레이션 함수 `_migrateProfileKeys()`(index.html) 에서만 참조된다. 값을 `user_avatar` / `user_bg` 로 옮긴 뒤 원본을 삭제하므로 활성 저장 키가 아니다.
> `insectAppSettings` 키는 2026-07-10 App Store 대응 변경으로 관련 설정 스캐폴딩과 함께 코드에서 제거되었다.

---

## 공개 지원 사이트 (`infoURL/`)

App Store Connect가 요구하는 Support URL·Privacy Policy URL을 제공하는 **별도의 정적 사이트.**
도감 앱(`project/`)과는 독립적이며 서로 파일을 공유하지 않는다.

| 파일 | 내용 |
|------|------|
| `infoURL/index.html` | 지원 — 앱 소개, 주요 기능, FAQ, 문의 |
| `infoURL/privacy.html` | 개인정보처리방침 (앱 `#pagePrivacy` 와 동일 문구) |
| `infoURL/credits.html` | 출처 및 라이선스 (앱 `#pageCredits` 와 동일 문구) |
| `infoURL/style.css` | 공용 스타일 (앱 다크 테마 토큰 재사용) |
| `infoURL/fonts/LINESeedKR-Rg.woff2` | `project/fonts/` 에서 복사한 사본 |

### 배포

`.github/workflows/pages.yml` 이 `korean_H` 또는 `appstore-prep` push 시 `infoURL/` 만
아티팩트로 올려 GitHub Pages에 배포한다 (`infoURL/**` 경로 필터).

| App Store Connect 필드 | URL |
|------------------------|-----|
| Support URL | `https://c-caffe1ne.github.io/insect/` |
| Privacy Policy URL | `https://c-caffe1ne.github.io/insect/privacy.html` |

### 주의

- **자체 완결형이어야 한다.** Pages는 `infoURL/` 만 서빙하므로 `project/` 의 CSS·폰트·JSON을
  상대 경로로 참조할 수 없다. 필요한 자산은 `infoURL/` 안으로 복사할 것.
- **방침·출처 문구를 한쪽만 고치지 말 것.** 앱 내 `#pagePrivacy` / `#pageCredits` 와
  `privacy.html` / `credits.html` 은 항상 같은 내용을 유지한다.
- 설계서: `docs/superpowers/specs/2026-07-13-support-site-design.md`

---

## 코드 작성 규칙

### 일반

- **도감 앱의 모든 변경은 `project/` 안에서만.** `.app` 클래스 외부 DOM에 절대 접근하지 말 것.
  (공개 지원 사이트 작업은 예외 — `infoURL/` 안에서만 하며, `.app` 컨테이너 규칙이 적용되지 않는다.)
- HTML 구조 변경 시 CSS selector와의 정합성을 먼저 확인.
- JS는 `index.html` 최하단 `<script>` 블록에 인라인 작성. 외부 `.js` 파일 추가 금지.
- 인덴트: 공백 2칸. 세미콜론 사용. `const` / `let` (var 금지).
- 함수명: camelCase. 내부(비공개) 변수·함수는 `_` 접두사 사용 (`_cropImg`, `_setBgStyle` 등).
- 주석은 기존 스타일(한글+영문 혼용) 유지. 불필요한 주석 추가·삭제 금지.

### DOM 조회

- 초기화 시점에 변수에 캐싱 (`const _cropFrame = document.getElementById(...)`).
- 반복 렌더링 루프 안에서 `querySelector` 남용 금지.

### 이벤트 리스너

- 모달/오버레이 내부 리스너는 반드시 해당 모달 초기화 블록 안에서 등록.
- `pointer` 이벤트 사용 (mouse + touch 통합). `touch` 이벤트와 혼용 금지.
- 멀티터치(핀치 줌)가 필요한 경우 `Map<pointerId, {x,y}>` 패턴으로 포인터를 추적.

### 이미지 크롭 모달 — 핵심 주의사항

크롭 기능은 CSS 렌더링 크기와 `canvas.drawImage()` 기준점 불일치가 버그의 근원.
아래 규칙을 반드시 준수:

1. **자연 크기 강제 설정** — `_cropImg.onload` 내 `requestAnimationFrame` 콜백 안에서:
   ```js
   _cropImg.style.width    = `${_cropImg.naturalWidth}px`;
   _cropImg.style.height   = `${_cropImg.naturalHeight}px`;
   _cropImg.style.maxWidth = 'none';  // 글로벌 CSS(max-width: 100% 등) 차단
   ```
2. **`transform-origin: center center`** — CSS에서 `#profileCropImg`에 명시 (이미 적용됨).
3. **모달을 먼저 보이게** — `_cropModal.hidden = false` 를 `_cropImg.src = dataUrl` **이전**에 실행해야 `offsetWidth` 가 0이 아닌 실제 크기를 반환.
4. **`requestAnimationFrame` 지연** — `onload` 콜백 안에서 viewport 치수를 읽을 때 반드시 `requestAnimationFrame` 으로 감싸서 브라우저 레이아웃 완료 후 계산.
5. **`_clampCrop` / canvas 역산** — 항상 `_cropFrame.offsetWidth/Height` (동적) 사용. `CROP_CFG` 의 고정 값을 직접 참조 금지.
6. **`closeCrop` 시 인라인 스타일 초기화** — `width`, `height`, `maxWidth` 를 `''` 로 리셋해 다음 호출 시 오염 방지.
7. **최소 스케일 기준** — 초기 표시는 `Math.min(vpW/imgW, vpH/imgH)` (뷰포트 fit-contain). 크롭 프레임을 채우는 fill 스케일은 줌 조작 후 사용자가 직접 설정.

### CSS 작성

- 커스텀 프로퍼티(`--green-soft`, `--text-primary` 등)를 최대한 재사용.
- 새 컴포넌트 스타일은 관련 섹션 주석 블록(`/* ── 섹션명 ── */`) 아래 추가.
- `z-index` 계층: 페이지(1) < 고정 nav(10) < 모달 배경(50) < 모달 패널(51) < 크롭 프레임(2, viewport 내부 기준).
- `.app` 외부에 절대 스타일 적용 금지.

---

## 바이브 코딩 가이드 (AI 에이전트 워크플로우)

### 스킬 트리거 기준

| 요청 유형 | 사용 스킬 |
|-----------|-----------|
| 새 기능 구현 / 페이지 추가 / 다중 파일 수정 | `web-orchestrator` |
| 단일 파일 1~5줄 수정, 질문 응답 | 직접 응답 |
| 버그·XSS·접근성·이벤트 누수 탐지 | `code-review` |
| 기능 동작 검증, 셀렉터 정합성 확인 | `qa` |
| README·주석·스키마 문서화 | `doc-writing` |

### 팀 구성 (모두 `model: "opus"`)

- `web-developer`: `project/` 하위 HTML/CSS/JS 구현
- `code-reviewer`: 버그·보안·접근성·taxonomy 바인딩 오류 탐지
- `qa-agent`: 셀렉터 교차 검증, 경계값 테스트, 모달 동작 추적
- `doc-writer`: README 갱신, JSON 스키마 문서화, 코드 주석

### 에이전트 공통 제약

- 작업 범위: `project/index.html`, `project/style.css` 만 수정.
- 데이터 JSON 직접 수정 금지 — 빌드 스크립트(`build_nibr_cache.mjs`) 경유.
- 한 응답에서 같은 파일을 두 번 수정 금지 (충돌 방지).
- 코드 삭제 전에는 반드시 `grep_search` 로 참조처 확인.
- UI 오버레이·모달은 전부 `.app` 컨테이너 안에 위치.

### 참고 경로

- 에이전트 정의: `.claude/agents/`
- 스킬: `.claude/skills/`
- 데이터 소스: `project/data/nibr_insects.json`
- 빌드 스크립트: `project/scripts/build_nibr_cache.mjs`

---

## 변경 이력

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-22 | 프로젝트 하네스 초기 구성 | 전체 | revfactory/harness 패턴 기반 곤충도감 도메인 적용 |
| 2026-06-29 | CLAUDE.md 전면 리팩토링 | 전체 | 크롭 모달·핀치줌·2-depth 액션시트 추가 후 현행화 |
| 2026-07-10 | 더미 핸들러 제거, `#pageCredits` 출처·라이선스 고지 페이지 추가, 페이지·LocalStorage 키 표 정정 | `index.html`, `style.css`, `CLAUDE.md`, `README.md` | App Store 심사 대응 — 더미 핸들러 제거, 출처·라이선스 고지 페이지 추가 |
| 2026-07-13 | 공개 지원 사이트 `infoURL/` 신설 + GitHub Pages 배포, 페이지 표에 누락된 `#pagePrivacy` 추가 | `infoURL/`, `.github/workflows/pages.yml`, `CLAUDE.md` | App Store Connect의 Support URL·Privacy Policy URL 확보 |
