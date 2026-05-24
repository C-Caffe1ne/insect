# ENTOMA · KR — 한국 곤충도감

> 한국 곤충 분류와 종 정보를 큐레이션·탐색하는 웹 도감 (Korean Insect Encyclopedia)

## 소개

ENTOMA · KR은 국립생물자원관(NIBR) KTSN 데이터를 기반으로 한 한국 곤충 도감입니다.
큐레이션된 테마(오늘의 곤충, 여름밤 곤충 등)로 일상적인 탐색을 돕고, **목 → 과 → 종** 3단계 분류 브라우저로 약 **34목 / 610과 / 12,000여 종**의 데이터를 체계적으로 살펴볼 수 있습니다.
종 카드를 클릭하면 인포그래픽 스타일의 **종 상세 페이지**가 열려 보전 상태, 분류 계층, 생애 주기, 크기, 서식지 등의 정보를 한눈에 보여줍니다 (데이터 자리표시자 포함).

## 실행 방법

`project/index.html`이 진입점입니다. 분류 JSON을 `fetch()`로 비동기 로드하므로 **로컬 정적 서버 사용을 권장**합니다.

```bash
cd project
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

(파일을 더블클릭해 열면 `file://` 스킴에서 CORS로 인해 JSON 로드가 실패할 수 있습니다.)

## 기능

- **Discover (테마 보기)** — "오늘의 곤충", "여름밤의 곤충", "The Iridescent Ones" 등 큐레이션된 컬렉션
- **Taxonomy (분류 보기)** — 목(Order) → 과(Family) → 종(Species) 계층 탐색
- **검색** — 학명(Latin) / 한글명 동시 검색 (`pageSearch`)
- **종 상세 페이지 (`pageSpeciesDetail`)** — 인포그래픽 스타일의 종 정보 패널
  - 히어로 이미지 + 학명/한글명
  - 보전 상태 배지 6종 (멸종위기 / 생태계교란 / 위해우려 / 천연기념물 / 유해종 / 한국고유종)
  - 분류 트리 7단계 (계 → 종)
  - 학명·명명자·연도
  - 설명 / 크기(시각화) / 서식지 / 생애 주기 4단계

## 데이터 구조

분류 데이터는 **3계층 JSON 분할 구조**로, 초기 로드를 가볍게 유지하고 필요한 노드만 그때그때 fetch합니다.

| 파일 | 용도 | 비고 |
|------|------|------|
| `project/taxonomy/index.json` | 34목 메타 (목록 + 과 수 + 종 수) | 앱 부팅 시 최초 로드 |
| `project/taxonomy/orders/{order-id}.json` | 한 목 안의 과(Family) 목록 | 목 클릭 시 lazy fetch |
| `project/taxonomy/families/{order-id}/{family-id}.json` | 한 과 안의 종(Species) 목록 | 과 클릭 시 lazy fetch |
| `project/korea_insect_species_by_family.json` | 통합 종 데이터 (~1MB) | 검색 등 통합 조회용 |

### `taxonomy/index.json` 스키마

```jsonc
{
  "generatedAt": "2026-05-20T10:40:44.837Z",
  "totalOrders": 34,
  "totalFamilies": 610,
  "orders": [
    {
      "id": "coleoptera",
      "rank": "order",
      "scientificName": "Coleoptera",
      "commonName": "딱정벌레목",
      "familyCount": 114,
      "recordCount": 5086,
      "file": "orders/coleoptera.json",
      "orderKtsn": 120000013750
    }
  ]
}
```

### `taxonomy/orders/{order-id}.json` 스키마

```jsonc
{
  "id": "coleoptera",
  "scientificName": "Coleoptera",
  "commonName": "딱정벌레목",
  "familyCount": 114,
  "recordCount": 5086,
  "families": [
    {
      "id": "aderidae",
      "scientificName": "Aderidae",
      "commonName": "닮은잎벌레붙이과",
      "speciesCount": 2,
      "speciesFile": "../families/coleoptera/aderidae.json",
      "familyKtsn": 120000013751
    }
  ]
}
```

