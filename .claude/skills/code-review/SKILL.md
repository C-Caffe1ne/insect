---
name: code-review
description: ENTOMA · KR 곤충도감 코드 리뷰. project/ 하위 HTML/CSS/JS의 버그·XSS·접근성·이벤트 리스너 누수·taxonomy 데이터 바인딩 오류 탐지. "코드 검토", "리뷰해줘", "버그 찾아줘", "코드 품질 확인" 등 요청 시 반드시 이 스킬을 사용. 단순 문법 설명이나 코드 작성 요청에는 해당하지 않음.
---

# 코드 리뷰 가이드 — ENTOMA · KR

## 검토 순서

심각도 순으로 검토: Critical → Warning → Suggestion

### Critical (반드시 수정)

**XSS 취약점**
```javascript
// 위험 (정적 데이터라도)
element.innerHTML = species.commonName;
// 안전
element.textContent = species.commonName;
```

**접근성 누락**
- 폼 `<label>`/`<input>` 미연결
- 이미지 `alt` 누락 (장식이면 `alt=""`)
- 다이얼로그 `aria-modal`, `aria-labelledby` 누락

**이벤트 리스너 누수**
```javascript
// 위험 — 열 때마다 누적
document.addEventListener('keydown', (e) => closeModal(e));
// 안전 — named function
document.addEventListener('keydown', handleEscape);
```

**null 에러**
```javascript
// 위험
document.querySelector('.species-card').addEventListener('click', fn);
// 안전
const card = document.querySelector('.species-card');
if (card) card.addEventListener('click', fn);
```

**fetch 에러 미처리**
```javascript
// 위험 - 실패하면 빈 화면
const data = await (await fetch('taxonomy/index.json')).json();
// 안전
try {
  const res = await fetch('taxonomy/index.json');
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
} catch (err) { /* fallback */ }
```

### Warning (권장 수정)
- `var` → `const`/`let` 교체
- 정적 인라인 스타일(`style=""`) 남용
- 무의미한 `<div>` 3단계 이상 중첩
- `!important` 남용
- 하드코딩 색·간격 반복 → CSS 변수
- 큰 JSON(1MB+) 한 번에 로드 → 지연/청크 로드 검토
- 한글 컨테이너에 `word-break: keep-all` 누락

### Suggestion
- 함수 30줄 초과 → 분리
- 중복 CSS 규칙
- 매직 넘버 → 명명 상수
- 학명 표시에 이탤릭 누락

## 체크포인트

### HTML
- [ ] `<html lang="ko">`, UTF-8, viewport
- [ ] `<img>` alt
- [ ] 시멘틱 태그
- [ ] 다이얼로그 `role/aria-modal/aria-labelledby`
- [ ] 검색 input `<label>` 또는 `aria-label`

### CSS
- [ ] 미사용 선택자 없음
- [ ] `!important` 최소
- [ ] 한글 컨테이너 `word-break`
- [ ] 학명 이탤릭 일관성

### JS
- [ ] `const`/`let`만
- [ ] 리스너 등록/해제 대응
- [ ] JSON 데이터에도 `textContent` 우선
- [ ] DOM 접근 null 가드
- [ ] `fetch()` 에러 처리

## 보고서 형식

```markdown
## 코드 리뷰 결과

### Critical (즉시 수정 필요)
- [파일:라인] 문제
  → 수정 제안: [코드]

### Warning (권장)
- [파일:라인] 문제 → 수정 제안

### Suggestion (선택)
- [파일:라인] 제안

### 종합 평가
[1-2문장]
```
