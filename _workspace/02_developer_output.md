## 구현 완료

신규 페이지 `pageSpeciesDetail` (인포그래픽 스타일 곤충 상세) 스캐폴드 + 자리표시자 UI 구현. 데이터 연결은 이후 단계에서 `openSpeciesDetail(species)` 호출 한 번이면 모든 슬롯이 자동으로 채워지도록 후크를 통일했다.

### 수정/추가된 파일
- `/Users/hwanghyeonseong/Documents/GitHub/insect/project/index.html` — 1530줄 → 2058줄 (+528줄)
  - 마크업 추가: `pageFamilyDetail` 직후 새 `<div class="page" id="pageSpeciesDetail">` 1블록 (≈310줄)
  - 인라인 `<script>`에 신규 함수 4종 및 핸들러 추가
  - 기존 `renderSpeciesSorted` 종 카드 생성 부에 클릭/키보드 핸들러 부착 (1줄 수정 + 약 18줄 추가)
- `/Users/hwanghyeonseong/Documents/GitHub/insect/project/style.css` — 1811줄 → 2415줄 (+604줄)
  - 끝부분에 `SPECIES DETAIL PAGE (INFOGRAPHIC)` 섹션 신규 추가

### 추가된 마크업 (pageSpeciesDetail)

페이지 구조 트리:
```
#pageSpeciesDetail .page
├─ .family-detail-topbar.species-detail-topbar
│  ├─ button#speciesDetailBackBtn.family-back-btn (← 백버튼)
│  └─ h2.family-detail-title ("종 상세")
├─ section.species-detail-hero
│  ├─ div#speciesDetailHeroImg.species-hero-img [data-slot="heroImg"]
│  │  ├─ .placeholder-img.placeholder-img--bee.species-hero-placeholder
│  │  └─ .data-pending-tag ("사진 데이터 준비 중")
│  └─ .species-hero-info
│     ├─ p.species-detail-kr [data-slot="commonName"]
│     └─ p.species-detail-sci [data-slot="scientificName"] (Cormorant Garamond italic)
├─ section.species-info-section — CONSERVATION STATUS
│  └─ .status-badge-grid#statusBadgeGrid (6개 배지)
│     └─ article.status-badge [data-status][data-badge-key=...]
│        ├─ .status-badge-icon (인라인 SVG)
│        ├─ .status-badge-label (멸종위기/생태계교란/위해우려/천연기념물/유해종/한국고유종)
│        └─ .status-badge-value [data-slot=...]
├─ section.species-info-section — TAXONOMY
│  └─ ol.taxonomy-tree#taxonomyTree
│     └─ li.taxonomy-step × 7 (Kingdom→Species, 마지막은 .taxonomy-step--leaf)
│        ├─ span.taxonomy-rank
│        └─ span.taxonomy-value [data-slot="tax{Kingdom..Species}"]
├─ section.species-info-section — SCIENTIFIC NAME
│  └─ .info-card
│     ├─ p.info-card-primary [data-slot="fullScientificName"]
│     └─ p.info-card-secondary × 2 (author / year)
├─ section.species-info-section — DESCRIPTION
│  └─ .info-card.info-card--text > p.info-card-body [data-slot="description"]
├─ section.species-info-section — SIZE
│  └─ .info-card.size-card
│     ├─ .size-visual > .size-ruler (11틱) + .size-bar [data-slot="sizeBar"]
│     └─ .size-text > .size-range [data-slot="sizeRange"]
├─ section.species-info-section — HABITAT
│  └─ .info-card.habitat-card
│     ├─ .habitat-row (icon + p.habitat-text [data-slot="habitat"])
│     └─ .habitat-map [data-slot="habitatMap"] (placeholder)
└─ section.species-info-section — LIFE CYCLE
   └─ ol.lifecycle-grid#lifecycleGrid (4 stages)
      └─ li.lifecycle-stage [data-stage=egg|larva|pupa|adult]
         ├─ .lifecycle-icon (SVG)
         ├─ .lifecycle-name (알/유충/번데기/성충)
         ├─ .lifecycle-sub (Egg/Larva/Pupa/Adult)
         └─ .lifecycle-desc [data-slot="lifecycle{Egg|Larva|Pupa|Adult}"]
```