### `taxonomy/families/{order}/{family}.json` 스키마 (species 단위)

```jsonc
{
  "order":  { "id": "coleoptera", "scientificName": "Coleoptera", "commonName": "딱정벌레목" },
  "family": { "id": "aderidae",   "scientificName": "Aderidae",   "commonName": "닮은잎벌레붙이과" },
  "speciesCount": 2,
  "insects": [
    {
      "ktsn": 120000013753,
      "scientificName": "Hylophilus praescutellaris Pic, 1914",
      "commonName": "뿔벌레붙이",
      "nomenclaturalAuthor": "Pic",
      "namingYear": "1914",
      "corsynSeYn": "Y",   // 한국고유종 여부 (Y/N)
      "egspcsYn":  "N",   // 멸종위기종 (Y/N)
      "hrmflSpecsYn": "N", // 유해종 (Y/N)
      "dispYn":    "N",   // 위해우려종 (Y/N)
      "phspYn":    "N",   // 생태계교란종 (Y/N)
      "korUnqBispYn": "N",
      "ntmYn":     "N",   // 천연기념물 (Y/N)
      "taxonomy": {
        "phylum": { "scientificName": "Arthropoda", "commonName": "절지동물문" },
        "class":  { "scientificName": "Insecta",    "commonName": "곤충강" },
        "order":  { "scientificName": "Coleoptera", "commonName": "딱정벌레목" },
        "family": { "scientificName": "Aderidae",   "commonName": "닮은잎벌레붙이과" },
        "genus":  { "scientificName": "Hylophilus", "commonName": "" },
        "species":{ "scientificName": "praescutellaris", "commonName": "뿔벌레붙이" }
      },
      "digitalContent": {
        "thumbnailUrl": null,
        "contents": { "EO": [], "FR": [], "DT": [], "EX": [] }
      }
    }
  ]
}
```

> 출처: 국립생물자원관 KTSN OpenAPI
> `https://species.nibr.go.kr/gwsvc/openapi/rest/ktsn/taxons/search?schTxgrpGroupCd=IN`

---

## 곤충 상세 페이지 데이터 연결 가이드

이 섹션은 **향후 `pageSpeciesDetail`에 실제 데이터를 연결할 사람을 위한 문서**입니다.
현재 페이지 마크업과 슬롯은 모두 준비되어 있으며, 함수 한 번만 호출하면 자동으로 채워집니다.

### 진입 방법

```js
openSpeciesDetail(species, fromPage = 'pageFamilyDetail');
```

- `species` — 아래 스키마를 따르는 객체 (필드 일부 누락 가능 — 자리표시자로 대체됨)
- `fromPage` — 백버튼이 돌아갈 페이지 ID (기본값 `'pageFamilyDetail'`)
- 종 카드 클릭 / Enter / Space 키 입력 시 자동 호출됨 (`renderSpeciesSorted` 내부, `project/index.html` 약 **1452행**)

### `species` 객체 스키마

> 정확한 자리표시자 기본값은 `buildPlaceholderSpecies()` (`project/index.html` 약 **1818행**) 참고.

