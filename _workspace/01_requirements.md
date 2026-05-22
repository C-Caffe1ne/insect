## 요구사항

### 사용자 요청
곤충 상세 페이지를 인포그래픽 스타일로 구현. 상세 정보 데이터/사진은 이후에 연결 예정 — **이번 작업은 페이지 스캐폴드 + 자리표시자(placeholder) UI**.

### 분류된 작업 유형
신규 구현 (새 페이지 + 네비게이션 통합)

### 필요한 정보 슬롯 (인포그래픽 구성 요소)
1. **히어로 영역**
   - 곤충 사진 (placeholder)
   - 종 이름(한글) + 학명(이탤릭)
2. **상태 배지 6종** (해당/비해당 시각 표시, 인포그래픽 스타일 아이콘+라벨)
   - 멸종위기 등급 (등급 텍스트 표시 영역 — Ⅰ급/Ⅱ급/관찰종/해당없음)
   - 생태계교란종 대상 (Yes/No)
   - 위해우려종 대상 (Yes/No)
   - 천연기념물 대상 (지정번호 표시 영역)
   - 유해종 대상 (Yes/No)
   - 한국고유종 대상 (Yes/No)
3. **분류 (taxonomy)** — 계: 동물계 / 문: 절지동물문 / 강: 곤충강 / 목 / 과 / 속 / 종 (계층 형태)
4. **분류명 (학명 전체 + 명명자/연도 슬롯)**
5. **곤충 설명** — 본문 텍스트 영역 (Lorem-ko 자리표시자)
6. **서식지** — 아이콘 + 텍스트 (한국 지도/지역 표시 가능성 고려)
7. **생애 (life cycle)** — 알→유충→번데기→성충 4단계 인포그래픽 (단계별 자리표시자 카드)
8. **크기** — 시각적 비교(예: ↔ 30mm) 또는 자/막대 그래픽

### 관련 파일
- `project/index.html` (1529줄, 인라인 `<script>`)
- `project/style.css` (1811줄)
- 향후 데이터 연결: `taxonomy/families/{order-id}/{family-id}.json`의 `insects[]` 항목 또는 신규 종 상세 JSON

### 진입 경로
- 기존 `renderFamilyDetail` 내 `renderSpecies()` 함수가 종 카드를 생성한다 (현재 클릭 핸들러 없음)
- 종 카드 클릭 시 신규 `pageSpeciesDetail`로 진입
- 뒤로가기: 이전 family 상세 페이지로 복귀

### 디자인 가이드
- **인포그래픽 스타일**: 시각 위주, 아이콘·배지·진행 단계 등을 사용
- 기존 ENTOMA · KR 디자인 토큰 준수:
  - 다크 톤 배경 (`--bg-primary` 등 기존 변수)
  - 카드형 섹션, 둥근 모서리, 부드러운 경계선
  - 폰트: Cormorant Garamond (학명), LINE Seed KR (한글), Inter (보조)
- 상태 배지: 해당이면 강조 색상, 비해당이면 회색/투명 — 색맹 친화 (배경색 + 아이콘 + 텍스트 3중 표시)
- 모바일 우선 — 단일 컬럼, 위에서 아래로 스크롤
- 자리표시자(placeholder)는 명확히 "데이터 연결 예정" 임을 시각적으로 표현 (점선 테두리 또는 흐림 처리)

### 데이터 연결 후크 (이후 확장)
- 종 객체 스키마(예상):
  ```js
  {
    scientificName, commonName, genus, species,
    images: [],              // 사진 URL 배열
    conservationStatus: {    // 보전 상태
      endangered: 'I' | 'II' | null,
      invasive: boolean,
      hazardous: boolean,
      naturalMonument: string | null,  // 지정번호
      harmful: boolean,
      endemic: boolean
    },
    taxonomy: { kingdom, phylum, class, order, family, genus, species },
    description: string,
    habitat: string,
    lifecycle: { egg, larva, pupa, adult },  // 단계별 설명
    size: { min: number, max: number, unit: 'mm' }
  }
  ```
- `renderSpeciesDetail(species)` 함수가 위 스키마를 받아 페이지를 채운다
- 데이터 미연결 상태에서는 모든 슬롯에 자리표시자 표시

### 작업 범위
1. `index.html`에 `pageSpeciesDetail` 페이지 마크업 추가
2. `style.css`에 인포그래픽 스타일 추가
3. 인라인 `<script>` 안에:
   - `openSpeciesDetail(species)` 함수
   - `renderSpeciesDetail(species)` 함수 (자리표시자 처리 포함)
   - 백버튼 핸들러
   - 종 카드 클릭 → `openSpeciesDetail()` 연결
4. README 갱신 (doc-writer)

### 참고 사항
- 기존 페이지 전환 패턴(`showPage` 헬퍼) 사용
- View Transitions API 지원 (graceful fallback)
- 모든 데이터 출력에 `escapeHTML` 사용 (XSS)
- 동적 이미지 `alt` 텍스트 + `loading="lazy"`
- 인포그래픽 배지는 의미상 텍스트도 함께 표시 (스크린리더 친화)
- 빈 데이터/배열 방어 — 페이지가 데이터 없이도 깨지지 않게
