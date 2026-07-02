## QA 검증 결과

검증 대상: `project/index.html`, `project/style.css`
변경 사항: 홈 화면 재구성(탭 삭제 → 오늘의 곤충 + 분류 보기 직접 배치), pageSearch 빈 상태에 테마 4종 추가, Settings 기본 화면 설정 제거, `previousFamilyPage` 뒤로가기 추적.
참고: `_workspace/03_review_output.md` 는 존재하지 않아(git상 삭제됨) 리뷰 지적 우선 검증은 생략, 체크리스트 기반 전면 검증 수행.

### Pass ✅

**DOM 셀렉터 ↔ HTML 교차 검증**
- 오늘의 곤충: `todayInsectCard`(HTML:63), `todayInsectBg`(64), `todayInsectTag`(67), `todayInsectName`(68), `todayInsectSci`(69) 모두 pageDiscover 내 존재. JS `initTodayInsectCard`(2082,2095,2106~2111)에서 getElementById로 접근 — 전부 매칭.
- 분류 보기: `orderGrid`(HTML:85), `sortBtn`(82), `orderSubtitle`(80) 모두 pageDiscover 내 존재. JS 접근 지점(renderOrders 1299, orderSubtitle 1497/1508, sortBtn 1682/1684/2513) 전부 매칭.
- 테마 스크롤 컨테이너 `themeScroll-{predator,pest,nocturnal,korean}` 4개 모두 pageSearch searchEmptyState(HTML:413,427,441,455) 내 존재. JS `renderThemeSections` 가 `themeScroll-${theme.id}`(1650)로 접근 — THEMES 배열 id와 정확히 일치.
- 테마 전체보기 `themeSeeAll-{predator,pest,nocturnal,korean}` 4개 모두 searchEmptyState(HTML:411,425,439,453) 내 존재. JS `themeSeeAll-${theme.id}`(1651) 접근, id 일치.

**제거된 식별자 정합성 (완전 삭제 확인)**
- `tabCurated`, `tabTaxonomy`, `discoverTabs`, `discoverTabPanels`, `panelCurated`, `panelTaxonomy`, `defaultHomeTab` — HTML/JS 전체에서 grep 결과 0건. 삭제 후 잔존 참조 없음(끊긴 셀렉터 없음).

**이벤트 리스너 정합성**
- `familyDetailBackBtn`(HTML:94) 클릭 핸들러(1748~1751)가 `showPage(previousFamilyPage)` + `syncNavForPage(previousFamilyPage)` 사용. 요구사항과 정확히 일치.
- `previousFamilyPage` 설정 지점: 목 카드 진입 시 `openOrderSpecies`에서 `'pageDiscover'`(1370), 테마 진입 시 `openThemeSpecies`에서 `'pageSearch'`(1617)로 세팅 → 뒤로가기 대상이 진입 경로에 따라 올바르게 분기됨.
- `sortBtn` 클릭 리스너(1682)가 pageDiscover의 `orderGrid`를 `renderOrders`로 재렌더 — 정상 연결.
- `themeSeeAll-*` 각 버튼에 `openThemeSpecies(theme)` 리스너 등록(1669). `openThemeSpecies`는 pageFamilyDetail 공용 인프라(familyDetailTitle, familySpeciesCount, speciesTabsRow, familySpeciesGrid)를 재사용 — 해당 요소 모두 존재, 연결 정상.

**흐름 테스트 (코드 레벨 추적)**
- 홈 → 목 카드 클릭 → `openOrderSpecies`(previousFamilyPage='pageDiscover') → pageFamilyDetail → 뒤로 → `showPage('pageDiscover')` + nav 홈 활성화. 복귀 정상.
- 검색 → 테마 전체보기 → `openThemeSpecies`(previousFamilyPage='pageSearch') → pageFamilyDetail → 뒤로 → `showPage('pageSearch')` + `syncNavForPage('pageSearch')`로 navSearch 활성화. 복귀 정상.
- searchEmptyState 표시 제어: JS `performSearch`가 `searchResultArea.dataset.state`를 empty/no-result/results로 세팅(1873,1888,1894). CSS(3106~3108)가 state=results/no-result일 때 `.search-empty-state { display:none }`, empty일 때(3103~3104) display:block. 검색어 입력 시 테마 섹션 숨김 → 정상.

**CSS 클래스 ↔ HTML/JS 정합성**
- 신규/재사용 클래스 전부 style.css에 정의됨: `species-scroll`, `see-all`, `theme-loading`, `order-grid`, `order-card-mini`, `sort-btn`, `featured-grid`, `featured-card--large`, `section-sub`, `species-card`, `species-detail-card`. 미정의 클래스 없음.

**JS 문법**
- 인라인 `<script>` 블록 `node --check` 통과 (JS SYNTAX OK).

### Fail ❌
- 없음.

### 수동 테스트 필요
- 테마 섹션 데이터 매칭 결과: `filterInsectsByTheme`는 nibr_cache.json의 실제 텍스트 키워드(포식/해충/야행성/석주명)에 의존. 각 테마가 실제로 종을 반환하는지는 캐시 데이터 내용에 따라 달라지므로 브라우저 실행 확인 권장. 데이터 0건 시 "해당하는 곤충 데이터가 없습니다" fallback은 코드상 처리됨(1657~1662).
- `attachDragScroll`의 포인터 드래그 vs 카드 클릭 구분(4px 임계), 실제 터치 디바이스 동작은 수동 확인 필요.
- 오늘의 곤충 카드 배경 이미지 `replaceWith` 후 레이아웃(긴 학명 시 featured-info 오버레이 겹침)은 실제 렌더 확인 권장.

### 종합: 전체 Pass
체크리스트 전 항목 코드 레벨 검증 통과. 끊긴 셀렉터·미정의 CSS·잔존 참조 없음. 데이터 의존 3건만 수동 확인 권장(Critical 아님).
