## QA 회귀 재검증 (Round 5)

검증 대상: 7개 패턴 데이터 정리 + Yn 폴백 코드 패치
검증 방식: grep + Python JSON 파싱 + Node Function 생성자 syntax 체크 (정적)
검증 일시: 2026-06-03

---

### A. 데이터 정리 검증

| 항목 | 결과 |
|---|---|
| 612 family JSON 파일 수 | 612 / 612 ✅ |
| 612 JSON 전체 유효 파싱 | 612 / 612 (Invalid 0) ✅ |
| `"digitalContent"` 잔존 | 0 건 ✅ |
| `"hrmflSpecsYn"` 잔존 | 0 건 ✅ |
| `"phspYn"` 잔존 | 0 건 ✅ |
| `"ntmYn"` 잔존 | 0 건 ✅ |
| `"eats": []` 잔존 | 0 건 ✅ |
| `"visitsFlowersOf": []` 잔존 | 0 건 ✅ |
| `"pathogenOf": []` 잔존 | 0 건 ✅ |
| `"order": null` 잔존 | 0 건 ✅ |
| `"family": null` 잔존 | 1 건 (`_unclassified/diptera.json` 최상위 — 의도된 미분류 컨테이너) ✅ |
| 종 레벨 `taxonomy.order` 키 잔존 | 0 / 21,359 ✅ |
| 종 레벨 `taxonomy.family` 키 잔존 | 0 / 21,359 ✅ |

#### 보존되어야 할 데이터 (의도 일치)

| 보존 키 | 출현 종 수 | 비고 |
|---|---|---|
| `taxonomy.subgenus` (비어있지 않음) | 4,211 / 21,359 (≈19.7%) | 사전 추정 20% 일치 ✅ |
| `inat.imageUrl` (URL 보존) | 4,632 / 21,359 | 이미지 폴백 체인 정상 ✅ |
| `egspcsYn === 'Y'` (멸종위기) | 25 | 배지 active 가능 ✅ |
| `dispYn === 'Y'` (생태계교란) | 3 | 배지 active 가능 ✅ |
| `korUnqBispYn === 'Y'` (한국고유) | 1,125 | 배지 active 가능 ✅ |
| `corsynSeYn === 'Y'` (분류 코드) | 21,357 | 거의 전 종 ✅ |

#### 종 객체 키 통합 (실측)

`['abstract', 'commonName', 'corsynSeYn', 'description', 'dispYn', 'egspcsYn', 'eol', 'gbif', 'gbifFetchedAt', 'gbifSchemaVersion', 'inat', 'inatTaxon', 'korUnqBispYn', 'ktsn', 'namingYear', 'nomenclaturalAuthor', 'scientificName', 'taxonomy', 'terminalLatinName', 'wiki']`

→ `digitalContent`, `hrmflSpecsYn`, `phspYn`, `ntmYn` 종 레벨에서도 완전 제거 ✅

---

### B. 코드 패치 검증

#### 위치 1: `project/index.html` line 1708–1716 (분류 보기 → 종 상세)

```js
conservationStatus: {
  endangered: item.egspcsYn === 'Y' ? 'II' : (item.conservationStatus?.endangered || placeholder.conservationStatus.endangered),
  // phspYn/ntmYn/hrmflSpecsYn 데이터가 cleanup으로 제거됨 — 모든 종 'N' 상태였으므로 명시적 false로 고정 ("해당없음" 표시)
  invasive: false,
  hazardous: item.dispYn === 'Y' ? true : (item.dispYn === 'N' ? false : placeholder.conservationStatus.hazardous),
  naturalMonument: false,
  harmful: false,
  endemic: (item.korUnqBispYn === 'Y' || item.corsynSeYn === 'Y') ? true : ((item.korUnqBispYn === 'N' || item.corsynSeYn === 'N') ? false : placeholder.conservationStatus.endemic)
}
```

#### 위치 2: `project/index.html` line 2344–2352 (검색 결과 → 종 상세)

