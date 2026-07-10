## 문서화 완료 — App Store 대응 변경분 반영 + 문서 드리프트 정정

### 생성/갱신된 파일
- `CLAUDE.md` — 페이지 표·LocalStorage 키 표·변경 이력 정정
- `README.md` — 주요 기능에 고지 페이지 반영, "라이선스 및 출처" 섹션 신규 추가
- `_workspace/05_doc_output.md` — 본 보고서

> `project/index.html`, `project/style.css`, `ios/`, JSON 데이터는 지시대로 수정하지 않음. 문서만 변경.

---

### 1. CLAUDE.md 정정

#### (a) 페이지 구조 표
- **삭제**: `#pageOrderGuide` — `grep -rn "pageOrderGuide" project/` 결과 **0건**. 코드에 존재하지 않는 유령 항목.
- **추가**: `#pageCredits | 출처 및 라이선스 고지 (데이터·이미지·서체·오픈소스)` — `grep -on 'id="page[A-Za-z]*"'` 로 실제 `.page` div 8개 확인, `739: id="pageCredits"` 존재 검증.
- 실제 페이지 8개: Discover / FamilyDetail / SpeciesDetail / Search / Saved / Profile / Settings / **Credits**.

#### (b) LocalStorage 키 표 — 대폭 정정
- **삭제**: `insectAppSettings` 행 — `grep -rn "insectAppSettings" project/` **0건**. 이번 App Store 대응 변경으로 설정 스캐폴딩과 함께 제거됨(02_developer_output 확인).
- **삭제 근거 보강**: `defaultHomeTab` — `grep -rn "defaultHomeTab" project/` **0건**. 코드에 존재한 적 없음(문서 드리프트).
- ⚠️ **추가로 발견한 드리프트 (지시 범위 밖이지만 정정)**: 기존 표의 `entoma_profile_photo` / `entoma_profile_bg` 는 **활성 키가 아님**. 실제 상수 정의(`grep -n "_KEY *="`)를 확인한 결과:

  | 표기(구 CLAUDE.md) | 실제 활성 키 | 상수 |
  |---|---|---|
  | `entoma_profile_photo` | `user_avatar` | `PROFILE_PHOTO_KEY` (index.html:3665) |
  | `entoma_profile_bg` | `user_bg` | `PROFILE_BG_KEY` (index.html:3666) |

  `entoma_profile_photo`/`entoma_profile_bg` 문자열은 index.html:3677-3678 의 1회성 마이그레이션 함수 `_migrateProfileKeys()` 에서 **구 키 소스**로만 참조되며, 값을 `user_avatar`/`user_bg` 로 옮긴 뒤 `removeItem` 한다(코드 3669-3679 직접 확인). → 활성 저장 키가 아니므로 표를 실제 키로 정정하고 각주로 명시.

- **추가(미문서화 활성 키 2종)**: `grep -on "localStorage\.\(get\|set\)Item"` 로 발견 후 정의 확인.
  - `entoma_recent` (`RECENT_KEY`, index.html:3394) — 최근 본 곤충 목록, 최대 30개 JSON.
  - `user_profile_info` (`PROFILE_INFO_KEY`, index.html:3784) — 프로필 텍스트 정보 `{name, handle, location}` JSON.
- 정정 후 활성 키: `entoma_favorites`, `entoma_recent`, `user_avatar`, `user_bg`, `user_profile_info` (모두 `getItem`/`setItem` 참조 grep 으로 확인).

#### (c) 변경 이력 표
- `2026-07-10` 행 추가. 사유: "App Store 심사 대응 — 더미 핸들러 제거, 출처·라이선스 고지 페이지 추가".

---

### 2. README.md 갱신

#### (a) 주요 기능
- 출처·라이선스 고지 페이지(`#pageCredits`) 항목 추가.

#### (b) 신규 섹션 "라이선스 및 출처"
- **데이터**: NIBR eCatalog. 요청대로 **공공누리(KOGL) 특정 유형 명시하지 않음** — "출처 표시" 수준만. 유형 확인 TODO 명시.
- **이미지**: `grep -o '"license": "[a-z0-9-]*"' project/inat_photo_cache.json | sort | uniq -c` 로 직접 집계한 실제 분포 표를 삽입.

  | 라이선스 | 수 |
  |---|---|
  | cc-by-nc | 596 |
  | cc-by | 126 |
  | cc-by-nc-nd | 69 |
  | 미지정(빈 값) | 39 |
  | cc-by-nc-sa | 26 |
  | cc0 | 26 |
  | cc-by-sa | 14 |
  | 공공누리 제3유형 | 1 |
  | 합계 | 897 |

  ※ 지시된 regex 로는 잡히지 않는 항목 1건(`"license": "공공누리 제 3유형 / 저작자 : 이승환"`, inat_photo_cache.json:4837)을 별도 grep 으로 발견해 표에 포함. 합계 검산: 596+126+69+39+26+26+14+1 = 897 = `grep -c '"license"'` 결과와 일치.
- **알려진 이슈**: `cc-by-nc-nd` 69장(ND=개작 금지) + 미지정 39장이 있고, `style.css` 가 `object-fit: cover`(크롭) + `filter: saturate()/brightness()`(색보정)로 원본을 개작 표시 → 라이선스 위반 소지로 명시. CSS 근거는 `grep -n "object-fit: cover"`(다수) 및 `filter: saturate(...)brightness(...)`(style.css:616,761,927,2175,2216) 직접 확인.
- **서체**: LINE Seed KR (© LINE Corporation), Cormorant Garamond / Inter (SIL OFL 1.1).
- **오픈소스**: Capacitor (MIT). 버전은 `package.json` 의 `@capacitor/* ^8.4.1` 확인 후 기재.
- **TODO**: `package.json` `"license": "ISC"`(package.json:23) 가 데이터·이미지 CC 라이선스와 어긋날 수 있어 의도 확인 필요를 명시.

---

### 검증 방법 요약 (모두 실제 파일 grep/read)
- 페이지: `grep -on 'id="page[A-Za-z]*"' project/index.html` → 8개, pageCredits 존재 / pageOrderGuide 0건.
- LS 키: `grep -n "_KEY *=" project/index.html` + 코드 3663-3707 read → 활성/레거시 키 판별.
- insectAppSettings·defaultHomeTab: `grep -rn` → 각 0건.
- 이미지 라이선스: `grep -o '"license": ...' | sort | uniq -c`, `grep -c '"license"'` = 897 검산.
- CSS 개작: `grep -n "object-fit: cover" / "filter:"` project/style.css.
- Capacitor 버전·ISC: `grep -n '"license"\|capacitor' package.json`.

### 문서화 범위
CLAUDE.md 3개 표(페이지·LocalStorage·변경 이력) 정정, README.md 라이선스/출처 섹션 신설. 코드·데이터 파일은 무수정.
