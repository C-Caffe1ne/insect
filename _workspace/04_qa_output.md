## QA 시나리오 검증 — JSON 정리 7개 후보 회귀 시뮬레이션

검증 방식: 정적 코드 분석 (READ-ONLY). `project/index.html` 직접 Read + grep, 그리고 `taxonomy/families/**/*.json`, `search_index.json` 실제 스키마 확인.

---

### 시나리오 A: 분류 보기 → 종 상세 페이지

**흐름**:
1. 사용자가 분류 탭에서 목 카드 클릭 → `selectedOrder = order;` (line 1521, 1604)
2. 과 카드 클릭 → `selectedFamily = family;` (line 1606), `openFamilyDetail()`
3. 종 카드 클릭 → `openDetail` (line 1681~) → `buildPlaceholderSpecies()` (line 1682) + `fullTaxonomy` 합성 (line 1687~1697) → `openSpeciesDetail({...})` (line 1699)
4. `renderSpeciesDetail(species)` (line 2899) → 슬롯/배지/분류트리 렌더

**필드별 슬롯 추적** (line 1708~1714, 1689~1697, 2932, 2939~2946):

| 슬롯 | 소스 (1차) | 폴백 (2차) | 폴백 (3차) |
|---|---|---|---|
| `endangered` 배지 | `item.egspcsYn === 'Y' ? 'II'` | `item.conservationStatus?.endangered` | `placeholder.conservationStatus.endangered` = `null` |
| `invasive` 배지 | `item.phspYn === 'Y'/'N'` | — | `placeholder.conservationStatus.invasive` = `null` |
| `hazardous` 배지 | `item.dispYn === 'Y'/'N'` | — | `null` |
| `naturalMonument` 배지 | `item.ntmYn === 'Y' ? '지정'` | — | `null` |
| `harmful` 배지 | `item.hrmflSpecsYn === 'Y'/'N'` | — | `null` |
| `endemic` 배지 | `item.korUnqBispYn` 또는 `corsynSeYn` (Y/N) | — | `null` |
| `taxKingdom` | `placeholder.taxonomy.kingdom` (= `'동물계 (Animalia)'`) | 슬롯 폴백 `'동물계 (Animalia)'` | — |
| `taxPhylum` | `formatTaxonRank(ktsn.phylum)` | `placeholder.taxonomy.phylum` = `'절지동물문 (Arthropoda)'` | 슬롯 폴백 |
| `taxClass` | `formatTaxonRank(ktsn.class)` | `placeholder.taxonomy.class` = `'곤충강 (Insecta)'` | — |
| `taxOrder` | `formatTaxonRank(ktsn.order)` | `placeholder.taxonomy.order` = `"${selectedOrder.commonName} (${selectedOrder.scientificName})"` (line 2814~2817) | 슬롯 폴백 `'데이터 준비 중'` |
| `taxFamily` | `formatTaxonRank(ktsn.family)` | `placeholder.taxonomy.family` = `selectedFamily` 기반 (line 2818~2821) | 슬롯 폴백 `'데이터 준비 중'` |
| `taxGenus` | `formatTaxonRank(ktsn.genus)` → `item.genus` → placeholder | `null` → 슬롯 폴백 | — |
| `taxSpecies` | `formatSpeciesRank(ktsn.species, ktsn.genus)` → `item.species` → placeholder | — | — |
| `heroImg` | `item.inat?.imageUrl` → `item.gbif?.media` → `item.wiki?.imageUrl` → `placeholder.images` (line 1717~1721) | — | placeholder DOM |
| description / habitat | `enrichSpeciesWithEol` (line 3113~3170): `t.habitat`, `t.geographic`, `t.eats`, `t.visitsFlowersOf` (각 `Array.isArray && length > 0` 가드 통과 시) | EOL 캐시 없으면 `item.description` / `item.abstract` (line 1706) | `placeholder.description` = `null` |
| author, year | `item.nomenclaturalAuthor`, `item.namingYear` (line 1704~1705) | EOL: 학명 정규식 파싱 (line 3155~3163) | `null` |

**선결 조건**: 시나리오 A 진입 시 `selectedOrder`, `selectedFamily`가 100% 채워져 있음. → placeholder.taxonomy.order/family가 안정적 폴백.

---

### 시나리오 B: 검색 → 종 상세 페이지

