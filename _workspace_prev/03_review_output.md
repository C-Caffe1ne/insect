## 코드 리뷰 결과

검토 대상: `project/index.html` 의 `#pageRecent`(최근 본 곤충 전체보기) 신규 서브페이지 관련 변경만.
콘텐츠 보호(contextmenu/dragstart/copy/cut/selectstart) 변경은 별개 기능이므로 검토 제외.

---

### Critical (즉시 수정 필요)

- **없음.** 이번 작업 범위(`#pageRecent`) 내에 Critical 이슈 없음.

---

### Warning (권장)

- **없음.** 요청된 7개 확인 항목 모두 통과. 라우팅 상수 오등록·리스너 누수·null 접근·접근성 누락 없음.

---

### Suggestion (선택)

- **[index.html:3542-3546] `insects.find()` 반복 순회 → Map 사전 구축 (개발자 질의 Q1 회신)**
  `arr.forEach` 안에서 항목마다 `insects.find(i => canonicalizeSciName(i.sci) === canonical)` 를 호출하므로, 최악의 경우 `canonicalizeSciName` 가 최근 30개 × 300종 ≈ 9,000회 실행된다(각 호출에 정규식 다수). 최근 목록 순서를 보존하면서도 O(n×m)→O(n+m) 로 줄이려면 루프 진입 전 canonical→ins Map을 한 번만 만들면 된다.
  → 수정 제안:
  ```js
  const bySci = new Map();
  insects.forEach(i => { const c = canonicalizeSciName(i.sci); if (c && !bySci.has(c)) bySci.set(c, i); });
  arr.forEach(entry => {
    const ins = bySci.get(canonicalizeSciName(entry.sci));
    if (ins) frag.appendChild(buildResultItem(ins, 'pageRecent'));
  });
  ```
  실사용 규모(30×300)에선 체감 지연이 없어 **현 구현도 허용 범위**이며, 순수 개선 제안이다. 순서 보존 로직 자체는 정확하다.

- **[index.html:512-521] 빈 상태 아이콘 시계 교체 (개발자 질의 Q2 회신)**
  하트(즐겨찾기 의미) 대신 시계 SVG(`<circle>`+`<polyline>`)로 교체한 판단은 적절하다. `stroke-width="1.8"` 등 `.empty-icon-glow` 상속 스타일과 일관되고 CSS 규칙 추가가 전혀 없어 "신규 CSS 불필요" 설계 의도에 부합한다. **컨벤션 상충 없음.**

- **[index.html:509 / 512] 최초 진입 시 empty-state 순간 노출 (pageSaved 상속, 회귀 아님)**
  `.saved-empty-state` 가 마크업에 `hidden` 없이 시작하고 `await loadSearchIndex()` 이후에야 `setAttribute('hidden','')` 되므로, search_index가 아직 캐시되지 않은 첫 렌더에서 빈 상태가 한순간 보였다 사라질 수 있다. 이는 복제 원본인 `renderSavedPage`(3410행)와 **완전히 동일한 기존 패턴**이라 이번 작업의 회귀가 아니며, `loadSearchIndex` 가 메모이즈되어 통상 즉시 resolve되므로 실사용 영향은 미미하다. 굳이 개선한다면 렌더 시작 시점에 `emptyState?.setAttribute('hidden','')` 를 먼저 두면 되나, pageSaved와의 패턴 일관성 유지가 우선이므로 **현 상태 유지 권장.**

---

### 검증 완료 항목 (요청 7개 교차 확인)

1. **XSS 안전 (통과)** — `renderRecentPage`(3524)는 raw `entry` 를 DOM에 직접 꽂지 않는다. `entry.sci` 는 `canonicalizeSciName(entry.sci)` 매칭 계산에만 쓰이고, 실제 카드는 `search_index` 에서 찾은 `ins` 객체로 `buildResultItem(ins,'pageRecent')`(2046) 이 생성한다. `buildResultItem` 은 `krEl/sciEl/taxEl` 전부 `textContent`, 이미지도 `img.src`/`img.alt` **속성 할당**만 사용 → `innerHTML` 삽입 경로 없음. 확인 요청대로 `entry` 가 아닌 `ins` 를 쓰는 것이 맞다.
   - (참고, **범위 외**) 인접한 기존 함수 `renderProfileRecent`(3495-3497)는 `entry.kr`/`entry.sci` 를 `innerHTML` 템플릿에 직접 삽입한다. 같은 `entoma_recent` 데이터원을 쓰지만 이번 작업이 건드리지 않은 사전 존재 코드(요구사항서에서 수정 금지 명시)라 이번 리뷰 대상은 아니다. 다만 신규 `renderRecentPage` 가 바로 이 함정을 피해 안전하게 구현됐다는 점을 확증한다. 별도 정리 시 오케스트레이터가 인지하도록 남겨 둔다.

