## 핸드오프 — 즐겨찾기·최근 본 곤충 스와이프 뒤로가기

### 요청
"즐겨찾기, 최근 본 곤충 페이지에서 화면 넘겨서 뒤로가기 가능하게 해줘"
→ `#pageSaved`(즐겨찾기), `#pageRecent`(최근 본 곤충)에 iOS 엣지 스와이프 뒤로가기 제스처 추가.

### 상태: 구현·리뷰·QA 완료, 커밋됨. CLAUDE.md 변경 이력 표 갱신만 보류.

### 완료된 것

1. **구현 완료 & 커밋됨** — `project/index.html` 4곳 수정 (커밋 `e21861d`/`5e16f8c`에 포함, HEAD 기준 `git status` clean):
   - `PAGE_HASHES`에 `pageSaved:'saved'`, `pageRecent:'recent'` 추가 (~1685-1686행)
   - `_syncNativeSwipeGesture`의 `enabled` 조건에 `pageSaved`/`pageRecent` 추가 (~1702-1703행)
   - `profileSavedViewAll`/`profileRecentViewAll` 진입 핸들러 `showPage()` 호출에 `keepNav: true` 추가 (~1930·1942행)
   - `savedBackBtn`/`recentBackBtn` 뒤로가기 버튼을 `history.back()` 호출로 교체 (~1923·1935행)
   - Swift·CSS 변경 없음 (기존 `EntomaSwipeNav`/`SwipeBackController` 브릿지가 페이지에 종속되지 않는 범용 구현이라 재사용).

2. **code-reviewer 리뷰: Critical 0 / Warning 0.** Suggestion 2건은 모두 이번 변경 범위 밖(기존 코드의 기존 패턴)이라 조치 불필요. 상세: `_workspace/03_review_output.md`.

3. **qa-agent 검증: 전체 Pass.** 셀렉터 정합성, 히스토리 push/pop 흐름(즐겨찾기·최근 본 곤충 각각 단독 왕복 + 종 상세로 더 들어갔다 나오는 왕복), `SWIPE_BACK_BLOCKED_PAGES` 비오염, family/species 기존 스와이프 백 회귀 없음 모두 확인. 실기기/시뮬레이터에서의 실제 제스처 감각만 미검증(코드 레벨에서는 검증 불가 영역). 상세: `_workspace/04_qa_output.md`.

4. **문서 초안 작성됨.** `_workspace/05_doc_output.md`에 CLAUDE.md "변경 이력" 표에 추가할 행과 4곳 수정 상세 설명 정리됨.

### 보류 중인 것 (다음 세션이 이어받아야 할 부분)

- **CLAUDE.md "변경 이력" 표에 이번 작업 행을 추가하는 `Edit`를 시도했으나 사용자가 명시적으로 중단시킴** ("사용자가 지금 이 작업을 원하지 않습니다" → "STOP … wait for the user to tell you how to proceed"). 영구 거부인지 "지금 타이밍이 아니다"인지는 불명확 — **다시 시도하기 전에 반드시 사용자에게 먼저 확인할 것.** 추가하려던 행 내용은 `_workspace/05_doc_output.md` 15-19행에 이미 정리되어 있음(그대로 재사용 가능).
- 그 외 남은 작업 없음 — 코드 변경 자체는 완결되어 커밋까지 끝난 상태.

### 참고
- `_workspace_prev/`에는 이전 작업(`#pageRecent` 서브페이지 신설) 파이프라인 산출물이 아카이브되어 있음 — 이번 작업과 무관.
- 워크플로우: `web-orchestrator` 스킬 사용 (`.claude/skills/web-orchestrator`), 팀: web-developer → code-reviewer + doc-writer(병렬) → qa-agent.