| 필드 | 타입 | 설명 | 미연결 시 표시 |
|------|------|------|----------------|
| `scientificName` | `string` | 학명 (Latin, *italic* 렌더링) | `"학명 미상"` |
| `commonName` | `string` | 한글명 | `"이름 미상"` |
| `author` | `string \| null` | 명명자 (예: `"Pic"`) | `data-pending="true"` 처리 |
| `year` | `number \| string \| null` | 명명 연도 (예: `1914`) | `data-pending="true"` 처리 |
| `images` | `string[]` | 이미지 URL 배열 | placeholder + 점선 테두리 + "사진 데이터 준비 중" 배지 |
| `conservationStatus.endangered` | `"I" \| "II" \| "관찰종" \| "해당없음" \| null` | 멸종위기 등급 | `null` → "데이터 없음" (점선·dim), `"해당없음"` → inactive |
| `conservationStatus.invasive` | `boolean \| null` | 생태계교란종 여부 | `null` → unknown, `true` → "해당", `false` → "해당없음" |
| `conservationStatus.hazardous` | `boolean \| null` | 위해우려종 여부 | (위와 동일) |
| `conservationStatus.naturalMonument` | `string \| null` | 천연기념물 지정번호 (예: `"218"`) | `null` → "해당없음", 값 있으면 `"제218호"` |
| `conservationStatus.harmful` | `boolean \| null` | 유해종 여부 | (boolean 규칙과 동일) |
| `conservationStatus.endemic` | `boolean \| null` | 한국고유종 여부 | (boolean 규칙과 동일) |
| `taxonomy.kingdom` ~ `species` | `string` | 분류 7단계 (kingdom, phylum, class, order, family, genus, species) | 빈 값은 italic dim 처리 |
| `description` | `string \| null` | 설명 본문 | `"곧 공개됩니다"` |
| `habitat` | `string \| null` | 서식지 설명 | `"데이터 준비 중"` |
| `habitatRegions` | `string[]` | (예약) 한국 지도 지역 강조용 — 현재 미사용 | placeholder 지도 |
| `lifecycle.egg` / `larva` / `pupa` / `adult` | `string \| null` | 생애 4단계 설명 | 각 단계별 dim italic |
| `size` | `{ min: number, max: number, unit: 'mm' } \| null` | 크기 (0~100mm 범위 가정) | "— ~ — mm" + 기본 위치 막대 |

### 자리표시자 처리 방식

페이지의 모든 슬롯은 `data-slot="<name>"` 속성을 가집니다.
`renderSpeciesDetail(species)`가 호출되면 `setSlot()` 헬퍼가 다음 규칙으로 자동 채웁니다.

1. **값이 있으면** → `textContent`로 안전 삽입 (XSS 방지) + `data-pending="false"`
2. **값이 null / undefined / `""`이면** → 한국어 자리표시자 텍스트 + `data-pending="true"` (CSS에서 italic + dim 처리)

상태 배지 6종은 `resolveBadge(key, raw)` 헬퍼가 키별 규칙으로 `{ status, text }`를 산출해 `data-status="active|inactive|unknown"`을 부여합니다.

| `data-status` | 시각 표현 |
|---------------|-----------|
| `active` | 의미 색 배경 + 아이콘 컬러 + 흰색 텍스트 |
| `inactive` | dim + 반투명 ("해당없음") |
| `unknown` | 점선 테두리 + dim italic ("데이터 없음") |

### 향후 데이터 연결 위치

현재는 종 카드 클릭 시 `buildPlaceholderSpecies(scientificName, commonName)`로 만든 placeholder 객체에 카드 정보만 머지해서 넘기고 있습니다 (`project/index.html` 약 **1452~1461행**).

실제 데이터를 연결하려면 다음 중 한 가지 방법을 사용하세요.

1. **분류 JSON 확장 (간단)**
   - `taxonomy/families/{order-id}/{family-id}.json`의 각 `insects[]` 항목에 위 `species` 스키마 필드를 직접 추가
   - 종 카드 클릭 핸들러에서 해당 item을 그대로 `openSpeciesDetail(item, 'pageFamilyDetail')`에 전달
   - KTSN 원본 필드 (`corsynSeYn`, `egspcsYn`, `dispYn`, `phspYn`, `hrmflSpecsYn`, `ntmYn`)를 `conservationStatus.*` 형태로 매핑하는 어댑터를 한 번만 작성하면 됨

2. **별도 종 상세 JSON (확장적)**
   - `project/taxonomy/species/{ktsn}.json` 같은 신규 경로 생성
   - 카드 클릭 시 `fetch()` → 응답을 그대로 `openSpeciesDetail()`에 전달
   - 이미지·서식지·생애 등 무거운 데이터를 lazy 로드 가능

