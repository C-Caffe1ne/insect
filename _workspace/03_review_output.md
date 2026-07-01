## 코드 리뷰 결과

리뷰 대상: `project/index.html`, `project/style.css`
변경 요약: 홈 화면 재구성 (탭 삭제 → pageDiscover 직접 배치, pageSearch 빈 상태에 테마 섹션 4개, Settings의 defaultHomeTab 제거, `previousDiscoverTab` → `previousFamilyPage`)

---

### Critical (즉시 수정 필요)

없음. 검토 포인트로 지목된 5개 항목 모두 안전하게 처리되어 있음.

- 검토 1 (stale 참조): `tabCurated`, `tabTaxonomy`, `switchDiscoverTab`, `defaultHomeTab`, `previousDiscoverTab` 는 index.html / style.css 전체에서 완전히 제거됨 (grep 0건). null 참조 크래시 없음.
- 검토 2 (뒤로가기): `familyDetailBackBtn` 클릭 → `showPage(previousFamilyPage)` + `syncNavForPage(previousFamilyPage)` [index.html:1748-1751]. `openOrderSpecies`는 `previousFamilyPage='pageDiscover'` [1370], `openThemeSpecies`는 `'pageSearch'` [1617]로 정확히 설정. 복귀 경로 정상.
- 검토 3 (테마 렌더링): THEMES id (`predator`/`pest`/`nocturnal`/`korean`) [1516-1541] == HTML의 `themeScroll-*`/`themeSeeAll-*` id [413-455] 완전 일치. `renderThemeSections`는 `scrollEl` null 가드 [1652], `seeAllBtn` null 가드 [1668] 모두 존재.
- 검토 4 (Settings JS): `initSettingsPage` [3359]에 `defaultHomeTab` getElementById 호출 없음. `dailyNotification`만 참조.
- 검토 5 (XSS): `buildThemeSpeciesCard` [1562-1599]는 `createElement` + `textContent` + `img.src`/`img.alt` 만 사용. `innerHTML` 미사용. 테마 섹션 관련 XSS 없음.

---

### Warning (권장)

- [style.css:288-307] 탭 마크업 삭제로 `.tab-panels`, `.tab-content`, `.tab-content.active`, `@media`의 `.tab-content.active` 규칙이 **미사용(dead) CSS**가 됨 (index.html에서 `tab-panels`/`tab-content` 참조 0건 확인). → 4개 규칙 및 관련 `@keyframes`(있다면) 제거 권장.

- [index.html:3395-3397] `pageshow:pageSettings` 이벤트마다 `initSettingsPage()`가 재호출되며, 내부에서 `dailyNotification`(change), `reportBug`(click), `rateApp`(click), 설정 뒤로가기 버튼(click)에 `addEventListener`를 매번 재등록함 → 설정 페이지 재방문 시 **리스너 누적(중복 실행)**. 이번 변경 범위 밖의 기존 이슈지만, 홈 재구성으로 진입 동선이 바뀐 만큼 함께 정리 권장. → 초기화 1회 가드(`let _settingsInited=false`) 또는 리스너 등록을 페이지 초기화 블록으로 이동.

---

### Suggestion (선택)

- [index.html:1748, 1754] `familyDetailBackBtn`, `familyOrderDescToggle`의 `getElementById(...).addEventListener` 는 null 가드 없이 직접 호출. 두 요소 모두 HTML에 정적 존재 [94, 126]하므로 현재는 안전하나, 초기화 블록의 다른 캐싱 패턴(`const inp = ...; if (inp) ...`)과 일관성을 위해 가드 추가를 고려.

- [index.html:414 등] 테마 섹션 로딩 자리표시자 `불러오는 중…` 텍스트는 정적 하드코딩. 데이터 로드 실패(`.catch(() => {})` [1676])로 `renderThemeSections`가 실행되지 않으면 자리표시자가 그대로 남음 → 로드 실패 시에도 사용자에게 상태를 알리도록 catch에서 `theme-loading` 텍스트 교체 고려.

- [index.html:411,425,439,453] "전체보기" 버튼은 텍스트가 있어 접근성상 aria-label 불필요(적절). 학명(`species-sci`)은 이탤릭 처리 권장(도감 표기 관례) — 기존 카드 스타일과 동일하다면 유지.

---

### 종합 평가

홈 화면 재구성의 핵심 리스크(탭 관련 stale 참조, 뒤로가기 분기, 테마 id 매핑, XSS)는 모두 깔끔하게 처리되어 Critical 이슈가 없다. 남은 정리 대상은 삭제된 탭의 dead CSS와 설정 페이지 리스너 재등록(기존 패턴)뿐으로, 병합에는 지장이 없으나 후속 정리를 권장한다.
