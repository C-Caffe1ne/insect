## 요구사항

### 사용자 요청
검색 페이지의 각 목의 대한 설명을 목 페이지 검색 바 밑으로 옮기고 검색페이지에서 목 설명 없애줘. 오류, 버그를 반드시 확인하고 작업해줘.

### 분류된 작업 유형
기능 이동 (UI 재배치)

### 관련 파일
- project/index.html
- project/style.css

### 현재 상태
- `pageOrderGuide` (`id="pageOrderGuide"`) — 검색 페이지 하위 페이지. `ORDER_GUIDE_DESC` 배열로 각 목(目)의 설명을 아코디언 방식으로 렌더링 (`renderOrderGuide()`, 약 line 2208).
- `pageFamilyDetail` (`id="pageFamilyDetail"`) — 목별 종 목록 페이지. 검색 바(`family-search-section`)는 있으나 목 설명 없음.
- `ORDER_GUIDE_DESC` 배열 (line 1052) — 16목의 `{ id, kr, sci, desc }` 데이터. `id`는 소문자 학명 (`coleoptera`, `lepidoptera` 등).
- `ordersData` 객체도 동일한 `id` 필드를 가짐.

### 변경 계획

#### HTML (pageFamilyDetail)
`family-search-section` 아래, `species-detail-section` 위에 추가:
```html
<div id="familyOrderDesc" class="family-order-desc" hidden></div>
```

#### JS 변경 1: openOrderSpecies()  (line ~1407)
해당 목의 설명을 `ORDER_GUIDE_DESC`에서 찾아 `#familyOrderDesc`에 표시:
```js
const descEl = document.getElementById('familyOrderDesc');
if (descEl) {
  const guideEntry = ORDER_GUIDE_DESC.find(d => d.id === order.id);
  if (guideEntry?.desc) {
    descEl.textContent = guideEntry.desc;
    descEl.hidden = false;
  } else {
    descEl.textContent = '';
    descEl.hidden = true;
  }
}
```

#### JS 변경 2: openThemeSpecies()  (line ~1655)
테마 보기에서도 pageFamilyDetail을 사용하므로 설명 숨김:
```js
const descEl = document.getElementById('familyOrderDesc');
if (descEl) { descEl.textContent = ''; descEl.hidden = true; }
```

#### JS 변경 3: renderOrderGuide()  (line ~2208)
- `li.innerHTML`에서 `<p class="order-guide-item-desc">` 제거
- chevron SVG 제거
- `role="button"`, `tabindex="0"`, `aria-expanded` 속성 제거
- `addEventListener('click', ...)` 및 `addEventListener('keydown', ...)` 제거

#### CSS 변경 1: .family-order-desc 신규 (style.css)
`family-search-section` 바로 아래에 연결되는 설명 텍스트 스타일.

#### CSS 변경 2: .order-guide-item
`cursor: pointer` → `cursor: default` (더 이상 클릭 불가)

### 참고 사항
- `openThemeSpecies()`도 `pageFamilyDetail`을 열므로 반드시 설명 숨김 처리 필요.
- `ORDER_GUIDE_DESC`의 `id`와 `ordersData[].id` 는 모두 소문자 학명이므로 직접 매칭 가능.
- 설명 없는 목(데이터 미존재)의 경우 element를 `hidden` 처리.
