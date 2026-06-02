## 요구사항

### 사용자 요청
1. 곤충 설명에 'GBIF 관측 기록' 적힌 텍스트를 모두 제거
2. cached 폴더에서 API 관련 스크립트 파일은 보존, 나머지 파일 정리
3. 데이터 없이 비어있는 코드 제거
4. 하네스를 이용해 신중하게 검토 후 작업
5. **코드 제거 전 다시 확인 후 제거** ← Critical

### 분류된 작업 유형
**검토 + 위험한 삭제** — 파괴적 작업이므로 사용자 확인 단계 필수

### 작업 흐름 (정상 파이프라인과 다름)
1. **Phase 2 (코드 리뷰 + QA, 병렬, READ-ONLY)** — 어떤 코드/파일을 제거할지 인벤토리만 작성
2. **STOP** — 오케스트레이터가 사용자에게 명확한 plan 제시 + 확인 요청
3. **사용자 확인 후에만** web-developer가 실제 삭제 실행
4. **Phase 5** — 삭제 후 종합 보고 (재검증 포함)

### 관련 파일 / 디렉토리
- `project/index.html` (1.5MB+, 2,200+ 줄) — JS의 enrichSpeciesWithEol 등에서 'GBIF 관측 기록' 텍스트 합성
- `project/style.css` — 미사용 클래스/규칙 후보
- `cached/` — 25+ 파일 (스크립트·JSON·로그)

### 작업 범위
- **READ-ONLY 인벤토리 (Phase 2)**:
  - code-reviewer: project/ 내 'GBIF 관측 기록' 텍스트 정확한 위치(파일:라인) + 사용 맥락
  - code-reviewer: project/ 내 빈/사용 안 됨 코드 (functions, CSS rules, HTML 요소) 후보 목록
  - qa-agent: cached/ 디렉토리 모든 파일을 분류 — API 스크립트(.mjs/.js/.py로 fetch/cache 수행) vs 데이터 JSON/log/기타
  - qa-agent: cached/의 JSON 파일들이 다른 스크립트의 입력으로 참조되는지(의존성) 확인
  
- **계획 보고 (STOP 지점)**: 무엇을 지울지 + 무엇을 건드리지 말지를 사용자에게 명확히 제시

- **삭제 실행 (사용자 OK 후만)**:
  - 'GBIF 관측 기록' 텍스트 제거
  - cached/ 정리
  - 빈 코드 제거

### 위험 요소
- `project/eol_species_cache.json`과 같이 frontend가 fetch 하는 파일이 cached/에서 복사된 것일 수 있음 — 의존 관계 확인 필수
- search_index.json 등 빌드 산출물의 입력이 되는 JSON은 보존 필요
- "API 스크립트"의 정의 — fetch_*.mjs, cache_*.mjs, process_*.mjs는 명백히 API 관련. 그 외 merge_*, extract_* 등은 사용자 판단 필요

### 보고 양식
- `_workspace/03_review_output.md` (code-reviewer): 'GBIF 관측 기록' 위치 + 빈 코드 후보
- `_workspace/04_qa_output.md` (qa-agent): cached/ 파일 분류 + 의존성
- 오케스트레이터: **사용자 확인용 plan 문서** 작성 + 답변 대기
