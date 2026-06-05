## 문서화 완료

### 생성/갱신된 파일
- `README.md`: `/Users/hwanghyeonseong/Documents/GitHub/insect/README.md` (신규 생성 — 프로젝트 루트에 기존 README 없음)

### 문서화 범위
- **소개** — 큐레이션 + 분류 브라우저 + 종 상세 (3-pillar 요약)
- **실행 방법** — `python3 -m http.server` 권장 사유 (fetch JSON CORS) 명시
- **기능** — Discover / Taxonomy / 검색 / 종 상세 페이지 (`pageSpeciesDetail`)
- **데이터 구조** — `taxonomy/index.json` · `orders/{order-id}.json` · `families/{order-id}/{family-id}.json` · 통합 종 데이터, 실제 JSON 샘플 기반 스키마 표
- **곤충 상세 페이지 데이터 후크 (핵심 섹션)**
- **파일 구조** — 실제 `ls` 결과 + 페이지 ID 행 번호 표
- **사용 기술** — LINE Seed KR (로컬), Cormorant Garamond + Inter (Google Fonts), View Transitions API

### 데이터 후크 섹션
- **진입 방법**: `openSpeciesDetail(species, fromPage)` 시그니처 + 카드 클릭 자동 호출 위치(`project/index.html` 1452행) 명시
- **species 객체 스키마 표**: 17개 필드 (`scientificName` / `commonName` / `author` / `year` / `images` / `conservationStatus.*` 6종 / `taxonomy.*` 7단계 / `description` / `habitat` / `habitatRegions` / `lifecycle.*` 4단계 / `size`) — 타입 + 설명 + **미연결 시 표시** 컬럼 포함
- **자리표시자 처리 방식**: `data-slot`/`data-pending`/`data-status` 자동 부여 규칙, 배지 3-state(active/inactive/unknown) 시각 표현 표
- **향후 데이터 연결 위치**: 두 가지 옵션 제시
  1. 기존 `taxonomy/families/{...}.json`의 `insects[]`에 필드 직접 추가 + KTSN 원본 필드(`corsynSeYn` 등) 매핑 어댑터
  2. 별도 `taxonomy/species/{ktsn}.json` 신설 + lazy fetch
- **핵심 함수 위치 표**: `buildPlaceholderSpecies` (1818) / `setSlot` (1851) / `resolveBadge` (1861) / `applyBadge` (1893) / `renderSpeciesDetail` (1901) / `openSpeciesDetail` (2011)

### 검증된 사항 (실제 파일 Read 기반, 추측 없음)
- `project/index.html` 2,059행, `project/style.css` 2,415행 (실측)
- 페이지 ID 7종 모두 grep으로 행 번호 확인
- `taxonomy/index.json`의 `totalOrders: 34`, `totalFamilies: 610` 확인
- KTSN 원본 boolean 플래그명(`corsynSeYn` / `egspcsYn` / `dispYn` / `phspYn` / `hrmflSpecsYn` / `ntmYn`) 샘플 JSON에서 직접 확인
- CSS 디자인 토큰명(`--bg-deep` / `--font-display` / `--font-body`) 실제 파일에서 확인
