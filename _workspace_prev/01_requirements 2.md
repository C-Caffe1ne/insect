## 요구사항

### 사용자 요청
ENTOMA · KR 곤충도감 서비스의 버그를 확인하고 고쳐달라.

### 분류된 작업 유형
전체 검토 + 버그 수정

### 관련 파일
- `project/index.html` (1368줄, 인라인 `<script>` 757~1365)
- `project/style.css` (1807줄)
- `project/taxonomy/index.json` (34목 메타)
- `project/taxonomy/orders/*.json` (목별 과 목록)
- `project/taxonomy/families/{order-id}/{family-id}.json` (과별 종 목록)
- `project/korea_insect_species_by_family.json` (통합 종 데이터 캐시)

### 작업 범위
1. **버그 식별 (병렬)**: code-reviewer + qa-agent
   - code-reviewer: XSS, 접근성, 이벤트 리스너 누수, null 가드, var 사용 등
   - qa-agent: DOM 셀렉터 ↔ HTML 정합성, JSON 스키마 ↔ 코드 필드 접근 정합성, 페이지 네비게이션 흐름
2. **버그 수정**: web-developer
   - Critical/Warning 등급 버그 수정
   - 기존 코드 스타일 유지, 인라인 `<script>` 구조 유지
3. **재검증**: qa-agent
   - 수정된 버그 재검증

### 참고 사항
- 단일 HTML 파일에 인라인 `<script>`로 작성된 SPA 구조
- View Transitions API 사용 (graceful fallback 있음)
- 한국어 + 학명 동시 표시, escapeHTML 함수 존재
- `expandedOrderKey`, `selectedOrder`, `selectedFamilies` 등 모듈 스코프 상태
- 페이지 ID: `pageDiscover`, `pageSearch`, `pageSaved`, `pageProfile`, `pageFamilyList`, `pageFamilyDetail`
- 네비 ID: `navDiscover`, `navSearch`, `navSaved`, `navProfile`
- 주의: `pageSaved`, `pageProfile`은 HTML에 실제 존재하는지 확인 필요
