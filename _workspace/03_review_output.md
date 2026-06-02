## 코드 리뷰 결과 — GBIF 텍스트 + 빈 코드 인벤토리

> **범위:** `project/index.html` (3,453줄), `project/style.css` (3,401줄)
> **모드:** READ-ONLY. 본 문서는 인벤토리이며, 어떤 파일도 수정하지 않았습니다.

---

### 1. 'GBIF 관측 기록' 텍스트 위치

#### 1-1. 사용자 가시 출력 (제거 대상) — **단 1곳**

- **[project/index.html:3194]** — 함수 `enrichSpeciesWithEol(species)` 내부, "4) 설명 — EOL은 description 텍스트 미제공. 통명/상호작용/관측수로 요약 합성" 블록.

  ```js
  3187      // 4) 설명 — EOL은 description 텍스트 미제공. 통명/상호작용/관측수로 요약 합성
  3188      if (!species.description) {
  3189        const desc = [];
  3190        if (Array.isArray(v.en) && v.en.length > 0) desc.push(`영명: ${v.en.slice(0, 3).join(' / ')}`);
  3191        if (Array.isArray(v.ja) && v.ja.length > 0) desc.push(`일본어: ${v.ja.slice(0, 2).join(' / ')}`);
  3192        if (Array.isArray(t.eats) && t.eats.length > 0) desc.push(`먹이: ${t.eats.slice(0, 5).join(', ')}`);
  3193        if (Array.isArray(t.visitsFlowersOf) && t.visitsFlowersOf.length > 0) desc.push(`방문 꽃: ${t.visitsFlowersOf.slice(0, 5).join(', ')}`);
  3194        if (t.gbifRecords) desc.push(`GBIF 관측 기록: ${Number(t.gbifRecords).toLocaleString('ko-KR')}건`);
  3195        if (Array.isArray(t.introduced) && t.introduced.length > 0) desc.push(`도입 지역: ${t.introduced.join(', ')}`);
  3196        if (desc.length > 0) species.description = desc.join(' · ');
  3197      }
  ```

  - **합성 위치**: `enrichSpeciesWithEol` 함수가 EOL 캐시 데이터 `eol_species_cache.json`의 항목을 `species.description`(상세 페이지 설명 영역) 문자열로 합성. 다른 4개 항목(영명/일본어/먹이/방문 꽃/도입 지역)은 ' · ' 구분자로 연결.
  - **위험도 판정**: **이 라인만 제거하면 안전**. 다른 `desc.push(...)` 분기와 독립적이며, 조건문(`if (t.gbifRecords)`)이 라인 자체에서 닫힘. 제거해도 다른 4개 분기가 정상 작동하여 description 합성에 빈 문자열이 생기지 않음.
  - **권장 수정**: 라인 3194 한 줄 삭제.

    ```js
    // before
    if (t.gbifRecords) desc.push(`GBIF 관측 기록: ${Number(t.gbifRecords).toLocaleString('ko-KR')}건`);

    // after — 라인 제거 (위/아래는 그대로 유지)
    ```

  - **부수 효과 없음**: `t.gbifRecords`는 EOL 캐시 JSON의 필드일 뿐이며 다른 곳에서 읽지 않음. JSON 파일을 수정할 필요는 없음(필드는 남겨두어도 무방).

#### 1-2. 'GBIF'가 들어가지만 **사용자 가시 텍스트가 아닌** 위치 — 보존 권장

다음은 description에 합성되지 않으므로 요구사항 범위 밖. 데이터 파이프라인이 정상 동작하려면 유지 필수.

- **[project/index.html:1716]** 주석 — `// 이미지 폴백 체인: iNaturalist → GBIF media → Wikipedia` (코드 의도 설명)
- **[project/index.html:1740]** `source: 'GBIF'` — 이미지 출처 메타데이터(`imageCredits[].source`). 라인 1741의 `sourceClass: 'gbif'`와 함께 이미지 크레딧 UI에 표시되는 출처 라벨.
- **[project/index.html:1744]** `license: m.license || 'see GBIF'` — 라이선스 미상 시 fallback 문구. 크레딧 UI.
- **[project/index.html:1763]** 주석 — `// GBIF 데이터(있는 경우)를 openSpeciesDetail의 render()에서 enrich`
- **[project/index.html:3216]** 주석 — `// GBIF 캐시 보강 — family JSON의 insect.gbif 필드를 species 객체로 매핑.`
- **[project/index.html:3252]** 주석 — `// 4.5) 분류 계층 보강 — KTSN에 없는 kingdom 등을 GBIF로 채움`
- **[project/index.html:3354]** 주석 — `// 10) GBIF 메타 — 추적/디버깅용`
- **[project/index.html:3370]** `console.error('GBIF enrich failed:', err);` — 콘솔 디버그 로그(사용자에게 안 보임)
- **[project/index.html:3391]** 주석 — `// GBIF는 동기 데이터(inline)이므로 EOL 캐시 도착 전이라도 미리 보강`
- **[project/style.css:3377]** `.species-credit-source--gbif { background: rgba(180,140,80,0.18); color: #e8c08a; }` — 이미지 크레딧 배지 색상(GBIF 출처 표시 UI). 라인 3071에서 `species-credit-source--${c.sourceClass}` 동적 적용.

