## 코드 리뷰 — 데이터 정리 안전성 검증

검토 대상: `project/index.html` (3,409줄, 인라인 `<script>` 포함 모든 frontend 로직)
검토 방식: 정확한 키 이름으로 grep, 사용 위치 라인 단위 추적, 추측 배제.

---

### 1. digitalContent 의존성

**grep 결과**: `digitalContent`, `dc.contents`, `dc.thumbnail`, `DigitalContent`, `digital_content` 모두 **0건**.

- 사용 위치: 없음
- 안전성: **높음 (안전)**
- 결론: index.html 어디에서도 참조되지 않음. 9,994개 응답 전수 제거 가능.

---

### 2. Yn 상수 3개

#### grep 결과 (정확한 라인)

| 키 | 라인 | 컨텍스트 |
|---|---|---|
| `hrmflSpecsYn` | **1713, 2348** | `harmful` 배지 매핑 |
| `phspYn` | **1710, 2345** | `invasive` 배지 매핑 |
| `ntmYn` | **1712, 2347** | `naturalMonument` 배지 매핑 |

#### 종 상세 6개 배지 ↔ Yn 키 전수 매핑

라인 1709~1714 (분류 브라우저 진입) 및 2344~2349 (검색 진입), 두 곳에서 **완전 동일한 매핑 사용**:

| 배지(`conservationStatus`) | 소스 키 | 라인 |
|---|---|---|
| `endangered` | `egspcsYn === 'Y' ? 'II'` | 1709 / 2344 |
| `invasive` | `phspYn === 'Y'/'N'` | **1710 / 2345** ← 제거 후보 |
| `hazardous` | `dispYn === 'Y'/'N'` | 1711 / 2346 |
| `naturalMonument` | `ntmYn === 'Y' ? '지정'` | **1712 / 2347** ← 제거 후보 |
| `harmful` | `hrmflSpecsYn === 'Y'/'N'` | **1713 / 2348** ← 제거 후보 |
| `endemic` | `korUnqBispYn` 또는 `corsynSeYn` | 1714 / 2349 |

#### 위험도 갱신

요구사항 문서의 가정("이미 멸종위기/생태계교란/한국고유는 사용중")은 **부분 오류**.
실제로는 **6개 배지 모두 Yn 키에 매핑**돼 있으며, 제거 후보 3개(`hrmflSpecsYn`, `phspYn`, `ntmYn`)는 각각 `harmful`, `invasive`, `naturalMonument` 배지의 **유일한 소스**.

다만 모든 종에서 값이 'N'이므로:
- 제거 전: 'N' → 명시적으로 `false`/`null`로 평가됨 → 배지 라벨 "해당없음"/"비지정"
- 제거 후: `undefined` → 폴백 체인이 `placeholder.conservationStatus.*`(즉 `null`) 사용 → 배지 라벨 "정보 없음"

즉 사용자 입장에서 "비지정/해당없음"이 "정보 없음"으로 바뀐다. **배지 자체는 사라지지 않지만 의미가 달라짐**.

- 안전성: **중간 (의미 회귀 가능)**
- 권고: 제거하려면 frontend 라인 1710~1713, 2345~2348의 폴백을 `null` 대신 명시적으로 `false`/`'비지정'`로 변경하는 코드 패치 동반 필요. 코드 패치 없이 데이터만 제거하면 3개 배지가 UI상 "정보 없음" 상태가 됨.

---

### 3. taxonomy.order / taxonomy.family 중복 (최중요)

#### grep 결과

| 라인 | 사용 코드 |
|---|---|
| **1687** | `const ktsn = item.taxonomy \|\| {};` |
| **1690** | `phylum: formatTaxonRank(ktsn.phylum)` |
| **1691** | `class: formatTaxonRank(ktsn.class)` |
| **1692** | `order: formatTaxonRank(ktsn.order) \|\| placeholder.taxonomy.order` |
| **1693** | `family: formatTaxonRank(ktsn.family) \|\| placeholder.taxonomy.family` |
| **1694** | `genus: formatTaxonRank(ktsn.genus) \|\| item.genus \|\| placeholder.taxonomy.genus` |
| **1696** | `species: formatSpeciesRank(ktsn.species, ktsn.genus) \|\| ...` |

#### 분석

- `formatTaxonRank` (1259~1265): `{commonName, scientificName, ktsn}` 객체에서 "한글명 (학명)" 문자열 생성. order/family도 동일 함수로 처리 중.
- 폴백 체인: `placeholder.taxonomy.order/family`는 라인 2810~2821에서 `selectedOrder`/`selectedFamily` (현재 페이지 컨텍스트)로 만들어짐.

#### 대체 가능성

