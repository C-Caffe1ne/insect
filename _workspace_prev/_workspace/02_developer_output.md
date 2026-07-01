## 구현 완료 보고

### 변경 파일
- `project/index.html`
- `project/style.css`

### HTML 변경
`pageFamilyDetail` — `family-search-section` 아래, `species-detail-section` 위에 추가:
```html
<div id="familyOrderDesc" class="family-order-desc" hidden></div>
```

### JS 변경 1: openOrderSpecies()
`ORDER_GUIDE_DESC`에서 `order.id`로 해당 목 설명을 조회 → `#familyOrderDesc` 표시:
- ID 매핑: `ordersData[].id` ↔ `ORDER_GUIDE_DESC[].id` (16목 모두 일치 확인)
- 설명 없는 목은 element를 `hidden` 처리

### JS 변경 2: openThemeSpecies()
테마 뷰에서 `pageFamilyDetail`을 열 때 `#familyOrderDesc`를 `hidden` 처리
(테마 보기는 단일 목이 아니므로 설명 불필요)

### JS 변경 3: renderOrderGuide()
- `<p class="order-guide-item-desc">` 제거
- chevron SVG 제거
- `role="button"`, `tabindex`, `aria-expanded` 속성 제거
- click / keydown 이벤트 리스너 제거 (아코디언 기능 완전 제거)
- 제목에서 "이란?" 텍스트 제거 (설명 없는 리스트에 어울리지 않음)

### CSS 변경 (style.css)
- `.family-order-desc` 신규: padding 14px 24px 0, 13px/1.75 body text, `--text-secondary`
- `.family-search-section`: 원래 `border-bottom` 유지 (테마 뷰에서도 구분선 표시되어야 함)
- `.order-guide-item`: `cursor: pointer` / `user-select: none` 제거 (더 이상 클릭 불가)

### 검증된 엣지 케이스
- 종 상세 → 백버튼 복귀: `previousSpeciesPage`로 복귀 시 desc 상태 유지됨 (추가 처리 불필요)
- 설명 없는 목: `ORDER_GUIDE_DESC`에 없는 `order.id`는 `hidden` 처리
- 16목 ID 일치: `search_index.json` orders IDs == `ORDER_GUIDE_DESC` IDs (모두 소문자 학명)
