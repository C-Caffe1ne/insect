# ENTOMA · KR

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
- EOL 서식지·분포 데이터 연결
- NIBR eCatalog 300종의 형태·생태·서식지 정보 연결
- iNaturalist, GBIF, Wikipedia 이미지와 출처 표시

## 데이터 구조

기존 `project/taxonomy/` 분할 JSON은 제거했습니다. 앱은 다음 파일을 런타임
데이터 소스로 사용합니다.

| 파일 | 용도 |
|------|------|
| `project/search_index.json` | NIBR 300종의 목·종 탐색과 검색에 사용하는 통합 인덱스 |
| `project/nibr_cache.json` | NIBR eCatalog 300종 상세 정보 |
| `project/eol_species_cache.json` | 300종 중 매칭된 EOL TraitBank 캐시 |
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
3. EOL: 서식지, 분포, 통명, 생태 형질
4. GBIF/iNaturalist/Wikipedia: 이미지와 부가 메타데이터

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

데이터 출처: 국립생물자원관 NIBR, EOL, GBIF, iNaturalist, Wikipedia/Wikimedia Commons
