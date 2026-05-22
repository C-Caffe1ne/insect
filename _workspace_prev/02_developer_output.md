## 구현 완료

### 수정된 파일
- `project/index.html`: 인라인 script 구조 유지하면서 보안(XSS) 패치, fetch 에러 처리 일관화, dead UI 핸들러 부착, 접근성 보강. 라인 수는 ~+150줄(주로 핸들러 블록 추가).
- `project/style.css`: `.family-detail-title`을 nowrap 단일 줄 → 2줄 line-clamp + 한글/학명 친화적 word-break으로 변경.

### 적용한 패치
- **C-1, C-2**: `renderOrders` 확장 카드(890–895)와 미니 카드(914–915)의 `order.scientificName`/`order.commonName`을 모두 `escapeHTML(...)`으로 감쌌다. 미니 카드의 `data-order-key`는 기존부터 escape되어 있어 유지.
- **C-3 / F-11**: `openFamilyDetail` 내부 fetch(라인 1109~)에 `.catch()` 추가 + `r.ok` 검사. 실패 시 `order.families`를 빈 배열로 폴백 후 `executeDetail()` 호출.
- **C-4**: 6개 fetch 호출(loadCachedSpecies / expandOrder / openFamilyPage / openFamilyDetail / renderFamilyDetail species fetch / taxonomy/index.json 최초 로드) 모두에 `if (!r.ok) throw new Error('HTTP ' + r.status)` 패턴 적용. 404/500 응답 시 SyntaxError 대신 의미 있는 catch 흐름으로 진입.
- **C-5 / F-1**: `#searchInput`(상단 검색바)에 focus 핸들러 부착 → `pageSearch`로 라우팅 + `navSearch.active` 동기화 + `globalSearchInput` 포커스 이동.
- **F-2**: `pageSearch`의 검색 input에 `id="globalSearchInput"` 부여 + `input` 이벤트 핸들러로 `ordersData` 부분 일치(common/scientific) 필터. 결과는 placeholder 텍스트로 가벼운 피드백 ("N개 목 일치 — 첫 결과: …" 또는 "일치하는 결과 없음"). 별도 결과 영역 마크업이 없어 placeholder 방식 채택.
- **C-6 / F-3**: `#btnRandom` 클릭 시 랜덤 order 선택 → `expandedOrderKey` 설정 → `showPage('pageDiscover')` + `navDiscover.active` + `switchDiscoverTab('taxonomy')` + 재렌더.
- **C-6 / F-4**: 모든 `.filter-btn`에 클릭 핸들러 부착, 임시로 `#sortBtn` 클릭 위임(상세 필터 모달 미정).
- **F-5**: species-tab(POPULAR/A-Z/BY COLOR)에 `data-sort` + `role="button"` + `tabindex="0"` 부여. `currentSpeciesList`/`currentSpeciesSort` 모듈 상태 도입, `renderSpeciesSorted()` 헬퍼 추가. POPULAR=원본, A-Z=scientificName 오름차순, BY COLOR=색상 정보가 데이터에 없어 Fisher-Yates 셔플로 시각적 변화만 제공. 클릭/Enter/Space 모두 active 토글 + 재렌더.
- **F-6**: 4개 `.explore-card`에 `role="button"` + `tabindex="0"` + `data-category` 부여. 클릭/Enter/Space 시 카테고리명을 `globalSearchInput`에 prefill + input 이벤트 dispatch + 포커스. (실제 카테고리별 필터링 데이터가 없어 검색바 prefill로 통합)
- **C-7**: 캐러셀 mouseup을 `window`에 등록. `stopDrag` 헬퍼로 mouseleave/mouseup 동일 처리. 윈도우 밖에서 손을 떼도 isDown=false로 안전 복귀.
- **C-8**: 검색 input 3개(`searchInput`, `familySearchInput`, `globalSearchInput`) 모두 `aria-label` 추가.
- **C-9**: 페이지 내 모든 `a.see-all`, `a.profile-view-all`에 `preventDefault` 부착. `<a href="#">` 클릭 시 상단 스크롤 점프 차단.
- **F-7**: 정렬 라벨 의미 일관화. 두 모드 모두 이름순으로 통일:
  - `A → Z`: `scientificName` 오름차순 (라틴 알파벳)
  - `ㄱ → ㅎ`: `commonName` 오름차순 (한국어, locale='ko')
  - 기존 `b.familyCount - a.familyCount` (숫자 정렬)는 제거. 코드 주석으로 "라벨은 현재 적용 중인 정렬" 의미 명시.
- **F-9**: profile 페이지 백버튼의 inline `onclick="showPage('pageDiscover')"`를 제거하고 `id="profileBackBtn"` 부여. JS 핸들러에서 `showPage('pageDiscover')` + `navDiscover.active` 동기화.
- **F-10**: family-photo-card / family-carousel-card / species-detail-card의 `<img alt="">`에 `escapeHTML(commonName || scientificName)`로 의미 있는 alt 부여. `loading="lazy"`도 함께 추가하여 초기 페인트 가속.
- **W-5**: `.family-detail-title`에 `word-break: keep-all`, `overflow-wrap: anywhere`, `white-space: normal`, `-webkit-line-clamp: 2` 추가. 긴 한글+학명 조합도 모바일 폭 안에서 두 줄로 깔끔히 보임.
- **W-8**: `taxonomy/index.json` 응답 처리부 — `data.orders`가 배열이 아니면 `[]`로 폴백. `totalOrders`/`totalFamilies`도 옵셔널 체이닝 + nullish 폴백.

