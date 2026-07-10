## 문서화 완료

### 생성/갱신된 파일
- 없음 — 프로젝트에 README나 별도 인터랙션 문서가 존재하지 않아 새 문서를 만들지 않음.

### 문서를 갱신하지 않은 이유
- 프로젝트 루트·`project/` 어디에도 README나 캐러셀/인터랙션 관련 문서 파일이 없음 (`README*` 검색 결과 없음).
- 작업 지시상 "없다면 무리하게 새 문서를 만들지 말고 변경 요약만 정리해도 충분"에 해당하므로, README 신규 생성 대신 아래 변경 요약을 기록함.
- 코드 주석은 CLAUDE.md 규칙(불필요한 주석 추가·삭제 금지)에 따라 변경하지 않음. `renderHeroCarousel()` 내부에는 이미 최소 주석(포인터 스와이프 40px 설명 등)이 있어 추가 불필요.

### 변경된 캐러셀 인터랙션 동작 (실제 코드 기준 · `project/index.html` `renderHeroCarousel()`, line 2781~2869)

곤충 상세 페이지(`#pageSpeciesDetail`) 히어로 사진 캐러셀의 이동 방식이 다음과 같이 정리됨:

- **좌우 이동 버튼 없음**: 기존 `.species-hero-nav--prev` / `.species-hero-nav--next` DOM 버튼과 `arrowSvg()` 헬퍼, 클릭 리스너를 모두 제거. `project/style.css`의 `.species-hero-nav` 계열 규칙(및 `/* Prev / Next 화살표 버튼 */` 주석)도 삭제됨. 두 파일 모두 `species-hero-nav` 참조가 전혀 남아있지 않음(grep 확인).

- **포인터 스와이프로 이동**: `touchstart`/`touchend`(터치 전용) 기반 로직을 pointer 이벤트로 교체 (CLAUDE.md "pointer 이벤트 사용, touch 이벤트 혼용 금지" 규칙 준수). `track` 요소에 다음 3개 리스너 등록:
  - `pointerdown`: `activePointerId === null`일 때만 제스처 시작. `activePointerId = e.pointerId`, `startX = e.clientX` 저장, `track.setPointerCapture(e.pointerId)` 호출(존재 시). 진행 중 다른 포인터(멀티터치/핀치줌 두 번째 손가락)는 초입에서 무시.
  - `pointerup`: 동일 `pointerId`일 때만 처리. `delta = e.clientX - startX`, `Math.abs(delta) > 40`이면 이동 — 오른쪽으로 끌면(delta > 0) 이전 슬라이드(`idx-1`), 왼쪽으로 끌면 다음 슬라이드(`idx+1`). `goTo()`는 모듈러 연산으로 순환(첫 장에서 이전 → 마지막 장).
  - `pointercancel`: 동일 `pointerId`일 때 `activePointerId = null`로 리셋만 하고 페이지 전환은 하지 않음(취소된 제스처는 무효).

- **스와이프 임계값**: 40px (`Math.abs(delta) > 40`). 기존 값과 동일하게 유지.

- **`pointermove` 미등록**: 시작/끝 좌표만으로 임계값을 판정하며, 드래그 중 실시간 `translateX` 프리뷰는 제공하지 않음(최소 변경 원칙). `setPointerCapture` 덕분에 트랙 밖에서 손을 떼도 `pointerup` 수신.

- **도트 인디케이터로 위치 확인·이동**: `.species-hero-dots`(`role="tablist"`) 안의 `.species-hero-dot` 버튼(`role="tab"`, `aria-label="사진 N / 총장수"`, 활성 시 `aria-selected="true"`)이 그대로 유지됨. 도트 클릭 시 해당 인덱스로 이동(`goTo(i)`). 버튼이 사라진 지금 도트가 **유일한 비-제스처 이동/위치 표시 수단**임.

- **경계 동작**: 이미지가 1장이면 `if (images.length === 1) return;`으로 도트·스와이프 리스너 등록을 모두 스킵. 이미지 0장이면 플레이스홀더만 표시. (중복 제거 후 최대 3장으로 캡)

### 참고 (문서화 범위 밖)
- `renderSpeciesDetail()` 상단 주석(line 2880 인근)에 "좌우 스와이프/버튼/도트 인디케이터"라는 표현이 남아 있어 버튼 제거 후 기술적으로 stale함. 다만 CLAUDE.md의 "불필요한 주석 추가·삭제 금지" 규칙과 본 작업 지시(주석 미변경)에 따라 이번 문서화 작업에서는 수정하지 않음. 필요 시 개발 에이전트가 별도 판단 요망.