**흐름**:
1. 검색 결과 카드 클릭 → `openSpeciesFromIndex(ins)` (line 2307, 2319)
2. 라인 2321~2328: `ordersData`에서 `ins.o`/`ins.os`로 order 찾아 `selectedOrder` **동기화**. 같은 방식으로 `selectedFamily`도 동기화.
3. 라인 2362~2369: `fetch(taxonomy/families/${ins.o}/${ins.f}.json)` → `detailed` 찾기 → `proceed(detailed)`
4. 라인 2330~2358: `proceed(detailedInsect)` 안에서 placeholder 합성 + species 객체 생성.

**핵심**: 라인 **2351~2357**에서 검색 경로의 taxonomy는 다음과 같이 합성됨:
```js
taxonomy: {
  ...placeholder.taxonomy,  // kingdom, phylum, class, subgenus 등은 placeholder
  order:  `${ins.oKr || ''} (${ins.os || ''})`.trim(),   // 검색 인덱스에서 직접
  family: `${ins.fKr || ''} (${ins.fs || ''})`.trim(),
  genus:  ins.g || item.genus || placeholder.taxonomy.genus,
  species: ins.s || item.species || placeholder.taxonomy.species
}
```

→ **검색 경로는 `item.taxonomy.order` / `item.taxonomy.family`를 절대 읽지 않는다.** ktsn.order/family 자체가 제거되더라도 ins.oKr/ins.os/ins.fKr/ins.fs(search_index.json 필드)는 별도 보존되며 화면은 동일.

**검색 인덱스 스키마 확인** (`project/search_index.json` 표본 1번):
```json
{"ktsn":120000529790,"sci":"Sciaropota japonica Chandler, 2002","kr":"옛버섯파리",
 "lat":"japonica","o":"diptera","oKr":"파리목","os":"Diptera",
 "f":"diptera","fKr":"","fs":"","g":"Sciaropota","s":"japonica","flags":"000"}
```
→ oKr/os/fKr/fs/g/s 모두 존재. (fKr/fs는 일부 종에서 빈 값일 수 있으나 `.trim()` 가드 있음.)

배지 6종, 이미지, description은 시나리오 A와 동일 매핑.

---

### 시나리오 C: 패턴별 회귀 위험 매트릭스

| # | 패턴 | 시나리오 A | 시나리오 B | 종합 |
|---|---|---|---|---|
| 1 | `digitalContent` 전체 제거 | Pass | Pass | **안전** — frontend grep 0건 |
| 2 | Yn 3개(`hrmflSpecsYn`/`phspYn`/`ntmYn`) 데이터만 제거 | **부분 Fail** | **부분 Fail** | **코드 패치 동반** 권장 (라인 1710~1713 / 2345~2348 폴백 수정) |
| 3 | `taxonomy.order` / `taxonomy.family` 중복 제거 | Pass (selectedOrder/Family 보장) | Pass (검색 경로는 ktsn 미사용) | **안전** (분류·검색 두 진입로만 있는 현재 코드 한정) |
| 4 | `taxonomy.subgenus` 전수 또는 빈 객체만 제거 | Pass | Pass | **안전** — frontend grep 0건 |
| 5 | `eol.eats` / `visitsFlowersOf` / `pathogenOf` 빈 배열 키 제거 | Pass | Pass | **안전** — `Array.isArray(undefined) === false` |
| 6 | `gbif.vernacularName` (단수형) 제거 | Pass | Pass | **안전** — frontend는 `vernaculars` 객체만 사용 |
| 7 | `inat.imageUrl` 빈 문자열 키 제거 | Pass | Pass | **안전** — 모든 사용처가 truthy 검사 |

---

### 패턴별 상세 검증

#### #1 digitalContent
- grep: `digitalContent`, `dc.contents`, `dc.thumbnail`, `DigitalContent`, `digital_content` = **0건** (전 파일)
- 실제 데이터 확인: `taxonomy/families/hemiptera/aphelocheiridae.json`에 존재하지만 frontend는 미참조.
- **결론**: 시나리오 A/B 모두 회귀 없음.

