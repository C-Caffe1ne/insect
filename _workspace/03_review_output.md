## 코드 리뷰 결과

대상: `project/index.html` `renderHeroCarousel()` (2781~2869), `project/style.css` (2145~2236)
작업: 히어로 캐러셀 좌우 버튼 제거 + touch → pointer 이벤트 전환

### Critical (즉시 수정 필요)
- 없음. XSS(모든 데이터가 `createElement`+`textContent`/속성 바인딩, `innerHTML` 미사용), null 접근, 리스너 누수 관점에서 Critical 이슈 없음.

### Warning (권장)
- [index.html:2846] 도트 접근성 — 키보드 이동 수단 부재
  `.species-hero-dot`에 `role="tab"`이 부여되어 있으나 `keydown`(Enter/Space/화살표) 핸들러가 없다. `<button>` 요소라 Enter/Space 클릭은 브라우저가 처리하지만, 좌우 이동 버튼이 제거되어 도트가 유일한 비제스처 이동 수단이 된 상황에서 `role="tablist"`는 화살표 키 네비게이션(WAI-ARIA tablist 관례)을 기대하게 만든다. 화살표 키 핸들러를 추가하거나, tablist가 아니라면 role을 떼고 순수 `<button>` 그룹으로 두는 편이 접근성 계약과 일치한다.
  → 수정 제안(선택 A — 화살표 키 지원):
  ```js
  dots.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(idx + 1); dots.children[idx].focus(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(idx - 1); dots.children[idx].focus(); }
  });
  ```
- [index.html:2841] `aria-selected` 제거 방식 — tab 역할과 불일치
  비활성 도트에서 `aria-selected`를 `removeAttribute`하는데, `role="tab"` 요소는 상태를 명시(`aria-selected="false"`)하는 것이 스크린리더에 더 일관적이다. 속성 자체를 지우면 "선택 안 됨"이 아니라 "속성 없음"으로 읽힐 수 있다.
  → 수정 제안: `d.setAttribute('aria-selected', on ? 'true' : 'false');`

### Suggestion (선택)
- [index.html:2880] 주석-코드 불일치: 렌더 호출부 주석이 "(최대 5장, 좌우 스와이프/버튼/도트 인디케이터)"로 남아있는데, 실제로는 버튼이 제거되었고 캡도 3장(2785 `images.length >= 3`)이다. 주석을 "(최대 3장, 좌우 스와이프/도트 인디케이터)"로 갱신 권장.
- [index.html:2783] 동일하게 "최대 5장 캡" 주석이 실제 `>= 3` 로직과 불일치 (이번 작업 범위 밖이지만 함께 정리하면 좋음).
- [index.html:2865] `pointercancel`이 delta 판정 없이 리셋만 하는 것은 의도대로 정상(취소된 제스처는 페이지 전환 안 함). 다만 `pointerup`/`pointercancel`이 track 밖에서 발생할 때를 위해 `setPointerCapture`에 의존하는데, capture 미지원(구형) 환경에서는 드래그를 track 밖에서 놓으면 `pointerup`이 안 잡혀 `activePointerId`가 고착될 수 있다. 실사용 대상(iOS WKWebView/모던 브라우저)은 전부 capture 지원이라 실질 위험은 낮음.

### 개별 확인 항목 결과 (developer 요청 사항)
- pointerId 충돌 방어: 정상. `pointerdown`은 `activePointerId !== null`이면 조기 return(2854), `pointerup`/`pointercancel`은 `e.pointerId !== activePointerId`이면 조기 return(2860, 2866). 첫 포인터만 제스처를 소유하고 이후 포인터(핀치줌 2번째 손가락) 무시 — 올바름.
- `setPointerCapture` 가드: 정상. `if (track.setPointerCapture)`(2857)로 메서드 존재 확인 후 호출. 예외 위험 없음.
- 리스너 누수: 없음. 재렌더 시 `heroImg.replaceChildren()`(2790)로 이전 `track` DOM이 통째 교체 → 예전 track에 붙은 pointer 리스너는 참조 소멸로 GC됨. 리스너는 매번 새로 생성된 track에만 등록되므로 누적 없음. 추가로 `dataset.currentSig` 캐싱(2788)으로 동일 이미지셋 재호출 시 재렌더 자체를 스킵.
- `goTo()` 순환 로직: 정상. `((target % n) + n) % n`(2836) — 음수 인덱스(idx-1 at idx 0)도 안전하게 마지막 슬라이드로 순환.
- 도트 속성 유지: `role="tablist"`(2821), `role="tab"`(2826), `aria-label`(2827), `aria-selected`(2828/2841) 모두 유지됨. (단 위 Warning의 상태 표기 방식 개선 여지 있음)
- 잔여 참조: 없음. `species-hero-nav`, `prevBtn`, `nextBtn`, `arrowSvg`, `touchstart`, `touchend` — index.html 전체 grep 결과 0건.
- CSS 정리: `.species-hero-nav*` 규칙 4개 + 주석 완전 제거 확인. 도트 CSS(`.species-hero-dots`/`.species-hero-dot`/`.active`) 미변경 유지. `.species-hero-track`의 `touch-action: pan-y pinch-zoom`(2186) 유지 확인.

### 종합 평가
요구사항 대비 구현이 정확하고 pointer 전환·버튼/CSS 제거·pointerId 방어·capture 가드가 모두 견고하다. Critical 0건이며, 남은 개선은 도트 키보드 접근성 강화와 주석 현행화 수준의 경미한 사항이다.
