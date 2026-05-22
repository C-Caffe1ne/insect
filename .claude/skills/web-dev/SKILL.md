---
name: web-dev
description: ENTOMA · KR 곤충도감용 바닐라 HTML/CSS/JS 개발. project/ 디렉토리에 모달, 검색, 분류 브라우저, 카드 그리드 등을 구현. taxonomy JSON 바인딩과 LINE Seed KR 한글 타이포그래피 포함. .html/.css/.js 파일을 만들거나 곤충도감 UI를 구현해야 할 때 반드시 이 스킬을 사용할 것.
---

# 바닐라 웹 개발 가이드 — ENTOMA · KR

## HTML 작성 기준

### 구조
- `<main>`, `<header>`, `<section>`, `<article>`, `<nav>` 등 시멘틱 태그 우선
- `<div>`/`<span>`은 의미 없는 래퍼에만 사용
- 한국어 필수: `<html lang="ko">`, `<meta charset="UTF-8">`, viewport 메타

### 접근성
- 모든 `<img>` alt (장식은 `alt=""`)
- 폼: `<label for>` 또는 `aria-label`
- 다이얼로그: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- 아이콘 전용 버튼은 `aria-label="설명"`

## CSS 작성 기준

### 속성 작성 순서
1. 레이아웃 (display, position, flex, grid)
2. 크기 (width, height, padding, margin)
3. 시각 (color, background, border, box-shadow)
4. 타이포그래피 (font-size, font-weight, line-height)
5. 기타 (cursor, transition, animation, z-index)

### 규칙
- 클래스 이름: `kebab-case`, 역할 기반 (`species-card`, `modal-header`, `tab-active`)
- 인라인 스타일 금지 (JS로 동적 조작 시만 예외)
- 반응형: `max-width` 미디어 쿼리, 모바일 퍼스트
- CSS 변수로 색·간격 일관성 유지

### 한국어 + 학명 타이포그래피
```css
body {
  word-break: keep-all;
  font-family: 'LINE Seed KR', 'Inter', sans-serif;
}
.species-sci {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;  /* 학명은 이탤릭 표기 관례 */
}
.species-kr {
  font-family: 'LINE Seed KR', sans-serif;
}
```

## JavaScript 작성 기준

### 코드 품질
- `const` 우선, 재할당 시 `let`, `var` 금지
- 함수명: 동사+목적어 (`openModal`, `loadOrder`, `renderSpeciesCard`)
- 이벤트 리스너: named function (리스너 해제 가능)

### DOM 조작
```javascript
const modal = document.querySelector('.species-modal');
const closeBtn = modal.querySelector('.btn-close');

if (!modal) return;  // null 가드
```

### 모달 이벤트 패턴
```javascript
function openModal() {
  modal.classList.add('active');
  document.addEventListener('keydown', handleEscape);
}
function closeModal() {
  modal.classList.remove('active');
  document.removeEventListener('keydown', handleEscape);
}
function handleEscape(e) {
  if (e.key === 'Escape') closeModal();
}
```

### 보안
- JSON 데이터(학명/한글명)라도 `innerHTML` 직접 삽입 금지
- `textContent` 또는 `createElement` + `append` 사용

## taxonomy JSON 바인딩 패턴

### 데이터 로드
```javascript
async function loadOrders() {
  try {
    const res = await fetch('taxonomy/index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.orders;
  } catch (err) {
    console.error('Failed to load orders', err);
    return [];
  }
}
```

### 종 카드 렌더링 (안전)
```javascript
function renderSpeciesCard(species) {
  const card = document.createElement('article');
  card.className = 'species-card';

  const kr = document.createElement('p');
  kr.className = 'species-kr';
  kr.textContent = species.commonName ?? '이름 미상';

  const sci = document.createElement('p');
  sci.className = 'species-sci';
  sci.textContent = species.scientificName ?? '';

  card.append(kr, sci);
  return card;
}
```

## 파일 구성 기준

```
project/
├── index.html
├── style.css
├── script.js               # 추가 시
├── fonts/
├── images/
└── taxonomy/...
```

기능이 많아지면 `scripts/main.js`, `scripts/modal.js`로 분리.