#### #2 Yn 3개 (hrmflSpecsYn / phspYn / ntmYn)
- 라인 1710~1713, 2345~2348에서 **유일 소스**. (code-reviewer 발견 그대로 검증됨.)
- 데이터 제거 전: `item.phspYn === 'N'` → `false` → `resolveBadge('invasive', false)` → status `inactive`, 텍스트 **"해당없음"** (라인 2870~2872).
- 데이터 제거 후: `item.phspYn === undefined` → 삼항 두 단계 모두 빠짐 → `placeholder.conservationStatus.invasive` = `null` → `resolveBadge('invasive', null)` → 라인 2849~2851 분기 적중 → status `unknown`, 텍스트 **"데이터 없음"**.
- **시나리오 A/B 둘 다** 동일 회귀: 3개 배지(`invasive`/`harmful`/`naturalMonument`) 라벨이 **"해당없음" → "데이터 없음"**.
- naturalMonument는 라인 2860~2863에서 `!raw` 분기로 "해당없음" 표시 (문자열 키). 다만 현재도 모든 데이터가 'N'(boolean false 폴백)이라 raw가 `null`로 진입하는 점은 동일하나, 변경 전후 표시 텍스트 차이는 발생.
- **권고**: 단순 데이터 제거 금지. 라인 1710~1713 및 2345~2348의 폴백 부분을 다음 중 하나로 패치 필요:
  - `placeholder.conservationStatus.invasive` → `false` (배지 텍스트 "해당없음")
  - 또는 `buildPlaceholderSpecies()`의 conservationStatus 초기값을 `null` → `false`(boolean용) / `'해당없음'`(naturalMonument용)으로 변경.

#### #3 taxonomy.order / taxonomy.family 중복
- 라인 1687~1696에서 `ktsn.order`/`ktsn.family` 사용. **시나리오 A에서만 호출** (`openDetail` 클로저 내부).
- 시나리오 A: 이미 분류 브라우저에서 `selectedOrder`, `selectedFamily`가 모두 truthy → placeholder.taxonomy.order/family도 truthy → 폴백 100% 동작.
- 표기 일치 검증: `formatTaxonRank` 출력 = `"${kr} (${sci})"` (line 1263). placeholder.taxonomy.order = `[kr, "(sci)"].filter(Boolean).join(' ')` = `"kr (sci)"` (line 2814~2817). **공백 위치까지 동일**.
- 시나리오 B: 라인 2353~2354에서 `ins.oKr`/`ins.os`로 직접 합성. ktsn.order/family를 읽지 않음. **무관**.
- **딥링크/북마크 진입**: 현재 코드에 URL 기반 직접 진입 핸들러 없음 (`hashchange`/`popstate`/`URLSearchParams` 기반 species 라우팅 grep 결과 0건). 모든 진입은 위 두 경로뿐.
- **결론**: 시나리오 A/B 모두 회귀 없음. **안전 제거 가능**. (Round 2 code-reviewer 판정과 일치)

#### #4 taxonomy.subgenus
- grep: `subgenus`, `Subgenus`, `taxonomy.subgenus` = **0건**.
- `buildPlaceholderSpecies()`의 taxonomy 키 목록(line 2810~2824)에 subgenus 없음.
- `renderSpeciesDetail`의 taxSlots(line 2939~2946)에도 subgenus 없음.
- **결론**: 빈 것 / 채워진 것 모두 frontend 미참조. **전수 제거 안전**.

#### #5 eol.eats / visitsFlowersOf / pathogenOf
- `eats`, `visitsFlowersOf`: line 3149~3150에서 `Array.isArray(t.x) && t.x.length > 0` 가드 후 사용. 키 자체 제거 시 `t.x === undefined` → `Array.isArray(undefined) === false` → skip. **동작 동일**.
- `pathogenOf`: frontend grep 0건. EOL 캐시 전체 검색 코드에서도 미사용.
- 단, 실제 데이터에서도 모두 빈 배열(`taxonomy/families/poduromorpha/poduridae.json` 확인) → 키 제거해도 부족한 정보 없음.
- **결론**: 시나리오 A/B 모두 회귀 없음. **안전 제거 가능**.

#### #6 gbif.vernacularName (단수형)
- grep `vernacularName` (단수형) = **0건**.
- frontend 사용 필드는 `gbifData.vernaculars.ko` (line 3189~3192, **복수형 객체**). 별개 키.
- **결론**: 안전 제거 가능. **단 `vernaculars`(복수형)와 혼동 금지** — Round 2 경고 그대로 유효.

#### #7 inat.imageUrl 빈 값
- 사용처 7곳 모두 truthy 검사 (Round 2 라인 1659/1660/1718/1726/1730/1731/2342).
- `''` (빈 문자열)도 `undefined`도 모두 falsy → 동일 폴백 경로.
- **결론**: 시나리오 A/B 모두 회귀 없음. **키 제거 권장**.

---

### 결정적 의문 사항 (모두 검증 완료)

