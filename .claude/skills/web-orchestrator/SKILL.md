---
name: web-orchestrator
description: ENTOMA · KR 곤충도감 웹 개발 전체 워크플로우 자동화. project/ 하위 HTML/CSS/JS 구현 → 코드 리뷰 → QA → 문서화까지 web-developer, code-reviewer, qa-agent, doc-writer 팀이 협업. "곤충도감 기능 추가", "분류 페이지 만들어줘", "검색 추가", "이 페이지 만들어줘", "다시 실행", "재실행", "업데이트", "수정", "이전 결과 개선" 등 웹 개발 전체 흐름 요청 시 반드시 이 스킬을 사용. 단순 질문이나 1줄 수정은 직접 응답 가능.
---

# 웹 개발 오케스트레이터 — ENTOMA · KR

**실행 모드:** 에이전트 팀 (기본)
**팀 구성:** web-developer, code-reviewer, qa-agent, doc-writer
**패턴:** 파이프라인 + 팬아웃 하이브리드 (구현 → 리뷰·문서화 병렬 → QA → 종합)
**작업 디렉토리:** `project/` (HTML/CSS/JS), 루트 `_workspace/` (중간 산출물)

---

## Phase 0: 컨텍스트 확인

시작 전 기존 산출물 확인:

```
_workspace/ 없음
  → 초기 실행: Phase 1부터 전체 실행

_workspace/ 있음 + 부분 수정 요청 ("리뷰만 다시", "QA만 재실행")
  → 부분 재실행: 해당 Phase 에이전트만 재호출

_workspace/ 있음 + 새 요구사항
  → 새 실행: _workspace/ 를 _workspace_prev/ 로 이동 후 전체 실행
```

## Phase 1: 요구사항 분석

1. 요청 유형 분류:
   - **신규 구현**: 새 컴포넌트/페이지 (예: 종 상세 모달)
   - **기능 추가**: 기존 화면 확장 (예: 분류 필터 추가)
   - **버그 수정**: 특정 동작 오류
   - **전체 검토**: 기존 코드 리뷰 + QA만

2. 관련 파일 파악:
   - `project/index.html` (1368줄), `project/style.css` (1807줄)
   - 데이터: `project/taxonomy/index.json`, `orders/*.json`, `families/**/*.json`
   - 신규 JS가 필요한지 판단(현재 인라인 스크립트 없음)

3. 작업 범위:
   - 신규/기능 추가 → 4개 에이전트 전체
   - 리뷰만 → code-reviewer + qa-agent
   - 문서만 → doc-writer

4. `_workspace/01_requirements.md` 저장:
```markdown
## 요구사항

### 사용자 요청
[원문]

### 분류된 작업 유형
[신규 구현 / 기능 추가 / 버그 수정 / 전체 검토]

### 관련 파일
[파일 목록 — project/ 하위]

### 데이터 의존성
[사용할 taxonomy JSON 경로 + 필요 필드]

### 참고 사항
[디자인·접근성·한글 표기 등 고려 사항]
```

## Phase 2: 팀 구성 및 구현

- TeamCreate: `[web-developer, code-reviewer, qa-agent, doc-writer]`
- 각 에이전트에게 TaskCreate로 작업 할당

**web-developer 에이전트 지시:**
- `_workspace/01_requirements.md` Read
- `project/` 하위 실제 파일 Read 후 구현
- taxonomy JSON을 사용할 경우 실제 스키마를 먼저 확인
- `_workspace/02_developer_output.md` 작성
- 완료 후 `code-reviewer`에게 SendMessage: "구현 완료. _workspace/02_developer_output.md 참조, 리뷰 요청"
- Agent 호출 시 `model: "opus"`

## Phase 3: 병렬 — 코드 리뷰 + 문서화

구현 완료 신호 수신 후 `code-reviewer`와 `doc-writer`를 병렬 실행.

**code-reviewer 지시:**
- 변경된 `project/` 파일 + `_workspace/02_developer_output.md` Read
- Critical/Warning/Suggestion 등급으로 분류
- `_workspace/03_review_output.md` 작성
- 완료 후 오케스트레이터에게 SendMessage: "리뷰 완료. Critical [N]개"
- `model: "opus"`

**doc-writer 지시 (병렬):**
- `project/` 파일 + `_workspace/02_developer_output.md` Read
- README.md 생성/갱신 — 데이터 스키마 섹션은 실제 JSON Read 후 작성
- `_workspace/05_doc_output.md` 작성
- 완료 후 오케스트레이터에게 SendMessage: "문서화 완료"
- `model: "opus"`

## Phase 4: QA 검증

코드 리뷰 완료 후 `qa-agent` 실행.

**qa-agent 지시:**
- 변경된 `project/` 파일 + `_workspace/03_review_output.md` Read
- **2종 경계면 교차 비교** 실행:
  1. JS 셀렉터 ↔ HTML 요소
  2. JS 데이터 접근 ↔ taxonomy JSON 스키마
- `_workspace/04_qa_output.md` 작성
- 완료 후 오케스트레이터에게 SendMessage: "QA 완료: Pass [N]개 / Fail [N]개"
- `model: "opus"`

**QA Fail 처리:**
- Critical Fail → `web-developer` 재작업 (최대 2회 반복)
- Warning/Suggestion → 결과 명시 후 Phase 5

## Phase 5: 최종 종합 보고

```markdown
## ENTOMA · KR 작업 완료 보고

### 구현된 내용
[02_developer_output.md 요약]

### 코드 리뷰
- Critical: [N]개 [있으면 목록]
- Warning: [N]개

### QA 결과
- Pass: [N]개 / Fail: [N]개
[Fail 있으면 목록]

### 문서화
[README.md 생성/갱신 요약]

### 생성/수정된 파일
- [파일명]: [경로]
```

---

## 에러 핸들링

| 상황 | 처리 방법 |
|------|----------|
| 에이전트 작업 실패 | 1회 재시도, 재실패 시 "미완료" 표시 후 진행 |
| QA Critical Fail | web-developer 재작업 요청 (최대 2회 반복) |
| 파일 읽기 실패 | 새 파일 시작 + 보고에 명시 |
| 상충하는 리뷰/QA | 양쪽 결과 보존 + 사용자에게 판단 요청 |
| taxonomy JSON 스키마 불일치 | qa-agent가 Critical Fail로 보고 → web-developer 재작업 |

---

## 데이터 흐름

```
사용자 요청
    ↓
_workspace/01_requirements.md
    ↓
web-developer → project/* 파일 + _workspace/02_developer_output.md
    ↓ (병렬)
code-reviewer → _workspace/03_review_output.md
doc-writer    → README.md + _workspace/05_doc_output.md
    ↓
qa-agent → _workspace/04_qa_output.md
    ↓
최종 보고
```

---

## 테스트 시나리오

### 정상 흐름 — "종 상세 모달 만들어줘"
1. 사용자 요청 분류: 신규 구현
2. web-developer: `project/index.html`에 다이얼로그 마크업 추가, `project/style.css`에 스타일, 인라인 `<script>` 또는 신규 `script.js` 생성
3. code-reviewer + doc-writer 병렬
4. qa-agent: `.species-card` 클릭 → `openSpeciesModal()` 연결 확인, JSON `commonName`/`scientificName` 필드 접근 검증
5. 종합 보고

### QA Fail 흐름 — JSON 필드 오접근
1. qa-agent: JS가 `species.koreanName`을 읽지만 JSON 실제 필드는 `commonName`
2. 오케스트레이터: web-developer 재작업 요청
3. web-developer: 필드명 수정
4. qa-agent 재검증 → Pass
5. 종합 보고