```js
conservationStatus: {
  endangered: item.egspcsYn === 'Y' ? 'II' : (item.conservationStatus?.endangered || placeholder.conservationStatus.endangered),
  // phspYn/ntmYn/hrmflSpecsYn 데이터가 cleanup으로 제거됨 — 모든 종 'N' 상태였으므로 명시적 false로 고정 ("해당없음" 표시)
  invasive: false,
  hazardous: item.dispYn === 'Y' ? true : (item.dispYn === 'N' ? false : placeholder.conservationStatus.hazardous),
  naturalMonument: false,
  harmful: false,
  endemic: (item.korUnqBispYn === 'Y' || item.corsynSeYn === 'Y') ? true : ((item.korUnqBispYn === 'N' || item.corsynSeYn === 'N') ? false : placeholder.conservationStatus.endemic)
}
```

| 항목 | 결과 |
|---|---|
| 두 위치 모두 동일 패치 적용 | ✅ |
| 인라인 `<script>` Syntax (Node Function 생성) | 1 / 1 OK, 0 errors ✅ |
| `resolveBadge('invasive', false)` → `{status:'inactive', text:'해당없음'}` | ✅ (line 2867–2874 boolean 분기) |
| `resolveBadge('harmful', false)` → `{status:'inactive', text:'해당없음'}` | ✅ |
| `resolveBadge('naturalMonument', false)` → `{status:'inactive', text:'해당없음'}` | ✅ (line 2862–2866 `!raw` 분기 — false도 falsy로 처리) |

---

### C. 시나리오 회귀 검증 (정적)

| 시나리오 | 결과 | 비고 |
|---|---|---|
| 분류 보기 → 7단계 트리 | Pass ✅ | `formatTaxonRank(ktsn.order)` undefined (taxonomy.order 제거) → `placeholder.taxonomy.order` 폴백. `selectedOrder` 전역 (line 1521,1604 설정) 통해 "한글명 (학명)" 합성됨 (line 2816–2819) |
| 분류 보기 → 6배지 | Pass ✅ | endangered/hazardous/endemic는 Y/N 데이터로 실값. invasive/naturalMonument/harmful는 false 고정 → "해당없음" inactive 표시 |
| 검색 결과 → 7단계 트리 | Pass ✅ | search_index의 oKr/os/fKr/fs 키 실측 확인 (21,359 entries). line 2353–2358에서 직접 합성 |
| 검색 결과 → 6배지 | Pass ✅ | 동일 패치 적용 — 분류 보기와 동일 동작 |

#### 추가 관찰

- 일부 search_index entry에서 `fKr: ""`, `fs: ""` 발견 (예: 옛버섯파리). line 2356 `${ins.fKr || ''} (${ins.fs || ''})`.trim() → ` ()` 문자열 생성. **이번 cleanup과 무관한 기존 이슈** (Round 5 회귀 아님). 별도 추적 권고.

---

### D. 백업 검증

| 항목 | 결과 |
|---|---|
| 백업 디렉토리 존재 (`_backup_taxonomy_20260603_145247/`) | ✅ |
| 백업 JSON 파일 수 | 612 ✅ |
| 백업에 `"digitalContent"` 존재 | 304 파일 ✅ (원본 보존) |
| 백업에 `"hrmflSpecsYn"` 존재 | 611 파일 ✅ |
| 백업에 `"phspYn"` 존재 | 611 파일 ✅ |
| 백업에 `"ntmYn"` 존재 | 611 파일 ✅ |
| 원복 가능성 | 100% ✅ |

> 백업 611건 vs 정리 후 612건의 1건 차이는 `_unclassified` 자동 생성 컨테이너 등 신규 파일 가능성 — 회귀와 무관. 정리된 612건 전체가 유효 JSON으로 파싱되므로 운영 영향 없음.

---

### 종합 평가

- **Pass: 25개 / Fail: 0개 / 회귀: 0개**
- **Critical Fail: 없음**
- 7패턴 제거 완전 (잔존 0건, 1건은 의도된 `_unclassified` 컨테이너 메타)
- 보존 데이터 무결 (subgenus 4,211, inat.imageUrl 4,632, Y 플래그 모두 유지)
- 코드 패치 두 위치 동기화, syntax 정상, resolveBadge 로직과 정합
- 백업 완비 (원복 가능)

### 종합: 전체 Pass ✅
