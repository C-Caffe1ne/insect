---
name: qa
description: ENTOMA · KR 곤충도감 기능 검증 및 QA. HTML 셀렉터와 JS querySelector 교차 비교, taxonomy JSON 스키마와 렌더링 코드 필드 정합성 검증, 버튼/탭/모달 동작 추적, 경계값 테스트. "테스트해줘", "검증", "QA", "동작 확인" 등 요청 시 반드시 이 스킬을 사용. 코드 작성이나 리뷰 요청에는 해당하지 않음.
---

# QA 가이드 — ENTOMA · KR

## 핵심 원칙: 경계면 교차 비교

**나쁜 QA**: "버튼이 존재한다" ✓ — 단순 존재 확인
**좋은 QA**: HTML의 `.species-card`와 JS의 `openSpeciesModal()` 이벤트 리스너가 실제로 연결되어 있는가 — 두 파일을 동시에 읽고 연결 검증

곤충도감은 추가로 **JS ↔ taxonomy JSON 스키마** 경계면을 가진다.

## 검증 절차

### Step 1: DOM 셀렉터 ↔ HTML 교차

JS에서 모든 DOM 접근 추출:
```
querySelector('.class')
getElementById('id')
querySelectorAll('[data-attr]')
```

각 셀렉터에 대해 HTML에 매칭 요소가 있는지 확인.
미매칭 → **Fail: 연결 끊김**

### Step 2: JSON 스키마 ↔ 렌더링 코드 교차

`taxonomy/index.json`, `orders/*.json`, `families/**/*.json`을 Read하여 실제 필드 구조 확인.
JS 코드가 접근하는 필드(`species.commonName`, `order.familyCount` 등)가 JSON에 실제 존재하는지 확인.

미존재 → **Fail: 스키마 불일치**

### Step 3: 이벤트 흐름 추적

```
[HTML 요소] → [JS 리스너] → [핸들러] → [DOM/상태 변경]
```

- 검색 input → input/change 이벤트 → 필터링 함수 → 카드 그리드 갱신
- 탭 버튼 클릭 → active 클래스 토글 → 패널 전환
- 카드 클릭 → 모달 open → 종 상세 표시
- 모달 close: ×, ESC, 백드롭 클릭 모두 동작?

### Step 4: CSS 클래스 ↔ 사용처 검증

JS가 `classList.add('active')` 추가하는 클래스가 CSS에 정의되어 있는가.
CSS에 정의된 클래스가 HTML 또는 JS에서 사용되는가 (미사용 탐지).

### Step 5: 경계값 테스트

- **빈 검색어**: 전체 표시? 빈 결과?
- **매우 긴 학명**: 카드 레이아웃 깨지는가
- **JSON 로드 실패**: 사용자가 보는 fallback이 있는가
- **누락 필드**: `species.commonName`이 없는 항목 처리
- **0건 결과**: 빈 상태 메시지 표시

### Step 6: 접근성 연결

- `aria-labelledby="title-id"` → HTML에 `id="title-id"` 존재
- `aria-controls="panel-id"` → 패널 존재
- 모달 열릴 때 포커스 이동, 닫힐 때 트리거로 복귀

## 결과 보고 형식

```markdown
## QA 검증 결과

### Pass ✅
- [기능명]: 어떻게 검증했고 통과했는지

### Fail ❌
- [파일:라인] 문제: 설명
  원인: 끊긴 이유
  재현: 어떤 상황에서

### 수동 테스트 필요
- [항목]: 코드 레벨로 부족한 이유

### 종합: [전체 Pass / 일부 Fail / Critical Fail]
```
