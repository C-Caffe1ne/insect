## 요구사항

### 사용자 요청
각 곤충마다 비어있는 데이터, 중복 데이터를 **여러 차례 검토 후** JSON 파일 코드 삭제 및 최적화.

### 분류된 작업 유형
**위험한 데이터 정리** — 21,359종 곤충 데이터(42MB)에서 빈/중복 필드 제거. 사용자 강조:
> 반드시 여러번의 검토를 진행하고 코드 삭제

### 작업 파이프라인
- **Round 1 (완료)**: 자체 인벤토리 — 빈/중복 패턴 6종 식별
- **Round 2 (이 단계)**: code-reviewer가 프론트엔드 의존성 교차 검증
- **Round 3 (이 단계, 병렬)**: qa-agent가 시나리오 시뮬레이션 — 제거 시 회귀 검사
- **STOP**: 사용자 승인 대기
- **Round 4**: 승인 후 web-developer 실행 (백업 포함)
- **Round 5**: 회귀 재검증

### Round 1에서 식별된 제거 후보 (검토 대상)

| # | 패턴 | 종 수 | 절감 추정 | 위험도 |
|---|---|---|---|---|
| 1 | `digitalContent` 전체 (5,596 빈 응답 + 4,398 HTTP 500) | 9,994 | ~2.19MB | 낮음 — 실데이터 0건 |
| 2 | Yn 상수 3개 제거: `hrmflSpecsYn`, `phspYn`, `ntmYn` (모든 종 'N') | 21,359 | ~0.7MB | 검토 필요 — 프론트 사용 여부 |
| 3 | `taxonomy.order`/`taxonomy.family` 중복 (파일 헤더와 100% 일치) | 21,359 | ~4.3MB | **검토 필요** — 종 상세 페이지가 사용 |
| 4 | `taxonomy.subgenus` 80%가 완전 빈 객체 | 17,148 | ~3.5MB | 빈 것만 제거 가능 |
| 5 | `eol.eats`, `eol.visitsFlowersOf`, `eol.pathogenOf` 100% 빈 배열 | 2,595 | ~0.5MB | 낮음 |
| 6 | `gbif.vernacularName` 100% 빈 | 97 | 적음 | 낮음 |
| 7 | `inat.imageUrl` 빈 값 238종 | 238 | 적음 | 검토 필요 |

### 점검 항목 (각 에이전트)

**code-reviewer**:
- 프론트엔드(`project/index.html` 인라인 JS)가 위 7개 패턴 중 어떤 필드를 직접 참조하는지 grep
- 특히 `insect.taxonomy.order`, `insect.taxonomy.family`, `insect.digitalContent`, `insect.hrmflSpecsYn` 등
- 제거 안전성 판정 (각 패턴별 위험도 갱신)

**qa-agent**:
- 시나리오: 분류 보기 → 목 펼치기 → 과 → 종 카드 → 종 상세 페이지
- 각 화면이 표시하는 필드 추적
- 제거 시 어떤 슬롯이 빈 폴백으로 떨어질지 예측

### 산출물
- `_workspace/03_review_output.md` (code-reviewer)
- `_workspace/04_qa_output.md` (qa-agent)
- 그 후 오케스트레이터가 **plan 보고서 + 사용자 확인 요청** 작성