신규 ID 목록:
- `pageSpeciesDetail` — 페이지 컨테이너
- `speciesDetailBackBtn` — 백버튼
- `speciesDetailHeroImg` — 히어로 이미지 컨테이너 (data-slot도 동시 부여)
- `statusBadgeGrid` — 상태 배지 그리드
- `taxonomyTree` — 분류 트리 OL
- `lifecycleGrid` — 생애 주기 OL

신규 클래스 목록 (kebab-case + 네임스페이스):
- 페이지: `species-detail-topbar`, `species-detail-hero`, `species-hero-img`, `species-hero-placeholder`, `species-hero-info`, `species-detail-kr`, `species-detail-sci`, `data-pending-tag`
- 섹션: `species-info-section`, `species-info-eyebrow`, `species-info-title`
- 정보 카드: `info-card`, `info-card--text`, `info-card-primary`, `info-card-secondary`, `info-card-body`, `info-meta-label`, `info-meta-value`
- 상태 배지: `status-badge-grid`, `status-badge`, `status-badge-icon`, `status-badge-label`, `status-badge-value`
- 분류: `taxonomy-tree`, `taxonomy-step`, `taxonomy-step--leaf`, `taxonomy-rank`, `taxonomy-value`
- 크기: `size-card`, `size-visual`, `size-ruler`, `size-ruler-tick`, `size-bar`, `size-bar-fill`, `size-bar-arrow`, `size-bar-arrow--left`, `size-bar-arrow--right`, `size-text`, `size-range`, `size-hint`
- 서식지: `habitat-card`, `habitat-row`, `habitat-icon`, `habitat-text`, `habitat-map`, `habitat-map-placeholder`
- 생애: `lifecycle-grid`, `lifecycle-stage`, `lifecycle-icon`, `lifecycle-name`, `lifecycle-sub`, `lifecycle-desc`

### 추가된 CSS (섹션별 요약)
- **`#pageSpeciesDetail` 스코프 색 토큰**: 6개 배지 의미 색 (endangered/invasive/hazardous/natural/harmful/endemic) + 데이터 미연결 점선 색을 페이지 내부에서만 정의 → 다른 페이지 오염 없음
- **Hero**: 4:3 비율, 점선 테두리(자리표시자 표시), `data-pending-tag` 흑반투명 배지
- **Section shell**: 공용 `species-info-section` 패딩 + `species-info-eyebrow`(레터스페이싱 0.2em) + `species-info-title` 헤드
- **`info-card`**: 카드형 배경(`rgba(255,255,255,0.035)`), 라운드 18px, 학명 카드/설명 카드 등에서 재사용
- **Status badge grid**: 모바일 `repeat(2, 1fr)`, 480px+ `repeat(3, 1fr)`. 3개 상태(`active`/`inactive`/`unknown`)별 시각 차이:
  - `active`: 배지별 의미 색 배경 + 아이콘 컬러 채움 + 흰색 텍스트
  - `inactive`: dim + 반투명
  - `unknown`: 점선 테두리 + dim italic 텍스트 — 데이터 미연결 표시
- **Taxonomy tree**: 좌측 8px 도트 + 세로 연결선(`::before`/`::after`), 마지막 종 단계는 `--leaf` 강조(글로우 box-shadow)
- **Size visualization**: 11틱 자(odd 틱 더 길게) + 그라데이션 막대 + 좌/우 화살표 (CSS 변수 `--size-start`/`--size-end`로 JS에서 제어)
- **Habitat**: 아이콘+텍스트 + 한국 지도 자리표시자 영역(점선 테두리, 라디얼 그라데이션)
- **Life cycle**: `grid-template-columns: repeat(4, 1fr)` + 카드 사이 → 화살표 (`::after` 삼각형, 마지막 카드 제외)
- 모든 한글 컨테이너에 `word-break: keep-all`

