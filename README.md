# 한국 곤충백과

한국 곤충 분류와 종 정보를 탐색하는 정적 웹 도감입니다.

## 실행

JSON 데이터를 `fetch()`로 읽으므로 로컬 정적 서버를 사용합니다.

```bash
cd project
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`으로 접속합니다.

## 주요 기능

- 큐레이션된 곤충 컬렉션
- 16개 목 → 해당 목의 전체 종 탐색
- 한글명, 학명, 목, 과 통합 검색
- 보전 상태와 분류 계층 표시
- NIBR eCatalog 300종의 형태·생태·서식지 정보 연결
- iNaturalist 이미지와 출처 표시
- 설정 > 데이터 출처에서 출처·라이선스 고지 페이지(`#pageCredits`) 확인 — 데이터·이미지·서체·오픈소스 출처를 안내

## 데이터 구조

기존 `project/taxonomy/` 분할 JSON은 제거했습니다. 앱은 다음 파일을 런타임
데이터 소스로 사용합니다.

| 파일 | 용도 |
|------|------|
| `project/search_index.json` | NIBR 300종의 목·종 탐색과 검색에 사용하는 통합 인덱스 |
| `project/nibr_cache.json` | NIBR eCatalog 300종 상세 정보 |
| `project/data/nibr_insects.json` | NIBR 추출 원본 병합본 |

`search_index.json`은 NIBR 300종과 16개 목만 포함하며 분류 탭과 검색 화면이 함께
사용합니다. 목 카드를 누르면 과 목록을 거치지 않고 해당 목의 종 전체가 표시됩니다.

## NIBR 캐시

NIBR 데이터에는 다음 필드가 포함됩니다.

```json
{
  "page": 218,
  "korean_name": "왕거위벌레",
  "scientific_name": "Paracycnotrachelus chinensis (Jekel)",
  "order_korean": "딱정벌레목",
  "order_latin": "Coleoptera",
  "family_korean": "거위벌레과",
  "family_latin": "Attelabidae",
  "habitat": "서식지",
  "morphology": ["형태 설명"],
  "ecology": ["생태 설명"],
  "other": ["기타 정보"]
}
```

캐시와 검색 인덱스를 다시 생성하려면:

```bash
cd project
node scripts/build_nibr_cache.mjs
```

스크립트는 학명을 속·종·아종 단위로 정규화하고 검색 인덱스를 300종·16목으로
재구성합니다. EOL 캐시에서도 이 300종과 무관한 항목을 제거합니다.

## 상세 페이지 데이터 우선순위

1. NIBR: 형태, 크기, 서식지, 생태, 기타 정보
2. 종 인덱스: 이름, 분류, 보전 플래그, 대표 이미지
3. iNaturalist: 이미지와 부가 메타데이터

실제 값이 없는 크기, 서식지, 생애주기 영역은 빈 자리표시자 대신 숨깁니다.

## 파일 구조

```text
insect/
├── README.md
├── CLAUDE.md
└── project/
    ├── index.html
    ├── style.css
    ├── search_index.json
    ├── nibr_cache.json
    ├── eol_species_cache.json
    ├── scripts/
    │   └── build_nibr_cache.mjs
    ├── data/
    │   ├── nibr_insects.json
    │   ├── nibr_progress.md
    │   └── nibr_section*.json
    ├── images/
    └── fonts/
```

## 기술

- HTML
- CSS
- Vanilla JavaScript
- 정적 JSON 캐시
- Capacitor (iOS 래핑) — `@capacitor/core` `@capacitor/ios` `@capacitor/cli` `^8.4.1`

## 라이선스 및 출처

앱 내에서는 설정 > 데이터 출처 → 출처 및 라이선스 고지 페이지(`#pageCredits`)에서 아래 내용을 안내합니다.

### 데이터

- 국립생물자원관(NIBR) — 「한반도의 생물다양성」 eCatalog. 종별 형태·생태·서식지 정보 300종의 출처입니다. (`https://species.nibr.go.kr`)
- 출처 표시: "출처: 국립생물자원관" 수준으로만 표기합니다.
- ⚠️ TODO(확인 필요): 공공누리(KOGL) 유형(제1~4유형)이 아직 확인되지 않았습니다. 유형이 확정되기 전까지 특정 유형을 명시하지 마세요.

### 이미지

iNaturalist 커뮤니티가 Creative Commons 라이선스로 공개한 사진을 사용합니다. (`https://www.inaturalist.org`, `https://creativecommons.org/licenses/`)

`project/inat_photo_cache.json` 의 실제 라이선스 분포(총 897장):

| 라이선스 | 사진 수 |
|---------|--------|
| `cc-by-nc` | 596 |
| `cc-by` | 126 |
| `cc-by-nc-nd` | 69 |
| 라이선스 미지정(빈 값 `""`) | 39 |
| `cc-by-nc-sa` | 26 |
| `cc0` | 26 |
| `cc-by-sa` | 14 |
| 공공누리 제3유형(NIBR 업로드) | 1 |
| **합계** | **897** |

### 서체

- LINE Seed KR — © LINE Corporation
- Cormorant Garamond, Inter — SIL Open Font License 1.1
  (라이선스 원문: `project/fonts/OFL-CormorantGaramond.txt`, `project/fonts/OFL-Inter.txt`)

모든 서체는 `project/fonts/` 에 로컬 번들되어 있다. Google Fonts CDN 원격 로드는
제거했으므로 오프라인에서도 서체가 깨지지 않고, 사용자 IP가 외부로 전달되지 않는다.
Cormorant Garamond 와 Inter 는 가변 폰트(wght 축) 단일 파일을 `latin` / `latin-ext`
서브셋으로 나눠 싣고, `@font-face` 의 `unicode-range` 로 필요한 서브셋만 로드한다.

한글·키릴 문자는 LINE Seed KR 이 커버하고, Inter 는 LINE Seed KR 에 없는 악센트 라틴
문자(`é`, `č`, `ø` 등 18자)를 메운다. CJK 한자는 iOS 시스템 폰트로 폴백한다.

> TODO: LINE Seed KR 라이선스 원문이 저장소에 포함되어 있지 않다. 배포본에 동봉할 것.
> 번들된 `LINESeedKR-Rg.woff2` 는 정적 Regular(400) 인데 `@font-face` 가
> `font-weight: 100 900` 으로 선언되어 있어 한글 굵은 글씨에 합성 볼드가 적용되지
> 않는다. `LINESeedKR-Bd.woff2` 를 함께 번들해 가중치별 페이스를 선언할 것.

### 오픈소스

- Capacitor — MIT License, © Ionic

### 알려진 이슈 (해결 필요)

- **이미지 라이선스 위반 소지**: 위 분포 중 `cc-by-nc-nd` 69장(개작 금지, ND)과 라이선스 미지정 39장이 포함되어 있습니다. 그런데 `project/style.css` 는 사진에 `object-fit: cover`(크롭)와 `filter: saturate()/brightness()`(색보정)를 적용해 원본을 개작(derivative)해 표시합니다. ND 조건과 라이선스 미지정 항목에 대해 개작 표시가 라이선스 위반이 될 수 있으므로, 해당 사진을 원본 표시로 전환하거나 교체·제외하는 조치가 필요합니다.
- **`package.json` 라이선스 확인 필요**: 현재 `"license": "ISC"` 로 설정되어 있습니다. 데이터(NIBR)와 이미지(CC)가 별도 라이선스를 가지는데 코드 라이선스가 ISC로 되어 있어 실제 배포 의도와 일치하는지 확인이 필요합니다. (TODO)