**판정**: 이들은 **'관측 기록' 텍스트 합성과 무관**한 GBIF 데이터 파이프라인(이미지/분류/명명자/분포 보강)이므로 보존. 만약 사용자가 "GBIF 관련 모든 흔적 제거"를 의도했다면 추가 확인 필요.

---

### 2. 빈 코드 후보

#### 2-A. HTML/JS — High confidence (삭제 권장)

- **[project/index.html:2139-2180]** — "인기 목 Top 6" 블록 전체 (`const popList = document.getElementById('popularOrderList'); if (popList) { ... }`)
  - **근거**: `popularOrderList`라는 ID를 가진 HTML 요소가 `index.html` 어디에도 존재하지 않음. `getElementById`는 항상 `null` 반환 → `if (popList)` 가드로 실행 안 됨 → 약 42줄 dead code.
  - 코드 미리보기:
    ```js
    const popList = document.getElementById('popularOrderList');
    if (popList) {
      popList.replaceChildren();
      (searchIndexData.orders || []).slice(0, 6).forEach(...
    }
    ```
  - 권장: 블록 전체 삭제(2139 주석 줄 포함). 필요 시 추후 인기 목 섹션 추가할 때 다시 작성.

#### 2-B. HTML/JS — Medium (검토 필요)

- **[project/index.html:557 일대]** `<div class="habitat-map" data-slot="habitatMap" aria-hidden="true">` 컨테이너
  - **근거**: `data-slot="habitatMap"`인데 `setSlot(... 'habitatMap', ...)` 호출도, `querySelector('[data-slot="habitatMap"]')` 호출도 없음. 현재는 정적 시각 요소(점·선 SVG 등)로만 사용되는 듯.
  - **위험**: 시각적 placeholder UI일 수 있음. `data-slot` 속성만 제거하거나, 향후 동적 바인딩 예약된 슬롯으로 보존 둘 다 가능.
  - 권장: `data-slot="habitatMap"` 속성만 제거(예약된 slot이 아니면). 컨테이너 자체는 유지.

- **[project/index.html:624]** `<footer ... data-slot="creditsSectionWrapper">`
  - **근거**: 동적 참조 없음. 컨테이너로만 사용. 동일하게 `data-slot` 속성만 의미 없음.
  - 권장: 속성만 제거 또는 유지(논의 필요).

#### 2-C. HTML/JS — Low/Risky (유지 권장)

- 정의된 50+ JS 함수 전체 검토 결과 **미사용 함수 없음** — 모두 최소 1회 이상 호출됨.
- 75개 HTML ID 중 `js_refs=1`인 ID들은 모두 CSS 스타일링 대상 또는 정적 시각 컨테이너로 사용중(`statusBadgeGrid`, `taxonomyTree`, `lifecycleGrid` 등은 클래스 셀렉터·시각적 grid 부모). 삭제 금지.
- `<style>` 인라인 블록 없음 — 동적 클래스 적용은 모두 JS `className =`/`classList`로 추적됨.

#### 2-D. CSS — High confidence (삭제 안전)

**미사용 CSS 클래스 (HTML/JS 어디에서도 참조되지 않음):**