- **분류 브라우저(목→과→종) 경로**: 사용자가 목 카드를 클릭해 들어왔으므로 `selectedOrder`/`selectedFamily`가 반드시 설정돼 있음. → `ktsn.order`/`ktsn.family`가 빠져도 폴백이 그대로 동작.
- **검색 진입 경로**: 라인 2351~2357에서 `ins.oKr`, `ins.os`, `ins.fKr`, `ins.fs`로 별도 생성 → `ktsn.order/family` 미사용.
- **딥링크/북마크 진입**: 페이지 컨텍스트가 없으면 폴백도 null. 다만 ENTOMA의 현재 코드는 모든 진입이 위 두 경로 중 하나.

폴백 표기 vs ktsn 표기 차이 검증 (라인 2814~2821):
```js
[selectedOrder.commonName, `(${selectedOrder.scientificName})`].filter(Boolean).join(' ')
// → "딱정벌레목 (Coleoptera)"
```
`formatTaxonRank`의 출력 `${kr} (${sci})` → "딱정벌레목 (Coleoptera)"
**표기 형식 완전 일치** (공백 위치까지 동일).

- 안전성: **중간 (조건부 안전)** — 분류 브라우저 진입 경로에서는 100% 안전. 검색 경로는 어차피 미사용. 단 deep-link 진입은 폴백 작동 안 함.
- 권고: kingdom~species 전체 중복 제거 가능. 다만 phylum/class 등 `placeholder.taxonomy`에 하드코딩된 값("절지동물문 (Arthropoda)", "곤충강 (Insecta)")이 항상 동작하므로 KTSN의 phylum/class도 함께 중복 가능성 검토 권고.

---

### 4. taxonomy.subgenus

#### grep 결과

- `subgenus`, `Subgenus`, `taxonomy.subgenus` **0건**.
- buildPlaceholderSpecies(2810~2824)의 taxonomy 객체에 `subgenus` 키 자체가 없음.

#### 안전성

- 안전성: **높음 (완전 안전)**
- 권고: 17,148개 빈 객체 전수 제거. 채워진 20% 종도 frontend가 미참조이므로 **전수 제거 권장**(저장 공간 절감 우선이면). 단 future-proof 차원에서 유지하려면 빈 객체만 제거.

---

### 5. eol.eats / eol.visitsFlowersOf / eol.pathogenOf

#### grep 결과

| 키 | 사용 라인 |
|---|---|
| `eats` | **3149**: `Array.isArray(t.eats) && t.eats.length > 0 → desc.push('먹이: ...')` |
| `visitsFlowersOf` | **3150**: `Array.isArray(t.visitsFlowersOf) && t.visitsFlowersOf.length > 0 → desc.push('방문 꽃: ...')` |
| `pathogenOf` | **0건** (검색 결과 없음) |

#### 분석

`enrichSpeciesWithEol` (3113~3170) 내부:
- `t.eats`, `t.visitsFlowersOf`는 모두 **`length > 0` 가드** 통과 후 사용 → 빈 배열은 무시됨.
- `pathogenOf`는 사용처 없음.

#### 안전성

- 안전성: **높음**
- 권고: 셋 다 빈 배열이면 키 제거해도 동작 동일 (`Array.isArray(undefined) === false`). `pathogenOf`는 어차피 미사용이라 전수 제거 가능.

---

### 6. gbif.vernacularName

#### grep 결과

- `vernacularName` (단수형) **0건**.
- `vernaculars` (복수형)는 3189, 3190에서 사용: `gbifData.vernaculars.ko[0]`. **별도 필드**.

#### 분석

`enrichSpeciesWithGbif` 내부에서 사용하는 건 `gbifData.vernaculars.ko` 배열이며, Round 1이 지목한 `vernacularName`(단수형 단일 문자열)과는 무관.

- 안전성: **높음**
- 권고: `gbif.vernacularName` (단수형, 100% 빈) 97종 전수 제거 가능. **단 `vernaculars` 객체와 혼동하지 말 것**.

---

### 7. inat.imageUrl 빈 값 238종

#### 사용 위치 (모두 라인 단위)

| 라인 | 코드 | 빈 값('') 처리 |
|---|---|---|
| **1659** | `const inatUrl = item.inat?.imageUrl \|\| null;` | falsy → null로 정상화 |
| **1660** | `if (inatUrl) { ... }` | 정상 (placeholder로 폴백) |
| **1718** | `if (item.inat?.imageUrl) return [item.inat.imageUrl];` | 정상 (다음 폴백으로) |
| **1726** | `if (item.inat?.imageUrl) { credits.push(...) }` | 정상 |
| **1730** | `url: item.inat.imageUrl` | 1726 가드 안쪽 → 빈 값이면 도달 안 함 |
| **1731** | `pageUrl: item.inat.observationUrl \|\| item.inat.imageUrl` | 1726 가드 안쪽 |
| **2342** | `item.inat?.imageUrl ? [...] : (ins.img ? ... )` | 빈 문자열은 falsy → 정상 폴백 |

