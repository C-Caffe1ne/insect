## 요구사항

### 사용자 요청
EOL(Encyclopedia of Life) API를 참고하여 곤충 상세 페이지에 실 데이터를 연결.

### 제약 조건 (사용자 명시)
1. 없거나 얻을 수 없는 데이터는 건너뛴다
2. 캐싱된 곤충 데이터만 대상으로 한다 (`cached/korea_insect_species_by_family.json`의 종)
3. API 호출 비용 절약 위해 응답을 **일괄 캐싱**한다

### 보안 이슈 ⚠️
- 사용자가 채팅으로 JWT 토큰을 공유 — **이미 노출**된 상태
- 권장: EOL 계정에서 즉시 키 재발급
- 본 구현: API 키는 환경변수 `EOL_API_KEY`로만 처리, **코드/저장소에 절대 하드코딩 금지**

### EOL API 탐색 결과
- 인증: JWT 토큰을 `Authorization: JWT <token>` 헤더로 전송
- **사용 엔드포인트**: `https://eol.org/service/cypher` (TraitBank Cypher API)
- 레거시 `https://eol.org/api/*` 엔드포인트는 Cloudflare 챌린지로 차단됨 (이미지/설명 텍스트 미수신)
- **Cypher로 가져올 수 있는 것**:
  - Page: `page_id`, `canonical`, `rank`
  - 관계: `Page -[:trait]-> Trait`, `Page -[:vernacular]-> Vernacular`, `Page -[:parent]-> Page`
  - Trait: 술어(predicate) + literal/measurement/object_term/unit
- **활용 가능 predicate**:
  - `habitat` (ENVO 용어, object_term="tropical" 등)
  - `geographic distribution`, `introduced range includes` (지리적 분포)
  - `eat`, `visit flowers of`, `are pathogens of` (상호작용)
  - `number of records in gbif` (관측 수)
  - `type specimen repository`
- **Vernacular**: 한국어("호랑나비"), 영어, 일본어, 중국어 등 다국어 통명
- **가져올 수 없는 것 (skip)**:
  - 이미지 (legacy API만 제공, 차단됨)
  - 상세 설명 텍스트
  - IUCN 보전 등급
  - Body size/length (Papilio xuthus 샘플에 없음, 종에 따라 다를 수 있음)
  - Lifespan/lifecycle 단계 텍스트
  - 한국 고유 분류 (멸종위기 Ⅰ/Ⅱ급, 천연기념물, 생태계교란, 유해종, 한국고유종) — EOL에 없음

### 매핑 — EOL → species 객체 (`renderSpeciesDetail`이 받는 스키마)
| species 필드 | EOL 출처 | 매핑 규칙 |
|---|---|---|
| `commonName` | Vernacular(kor) | 한국어 통명 있으면 우선 |
| `description` | (없음) | skip (자리표시자 유지) |
| `habitat` | trait[predicate=habitat].object_term | 콤마 결합 ("tropical, freshwater") |
| `habitatRegions` | trait[predicate=geographic distribution].object_term | 배열 |
| `lifecycle` | (없음) | skip |
| `size` | (없음) | skip |
| `conservationStatus.*` | (한국 분류는 EOL 미보유) | skip |
| `taxonomy.genus/species` | 종의 학명 파싱 | 기존 로직 유지 |

### 작업 산출물
1. **`cached/cache_eol_species.mjs`** — Node.js ESM 스크립트
   - 입력: `cached/korea_insect_species_by_family.json` (캐싱된 종 목록)
   - 출력: `cached/eol_species_cache.json` (EOL 데이터 매핑 캐시)
   - 옵션: `--limit N` (테스트용), `--force` (기존 캐시 무시), `--delay-ms`, `--concurrency`, `--retries`
   - 환경변수: `EOL_API_KEY` 필수
   - 패턴: 기존 `cache_digital_contents.mjs` 따라 incremental save + retry + sleep
   - 한 종당 2회 쿼리: (1) page_id + canonical, (2) traits + vernaculars (UNION)
2. **프론트엔드 통합** (`project/index.html`):
   - 페이지 로드 시 `cached/eol_species_cache.json` 한 번만 fetch (저장 + 메모리 캐시)
   - `renderSpecies` 카드 클릭 핸들러에서 학명으로 EOL 캐시 조회
   - EOL 데이터를 `buildPlaceholderSpecies()` 결과에 머지 후 `openSpeciesDetail`로 전달
   - 미적중 시 기존 자리표시자 그대로

### 데이터 위치
- 입력: `cached/korea_insect_species_by_family.json` (1MB, 610과 × 최대 8종)
- 출력: `cached/eol_species_cache.json` (신규)
- 사본: `project/eol_species_cache.json` (프론트엔드 fetch용 — 또는 cached/에서 직접 fetch 경로)

### 참고 사항
- 호출 비용 절약: 최대 캐시 적중률 → 학명 정규화 키 사용
- 학명에 명명자/연도 포함 케이스 처리: `"Papilio xuthus Linnaeus, 1767"` → canonical `"Papilio xuthus"`
- 캐시 스키마 버전 필드 포함 (`schemaVersion: 1`)
- 실패한 종도 기록(`status: "not_found"`)하여 재실행 시 건너뜀
- `--force` 또는 종의 schemaVersion 불일치 시에만 재요청
