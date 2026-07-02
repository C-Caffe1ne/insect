## 구현 완료

### 생성/수정된 파일
- `project/index.html` — `renderHeroCarousel(heroImg, species)` 함수 수정 (약 2781~2870줄)
  - `prevBtn`/`nextBtn` DOM 생성 코드, `heroImg.append(prevBtn, nextBtn)`, `arrowSvg` 헬퍼, 두 버튼의 click 리스너 전부 제거.
  - `touchstart`/`touchend` 스와이프 로직을 `pointerdown`/`pointerup`/`pointercancel` 기반으로 교체.
- `project/style.css` — `/* Prev / Next 화살표 버튼 */` 주석 및 `.species-hero-nav`, `.species-hero-nav:active`, `.species-hero-nav--prev`, `.species-hero-nav--next` 규칙 삭제 (기존 약 2205~2228줄). 도트 CSS는 미변경.

### 데이터 바인딩
- 변경 없음. `species.images` 배열을 슬라이드로 렌더링하는 기존 바인딩 그대로 유지.

### 제거한 요소
- 버튼: `prevBtn`(`.species-hero-nav--prev`), `nextBtn`(`.species-hero-nav--next`)
- 헬퍼: `arrowSvg(dir)` — grep 확인 결과 이 함수 내부에서만 사용되어 안전하게 삭제
- 리스너: prevBtn/nextBtn click 리스너, track의 `touchstart`/`touchend` 리스너
- CSS 규칙 4개 + 주석 1개

### 새로 추가한 pointer 이벤트 리스너
- `track` `pointerdown`: `activePointerId === null`일 때만 시작. `activePointerId = e.pointerId`, `startX = e.clientX` 저장, `track.setPointerCapture(e.pointerId)` 호출(존재 시).
- `track` `pointerup`: `e.pointerId === activePointerId`일 때만 처리. `delta = e.clientX - startX`, `Math.abs(delta) > 40`이면 `goTo(delta > 0 ? idx-1 : idx+1)`. 이후 `activePointerId = null`.
- `track` `pointercancel`: 동일 pointerId일 때 `activePointerId = null`로 제스처 리셋.
- 임계값: 기존과 동일한 40px 유지.
- 도트 click 리스너는 그대로 유지.

### 주요 설계 결정
1. `pointermove`는 등록하지 않음 — 최소 변경 원칙. 기존 로직도 시작/끝 좌표만으로 임계값 판정했고, `translateX` 실시간 프리뷰는 요구사항이 아니라 생략. `setPointerCapture` 덕분에 pointerup은 track 밖에서 떼도 수신됨.
2. `activePointerId` 단일 변수로 방어 — 캐러셀은 단일 드래그이므로 `Map` 없이도 충분. 첫 포인터만 제스처를 소유하고 이후 포인터(핀치줌 두 번째 손가락 등)는 `pointerdown` 초입에서 무시.
3. `if (images.length === 1) return;`는 위치 그대로 유지 → 1장이면 pointer 리스너 등록 자체가 스킵됨.
4. `track`의 `touch-action: pan-y pinch-zoom`(style.css)는 그대로 두어 세로 스크롤/핀치줌은 브라우저에 위임.

### 코드 리뷰어 확인 요청 사항
- pointerId 충돌 방어: 진행 중 제스처와 다른 pointerId 이벤트를 `pointerup`/`pointercancel`에서 조기 return하는지 확인.
- `setPointerCapture` 존재 여부 가드(`if (track.setPointerCapture)`) — 구형 환경 호환성. iOS WKWebView에서 정상 동작하는지 QA 검토 권장.
- 접근성: 좌우 버튼 제거로 비-제스처 이동 수단이 도트 버튼(`.species-hero-dot`, `role="tab"`)만 남음. 도트의 `role="tablist"`/`role="tab"`/`aria-label`/`aria-selected`는 기존 유지됨 — 키보드 접근 정책상 충분한지 판단 요청.
- `pointercancel` 시 delta 판정 없이 리셋만 하는 동작이 의도대로인지(취소된 제스처는 페이지 전환하지 않음).
