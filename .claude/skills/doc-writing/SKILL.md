---
name: doc-writing
description: ENTOMA · KR 곤충도감 README 작성, taxonomy JSON 스키마 문서화, 코드 주석. "README 만들어줘", "문서 작성", "주석 달아줘", "사용법 설명" 등 문서 작성 요청 시 반드시 이 스킬을 사용. 코드 작성이나 코드 설명 질문에는 해당하지 않음.
---

# 문서 작성 가이드 — ENTOMA · KR

## 원칙

**실제 코드/데이터 기반 작성**: 파일을 직접 Read하고 문서를 작성한다. 없는 파일·필드를 언급하지 않는다.

**주석 최소화**: "왜"가 불명확할 때만 추가.

## README 표준 구조 (이 프로젝트용)

```markdown
# ENTOMA · KR — 한국 곤충도감

> 한 줄 설명 (큐레이션 + 분류 브라우저)

## 소개
[2-3문장]

## 실행 방법
`project/index.html`을 브라우저로 엽니다.
JSON을 fetch하므로 로컬 정적 서버 권장: `python3 -m http.server`

## 기능
- **Discover**: 큐레이션 테마 카드
- **Taxonomy**: 목 → 과 → 종 계층 탐색
- **검색**: 학명/한글명 동시 검색

## 데이터
- `project/korea_insect_species_by_family.json` — 통합 종 데이터
- `project/taxonomy/index.json` — 34목 메타
- `project/taxonomy/orders/{order-id}.json` — 목별 과 목록
- `project/taxonomy/families/{order-id}/{family-id}.json` — 과별 종 목록

## 파일 구조
[실제 ls 결과 기반 tree]

## 사용 기술
- HTML5 / CSS3 (CSS 변수, 반응형)
- JavaScript (ES6+ 바닐라)
- 폰트: LINE Seed KR, Cormorant Garamond, Inter
```

파일 구조 섹션은 `ls`/`find`로 확인하고 작성.

## taxonomy JSON 스키마 문서화

실제 JSON을 Read하고 표로 정리한다:

```markdown
### order 객체 (taxonomy/index.json)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | string | 영문 ID (예: "coleoptera") |
| scientificName | string | 학명 (예: "Coleoptera") |
| commonName | string | 한글명 (예: "딱정벌레목") |
| familyCount | number | 포함된 과 수 |
| recordCount | number | 종 레코드 수 |
| file | string | 상세 경로 (예: "orders/coleoptera.json") |
```

추정 시 "(추정)" 명시.

## 코드 주석 판단

**주석 필요 (왜가 불명확)**:
```javascript
// keydown 핸들러를 named function으로 분리해야
// removeEventListener로 나중에 제거 가능
function handleEscape(e) { ... }
```

**주석 불필요 (이름이 설명)**:
```javascript
function openModal() { ... }  // 주석 없음
```

## 한국어 문서 작성 기준
- 전문 용어 한국어 + 영어 병기: "이벤트 리스너(Event Listener)"
- 학명: 이탤릭 또는 `*Genus species*`
- 명령형: "열려면", "클릭하면", "입력하세요"
- 날짜: YYYY년 MM월 DD일

## 자주 문서화할 패턴

### 모달 다이얼로그
```markdown
### 종 상세 모달
- **열기**: 종 카드 클릭
- **닫기**: × 버튼, ESC, 배경 클릭
- **접근성**: `role="dialog"`, `aria-modal="true"`
```

### 검색
```markdown
### 검색
- 학명 또는 한글명 입력 시 실시간 필터링
- 빈 입력 시 전체 표시
```
