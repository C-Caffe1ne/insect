## 데이터 정리 완료

### Step 1: 백업
- 백업 디렉토리: `_backup_taxonomy_20260603_145247/`
- 612 JSON 파일 보존 (43 MB)
- 검증 명령: `find _backup_taxonomy_20260603_145247 -name "*.json" | wc -l` → 612

### Step 2: 데이터 정리 결과
- 처리 파일: 611/612 (1개는 `families/index.json` 메타파일로 skip — 정상)
- 처리 곤충: 21,359종 (요구사항 명시 수치와 일치)

#### 패턴별 적용 횟수

| # | 패턴 | 적용 횟수 |
|---|---|---|
| 1 | `digitalContent` 제거 | 9,994종 |
| 2 | `hrmflSpecsYn` 제거 | 21,359종 |
| 2 | `phspYn` 제거 | 21,359종 |
| 2 | `ntmYn` 제거 | 21,359종 |
| 3 | `taxonomy.order` 제거 | 21,359종 |
| 3 | `taxonomy.family` 제거 | 21,359종 |
| 4 | `taxonomy.subgenus` 빈 객체 제거 | 17,148종 |
| 5 | `eol.eats` 빈 배열 제거 | 2,595종 |
| 5 | `eol.visitsFlowersOf` 빈 배열 제거 | 2,595종 |
| 5 | `eol.pathogenOf` 빈 배열 제거 | 2,595종 |
| 6 | `gbif.vernacularName` 빈/falsy 제거 | 97종 |
| 7 | `inat.imageUrl` 빈 문자열 제거 | 238종 |

### Step 3: 사이즈 변화
- 이전: 42.00 MB
- 이후: 28.27 MB
- 절감: **13.73 MB (32.70%)**
- du 기준 디렉토리: 43M → 29M

### Step 4: 코드 패치
패치 위치 두 곳 모두 `placeholder.conservationStatus.X` 폴백 체인을 명시적 상수로 교체.

- **project/index.html line 1710~1714** (renderSpeciesSorted → openDetail 진입)
  - `invasive: false` (← `phspYn` 폴백 체인)
  - `naturalMonument: false` (← `ntmYn` 폴백 체인, `null` 대신 `false`로 — "데이터 없음" 회귀 방지, "해당없음" 표시 유지)
  - `harmful: false` (← `hrmflSpecsYn` 폴백 체인)
- **project/index.html line 2346~2350** (openSpeciesFromIndex → 검색 진입)
  - 동일 3개 패치

#### naturalMonument를 `null`이 아닌 `false`로 고정한 이유
QA 보고서(`_workspace/04_qa_output.md` line 99) 회귀 분석에서 발견: `resolveBadge('naturalMonument', null)` → line 2851 unknown 분기 → "데이터 없음" 표시. 반면 `false`는 line 2864의 `!raw` 분기를 타서 "해당없음" 표시. 기존 'N' 데이터일 때와 동일 라벨을 유지하려면 `false`가 정답.

### Step 5: 검증
- [x] 612 JSON 모두 유효 파싱 (OK: 612, FAIL: 0)
- [x] `digitalContent` 잔존 0건
- [x] `hrmflSpecsYn` 잔존 0건
- [x] `phspYn` 잔존 0건
- [x] `ntmYn` 잔존 0건
- [x] `taxonomy.order` 키 잔존 0건
- [x] `taxonomy.family` 키 잔존 0건
- [x] `taxonomy.subgenus` 빈 객체 잔존 0건
- [x] `gbif.vernacularName` 빈/falsy 잔존 0건
- [x] `inat.imageUrl` 빈 문자열 잔존 0건
- [x] `eol.eats`/`visitsFlowersOf`/`pathogenOf` 빈 배열 잔존 0건
- [x] `project/index.html` 인라인 script 1개 파싱 OK