2. **히스토리/뒤로가기 정합성 (통과)** — `pageRecent` 가 `SWIPE_BACK_BLOCKED_PAGES`(1030), `PAGE_HASHES`(1682-1685), `_subPageBackTarget` 초기값(1033) **어디에도 없음**(grep로 교차 확인). `recentBackBtn`(1933)은 `history.back()` 이 아니라 `showPage('pageProfile',{restoreScroll:true,dir:'back'})` 직접 호출 → `pageSaved`(1920) 패턴과 바이트 단위로 동일. `showPage('pageRecent',{dir:'forward'})` 는 hash 없음 → `replaceState` 경로(1774-1777)로 처리되어 pageSaved와 동일한 단순 서브페이지로 동작.

3. **`fromPage` 전파 → 종 상세 복귀 (통과)** — `buildResultItem(ins,'pageRecent')` → li 클릭 → `openSpeciesFromIndex(ins,'pageRecent')`(2100) → `openSpeciesDetail(...,'pageRecent')`(3309): `previousSpeciesPage='pageRecent'` 저장 후 `showPage('pageSpeciesDetail',{keepNav:true})`. `pageSpeciesDetail` 은 `PAGE_HASHES` 에 있으므로 `_subPageBackTarget['pageSpeciesDetail']='pageRecent'`(1772) 기록 + `pushState`. 종 상세 뒤로가기 `history.back()` → popstate `e.state.page='pageRecent'` → `showPage('pageRecent',...)` + `syncNavForPage('pageRecent')` + `pageshow:pageRecent` 재렌더. **정확히 pageRecent로 복귀** 확인. (네이티브 스와이프 프리뷰 경로도 `_subPageBackTarget` 값이 pageRecent로 갱신되어 pageSaved와 동일하게 동작.)

4. **이벤트 리스너 누수 없음 (통과)** — `pageshow:pageRecent` document 리스너는 스크립트 초기화 시 **1회만** 등록(grep count=1). 재렌더 시 `list.innerHTML=''` 로 기존 `<li>` 를 제거하면 그에 붙은 click/keydown 리스너도 노드와 함께 GC 대상이 되고, `buildResultItem` 은 매 호출마다 **새로 만든** `<li>` 에만 리스너를 부착 → 동일 엘리먼트 중복 부착 없음.

5. **매칭 실패 빈 상태 (통과)** — `arr.length===0` 조기 반환(빈 최근 목록) + `if(!frag.childElementCount)` 가드(전부 매칭 실패)로 두 경우 모두 empty-state 노출 + `list.hidden=true`. `if(ins)` 가드로 미매칭 항목 조용히 스킵(throw 없음). `renderSavedPage` 와 동일한 빈 상태 시맨틱.

6. **접근성 (통과, pageSaved 동급)** — `recentResultList` 에 `role="list"` + `hidden`(509), `recentBackBtn` 에 `aria-label="뒤로"`(498), empty-state div는 `hidden` 없이 시작해 JS 토글(컨벤션 동일). 아이콘 SVG는 라벨된 버튼/빈상태 내부의 장식 요소로 pageSaved와 동일 처리. 신규 페이지 접근성 수준이 원본과 일치.

7. **`syncNavForPage` 부작용 없음 (통과)** — 1713행에서 기존 `pageProfile || pageSaved` else-if 에 `|| pageId === 'pageRecent'` 만 추가. 이전에는 pageRecent가 `else → navDiscover`(오작동)로 빠졌을 것을 navProfile로 교정하는 것으로, 추가된 OR 조건은 pageRecent 외 다른 페이지의 분기 결과를 바꾸지 않는다.

**부가 확인**: 신규 id 4종(`pageRecent`/`recentBackBtn`/`recentResultList`/`profileRecentViewAll`) 문서 내 유일(각 정의 1회), `#pageRecent .saved-empty-state` 셀렉터 단일 해석, 인덴트 2칸·`const`/`let`·세미콜론 등 CLAUDE.md 코드 규약 준수. `style.css` 무수정 확인.

---

### 종합 평가

`#pageSaved` 패턴을 XSS 회피 지점(raw entry 대신 search_index `ins` 사용)·라우팅 상수 제외·리스너 등록 위치·접근성·문구까지 정확히 복제한 견고한 구현으로, 요청된 7개 확인 항목 전부 통과했고 **Critical·Warning 0건**이다. 제안 사항(find→Map 최적화)은 실사용 규모에서 무해한 선택 개선이며 현 구현 그대로 배포 가능하다.