### 핵심 함수 (모두 `project/index.html` 인라인 `<script>` 내부)

| 함수 | 위치 (행) | 역할 |
|------|-----------|------|
| `buildPlaceholderSpecies(sci, common)` | 1818 | 표준 species 스키마(자리표시자) 생성 |
| `setSlot(root, slotName, value, fallback)` | 1851 | `[data-slot]` 요소 안전 채움 (`textContent`, XSS 안전) |
| `resolveBadge(key, raw)` | 1861 | 6개 배지를 `{ status, text }`로 정규화 |
| `applyBadge(badgeEl, badgeState)` | 1893 | 배지 DOM에 `data-status`/값 적용 |
| `renderSpeciesDetail(species)` | 1901 | 페이지 전체 슬롯 일괄 렌더 |
| `openSpeciesDetail(species, fromPage)` | 2011 | 진입 엔트리 (렌더 + 페이지 전환) |

---

## 파일 구조

```
insect/
├── README.md                  # 이 문서
├── CLAUDE.md                  # 프로젝트 하네스 정의
├── _workspace/                # 오케스트레이션 산출물 (커밋 제외 권장)
│   ├── 01_requirements.md
│   ├── 02_developer_output.md
│   └── ...
└── project/                   # 실제 웹앱 진입점
    ├── index.html                              (~2,058행, 인라인 <script>)
    ├── style.css                               (~2,415행)
    ├── korea_insect_species_by_family.json     (~1MB 통합 종 데이터)
    ├── fonts/
    │   └── LINESeedKR-Rg.woff2
    ├── images/                                 # 큐레이션 hero 이미지
    │   ├── asian_swallowtail.png
    │   ├── catocala_nupta.png
    │   ├── jewel_beetle.png
    │   ├── limenitis_camilla.png
    │   └── yujin_profile.png
    └── taxonomy/
        ├── index.json                          # 34목 메타
        ├── orders/                             # 목별 과 목록 (34개 파일)
        │   ├── coleoptera.json
        │   ├── lepidoptera.json
        │   └── ...
        └── families/                           # 과별 종 목록 (~610개 파일)
            ├── coleoptera/
            │   ├── aderidae.json
            │   └── ...
            ├── lepidoptera/
            └── ...
```

페이지 ID 목록 (`project/index.html`):

| 페이지 ID | 행 | 설명 |
|-----------|-----|------|
| `pageDiscover` | 27 | 홈 (테마/분류 탭) |
| `pageFamilyList` | 268 | 한 목 안의 과 목록 |
| `pageFamilyDetail` | 303 | 한 과 안의 종 목록 |
| `pageSpeciesDetail` | 343 | **종 상세 (인포그래픽)** — 신규 추가 |
| `pageSearch` | 632 | 검색 결과 |
| `pageSaved` | 773 | 저장된 항목 |
| `pageProfile` | 795 | 프로필 |

## 사용 기술

- **HTML5 / CSS3** — CSS 변수 기반 디자인 토큰, `word-break: keep-all`로 한글 줄바꿈 최적화
- **JavaScript (ES6+, 바닐라)** — 프레임워크/빌드 도구 없음, 단일 인라인 `<script>`
- **View Transitions API** — `showPage()` 헬퍼의 페이지 전환 (지원 안 되는 브라우저는 graceful fallback)
- **폰트**
  - 본문 한글: **LINE Seed KR** (로컬 `project/fonts/LINESeedKR-Rg.woff2`)
  - 학명·디스플레이: **Cormorant Garamond** (Google Fonts, italic)
  - 보조: **Inter** (Google Fonts)
- **데이터 출처**: 국립생물자원관(NIBR) KTSN OpenAPI

---

*이 문서는 ENTOMA · KR 웹 개발 워크플로우(`web-orchestrator`)의 `doc-writer` 에이전트가 자동 생성한 후 보강되었습니다.*
