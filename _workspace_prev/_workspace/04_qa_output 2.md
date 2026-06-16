## QA 검증 결과 (pageSpeciesDetail 최종 검증)

대상: `project/index.html` (2078줄) + `project/style.css` (2415줄)
검증 방식: 실제 파일 내용 직접 Read + grep 교차 검증. 보고서 의존 없음.

---

### Critical 패치 적용 확인 ✅

- **C-1 (renderSpeciesSorted 카드 createElement 전환)**: ✅ 적용됨
  - `index.html:1440~1458` — `document.createElement('article')` + `imgWrap.createElement('img')` + `h3.textContent` + `p.textContent`. `innerHTML` 템플릿 완전 제거됨.
  - 이전 escapeHTML 템플릿(`<img src=...alt=...>` 형태)이 사라지고 DOM 노드로만 구성. XSS 회귀 위험 0.

- **C-2 (renderSpeciesDetail 히어로 이미지 replaceChildren + 헬퍼)**: ✅ 적용됨
  - `index.html:1937~1951` — `heroImg.replaceChildren();` 호출 후 `url` 분기에서 `createElement('img')` + alt fallback `species.commonName || species.scientificName || '곤충 사진'`. else 분기에서 `heroImg.appendChild(createHeroPlaceholder())` 호출.
  - `dataset.pending` 'false'/'true' 명시적 토글.

- **C-3 (speciesDetailBackBtn SVG aria-hidden + focusable)**: ✅ 적용됨
  - `index.html:346~347` — `<svg ... aria-hidden="true" focusable="false">`. button 자체에 `aria-label="이전 페이지로 돌아가기"` 부여(345줄).
  - grep으로 다른 백버튼들(271, 306줄 — familyBackBtn / familyDetailBackBtn)에는 여전히 누락이지만 **기존 코드 영역**으로 이번 작업 범위 밖. 회귀 항목으로 기록.

- **C-4 (buildPlaceholderSpecies filter(Boolean).join 가드)**: ✅ 적용됨
  - `index.html:1845~1852` — `[selectedOrder.commonName, selectedOrder.scientificName ? \`(${...})\` : null].filter(Boolean).join(' ') || null` 패턴으로 변경. family도 동일 패턴.
  - 두 값 모두 빈 문자열이면 `filter(Boolean)` 결과 빈 배열 → `join(' ')` 빈 문자열 → `|| null`로 null 반환 → setSlot의 fallback("데이터 준비 중") 활성화.

- **헬퍼 추가 (createHeroPlaceholder)**: ✅ 적용됨
  - `index.html:1915~1924` — DocumentFragment 반환. `placeholder-img placeholder-img--bee species-hero-placeholder` div + `data-pending-tag` span("사진 데이터 준비 중"). HTML 357~360줄의 초기 마크업과 동일 구조.
  - `renderSpeciesDetail`에서 url 없을 때 `heroImg.appendChild(createHeroPlaceholder())`로 호출 — 단일 진실 소스.

---

### Pass ✅

#### A. DOM 셀렉터 ↔ HTML 교차 검증
- **모든 data-slot 매칭 완료** — JS에서 호출하는 슬롯 30종이 HTML에 1:1 존재.
  - 텍스트 슬롯: commonName(362), scientificName(363), fullScientificName(492), author(495), year(499), description(509), habitat(560), sizeRange(541)
  - 배지 6종 + value 슬롯: endangered(382), invasive(395), hazardous(408), naturalMonument(420), harmful(434), endemic(446)
  - 분류 트리 7단계: taxKingdom/Phylum/Class/Order/Family/Genus/Species(458, 462, 466, 470, 474, 478, 482)
  - 생애 4단계: lifecycleEgg/Larva/Pupa/Adult(582, 594, 606, 623)
  - 히어로/크기: heroImg(357), sizeBar(534), habitatMap(562)