### 추가된 JS 함수
1. **`buildPlaceholderSpecies(scientificName, commonName)`** — 표준 species 스키마(자리표시자) 반환. 현재 선택된 `selectedOrder`/`selectedFamily`가 있으면 taxonomy.order/family에 자동 주입.
2. **`setSlot(root, slotName, value, fallback)`** — `[data-slot="..."]` 요소를 안전하게 채우고 `dataset.pending` 표시. 모든 텍스트는 `textContent`로 세팅(XSS 안전).
3. **`resolveBadge(key, raw)`** — 6개 배지 각 키별 값을 `{ status, text }`로 정규화 (멸종위기 등급 매핑, 천연기념물 지정번호 포맷, boolean 처리).
4. **`applyBadge(badgeEl, badgeState)`** — `data-status` + value 텍스트 동기화.
5. **`renderSpeciesDetail(species)`** — 메인 렌더러. 위 헬퍼들을 사용해 페이지의 모든 슬롯을 일괄 채움. 이미지 배열이 있으면 `<img loading="lazy">` 동적 삽입, 없으면 placeholder + 점선.
6. **`openSpeciesDetail(species, fromPage = 'pageFamilyDetail')`** — 진입 엔트리. 상태 갱신 → 렌더 → `showPage('pageSpeciesDetail', { keepNav: true })`.

신규 모듈 스코프 변수: `selectedSpecies`, `previousSpeciesPage`.

### 데이터 연결 후크
이후 species 객체만 다음 스키마로 만들어 `openSpeciesDetail(species, fromPage)`에 전달하면 모든 슬롯이 자동으로 채워진다:

```js
{
  scientificName: string,         // → .species-detail-sci, fullScientificName 베이스
  commonName: string,             // → .species-detail-kr
  author: string | null,          // → info-card author 슬롯, fullScientificName에 합성
  year: number | string | null,   // → info-card year 슬롯
  images: string[],               // → 히어로 <img>; 빈 배열이면 placeholder + 점선
  conservationStatus: {
    endangered: 'I' | 'II' | '관찰종' | '해당없음' | null,  // null→unknown, 해당없음→inactive
    invasive: boolean | null,     // true→active 해당, false→inactive 해당없음, null→unknown
    hazardous: boolean | null,
    naturalMonument: string | null,  // 지정번호 (예: '218') → 'active 제218호'
    harmful: boolean | null,
    endemic: boolean | null
  },
  taxonomy: { kingdom, phylum, class, order, family, genus, species },
  description: string | null,
  habitat: string | null,
  habitatRegions: string[],       // (현재 미사용, 추후 한국 지도 시각화용 슬롯)
  lifecycle: { egg, larva, pupa, adult },  // 각 단계 짧은 설명
  size: { min: number, max: number, unit: 'mm' } | null  // 막대 위치는 0~100mm 가정
}
```

값이 null/undefined/빈 문자열이면 슬롯마다 의미 있는 자리표시자 텍스트("데이터 준비 중", "곧 공개됩니다", "데이터 없음" 등)가 채워지고 `data-pending="true"`가 부여되어 CSS에서 시각적으로 dim 처리.

### 진입/이탈 경로
- **진입**: `renderSpeciesSorted()` 내부 종 카드 생성 부에 `click` + `keydown(Enter/Space)` 핸들러 부착. 클릭 시 `buildPlaceholderSpecies(...)` + 카드의 `scientificName/commonName/genus/species` 머지 → `openSpeciesDetail(species, 'pageFamilyDetail')` 호출. `role="button"` + `tabIndex=0` 부여로 키보드/스크린리더 접근.
- **이탈**: `#speciesDetailBackBtn` 클릭 → `showPage(previousSpeciesPage || 'pageFamilyDetail', { keepNav: true })`. `keepNav: true`로 하단 네비 active 상태 보존.
- **호환성**: F-5 정렬 함수(`renderSpeciesSorted`)가 카드를 생성하는 유일한 지점이라 정렬 변경 후에도 클릭 핸들러가 매번 다시 부착됨 (재바인딩 누수 없음 — 카드 자체가 재생성되며 같이 사라짐).