#### 분석

JS의 `if (x)` / `x ? a : b` / `x || y` 패턴은 모두 빈 문자열을 falsy로 처리. **현재 코드는 빈 값을 올바르게 폴백 처리 중**. 다만:
- 의미상 키 존재 여부가 아닌 truthy 여부로 검사하므로, 빈 값을 그대로 두어도 회귀 없음.
- 키 자체를 제거해도 `item.inat?.imageUrl`는 `undefined`(falsy)로 동일 동작.

- 안전성: **높음 (둘 다 안전)**
- 권고: **키 제거 권장** — 저장 공간 절감과 스키마 가독성. 빈 값 유지도 무방하나 데이터 의미 모호.

---

### 종합 권고

| # | 패턴 | 위험도 (Round 1 → Round 2) | 권고 | 코드 패치 필요? |
|---|---|---|---|---|
| 1 | `digitalContent` 전체 제거 (9,994건) | 낮음 → **낮음** | 진행 가능 | 불필요 |
| 2 | Yn 3개 (`hrmflSpecsYn`/`phspYn`/`ntmYn`) | 검토 필요 → **중간** | 조건부 진행 | **필요** (라인 1710~1713, 2345~2348의 폴백을 `null` 대신 `false`/`'비지정'`으로) |
| 3 | `taxonomy.order/family` 중복 | 검토 필요 → **중간** | 조건부 진행 | 불필요 (분류 브라우저/검색 경로에서만 진입한다는 가정 하) |
| 4 | `taxonomy.subgenus` 빈 객체 | - → **낮음** | 진행 가능 (전수 제거 가능) | 불필요 |
| 5 | `eol.eats`/`visitsFlowersOf`/`pathogenOf` 빈/미사용 | 낮음 → **낮음** | 진행 가능 | 불필요 |
| 6 | `gbif.vernacularName` (단수형, 미사용) | 낮음 → **낮음** | 진행 가능 (`vernaculars`와 혼동 주의) | 불필요 |
| 7 | `inat.imageUrl` 빈 값 238종 | 검토 필요 → **낮음** | 키 제거 권장 | 불필요 |

### 핵심 발견

1. **#2 (Yn 3개)는 Round 1이 명시하지 않은 매핑 발견** — `harmful`/`invasive`/`naturalMonument` 배지의 유일한 소스. 데이터만 제거하면 'N'(명시적 false) → undefined(`null` 폴백)로 의미 변화. **코드 패치 동반 권장**.

2. **#3 (taxonomy 중복)의 표기 형식이 폴백과 100% 일치 확인** — `formatTaxonRank` 출력과 `selectedOrder` 폴백이 동일 포맷 "한글명 (학명)". 분류 브라우저/검색 진입 경로에서 회귀 없음.

3. **#7은 위험 없음** — 현재 코드가 빈 문자열을 falsy로 올바르게 폴백 처리 중. 키 제거/유지 모두 동작 동일.

4. **사용 안 된 키**: `digitalContent`, `taxonomy.subgenus`, `eol.pathogenOf`, `gbif.vernacularName`(단수) — 4종은 frontend 0건 참조로 완전 안전 제거 가능.

### Critical (즉시 수정 필요)
없음 (READ-ONLY 분석이므로 본 검토에서는 수정 권고만 기록).

### Warning (데이터 정리 실행 전 권장)
- [index.html:1710~1713, 2345~2348] Yn 키 3개 제거를 진행한다면, 폴백 표현을 `null`(→"정보 없음") 대신 명시적 `false`/`'비지정'`로 변경하여 UX 회귀 방지.

### Suggestion
- [index.html:1687~1696] `taxonomy.order`/`family` 중복 제거 후 phylum/class도 중복 제거 가능성 함께 검토 (placeholder의 하드코딩 값 항상 동작).
- [index.html:1731] `pageUrl: item.inat.observationUrl || item.inat.imageUrl` — 둘 다 빈 문자열이면 pageUrl이 ''. 1726 가드 안이라 도달 안 하지만, 방어적으로 `|| '#'` 추가 검토.

### 종합 평가
7개 제거 후보 중 4개(#1, #4, #5, #6, #7)는 frontend 미참조 또는 폴백 자동 처리로 즉시 안전 제거 가능. #3은 분류/검색 진입 시나리오만이라면 안전. **#2(Yn 3개)만 단순 데이터 제거가 아닌 코드 패치 동반 권장** — Round 1의 위험도 "검토 필요"는 정확했으며, 본 검증에서 매핑 위치를 8개 라인으로 특정함.
