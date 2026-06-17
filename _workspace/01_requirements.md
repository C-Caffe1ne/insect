# 요구사항

## 사용자 요청
> 내 정보 페이지에서 뱃지 관련 제거, 영어를 한글로 번역, 폰트 설정, 즐겨찾기 한 곤충들 즐겨찾기 페이지에서 볼 수 있도록 해줘

## 분류된 작업 유형
기능 추가 + 콘텐츠 수정 (4가지 독립 태스크)

## 관련 파일
- `project/index.html` — 메인 파일 (모든 페이지 포함)
- `project/style.css` — 스타일 (폰트, saved/profile 페이지 관련)
- `project/fonts/` — LINESeedKR-Rg.woff2 (Regular만 존재)

---

## 태스크 상세

### 1. 내 정보 페이지(`#pageProfile`) — 뱃지 관련 제거
제거 대상:
- `<!-- Badges Earned Section -->` 전체 (`<section class="profile-section">` ~ `</section>`, line ~658-717)
- 통계 캡슐의 BADGES stat item (`profile-stat-item` 중 BADGES 항목 + 좌우 divider 중 하나)
- `style.css`에서 badge 관련 CSS 클래스 전체 제거: `.badge-item`, `.badge-ring`, `.badge-ring--*`, `.badge-name`, `.profile-badges-scroll`

### 2. 내 정보 페이지 + 기타 — 영어 → 한글 번역
**`#pageProfile`에서 변경:**
| 영어 (현재) | 한글 (변경) |
|---|---|
| `aria-label="Go Back"` | `aria-label="뒤로"` |
| `aria-label="Settings"` | `aria-label="설정"` |
| `VIEWED` (stat label) | `조회` |
| `SAVED` (stat label) | `저장` |
| `My Collection` (section title) | `나의 컬렉션` |
| `Species you've fallen for` (subtitle) | `관심 있는 곤충들` |
| `VIEW ALL` (링크 3개) | `전체 보기` |
| `FAVORITE` (collection-tag 2개) | `즐겨찾기` |
| `Recently Encountered` (section title) | `최근 만난 곤충` |
| `Your latest encounters` (subtitle) | `최근에 발견한 곤충들` |
| `TODAY` (recent-time-badge) | `오늘` |
| `YESTERDAY` | `어제` |
| `2 DAYS AGO` | `2일 전` |

**`index.html` head/meta에서 변경:**
- title: `ENTOMA · KR — Insect Encyclopedia` → `ENTOMA · KR — 한국 곤충도감`
- meta description: 영어 설명 → `한국 곤충 분류와 종 정보를 탐색하는 프리미엄 곤충도감입니다.`

### 3. 폰트 설정 (`style.css`)
현재 상황: LINE Seed KR Regular(400)만 로드됨. Bold 파일 없음.
- style.css `@font-face`에서 `LINESeedKR-Rg 2.woff2` (중복 파일) 참조 제거 (이미 없음)
- `font-weight: 600` / `700` 사용 시 LINE Seed KR가 작동하도록 `@font-face`에 `font-weight: 400 900` 범위 선언 추가 (synthetic bold 허용)
- Cormorant Garamond Google Fonts `<link>` 에 `LINESeed KR`는 이미 local이므로 충분
- LINE Seed KR 한글 Bold는 cdnjs를 통해 가져오거나, `@font-face` 정의에 `font-weight: 100 900`로 범위를 넓혀 합성 볼드 활용
- 실용적 접근: `@font-face` 두 개를 선언 — weight 400 (Rg) + weight 700 (Rg, 합성볼드 허용)

### 4. 즐겨찾기 페이지(`#pageSaved`) — 실제 즐겨찾기 곤충 표시

현재: 빈 상태만 보여줌 (`.saved-empty-state`)
변경: `localStorage('entoma_favorites')` 에서 학명 Set 로드 → search_index에서 매칭 → 카드 렌더링

**HTML 변경:**
- `<div class="saved-page-header">` 다음에 `<ul class="saved-result-list" id="savedResultList" role="list"></ul>` 추가
- 빈 상태 div는 유지 (JS로 표시/숨김)

**CSS 추가:**
- `.saved-result-list` — `search-result-list`와 동일한 스타일 재사용 (같은 클래스 사용 가능)
- 또는 `.saved-result-list { list-style: none; padding: 0 16px; margin: 0; }`

**JS 추가 (즐겨찾기 페이지 진입 시 렌더링):**
```javascript
async function renderSavedPage() {
  const list = document.getElementById('savedResultList');
  const emptyState = document.querySelector('#pageSaved .saved-empty-state');
  if (!list) return;

  const favs = loadFavorites(); // 기존 함수 재사용
  list.innerHTML = '';

  if (favs.size === 0) {
    emptyState?.removeAttribute('hidden');
    list.hidden = true;
    return;
  }

  // 검색 인덱스 로드 (이미 캐시돼 있으면 즉시 반환)
  const data = await loadSearchIndex();
  const insects = data?.insects || [];
  const matched = insects.filter(ins => favs.has(ins.sci));

  if (matched.length === 0) {
    emptyState?.removeAttribute('hidden');
    list.hidden = true;
    return;
  }

  emptyState?.setAttribute('hidden', '');
  list.hidden = false;
  matched.forEach(ins => {
    const li = buildResultItem(ins); // 기존 함수 재사용
    // fromPage를 'pageSaved'로 설정하여 뒤로가기 시 즐겨찾기 페이지로 돌아오게
    li.addEventListener('click', () => openSpeciesFromIndex(ins, 'pageSaved'), { once: true }); // 이미 click 리스너가 있으니 이 방식은 주의
    list.appendChild(li);
  });
}
```

**주의:** `buildResultItem`이 이미 내부에서 `openSpeciesFromIndex(ins)` click 리스너를 붙이므로 중복 방지.
대신 `buildResultItem`은 재사용, `openSpeciesFromIndex` 호출 시 `fromPage` 인자를 `'pageSaved'`로 넘겨야 뒤로가기가 즐겨찾기 페이지로 돌아옴.
→ `buildResultItem`에 `fromPage` 파라미터 추가하거나, `renderSavedPage`에서 리스너를 교체하는 방식 사용.

**가장 간단한 구현:** `buildResultItemForSaved(ins)` — `buildResultItem` 복사 후 click handler만 `openSpeciesFromIndex(ins, 'pageSaved')`로 변경. 단, 코드 중복 최소화 위해 `buildResultItem(ins, fromPage='pageSearch')` 파라미터화 권장.

**pageshow 이벤트 연결:**
```javascript
document.addEventListener('pageshow:pageSaved', renderSavedPage);
```

### 참고 사항
- `openSpeciesFromIndex(ins, fromPage)` — 두 번째 인자가 있으면 뒤로가기 대상 페이지로 사용됨 (기존 코드 확인 필요)
- `loadSearchIndex()` — search_index.json을 fetch하는 기존 함수 (캐시 있으면 즉시 resolve)
- `loadFavorites()` / `FAV_KEY` — 이미 선언되어 있음 (script 맨 아래쪽)
- `buildResultItem(ins)` — 검색 결과 카드 생성 함수, 재사용
- 즐겨찾기 목록은 페이지 진입 시마다 새로고침 (heart 토글 후 다시 와도 최신 반영)
- 빈 상태(`saved-empty-state`)는 `hidden` 속성으로 표시/숨김 처리