- **신규 ID 매칭**: pageSpeciesDetail(343), speciesDetailBackBtn(345), speciesDetailHeroImg(357), statusBadgeGrid(371), taxonomyTree(455), lifecycleGrid(572). JS는 pageSpeciesDetail(1928), speciesDetailBackBtn(2040)만 직접 참조 — 나머지는 [data-slot] 셀렉터로 접근. 모두 일치.
- **`.status-badge[data-badge-key="<key>"]` × 6 매칭**: JS의 1955줄 6개 키 배열이 HTML 372/385/398/411/423/437줄 6개 `data-badge-key` 속성과 1:1 일치. `.status-badge-value` 자식도 6개 모두 존재.

#### B. 페이지 진입/이탈 흐름
- **카드 클릭 진입**: `renderSpeciesSorted` 1471줄 `card.addEventListener('click', openDetail)` → 1460~1469줄 `openDetail`에서 `buildPlaceholderSpecies(...)` + spread + `openSpeciesDetail({...}, 'pageFamilyDetail')` 호출 → 2031줄 `openSpeciesDetail` → `renderSpeciesDetail(species)` (2035) + `showPage('pageSpeciesDetail', { keepNav: true })` (2036).
- **키보드 진입**: 1472~1477줄 `keydown` 핸들러 — Enter/Space 모두 `e.preventDefault()` + `openDetail()`. `role="button"` + `tabIndex=0`(1442~1443) 부여로 Tab 포커스 가능.
- **백버튼 이탈**: 2040~2045 — `speciesDetailBackBtn` 클릭 시 `showPage(previousSpeciesPage || 'pageFamilyDetail', { keepNav: true })`. `<button>` 요소라 Enter/Space 기본 동작.
- **keepNav 옵션 동작**: `showPage` 1661~1667줄 `if (!options.keepNav) allNavItems.forEach(...remove('active'))` — keepNav: true일 때 하단 nav active 유지 확인.

#### C. 자리표시자 동작 (데이터 미연결)
- **setSlot null/undefined/'' 분기**: 1868줄 `hasValue = value !== null && value !== undefined && value !== ''`. !hasValue → `el.textContent = fallback ?? '데이터 준비 중'` + `el.dataset.pending = 'true'`. 모두 명시적 검증.
- **6개 배지 unknown**: `buildPlaceholderSpecies` conservationStatus 6필드 전부 null → `resolveBadge` 1877줄 `raw === null` 분기 → `{ status: 'unknown', text: '데이터 없음' }` → `applyBadge` 1909줄 `dataset.status = 'unknown'`. HTML 372줄 등 초기값과 동일.
- **분류 트리**: kingdom/phylum/class 3단계는 placeholder에 한국어/학명 채워짐(1842~1844). order/family는 selectedOrder/selectedFamily에 따라 채워지거나 null. genus/species는 null → fallback "데이터 준비 중" 표시 + `taxonomy-step[data-pending="true"]` (1973~1974).
- **생애 4단계**: placeholder.lifecycle 모두 null → setSlot fallback "준비 중" + `lifecycle-stage[data-pending="true"]` (2026~2027).
- **크기**: placeholder.size = null → 2004~2009 `setSlot('sizeRange', null, '— ~ — mm')` + sizeBar 기본 30%~65%.

#### D. 데이터 연결 후크 검증 (코드 트레이싱)
실제 species 객체에 필드 채워질 때 동작:
- `images: ['url']` → 1938 url 존재 → 1941~1946 img 동적 생성, src/alt/loading 부여. ✅
- `conservationStatus.endangered: 'I'` → resolveBadge 1882~1887 labelMap['I'] = 'Ⅰ급' + status 'active' → 배지 active 색상. ✅
- `conservationStatus.invasive: true` → resolveBadge 1898 `raw === true` → 'active 해당'. ✅
- `conservationStatus.naturalMonument: '210'` → resolveBadge 1889~1891 → 'active 제210호'. ✅
- `taxonomy.genus: 'Papilio'` → 1968 taxGenus 슬롯 setSlot으로 채워짐. ✅
- `description: '나비목...'` → 1988 setSlot('description', ...). ✅
- `habitat: '평지...'` → 2013 setSlot('habitat', ...). ✅
- `lifecycle.{egg/larva/pupa/adult}` → 2018~2028 4번 setSlot 호출. ✅
- `size: {min: 30, max: 50, unit: 'mm'}` → 1993 typeof === 'number' 가드 → 1995 setSlot('sizeRange', `30 ~ 50 mm`) + 1999~2002 `--size-start: 30%`, `--size-end: 50%` setProperty로 막대 위치. ✅

