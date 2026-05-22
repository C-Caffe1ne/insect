# CLAUDE.md — ENTOMA · KR (한국 곤충도감)

## 프로젝트 개요

- **목적**: 한국 곤충 분류와 종 정보를 큐레이션·탐색하는 웹 도감 (ENTOMA · KR)
- **기술**: 순수 HTML/CSS/JavaScript (프레임워크 없음)
- **데이터 규모**: 34목 / 610과 / 통합 종 JSON ~1MB
- **작업 디렉토리**: `project/` (HTML/CSS/이미지/폰트/JSON)
- **중간 산출물**: 루트 `_workspace/` (오케스트레이션용)

## 하네스: ENTOMA · KR 웹 개발 워크플로우

**목표:** `project/` 하위 HTML/CSS/JS 구현 → 코드 리뷰 → QA → 문서화 전체 자동화

**트리거:** 곤충도감 관련 웹 개발(구현, 수정, 리뷰, 테스트, 문서화) 요청 시 `web-orchestrator` 스킬을 사용하라. 단순 질문이나 1줄 수정은 직접 응답 가능.

**팀 구성:** `web-developer` · `code-reviewer` · `qa-agent` · `doc-writer` (모두 `model: "opus"`)

**참고 경로:**
- 에이전트 정의: `.claude/agents/`
- 스킬: `.claude/skills/`
- 데이터: `project/taxonomy/index.json`, `project/taxonomy/orders/`, `project/taxonomy/families/`

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-22 | 프로젝트 하네스 초기 구성 | 전체 | revfactory/harness 패턴 기반 곤충도감 도메인 적용 |
