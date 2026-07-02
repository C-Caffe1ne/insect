## QA 검증 결과

대상: `project/index.html` `renderHeroCarousel()` (2781~2869), 렌더 호출부 (2872~2882), `project/style.css` `.species-hero-*` (2145~2236)
작업: 히어로 캐러셀 좌우 버튼 제거 + touch→pointer 스와이프 전환

### Pass ✅

- **species-hero-nav 완전 제거 (HTML/JS)**: `grep`으로 `index.html` 전체 검색 결과 `species-hero-nav`, `prevBtn`, `nextBtn`, `arrowSvg`, `touchstart`, `touchend` 모두 0건. DOM 생성 코드에도 nav 버튼 생성 라인이 없음(2799~2831은 track/slide/dots만 생성). querySelector 대상과 실제 DOM 생성이 일치.

- **species-hero-nav CSS 규칙 제거 (dead selector 없음)**: `style.css`에서 `.species-hero-nav*` 규칙 4개 + `/* Prev / Next 화살표 버튼 */` 주석 완전 삭제. 현재 `.species-hero-*` 셀렉터는 img/track/slide/placeholder/dots/dot/dot.active만 존재(2145~2231). JS가 생성하는 클래스(`species-hero-track`, `species-hero-slide`, `species-hero-dots`, `species-hero-dot`, `active`)와 1:1 대응 — dead selector 및 미정의 클래스 없음.

- **pointer 리스너 대상 엘리먼트 존재 정합성**: `pointerdown`/`pointerup`/`pointercancel`(2852/2859/2865) 모두 `track`(2800 `document.createElement('div')`, 2801 `species-hero-track`, 2813 `heroImg.appendChild(track)`)에 등록. 리스너 대상이 실제 DOM에 append됨 — 끊긴 참조 없음.

- **touch-action CSS 적용 위치 일치**: pointer 리스너가 붙는 `track`의 클래스 `.species-hero-track`에 `touch-action: pan-y pinch-zoom`(style.css:2186)이 정확히 적용됨. 가로 스와이프는 캐러셀, 세로 스크롤/핀치줌은 브라우저 위임 — 리스너 대상과 touch-action 대상 동일 엘리먼트로 일치.

- **data-slot="heroImg" 셀렉터 정합성**: JS `page.querySelector('[data-slot="heroImg"]')`(2881)의 대상이 HTML `<div class="species-hero-img" id="speciesDetailHeroImg" data-slot="heroImg">`(index.html:172)에 실제 존재. `#pageSpeciesDetail` 마크업 내부에 위치. 렌더 진입점 정상 연결.

- **이미지 장수 분기 무모순**:
  - 0장(2792~2796): placeholder 후 return — track/dots/리스너 미생성.
  - 1장(2816 `if (images.length === 1) return;`): track만 생성 후 return → dots·pointer 리스너 등록 스킵. 스와이프 대상 없음이 의도대로.
  - 2·3장: dots + goTo + pointer 리스너 등록.
  - 상한 캡(2785 `if (images.length >= 3) break;`): 최대 3장. `goTo`의 `images.length` 순환(2836)은 실제 slide 수와 동일 배열 기준이라 도트 수·슬라이드 수·순환 모듈로가 모두 3으로 일치. 분기 간 모순 없음.

- **도트 클릭 ↔ 스와이프 상태 일관성**: 두 경로 모두 동일 `goTo()`(2835) 호출.
  - 도트 클릭(2846): `goTo(i)`.
  - 스와이프(2863): `goTo(delta > 0 ? idx - 1 : idx + 1)`.
  `goTo`가 `idx`(2836), `track.style.transform`(2837), 모든 도트의 `.active` 토글(2840), `aria-selected`(2841)를 단일 지점에서 갱신 → 두 경로가 동일 상태로 수렴. 불일치 경로 없음.