### 생성/수정된 파일
- **신규**: `cached/cleanup_empty_duplicate.mjs` — 7개 패턴 1-pass cleanup 스크립트
- **수정**: `project/index.html` 두 위치 (line 1710~1714, 2346~2350) — Yn 3개 폴백 패치
- **수정**: `project/taxonomy/families/**/*.json` 611개 — 데이터 정리 적용
- **백업**: `_backup_taxonomy_20260603_145247/` — 612 JSON 보존

### 데이터 바인딩 (변경 후 매핑)
- 종 상세 6배지(`conservationStatus`) 중 3개(`invasive`/`naturalMonument`/`harmful`)는 더 이상 JSON에서 읽지 않고 코드 상수 `false`. `resolveBadge` 거쳐 "해당없음" 라벨 유지.
- 분류 트리의 `taxOrder`/`taxFamily` 슬롯은 이제 무조건 `placeholder.taxonomy.order`/`family`(= `selectedOrder`/`selectedFamily` 기반) 폴백 사용. 표기 포맷 "한글명 (학명)"은 기존과 동일.
- 검색 경로(line 2353~2354)는 `ins.oKr`/`ins.os`/`ins.fKr`/`ins.fs`로 합성 — `taxonomy.order`/`family` 제거 영향 없음.

### 주요 설계 결정
1. **`naturalMonument` 폴백은 `false` (not `null`)**: QA가 명시한 회귀 시나리오 — `null`이면 `resolveBadge`가 "데이터 없음" 표시. 기존 'N' 상태와 동일 라벨("해당없음") 유지하려면 `false`.
2. **`taxonomy.subgenus`는 빈 객체만 제거** (요구사항 #4 권고 채택). 채워진 4,211개 객체는 보존. code-reviewer가 "전수 제거도 안전" 판정했으나 future-proof 차원에서 빈 것만 제거.
3. **`index.html` 분류/검색 두 경로 동일 패치**: 같은 의미여야 일관성 유지.
4. **스크립트가 `families/index.json`을 자동 skip**: 메타 인덱스는 `insects` 배열이 없어 `if (!Array.isArray(data.insects))` 가드에서 건너뜀.
5. **JSON 출력 시 `JSON.stringify(..., null, 2) + '\n'`**: 기존 포맷(2-space, trailing newline) 유지로 diff 노이즈 최소화.
6. **스크립트 idempotent**: `in` 검사 + Array.isArray + length 가드로 재실행해도 부작용 없음.

### code-reviewer 확인 요청 사항
- **#3 (taxonomy.order/family 제거) 회귀 검증**: code-reviewer가 "분류 브라우저 + 검색 경로 한정 안전" 판정 (`_workspace/03_review_output.md` line 90). 딥링크 진입 없음 확인. 실제 종 상세 페이지에서 phylum~species 슬롯 표기가 폴백과 시각적 동일한지 QA 회귀 재검증 권고.
- **`naturalMonument: false` 선택 적절성**: `null`/`false`/`'해당없음'` 3안 중 `false` 선택. QA의 line 100 권고 중 `false` 채택 근거 — `resolveBadge`의 line 2864 `!raw` 분기로 동일 "해당없음" 표시 가능.
- **나머지 폴백 미변경**: `endangered`/`hazardous`/`endemic`은 데이터 정리 대상 아니므로 기존 폴백 체인 유지. 일관성 vs 안전성 트레이드오프 확인 부탁.
- **cleanup 스크립트 재실행 안전성**: 의도적으로 idempotent. 재실행 시 카운터는 0이 되며 파일 변경 없음.

### 다음 단계 (Round 5 회귀 재검증)
QA 권고 (`_workspace/04_qa_output.md` line 180~183) 회귀 항목:
1. 임의 5종(분류 진입 / 검색 진입 각각)에서 6개 배지 모두 "데이터 없음" 외 라벨 표시 확인
2. 분류 트리 7단계 모두 폴백 텍스트("데이터 준비 중") 없이 채워짐 확인
3. `enrichSpeciesWithEol` 후 description/habitat 슬롯 정상