- **[패턴 3]** Q: openSpeciesFromIndex가 selectedOrder를 설정하는가? → **Yes** (line 2321~2328 ordersData에서 검색). 검색 경로도 selectedOrder 설정함. 다만 taxonomy.order 렌더는 ins.oKr/os로 직접 합성하므로 어차피 ktsn.order 미참조.
- **[패턴 5]** Q: enrichSpeciesWithEol의 eats/visitsFlowersOf 처리 코드 → **확인됨** (line 3149~3150). 각각 `Array.isArray && length > 0` 가드.
- **[패턴 3 추가]** Q: 딥링크 진입 경로 존재? → **없음**. `hashchange`/`popstate`/URLSearchParams 기반 species 직접 진입 핸들러 grep 0건.

---

### Fail 항목 (재현 조건)

#### Fail-1: [index.html:1710~1713, 2345~2348] Yn 3개 데이터만 제거 시 배지 의미 회귀
- **원인**: Y/N 명시 문자열은 폴백 체인의 첫 단계(`=== 'N' ? false`)에서 잡히나, 키 제거 시 `undefined`로 placeholder `null`까지 흘러감.
- **재현**: 임의 종 상세 페이지 열기 → `invasive`/`harmful`/`naturalMonument` 배지가 "해당없음"이 아닌 "데이터 없음"으로 표시.
- **권고 패치**: 폴백을 `placeholder.conservationStatus.X`(=null) 대신 `false`(boolean용) / `'해당없음'`(naturalMonument)로 변경. 또는 `buildPlaceholderSpecies()`의 초기값을 보정.

---

### 수동 테스트 필요

- **시나리오 A의 description 보강** (`enrichSpeciesWithEol`): EOL 캐시 키와 species 학명 정규화 매칭이 실제 데이터셋에서 얼마나 적중하는지는 코드 레벨로 확인 불가. 단, 데이터 정리 7개 패턴과는 무관(eats/visitsFlowersOf 빈 배열 제거는 영향 없음).
- **검색 결과의 fKr/fs 빈 문자열 케이스** (line 2353~2354): 표본 첫 종에서 `fKr=""`, `fs=""` 관측됨. `${''}.trim()` → `''`. 빈 문자열이 placeholder.taxonomy.family로 폴백되지 않는다는 점은 정적으로 명확하나, **UI에 빈 괄호 `( )` 표시될 가능성** 존재 — 이는 본 데이터 정리 범위 외 이슈이나 별도 패치 검토 필요(`.replace(/^\(\s*\)$/, '')` 등).

---

### 종합 권고 (오케스트레이터 → 사용자 plan 보고 입력)

- **즉시 안전 제거 가능 (코드 패치 불필요)**: **#1, #3, #4, #5, #6, #7**
  - #1 digitalContent: 9,994 응답 / ~2.19MB
  - #3 taxonomy.order/family 중복: 21,359종 / ~4.3MB (현재 라우팅 한정 안전. 향후 딥링크 도입 시 재검토 플래그)
  - #4 taxonomy.subgenus: 17,148 빈 + 4,211 채워진 객체 모두 미참조. 전수 제거 시 ~3.5MB+α
  - #5 eol.eats/visitsFlowersOf/pathogenOf: 2,595×3 / ~0.5MB
  - #6 gbif.vernacularName(단수): 97종 / 소량 (vernaculars 복수형과 혼동 금지)
  - #7 inat.imageUrl 빈 값: 238종 / 소량

- **코드 패치 동반 권장**: **#2 (Yn 3개)**
  - 코드 패치 위치: `project/index.html` 라인 1710~1713, 2345~2348 (혹은 2802~2808 placeholder 초기값).
  - 데이터 제거 후 폴백이 `null`(→"데이터 없음")로 빠지지 않도록 `false`/`'해당없음'`로 명시.
  - 패치 후 ~0.7MB 절감.

- **보존 권장**: 없음.

- **선결 조건 (web-developer 단계 진입 전)**:
  1. JSON 원본 백업 (`taxonomy/families/**/*.json` 전체 git 커밋 또는 별도 archive).
  2. #2 진행 시 데이터 변경과 코드 패치를 **하나의 커밋**으로 묶어 회귀 윈도우 최소화.
  3. Round 5 회귀 재검증 항목:
     - 임의 5종(분류 진입 / 검색 진입 각각)에서 6개 배지 모두 "데이터 없음" 외 라벨 표시 확인.
     - 분류 트리 7단계 모두 폴백 텍스트("데이터 준비 중") 없이 채워짐 확인.
     - `enrichSpeciesWithEol` 후 description/habitat 슬롯 정상.

### 종합 판정

**일부 Fail** — 7개 후보 중 6개는 즉시 안전 제거 가능. **#2(Yn 3개)는 코드 패치 동반 시 안전**. Critical Fail 없음.