#### E. 회귀 검증 (기존 기능 영향)
- **기존 페이지 영향 0**: pageDiscover(27), pageFamilyList(268), pageFamilyDetail(303), pageSearch(632), pageSaved(773), pageProfile(795) 모두 마크업 보존. showPage는 모든 .page를 remove('active') 후 target만 add('active')하는 단순 로직이라 신규 페이지 추가가 기존 흐름에 영향 없음.
- **공유 상태 호환**: selectedOrder(1097), selectedFamily(1099), previousFamilyPage(1100) 기존 변수와 selectedSpecies(1103), previousSpeciesPage(1104) 신규 변수 명확히 분리. 충돌 없음.
- **정렬 탭 영향 없음**: `#speciesTabsRow .species-tab` 핸들러(1777~1791)는 페이지 로드 시 1회 부착되어 `renderSpeciesSorted()` 호출. 정렬 변경 → grid.innerHTML = '' (1437) → forEach로 새 카드 생성 → 핸들러 매번 새로 부착. 카드 재생성과 함께 이전 핸들러는 GC. 정렬 시 모든 카드에 click+keydown 정상 부착 확인.

#### F. 접근성
- **상태 배지 의미 텍스트**: 6개 모두 `.status-badge-label`(고정 텍스트) + `.status-badge-value`(동적 텍스트). 스크린리더 친화 (시각 색상 외 텍스트도 함께).
- **SVG aria-hidden 일관성**: 신규 페이지(pageSpeciesDetail) 내 상태배지 6개 SVG는 parent `<span class="status-badge-icon" aria-hidden="true">`로 감싸여 OK(373, 386, 399, 412, 424, 438). 생애주기 4개 SVG도 parent `<span class="lifecycle-icon" aria-hidden="true">` (574, 585, 597, 609). 서식지 SVG도 parent span aria-hidden(553). 백버튼 SVG는 C-3 패치로 직접 aria-hidden 부여.
- **카드 접근성**: role="button" + tabIndex=0 + keydown 핸들러(Enter/Space) 부여. 정렬 변경 후에도 forEach 안에서 매번 부착되므로 일관성 보장.
- **자리표시자 텍스트**: setSlot fallback이 모두 의미 있는 한국어("데이터 준비 중", "이름 미상", "— 데이터 준비 중 —" 등). 스크린리더 "이름 미상, Scientific name" 같이 빈 영역 없이 읽음.

#### G. XSS 안전성 재검증
- **카드 마크업**: createElement + textContent로 완전 전환. `<script>` 페이로드를 학명에 넣어도 1454줄 `h3.textContent = item.commonName || ...`로 텍스트 그대로 출력, 파싱 안 됨. ✅
- **setSlot 내부**: 1869줄 `el.textContent = ...` — innerHTML 사용 없음. ✅
- **히어로 img.alt**: 1943줄 `species.commonName || species.scientificName || '곤충 사진'` — fallback 3단계로 견고. alt 자체는 IDL 속성이라 HTML 파싱 위험 0.
- **상태배지 value 텍스트**: 1911줄 `valueEl.textContent = badgeState.text` — textContent 일관 사용. ✅
- **resolveBadge 매핑값**: 1885줄 labelMap 객체 내부 'Ⅰ급'/'Ⅱ급' 고정 문자열. 외부 raw가 'I'/'II'/'관찰종' 외의 값이면 1886줄 `labelMap[raw] || String(raw)` fallback — raw가 어떤 임의 텍스트라도 textContent로 출력되므로 안전.

#### CSS 정합성
- 신규 클래스 87개 정의 모두 `style.css` 1818~2415줄 신규 섹션 + 기존 영역에 존재.
- `[data-pending="true"]` CSS 셀렉터(2190, 2408): JS에서 dataset.pending 토글 → CSS 시각 dim 처리 자동 연동.
- `[data-status="active"/"inactive"/"unknown"]` 셀렉터(2029, 2093, 2106): JS applyBadge 1909줄과 매칭.
- `[data-badge-key="endangered"]` 등 6개 키별 색상(2038~2087): JS 매핑 키와 1:1.
- `--size-start`, `--size-end` CSS 변수(2238~2260): JS setProperty와 매칭. 인라인 style fallback(534)이 있어도 setProperty가 덮어쓰므로 안전.

