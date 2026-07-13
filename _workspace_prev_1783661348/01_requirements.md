## 요구사항

### 사용자 요청
곤충 상세 페이지(#pageSpeciesDetail)의 사진 캐러셀을 좌우 스와이프(제스처)로 넘길 수 있게 하고, 좌우 이동 버튼은 삭제해줘.

### 분류된 작업 유형
기능 수정 (기존 캐러셀 인터랙션 변경)

### 관련 파일
- project/index.html (JS: `renderHeroCarousel()` 함수, 약 line 2779-2878)
- project/style.css (`.species-hero-nav` 관련 규칙, 약 line 2205-2228)

### 현재 상태
- `renderHeroCarousel(heroImg, species)` 함수가 `pageSpeciesDetail`의 히어로 이미지 캐러셀을 렌더링.
- 현재 `prevBtn`/`nextBtn` (`.species-hero-nav`, `.species-hero-nav--prev`, `.species-hero-nav--next`) DOM 버튼이 존재하고 클릭 리스너로 `goTo(idx±1)` 호출.
- 스와이프는 이미 구현되어 있으나 `touchstart`/`touchend` (터치 전용) 이벤트 기반 — CLAUDE.md 규칙상 "pointer 이벤트 사용, touch 이벤트와 혼용 금지" 위반 상태.
- 도트 인디케이터(`.species-hero-dots` / `.species-hero-dot`)는 유지.
- `track`에는 `touch-action: pan-y pinch-zoom` CSS가 이미 적용됨 (style.css:2186) — pointer 이벤트로 전환해도 유지 필요.

### 변경 계획
1. **index.html**: `renderHeroCarousel()` 내부
   - `prevBtn`/`nextBtn` 생성, `heroImg.append(prevBtn, nextBtn)`, 관련 클릭 리스너, `arrowSvg()` 헬퍼(다른 곳에서 미사용 시) 전부 제거.
   - `touchstart`/`touchend` 리스너를 `pointerdown`/`pointermove`/`pointerup`(+`pointercancel`) 기반으로 교체. 드래그 중 `track`에 실시간 transform 프리뷰(선택) 또는 기존처럼 40px 임계값 넘으면 `goTo()` 전환만 해도 무방 — 최소 변경으로 기존 40px 임계값 로직 유지하며 pointer 이벤트로만 치환.
   - `pointerId` 추적해서 멀티터치/핀치줌과 충돌하지 않도록 처리 (CLAUDE.md: `Map<pointerId,{x,y}>` 패턴 참고, 단일 캐러셀 드래그이므로 단순 변수로도 충분하나 다른 pointerId 무시하도록 방어 코드 필요).
   - 이미지 1장일 때는 컨트롤 생략 로직(`if (images.length === 1) return;`) 유지 — 스와이프 리스너도 이 이후에 등록되므로 자동으로 스킵됨.

2. **style.css**: `.species-hero-nav`, `.species-hero-nav:active`, `.species-hero-nav--prev`, `.species-hero-nav--next` 규칙 삭제 (주석 `/* Prev / Next 화살표 버튼 */` 포함).

### 참고 사항
- CLAUDE.md 이미지 크롭 모달 규칙은 이 작업과 무관 (다른 기능).
- `.app` 외부 접근 금지, 인덴트 공백 2칸, 세미콜론 사용, `const`/`let`만 사용.
- 버튼 제거 후 접근성: 캐러셀에 키보드 접근 수단이 없어지므로 도트 버튼(`.species-hero-dot`)이 유일한 비-제스처 이동 수단이 됨 — 기존 `aria-label`, `role="tablist"`/`role="tab"` 유지 확인.
- 버튼 삭제 전 `species-hero-nav` 참조처가 다른 곳에 없는지 grep으로 확인 필요.