| 클래스 | style.css 라인 | 사유 |
|--------|----------------|------|
| `.explore-card--random` | 2900 | HTML에 `--random` 변형 카드 없음 (현재 endangered/endemic/invasive/heritage 4종만 존재) |
| `.explore-card-sub` | 1365 | HTML에서 미사용 |
| `.order-body` | 577 | 동적 className 적용 없음 |
| `.order-card--expanded` | 558 | HTML/JS에 `expanded` BEM 변형 없음. 코드는 `.order-card-mini.expanded`(공백 + 단어) 사용 |
| `.order-card-single` | 1167, 1179 | HTML에 single 변형 카드 없음 |
| `.order-kr` | 589 | 동적 적용 없음 (`.order-name-kr`, `.expanded-title` 등 다른 이름 사용) |
| `.order-single-img` | 1174 | 동반 클래스 `order-card-single`과 함께 미사용 |
| `.placeholder-img--beetle` | 153 | HTML/JS에 사용처 없음 |
| `.placeholder-img--bug` | 171 | 〃 |
| `.placeholder-img--butterfly` | 159 | 〃 |
| `.placeholder-img--dragonfly` | 165 | 〃 |
| `.placeholder-img--grasshopper` | 183 | 〃 |
| `.placeholder-img--iridescent` | 145 | 〃 (현재 사용중: `--bee`, `--night`만) |
| `.popular-order-list` | 2903 | 부모 컨테이너로 추정되지만 HTML에 `id="popularOrderList"` 요소 자체가 없음(2-A 참고) |
| `.random-btn` | 1388, 1405 | HTML은 `random-finder-card`(별개 명명) 사용 — 옛 이름 잔재 |
| `.random-icon` | 1410 | 〃 |
| `.trait-finder-card` | 1301 | HTML은 `feature-finder-card` 사용 — 리네임 잔재 |
| `.trait-finder-title` | 1327 | 〃 |
| `.trait-finder-sub` | 1334 | 〃 |
| `.trait-icon` | 1316 | 〃 |
| `.trait-icons` | 1309 | 〃 |

**미사용 CSS 변수 (`@root`에서 정의됐지만 `var(--xxx)` 호출 없음):**

| 변수 | 위치 (style.css) | 사유 |
|------|------------------|------|
| `--bg-elevated` | 정의부 | 어디에서도 `var(--bg-elevated)` 호출 없음 |
| `--ghost` | 정의부 | 〃 |
| `--green-pale` | 정의부 | 〃 |
| `--leaf` | 정의부 | 〃 |
| `--primary` | 정의부 | 〃 (`--green-mid` 등 다른 그린 변수가 실제 primary 역할) |

#### 2-E. CSS — Medium / Low (조심)

- `.popular-order-row/-rank/-info/-name/-sci/-count` — JS에서 `className = 'popular-order-...'`로 동적 적용 중. **단** 2-A의 dead code 안에서만 사용되므로, 2-A 블록을 삭제할 경우 이 CSS도 함께 미사용 상태가 됨. 2-A 삭제 시 동반 제거 후보.
- `--search-cat-random` 변수: `.explore-card--random`에서만 호출되므로 해당 클래스 제거 시 함께 미사용.
- `@keyframes pageFadeIn` (1250), `@keyframes featureFadeIn` (3159): 모두 `animation:` 속성에서 사용 중 — **유지**.

---

### 3. 종합 권고

#### 핵심 변경 요약 (사용자 승인 대기 항목)

| 카테고리 | 항목 수 | 라인 추정 | 위험도 |
|----------|--------|-----------|--------|
| GBIF 텍스트 제거 | 1줄 | 1 | High confidence — 즉시 제거 가능 |
| JS dead code (popularOrderList 블록) | 1블록 | ~42 | High confidence |
| CSS 미사용 클래스 | 21개 | 약 90~110 | High confidence (모두 grep으로 0 hit 확인) |
| CSS 미사용 변수 | 5개 | 5 | High confidence |
| `data-slot="habitatMap" / "creditsSectionWrapper"` 속성 | 2개 | 2 | Medium — 속성만 제거하거나 보존 |

**총 안전 제거 가능 라인 수**: 약 140~160줄 (HTML 1줄 + JS 약 42줄 + CSS 약 95~115줄 + 변수 5줄)
**검토 필요 라인 수**: 2개 속성 (예약된 slot인지 디자이너 확인 필요)

#### 추가 권고

1. **GBIF 라인 제거(라인 3194)는 가장 안전한 단일 변경**이므로 우선 처리 가능. 다른 GBIF 관련 코드(이미지 출처, 분류 보강)는 사용자 가시 출력이 아니므로 보존.
2. **CSS 정리는 별도 단계로 분리** 권장. 21개 클래스를 한 번에 제거하기보다 카테고리별(placeholder 변형, trait-finder 잔재, order-* 잔재)로 분리해서 사용자 승인.
3. **`popularOrderList` dead block 제거**는 안전하나, "인기 목 Top 6" 기능이 향후 기획에 있는지 사용자 확인 필요. 기획이 살아있다면 HTML 요소를 추가하는 방향이 맞음.
4. **`data-slot="habitatMap" / "creditsSectionWrapper"`** 는 향후 동적 바인딩 예약 가능성이 있어 web-developer 단계에서 사용자에게 명시적으로 묻는 게 좋음.

#### 다음 단계 제안

- 오케스트레이터는 위 표를 사용자에게 plan으로 제시하고 항목별 OK/NO 응답을 받는다.
- 모든 항목 OK 시: web-developer가 단일 PR로 적용 + qa-agent가 회귀 테스트.
- 부분 OK 시: 항목별 분리 적용.