### Skip한 항목 + 이유
- **W-1 (selectedOrder 클로저 캡처)**: 현재 흐름에서 race 미발생. 별도 리팩토링 시 처리.
- **W-2 (showPage unknown id 경고)**: 모든 호출처에서 유효한 id를 전달함이 확인됨. 디버깅 보조용이라 우선순위 낮음.
- **W-3 (sub-page nav 동기화)**: F-9에서 profile/saved 백버튼은 명시 동기화. family-list/detail의 `keepNav: true` 흐름은 현재 정상.
- **W-4 (인라인 style 클래스화)**: 별도 리팩토링 작업으로 분리. 동작 영향 없음.
- **W-6 (inert 폴리필)**: 모던 브라우저 가정.
- **W-7 (`tabTaxonomy.click()` 직접 호출)**: 동작 동일, 코드 가독성만 영향. 우선순위 낮음.
- **W-9 (View Transition race)**: 현재 무해.
- **S-1 ~ S-10**: 모두 Suggestion (선택). 별도 작업 시 처리.
- **F-5의 'BY COLOR' 정확 매핑**: 데이터에 색상 정보 없음. 셔플로 대체 (시각적 변화만 보장, 의미 있는 정렬 아님).
- **F-8 (종 이미지가 family 이미지 fallback 4장 순환)**: 데이터 자체에 종별 이미지/thumbnail 없음. fallback 외 해결 불가. 이번 패치 범위 밖.

### QA 재검증 요청 포인트
1. **XSS 안전성 (C-1/C-2)**: `taxonomy/index.json`의 `orders[].commonName`을 일시적으로 `<script>alert(1)</script>` 같은 페이로드로 교체하고 분류 보기 탭 → 카드 확장 → DOM에 `<script>`가 텍스트로만 나오는지 확인.
2. **fetch 실패 폴백 (C-3/C-4)**: 네트워크 차단 또는 잘못된 경로로 `taxonomy/<order>.json` 404 상황 재현. 콘솔에 unhandled rejection 없는지, "과 데이터 없음" 폴백이 보이는지.
3. **검색 라우팅 (C-5/F-1)**: 홈 상단 `#searchInput` 클릭 → pageSearch로 즉시 이동 + `globalSearchInput`에 포커스 + 하단 nav가 "검색" 활성으로 동기화.
4. **검색 필터 (F-2)**: pageSearch input에 "딱정벌레", "Coleoptera", "ㅂ" 등 입력 → placeholder가 "N개 목 일치 — 첫 결과: …"로 갱신되는지. 빈 문자열로 지우면 원래 placeholder 복귀.
5. **랜덤 버튼 (C-6/F-3)**: pageSearch → "랜덤 곤충 보기" 반복 클릭 → 매번 다른(or 같을 수도 있는) order로 확장된 상태로 pageDiscover 분류 탭 진입.
6. **filter-btn (C-6/F-4)**: 헤더 SVG 필터 아이콘 클릭 → 정렬 토글이 실행되어 라벨이 "A → Z" ↔ "ㄱ → ㅎ" 전환.
7. **species-tab (F-5)**: family 상세 진입 → POPULAR/A-Z/BY COLOR 클릭 시 active 클래스 이동 + 종 카드 순서 변경. Tab키 + Enter/Space로도 동일하게 동작.
8. **explore-card (F-6)**: pageSearch의 4개 카드 클릭/Enter → `globalSearchInput`에 카테고리명 prefill + 필터 결과(placeholder) 갱신.
9. **캐러셀 mouseup (C-7)**: family 상세에서 캐러셀 mousedown 후 윈도우 밖에서 손 떼기 → 돌아와서 클릭해도 드래그 잠김 없는지.
10. **family-detail-title 줄바꿈 (W-5)**: 긴 commonName + scientificName 조합(예: "장수풍뎅이과 (Dynastidae)") family로 진입 → 모바일 폭(430px)에서 2줄로 정상 표시.
11. **profile 백버튼 nav 동기화 (F-9)**: profile 진입 → 좌상단 ← 클릭 → 홈으로 돌아오면서 하단 nav "홈"이 active.
12. **이미지 alt (F-10)**: VoiceOver/스크린리더로 family-photo-card 탐색 시 한국어 이름 또는 학명이 읽히는지.
13. **정렬 라벨 의미 (F-7)**: 분류 보기 탭에서 sortBtn 클릭 반복 → "A → Z"일 때 학명 알파벳순, "ㄱ → ㅎ"일 때 한글명 가나다순.
14. **빈/잘못된 index.json (W-8)**: `taxonomy/index.json`을 `{}`로 교체해도 콘솔에 TypeError 없이 "데이터 로드 실패" 또는 빈 그리드만 표시.