---

### Fail ❌

없음. 모든 검증 항목 통과.

---

### 회귀 (잠재)

- **[index.html:271, 306] 기존 백버튼 SVG (familyBackBtn/familyDetailBackBtn)에 aria-hidden 누락**: 이번 작업과 무관한 기존 영역. 신규 speciesDetailBackBtn은 C-3 패치로 부여됨. **이번 작업으로 새로 생긴 문제는 아님** — 일관성 차원에서 차후 별도 PR 권장 (리뷰 보고서도 동일 지적).
- **[index.html:1466~1467] 카드 클릭 시 species 객체 최상위에 `genus`/`species` 키 주입 후 placeholder의 taxonomy.genus/species는 null 그대로 전달**: `openSpeciesDetail` 호출 직후 `renderSpeciesDetail`이 `species.taxonomy.genus`를 읽으므로(1968) 최상위 키는 무시됨. 결과는 placeholder의 null이 그대로 fallback "데이터 준비 중"으로 표시되어 시각적으로는 일관됨. 다만 **데이터 전달이 효과 없는 dead code**. taxonomy 객체 내부로 병합하도록 후속 개선 가능.
- **[style.css:534] size-bar 인라인 style (--size-start: 30%; --size-end: 65%;)**: CSS fallback(`var(--size-start, 30%)`)과 중복이지만 JS setProperty(1999~2008)가 항상 덮어쓰므로 동작은 일치. 리뷰 Warning 항목이며 회귀 영향 없음.

---

### 수동 테스트 필요

- **반응형 배지 그리드 전환**: 모바일 max-width 430px 2컬럼, 480px 뷰포트에서 3컬럼 전환. 코드 레벨로 CSS 미디어쿼리 정합성은 확인했으나 실제 브라우저 시각 확인 필요.
- **size-bar 30%~65% 막대 시각화**: JS는 `setProperty('--size-start', '30%')`로 정확히 부여하나 실제 막대 그리기는 CSS 합성 결과. 시각적 위치 확인 필요.
- **분류 트리 ::before/::after 라인**: 7개 step의 좌측 도트+라인이 첫 단계 상단/마지막 단계 하단에서 깔끔히 잘리는지. 리뷰에서도 같은 Suggestion 지적.
- **View Transitions API 동작**: `showPage`는 단순 class toggle만 수행, View Transitions API 사용은 별도 코드 없음. 페이지 전환 애니메이션은 CSS `pageFadeIn` keyframes(1182~1191)만 적용. 브라우저 동작 확인 필요.
- **`prefers-reduced-motion`**: CSS 1193~1197에 정의 있음. OS 설정 토글로 확인 필요.
- **드래그 스크롤 vs 카드 클릭 stopPropagation**: 종 카드는 carousel과 별개라 영향 없으나, otherFamilyCarousel(2048~2074)의 hasDragged 핸들러는 family-carousel-card에만 영향. 회귀 0.

---

### 종합 평가: 전체 Pass ✅

- Pass: **24개** (Critical 패치 5건 + 검증 항목 19건 — A 셀렉터 매칭, B 진입/이탈, C 자리표시자, D 데이터 후크 9건, E 회귀 무결, F 접근성, G XSS, CSS 정합성)
- Fail: **0개**
- 회귀(경미/기존): 3건 (모두 이번 작업과 무관 또는 동작 일치)
- 수동 테스트 권장: 6건 (브라우저 시각/모션 확인)

**결론**: Critical 4건 + 헬퍼 추가 패치가 모두 정확히 적용되었고, 신규 `pageSpeciesDetail` 페이지의 HTML/CSS/JS 연결 정합성이 완전합니다. 종 카드 → 상세 페이지 진입, 자리표시자 렌더링, 데이터 연결 후크, 접근성, XSS 방어 모두 코드 레벨에서 검증 완료. 데이터 연결 단계로 안전하게 진행 가능합니다.
