## 코드 리뷰 결과

검토 대상: `project/index.html`, `project/style.css`
검토 범위: 즐겨찾기 페이지 JS, HTML 번역 누락, badge 클래스 삭제, `@font-face` weight 범위
JS 구문 검증: `new Function()` 파싱 통과 (단일 스크립트 블록, 약 105K자)

---

### Critical (즉시 수정 필요)

없음. 이번 4개 태스크 변경분에서 XSS, 이벤트 리스너 누수, null 접근, fetch 미처리 등의 Critical 이슈는 발견되지 않았습니다.

검증 근거:
- `buildResultItem`(index.html:1742)은 모든 데이터를 `textContent`로 삽입 (`krEl.textContent = ins.kr`, `sciEl.textContent = ins.sci`, 분류 span도 `textContent`). XSS 안전.
- `renderSavedPage`(index.html:3369)는 `getElementById` 결과를 `if (!list) return` null 가드 처리. `emptyState?.` 옵셔널 체이닝 사용.
- `loadSearchIndex`(index.html:1663)는 `.catch`로 fetch 실패를 처리하고 빈 인덱스로 폴백. `renderSavedPage`는 `data?.insects || []`로 추가 방어.
- `pageshow:pageSaved` 리스너(index.html:3403)는 모듈 스크립트 최상위에서 1회만 등록. 중복 등록 경로 없음 (반복 호출되는 init 함수 내부 아님).

---

### Warning (권장)

- **[style.css:7-13] `@font-face font-weight: 100 900`이 정적 폰트에 선언됨 — 가짜 굵기 합성 발생.**
  `font-weight: 100 900` 2값 구문 자체는 CSS Fonts L4 표준이며 유효합니다. 그러나 `src`가 `fonts/LINESeedKR-Rg.woff2` (정적 Regular 단일 굵기) 한 개뿐이고, `fonts/` 디렉토리에 가변 폰트나 Bold/Light 파일이 없습니다. CSS는 300~700 굵기를 광범위하게 사용하므로(style.css 전체에 `font-weight: 600/700` 다수), 브라우저가 600/700을 faux-bold로 합성합니다. 한글 본문 가독성·렌더 품질 저하 가능.
  → 수정 제안: 실제 가진 굵기에 맞춰 `font-weight: 400;`(정적 단일값)로 선언하거나, 가변 폰트(`LINESeedKR-VF.woff2`) 또는 굵기별 파일을 추가하고 각 weight에 별도 `@font-face`를 선언. 정적 Regular만 쓸 거라면 범위 선언은 제거.

- **[index.html:637-638, 671-672, 680-681] `#pageProfile`에 번역 누락 영어 텍스트 잔존.**
  태스크 2의 검토 항목입니다. 다음이 영어로 남아 있습니다:
  - `profile-name` "Yujin Park", `profile-handle-location` "@yujin.entoma · Seoul, KR"
  - `collection-title` "Jewel Beetle"(671), "Asian Swallowtail"(680) — 다른 카드의 통명(`recent-title-kr`)은 모두 한글인데 컬렉션 카드만 영어 통명. 일관성 불일치.
  → 수정 제안: 컬렉션 통명을 한글로 ("비단벌레", "산호랑나비" 등). 학명(`collection-scientific` `Chrysochroa fulgidissima` 등)과 `recent-title-sci`는 학명 표기 관례상 그대로 두는 것이 맞음. 프로필 이름/핸들은 도감 톤에 맞춰 한글화 검토(선택).

- **[index.html:632, 667, 676] 영어 `alt` 텍스트 잔존.**
  `<img ... alt="Yujin Park">`(632), `alt="Jewel Beetle"`(667), `alt="Asian Swallowtail">`(676). 화면 표시 텍스트 한글화 시 `alt`도 함께 한글로 통일 권장 (스크린리더 일관성).

- **[style.css:2652-2668] 미사용 CSS 규칙 `.result-badges` / `.result-badge` / `--eol` / `--nibr`.**
  HTML·JS 어디에서도 이 클래스를 참조하지 않습니다(`grep` 교차 확인). 이번 태스크가 만든 것은 아니나(기존 잔존), badge 정리 맥락에서 함께 제거 검토 권장.

- **[index.html:688] 인라인 스타일 정적 사용.**
  `<section class="profile-section" style="margin-bottom: 24px;">` — 동적 조작이 아닌 정적 값이므로 CSS 클래스로 이동 권장. (기존 코드, 이번 변경 외.)

---

### Suggestion (선택)

- **[index.html:3387-3388] 즐겨찾기 canonical 매칭 — 개발자 보완 적절. 추가 메모만.**
  `favs.has(ins.sci) || favs.has(canonicalizeSciName(ins.sci))` 보완은 정확합니다. 실제 `search_index.json` 300종 중 183종이 괄호 저자명 포함이고, 괄호 없는 종조차 말미에 저자명을 가집니다(예: `"Ctenolepisma longicaudata Escherich"`). 따라서 `favs.has(ins.sci)`는 사실상 절대 매칭되지 않고, canonical 폴백이 실제 동작을 담당합니다. 즐겨찾기 저장값(`openSpeciesFromIndex` → `scientificName = canonicalizeSciName(ins.sci)`, index.html:1808-1833)과 동일 변환이므로 결정적으로 일치. 로직 정상.
  → 첫 번째 `favs.has(ins.sci)` 항은 실질 효과가 없어 가독성상 제거해도 무방하나, 미래에 raw sci로 저장하는 경로가 생길 가능성에 대비한 방어로 남겨두는 것도 합리적. 의도를 주석으로 명시하면 좋음.

- **[index.html:1742] `buildResultItem(ins, fromPage='pageSearch')` 호환성 — 안전.**
  기본값 파라미터라 기존 `buildResultItem(ins)` 호출부(1737, 2185)는 `pageSearch`로 자동 동작. `renderSavedPage`만 `'pageSaved'` 전달. 후방 호환 OK.

- **[index.html:3833 영역] Step B 흐름 — 수정 불필요 확인.**
  `openSpeciesFromIndex(ins, fromPage)` → `openSpeciesDetail(..., fromPage)`로 `fromPage`를 전달하므로 `'pageSaved'` 뒤로가기 복귀 동작은 추가 작업 없이 성립.

- **[index.html:570] `<ul ... hidden>` 가시성 — 정상.**
  `.saved-result-list`(style.css:1285)는 `display`를 강제하지 않고 `[hidden]` 오버라이드 규칙도 없어 네이티브 `[hidden]`(display:none)이 정상 적용됨.

---

### 종합 평가

이번 4개 태스크 변경분은 Critical 0개로 품질이 양호하며, 특히 즐겨찾기 canonical 매칭 버그를 선제적으로 발견·수정한 점이 우수합니다(데이터 300종으로 교차 검증 완료). 다만 (1) 정적 Regular 폰트에 `font-weight: 100 900` 범위 선언은 표준상 유효하나 faux-bold 합성을 유발하므로 단일값/가변폰트로 정정 권장하고, (2) `#pageProfile`의 컬렉션 카드 영어 통명·alt가 번역 누락으로 남아 있어 보완이 필요합니다.

— 발신: code-reviewer · 리뷰 완료, Critical 0개 / Warning 5개 / Suggestion 4개