### 자리표시자 처리
1. **사진 없음**: 점선 테두리(`border: 1px dashed var(--data-pending-line)`) + `.data-pending-tag` ("사진 데이터 준비 중") 좌하단 배지
2. **상태 배지**: `data-status="unknown"` → 점선 테두리 + 아이콘/텍스트 dim + value "데이터 없음" italic
3. **분류 트리/생애 주기**: 빈 슬롯은 `data-pending="true"` 부여 → italic + faint 색
4. **크기**: 데이터 없으면 막대를 30%~65% 기본 위치에 두고 텍스트만 "— ~ — mm"
5. **서식지 지도**: 자리표시자 영역에 라디얼 그라데이션 + "한국 지도 데이터 준비 중" 배지
6. **학명/설명**: "— 데이터 준비 중 —", "— 곧 공개됩니다 —" 등 명시적 한국어 자리표시자

### 코드 리뷰어 확인 요청 사항
1. **모든 동적 텍스트는 `setSlot()`에서 `textContent`로 세팅** — innerHTML을 쓰는 곳은 히어로 이미지의 `<img>` DOM 생성(`createElement`) 한 곳뿐. XSS 방어 확인 부탁.
2. **`buildPlaceholderSpecies` 내부에서 `selectedOrder`/`selectedFamily` 전역 참조** — taxonomy.order/family를 자동 주입하기 위해. 종 카드 진입은 항상 `pageFamilyDetail` 컨텍스트에서 일어나므로 항상 truthy 가정. 다른 진입 경로(검색 결과 직접 클릭 등) 추가 시 이 가정이 깨질 수 있음 — 향후 확장 시 검토 필요.
3. **`renderSpeciesSorted` 안의 카드 핸들러가 호이스팅된 `buildPlaceholderSpecies`/`openSpeciesDetail`를 참조** — 두 함수 모두 function 선언(호이스팅 OK)이지만, 스크립트가 로드 순서에 민감해질 가능성이 있는지 점검 부탁.
4. **IDE 경고 (style.css 890, 1107줄)**: `-webkit-line-clamp` 표준 속성 미정의 — **기존 코드** 영역이므로 이번 작업 범위 밖, 별도 픽스 PR 권장.

### QA가 검증해야 할 동작
1. **종 카드 → 상세 페이지 진입**: 분류 탭 → 임의의 목 확장 → 과 선택 → `pageFamilyDetail`에서 종 카드 클릭 시 `pageSpeciesDetail`이 열리고 학명·한글명이 카드와 일치하게 채워지는가.
2. **백버튼 동작**: 상세 페이지에서 ← 클릭 시 직전 `pageFamilyDetail`로 복귀하며 하단 네비 active 유지되는가. 정렬 탭(POPULAR/A-Z/BY COLOR) 상태가 보존되는지도 확인.
3. **키보드 접근성**: 종 카드에 Tab으로 포커스 → Enter/Space로 상세 진입 가능한가. 백버튼도 Enter로 동작하는가.
4. **자리표시자 시각 표현**: 데이터 미연결 상태에서 (a) 6개 상태 배지가 모두 "데이터 없음" + 점선, (b) 분류 트리 하단 4단계(목/과/속/종)는 italic dim, 상단 3단계(계/문/강)는 고정값으로 정상 표시, (c) 생애 주기 4단계 카드 사이 → 화살표가 보이고 마지막 카드에는 없음.
5. **반응형 배지 그리드**: 모바일(현재 max-width: 430px) 2컬럼, 480px 뷰포트에서 3컬럼으로 전환. 외부 브라우저에서 확장 시 시각 확인.
6. **`renderSpeciesDetail` 단위 호출**: 콘솔에서 `openSpeciesDetail({ scientificName: 'Papilio xuthus', commonName: '호랑나비', conservationStatus: { endangered: 'II', invasive: false, hazardous: null, naturalMonument: '218', harmful: false, endemic: true }, taxonomy: { kingdom:'동물계 (Animalia)', phylum:'절지동물문 (Arthropoda)', class:'곤충강 (Insecta)', order:'나비목 (Lepidoptera)', family:'호랑나비과 (Papilionidae)', genus:'Papilio', species:'P. xuthus' }, size: { min: 30, max: 50, unit: 'mm' } }, 'pageFamilyDetail')` 호출 시 모든 슬롯이 즉시 정확히 채워지는가(active/inactive/unknown 배지 색 구분, 크기 막대 30~50mm 위치).