- **goTo 순환 안전성**: `((target % n) + n) % n`(2836)으로 음수 인덱스(idx 0에서 좌스와이프 → -1)도 마지막 슬라이드로 안전 순환. 경계값 정상.

- **pointerId 충돌 방어**: `pointerdown`은 `activePointerId !== null`이면 조기 return(2854), `pointerup`/`pointercancel`은 `e.pointerId !== activePointerId`이면 조기 return(2860/2866). 첫 포인터만 제스처 소유, 핀치줌 2번째 포인터 무시 — 정상.

- **setPointerCapture 가드**: `if (track.setPointerCapture)`(2857)로 존재 확인 후 호출. 미지원 환경 예외 없음.

- **리스너 누수 없음**: 재렌더 시 `heroImg.replaceChildren()`(2790)로 이전 track DOM 통째 교체 → 이전 리스너 GC. `dataset.currentSig` 캐싱(2788)으로 동일 이미지셋 재호출 시 재렌더 스킵. 누적 없음.

- **도트 CSS 정상 작동**: `.species-hero-dots`(pointer-events:none, 컨테이너 통과) + `.species-hero-dot`(pointer-events:auto, 클릭 가능) + `.species-hero-dot.active`(2227, 활성 표시) 조합 유지. JS `classList.toggle('active')`(2840)가 CSS `.active` 규칙과 정확히 매칭.

### Fail ❌

- 없음.

### 수동 테스트 필요

- **iOS WKWebView pointer 이벤트 실동작**: `setPointerCapture` 및 pointerdown/up 좌표(`e.clientX`)가 WKWebView에서 정확히 발화하는지는 코드 레벨로 보장 불가. 실기 스와이프(좌/우, 40px 임계값 근처, track 밖에서 손 떼기) 확인 권장. (developer가 요청한 검토 항목)
- **핀치줌 중 캐러셀 오동작 방지 실측**: `activePointerId` 단일 변수 방어는 코드상 정상이나, 두 손가락 동시 터치 → 확대 시 캐러셀이 넘어가지 않는지 실기 확인 필요.
- **capture 미지원 환경에서 activePointerId 고착 위험**: 리뷰 Suggestion(03:26)대로 track 밖에서 손 떼면 pointerup 미수신 → activePointerId 고착 가능성. 실사용 대상(모던 브라우저/WKWebView)은 전부 capture 지원이라 실질 위험 낮으나, `pointermove` 없이 시작/끝 좌표만 쓰므로 재현 시 관찰 필요.

### 참고 (리뷰 Warning — 미수정 상태, QA 범위 밖)

- [index.html:2841] 비활성 도트에서 `aria-selected`를 `removeAttribute`(리뷰 권장: `'false'` 명시). 기능 결함 아님(스와이프/클릭 동작 정상), 접근성 정합성 개선 여지. 현재 코드 그대로.
- [index.html:2845~] 도트 tablist에 화살표 키(keydown) 핸들러 부재. `<button>`이라 Enter/Space 클릭은 브라우저 처리되어 도트 조작 자체는 키보드로 가능하나 tablist 관례상 화살표 이동 미지원. 기능 Fail 아님.
- [index.html:2880 / 2783 / style.css:2177] 주석 stale — "최대 5장"인데 실제 `>= 3` 캡. index.html:2880 주석은 아직 "(최대 5장, ...)"로 남아있음. 오케스트레이터가 수정 완료했다고 전달받았으나 QA 재확인 시점에는 2880·2783·css:2177 주석 모두 "5장" 표기 잔존. 코드 동작에는 무영향(순수 주석).

### 종합: 전체 Pass

경계면 교차 검증(HTML↔CSS↔JS) 전 항목 통과. Critical/Fail 0건. 셀렉터-DOM-CSS 3자 정합성, pointer 리스너 대상, 장수 분기, 도트/스와이프 상태 일관성 모두 확인. 남은 항목은 실기 수동 테스트(iOS WKWebView 제스처) 및 리뷰 Warning 수준의 접근성/주석 개선(기능 무영향).
