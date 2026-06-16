## 코드 리뷰 결과 (EOL TraitBank 통합)

대상 변경분
- `cached/cache_eol_species.mjs` (신규, 413줄)
- `project/index.html` 인라인 스크립트의 다음 영역
  - 모듈 상태 1106–1108 (`eolCacheData`, `eolCacheLoading`)
  - 종 카드 클릭 핸들러 1464–1485 (`renderSpeciesSorted` 내부)
  - `loadEolCache()` 사전 호출 1594–1595
  - `canonicalizeSciName` 2044–2060
  - `loadEolCache` 2062–2081
  - `enrichSpeciesWithEol` 2085–2143
  - `openSpeciesDetail` 2145–2163

직전 리뷰(`_workspace_prev/03_review_output.md`)의 Critical 이슈 중 C-1/C-2(escapeHTML), C-4(fetch r.ok), C-7(window mouseup), C-8(검색 입력 aria-label 일부)는 이번 변경 영역에 영향을 주지 않으며 별개 PR에서 처리 예정. EOL 통합 변경분만 본 리뷰의 대상이다.

먼저 보안 상태 요약: `cached/eol_species_cache.json`, `project/eol_species_cache.json`을 직접 grep한 결과 토큰/키 문자열이 캐시 산출물에 섞이지 않았다. Node 스크립트 `apiKey`는 환경변수에서만 읽으며, 어느 console 출력에도 `opts.apiKey`가 노출되지 않는다(verified). `.claude/settings.local.json`은 글로벌 git ignore(`**/.claude/settings.local.json`)로 저장소에 커밋되지 않으나, 로컬 디스크에 토큰이 평문으로 남아 있으니 사용자 측 EOL 계정에서 즉시 재발급해야 한다(요구사항 명시 항목 — 코드 측에서는 추가 조치 없음).

---

### Critical (즉시 수정 필요)

#### C-1. `enrichSpeciesWithEol`이 page 라이프사이클을 넘어 species 객체를 영구 mutate — race 시 잘못된 종 데이터 표시
[project/index.html:2085–2143, 2145–2163]
`openSpeciesDetail`는 `enrichSpeciesWithEol(species)`을 호출한 뒤 `selectedSpecies = enriched` 비교만으로 동시성을 막는데, `enrichSpeciesWithEol`은 **인자로 받은 species 객체 자체를 직접 변경**(`species.commonName = ...`, `species.habitat = ...`, `species.eolPageId = ...`)한다. `renderSpeciesSorted`의 `openDetail` 클로저는 카드를 누를 때마다 `buildPlaceholderSpecies()`로 새 객체를 만들어 넘기므로 1회 진입 시점에는 안전하지만, 다음 시나리오에서 문제가 된다.

1. 사용자가 종 A를 누른다 → enriched_A를 만들고 `selectedSpecies = enriched_A` 후 캐시 미적중이면 비동기 대기 시작.
2. 캐시 도착 전에 사용자가 종 B를 누른다 → enriched_B를 만들고 `selectedSpecies = enriched_B`.
3. 종 A의 then 콜백이 도착 → `selectedSpecies === enriched` 비교는 false라 재렌더는 안 되지만, **이미 enriched_A 객체에 `eolPageId`, `eolCanonical`, `habitat` 등이 박혀 있다**. 사용자가 뒤로 갔다가 같은 카드 A를 다시 누르면 `buildPlaceholderSpecies()`로 새 객체가 만들어지므로 다시 깨끗하나, **종 A의 enriched 객체가 외부 참조(예: 캐러셀 캐시, 즐겨찾기)로 보관되는 향후 코드에서는 stale 값이 그대로 노출**된다.

또한 race condition 자체에는 더 미묘한 버그가 있다: `openSpeciesDetail`의 가드 `if (!eolCacheData)`는 캐시 로드 완료 직전(`.then` 동기 부분 직후 다음 마이크로태스크) 사이에 새 클릭이 들어오면 첫 클릭은 `loadEolCache().then(...)`을 등록한다. 두 번째 클릭이 들어왔을 때는 `eolCacheData`가 채워졌을 수도, 아닐 수도 있어 두 경로가 동시에 활성화될 수 있다. `selectedSpecies === enriched` 가드가 막아주지만, **첫 enriched 객체에 빈 보강만 적용**되고 캐시가 늦게 도착한 경우 그 객체는 다시는 재렌더되지 않는다 — 사용자가 빠르게 A를 누른 뒤 뒤로 가서 다시 A를 보면 placeholder 그대로(새 객체에 캐시 적중)면 다행이지만, 같은 enriched_A 참조가 다른 흐름에서 유지되면 진짜 잠재 버그.

수정 제안 — (a) mutate 대신 copy를 반환하도록 함수 시그니처를 명시화하고, (b) race 가드를 토큰 기반으로 강화한다.

```js
// 1) 순수 함수로 — 입력 species를 변경하지 않고 새 객체 반환
function enrichSpeciesWithEol(species) {
  if (!eolCacheData || !species || !species.scientificName) return species;
  const canonical = canonicalizeSciName(species.scientificName);
  const entry = eolCacheData.species && eolCacheData.species[canonical];
  if (!entry || entry.status !== 'ok') return species;

  const t = entry.traitsSummary || {};
  const v = entry.vernaculars || {};
  const next = {
    ...species,
    taxonomy: species.taxonomy ? { ...species.taxonomy } : {},
    lifecycle: species.lifecycle ? { ...species.lifecycle } : {},
    conservationStatus: species.conservationStatus ? { ...species.conservationStatus } : {},
  };

  if ((!next.commonName || next.commonName === '이름 미상') && Array.isArray(v.ko) && v.ko.length > 0) {
    next.commonName = v.ko[0];
  }

  const parts = [];
  if (Array.isArray(t.habitat) && t.habitat.length > 0) parts.push(t.habitat.join(', '));
  if (Array.isArray(t.geographic) && t.geographic.length > 0) {
    const regions = t.geographic.slice(0, 10).join(', ');
    const suffix = t.geographic.length > 10 ? ` 외 ${t.geographic.length - 10}개 지역` : '';
    parts.push(`분포: ${regions}${suffix}`);
  }
  if (!next.habitat && parts.length > 0) next.habitat = parts.join(' · ');

  if ((!Array.isArray(next.habitatRegions) || next.habitatRegions.length === 0) && Array.isArray(t.geographic)) {
    next.habitatRegions = t.geographic.slice(0, 20);
  }

  if (!next.description) {
    const desc = [];
    if (Array.isArray(v.en) && v.en.length > 0) desc.push(`영명: ${v.en.slice(0, 3).join(' / ')}`);
    if (Array.isArray(v.ja) && v.ja.length > 0) desc.push(`일본어: ${v.ja.slice(0, 2).join(' / ')}`);
    if (Array.isArray(t.eats) && t.eats.length > 0) desc.push(`먹이: ${t.eats.slice(0, 5).join(', ')}`);
    if (Array.isArray(t.visitsFlowersOf) && t.visitsFlowersOf.length > 0) desc.push(`방문 꽃: ${t.visitsFlowersOf.slice(0, 5).join(', ')}`);
    if (t.gbifRecords) desc.push(`GBIF 관측 기록: ${Number(t.gbifRecords).toLocaleString('ko-KR')}건`);
    if (Array.isArray(t.introduced) && t.introduced.length > 0) desc.push(`도입 지역: ${t.introduced.join(', ')}`);
    if (desc.length > 0) next.description = desc.join(' · ');
  }

  if (!next.author || !next.year) {
    const rawSci = next.rawScientificName || next.scientificName || '';
    const yearMatch = rawSci.match(/\b(\d{4})\b/);
    if (yearMatch && !next.year) next.year = yearMatch[1];
    const authorMatch = rawSci.match(/\b([A-Z][A-Za-z'’.\- ]+?)(?:,?\s*\d{4})/);
    if (authorMatch && !next.author) next.author = authorMatch[1].trim();
  }

  next.eolPageId = entry.pageId;
  next.eolCanonical = canonical;
  return next;
}

// 2) 토큰 기반 race 가드 — 매 진입마다 증가, 늦게 도착한 then은 자기 토큰일 때만 갱신
let speciesDetailToken = 0;
function openSpeciesDetail(species, fromPage = 'pageFamilyDetail') {
  if (!species) return;
  const myToken = ++speciesDetailToken;
  const enriched = enrichSpeciesWithEol(species);
  selectedSpecies = enriched;
  previousSpeciesPage = fromPage;
  renderSpeciesDetail(enriched);
  showPage('pageSpeciesDetail', { keepNav: true });

  // 캐시가 아직 로드 중이라면 완료 후, 사용자가 같은 종에 머물러 있을 때만 재렌더
  if (!eolCacheData) {
    loadEolCache().then(() => {
      if (myToken !== speciesDetailToken) return; // 다른 종으로 이동했음
      const re = enrichSpeciesWithEol(species);
      selectedSpecies = re;
      renderSpeciesDetail(re);
    });
  }
}
```

#### C-2. `enrichSpeciesWithEol` — `species.scientificName`이 truthy하지만 `rawScientificName`이 undefined일 때 정규식 호출은 안전하나, 명명자 정규식이 `species` 자체 학명에서 명명자를 추출 못함
[project/index.html:2128–2136]
`renderSpeciesSorted`(1469줄)에서 `rawScientificName: item.scientificName`을 전달한다. 그런데 `buildPlaceholderSpecies`는 `species.scientificName`을 그대로 받은 값을 `species.scientificName`에 둔다 — 즉 raw와 동일한 값이다. 그래서 `Papilio xuthus Linnaeus, 1767` 같은 학명이 들어오면 `species.scientificName`에도 명명자가 박혀 있는 상태에서 `setSlot(page, 'scientificName', species.scientificName, ...)`로 전체 문자열이 표시되고, 이후 detail의 "학명" 행과 "명명자/연도" 행이 중복 표시된다(`fullScientificName`에 다시 `${species.scientificName} ${species.author}, ${species.year}` 형식으로 조합).

또한 보안 측면에서 문제는 아니지만, EOL 캐시 적중 시 `species.scientificName`을 canonical로 정규화하지 않아 detail 페이지의 학명 라벨이 깔끔하지 않다.

수정 제안 — 보강 시 학명을 canonical로 교체하고 raw는 별도 필드 보존.

```js
// enrichSpeciesWithEol 안에서:
if (canonical && canonical !== next.scientificName) {
  if (!next.rawScientificName) next.rawScientificName = next.scientificName;
  next.scientificName = canonical;
}
```

추가로 `renderSpeciesDetail`(1989줄 부근)에서 fullScientificName 조합 시 raw를 우선 사용하도록:

```js
const fullName = species.rawScientificName
  || (species.scientificName
        ? (species.author && species.year
            ? `${species.scientificName} ${species.author}, ${species.year}`
            : species.scientificName)
        : null);
setSlot(page, 'fullScientificName', fullName, '— 데이터 준비 중 —');
```

#### C-3. Cypher 인젝션 — `escapeCypher`가 `\` 외에 backtick/줄바꿈/유니코드 제어문자를 처리하지 않음
[cached/cache_eol_species.mjs:209–211, 213–214]
`escapeCypher`는 `\`→`\\`, `"`→`\"`만 치환한다. 입력이 `cached/korea_insect_species_by_family.json`(신뢰 가능한 정적 데이터)에서 오므로 현재 실위협은 낮으나, 다음 시나리오에서 깨진다.

1. `\n`, `\r`, `\t`가 학명에 포함되면 Cypher 쿼리 문자열 리터럴이 그대로 줄바꿈되어 파싱 에러(429/500 retry 트리거).
2. 향후 다른 텍스트 컬럼(예: `commonName`)을 쿼리 파라미터로 넣으면 한국어 따옴표/제로폭 공백 등으로 의도치 않은 동작 가능.
3. Neo4j는 `${...}` 보간을 지원하지 않으나 `$param` 형태의 파라미터 바인딩을 지원한다 — 안전한 길.

수정 제안 — (a) 즉각: escape 강화, (b) 본질적으로: parameter binding으로 전환. EOL의 Cypher 엔드포인트 명세에 따르나 보통 `{ query, params }` 형태를 지원.

```js
// 단기 패치
function escapeCypher(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/[ -]/g, ''); // 제어문자 제거
}

// 장기 패치 — parameter binding (EOL Cypher가 지원한다면)
async function fetchPageId(opts, canonical) {
  const q = `MATCH (p:Page) WHERE p.canonical = $canonical RETURN p.page_id AS page_id, p.canonical AS canonical, p.rank AS rank LIMIT 1`;
  const rows = rowsToObjects(await cypher(opts, q, { canonical }));
  return rows[0] || null;
}
// 그리고 cypher() 함수에서 body: JSON.stringify({ query, params }) 으로 전송
```

#### C-4. Cypher 정수 보간 — `pageId`가 EOL 응답(외부 데이터)이지만 가드 없이 쿼리에 직접 삽입
[cached/cache_eol_species.mjs:219, 221, 240, 241]
`fetchTraits(opts, pageId)`와 `fetchVernaculars(opts, pageId)`가 `MATCH (p:Page {page_id: ${pageId}})`로 쿼리한다. `pageRow.page_id`는 EOL 응답에서 왔고, `Number()`로 타입 강제도 안 한다. EOL이 손상되거나 중간자가 응답을 가로채면 `"123 OR true"` 같은 문자열을 보내 즉시 Cypher 인젝션이 된다.

수정 제안:

```js
async function processOne(opts, sp) {
  const pageRow = await fetchPageId(opts, sp.canonical);
  if (!pageRow || !pageRow.page_id) {
    return { status: 'not_found', canonical: sp.canonical };
  }
  const pageIdNum = Number(pageRow.page_id);
  if (!Number.isInteger(pageIdNum) || pageIdNum <= 0) {
    return { status: 'error', canonical: sp.canonical, error: `invalid page_id: ${pageRow.page_id}` };
  }
  if (opts.delayMs) await sleep(opts.delayMs);
  const traits = await fetchTraits(opts, pageIdNum);
  if (opts.delayMs) await sleep(opts.delayMs);
  const vern = await fetchVernaculars(opts, pageIdNum);
  // ... 이하 동일, result에 pageIdNum 사용
}
```

`fetchTraits`/`fetchVernaculars` 시그니처 주석에 "pageId는 반드시 정수"를 명시하라.

#### C-5. fetch 응답에 `r.ok` 검사는 있으나 catch가 silently fallback — 사용자가 오류를 인지하지 못함
[project/index.html:2065–2080]
`loadEolCache`는 실패 시 `console.warn`만 출력하고 `{ species: {} }`로 폴백한다. 이는 캐시 미적중 동작과 구분되지 않아, **EOL 캐시 파일을 깜빡 잊고 배포에서 누락**한 경우에도 사용자는 모든 종에서 placeholder만 보게 되고 원인 파악이 불가능하다.

본 항목은 요구사항(없는 데이터는 skip)과 충돌하므로 사용자 표시는 선택이지만, 캐시 자체의 로드 실패는 데이터 누락과 다르다. 또한 스키마 버전 검증이 누락되어 있어 향후 schemaVersion=2로 올렸을 때 프론트가 옛 로직으로 새 데이터를 잘못 해석할 수 있다.

수정 제안 — 스키마 버전 검증 + 로드 실패 마커:

```js
const EOL_CACHE_EXPECTED_SCHEMA = 1;
function loadEolCache() {
  if (eolCacheData) return Promise.resolve(eolCacheData);
  if (eolCacheLoading) return eolCacheLoading;
  eolCacheLoading = fetch('eol_species_cache.json')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      eolCacheData = data && typeof data === 'object' ? data : { species: {} };
      if (!eolCacheData.species) eolCacheData.species = {};
      if (eolCacheData.schemaVersion !== EOL_CACHE_EXPECTED_SCHEMA) {
        console.warn(`EOL 캐시 스키마 버전 불일치: ${eolCacheData.schemaVersion} (예상 ${EOL_CACHE_EXPECTED_SCHEMA}) — 일부 필드 누락 가능`);
      }
      return eolCacheData;
    })
    .catch(err => {
      console.warn('EOL 캐시 로드 실패 (자리표시자만 표시):', err.message);
      eolCacheData = { species: {}, _loadError: err.message };
      return eolCacheData;
    });
  return eolCacheLoading;
}
```

---

### Warning (권장)

#### W-1. 학명 정규화 — Node/브라우저 두 함수가 코드 중복이라 향후 drift 위험
[cached/cache_eol_species.mjs:65–91, project/index.html:2044–2060]
현재 두 함수 본문은 동일하나, **한 쪽이 수정되고 다른 쪽이 동기화되지 않으면 캐시 키 적중률 0으로 회귀**한다. 정적 검증이 어렵다.

수정 제안 — 공유 모듈로 추출:

```
project/lib/canonicalize.mjs  (양쪽 import 가능한 ESM)
cached/cache_eol_species.mjs → import { canonicalize } from '../project/lib/canonicalize.mjs';
project/index.html           → <script type="module"> import { canonicalize } ... </script>
```

또는 적어도 양쪽 함수 위 주석에 **"양쪽 동기화 필수, 한쪽 수정 시 반드시 다른 쪽도 수정"** 강조를 명시하고 단위 테스트로 보장:

```js
// project/index.html 주석:
// SYNC POINT — cached/cache_eol_species.mjs::canonicalize와 동일 로직 유지
// 변경 시 양쪽 모두 수정하고 단위 테스트로 적중률 검증
```

#### W-2. 명명자 추출 정규식 — 다중 명명자/소문자 시작/유니코드 케이스 미처리
[project/index.html:2134]
정규식 `\b([A-Z][A-Za-z'’.\- ]+?)(?:,?\s*\d{4})`은 다음을 놓친다.
- `"de Geer, 1773"` — 첫 글자가 소문자 `de`로 시작.
- `"Smith and Jones, 1900"` — 두 번째 대문자 단어부터 다시 매치되어 `"Jones"`만 추출(첫 명명자 누락).
- 비-ASCII 명명자(`Müller`, `Léon`): `[A-Za-z]`가 `ü`, `é`를 매칭하지 않아 `M` 한 글자만 추출.

수정 제안:

```js
// 유니코드 letter + 다중 명명자 케이스 ("and", "&")
const authorRe = /(?<=\s|^)([A-ZÀ-Þ][\p{L}'’.\- ]*?(?:\s+(?:and|&)\s+[A-ZÀ-Þ][\p{L}'’.\- ]*?)*?)(?=,?\s*\d{4}\b)/u;
const m = rawSci.match(authorRe);
if (m && !next.author) next.author = m[1].trim();
```

#### W-3. `loadEolCache()` 사전 호출이 페이지 초기 데이터 로드와 동시 시작 — 모바일 네트워크 부담
[project/index.html:1594–1595]
페이지 진입 즉시 `loadEolCache()` (현재 ~30KB 부분 캐시, 최종 수 MB 예상)와 `fetch('taxonomy/index.json')`이 병렬 시작된다. 비차단이긴 하나 모바일 LTE에서 첫 페인트 지연이 발생한다.

수정 제안 — `requestIdleCallback`로 지연, 또는 첫 종 상세 진입 직전에만 로드:

```js
// 1594줄 교체
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => loadEolCache(), { timeout: 3000 });
} else {
  setTimeout(loadEolCache, 1500);
}
```

추가로 캐시 크기가 우려되면 향후 알파벳 첫 글자별 분할 파일(`eol_a.json`, `eol_b.json` 등)로 지연 로드 권장.

#### W-4. `enrichSpeciesWithEol`이 입력 species를 mutate — C-1 패치 미수용 시 최소 명시적 주석 필요
[project/index.html:2085–2143]
C-1에서 다룬 것의 약한 형태. 만약 C-1의 패치를 수용하지 않고 mutate를 유지한다면, 함수 위 주석에 다음을 명시하라.

```js
/**
 * EOL 캐시에서 학명으로 조회하여 species 객체의 빈 필드를 보강한다.
 *
 * MUTATES — 입력 species 객체를 직접 변경한다.
 *   호출자는 buildPlaceholderSpecies()로 매번 새 객체를 만들거나,
 *   공유 참조에 적용하지 않아야 한다.
 *
 * @param {Object} species - 보강 대상 (mutate됨)
 * @returns {Object} 동일한 species 참조 (편의용)
 */
```

#### W-5. `eolPageId`, `eolCanonical` 메타데이터를 species에 부여만 하고 UI에 노출 안 함 — 디버깅용이라면 명시
[project/index.html:2139–2140]
detail 페이지에 EOL 출처 표시(예: "Source: EOL #1174823")가 없다. 의도가 디버깅이라면 dev-only 표시로 감싸고, 사용자에게 보일 계획이라면 detail 페이지에 슬롯을 추가하라.

수정 제안 (선택) — detail 푸터에 출처 행 추가:

```html
<!-- pageSpeciesDetail 푸터 영역에 -->
<p class="data-source-note" data-slot="eolSource" hidden></p>
```
```js
// renderSpeciesDetail 끝에 추가
const sourceEl = page.querySelector('[data-slot="eolSource"]');
if (sourceEl) {
  if (species.eolPageId) {
    sourceEl.textContent = `데이터 출처: EOL (eol.org/pages/${species.eolPageId})`;
    sourceEl.hidden = false;
  } else {
    sourceEl.hidden = true;
  }
}
```

#### W-6. 캐시 JSON 사이즈 — 단일 fetch가 모바일에서 부담
3148 종 × 평균 ~100 traits × 평균 30바이트 ≈ 9MB 추정. 현재 부분 캐시는 30KB지만 풀 캐시는 수 MB 수준. iOS Safari 모바일 데이터에서 첫 종 진입까지 느려진다.

수정 제안 (향후) — (a) 캐시를 알파벳/목별 분할, (b) 또는 첫 종 진입 시 해당 종만 lazy 호출(static cache fallback), (c) 또는 gzip 압축 가능 정적 서버 사용.

```js
// 옵션 B: 첫 종 진입 시 lazy 분할 로드
async function loadEolCacheFor(canonical) {
  const bucket = (canonical[0] || '_').toLowerCase().replace(/[^a-z]/, '_');
  if (!eolBucketCache[bucket]) {
    eolBucketCache[bucket] = fetch(`eol/${bucket}.json`).then(r => r.ok ? r.json() : { species: {} }).catch(() => ({ species: {} }));
  }
  return eolBucketCache[bucket];
}
```

#### W-7. Node 스크립트 — retry 백오프가 선형이라 429 지속 시 짧음
[cached/cache_eol_species.mjs:157–196]
`sleep(500 * attempt)`로 1초 → 2초 → 3초의 선형 증가. 지속 429에서는 너무 짧고 jitter도 없어 여러 종이 동시에 재시도하면 다시 429를 받기 쉽다.

수정 제안 — 지수 백오프 + jitter + Retry-After 헤더 우선:

```js
async function cypher(opts, query) {
  const retries = Math.max(1, opts.retries);
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await fetch(CYPHER_URL, { /* ... */ });
      clearTimeout(timer);
      const text = await res.text();
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
        err.retryable = res.status === 429 || res.status >= 500;
        const ra = Number(res.headers.get('Retry-After'));
        if (Number.isFinite(ra)) err.retryAfterMs = ra * 1000;
        throw err;
      }
      try { return JSON.parse(text); }
      catch { throw new Error(`JSON 파싱 실패: ${text.slice(0, 200)}`); }
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err.retryable === false || attempt === retries) break;
      const base = err.retryAfterMs || Math.min(30000, 1000 * Math.pow(2, attempt - 1));
      const jitter = base * 0.5 * Math.random();
      await sleep(base + jitter);
    }
  }
  throw lastErr;
}
```

#### W-8. Node 스크립트 — OUTPUT_FILE 동시 쓰기 충돌 가능성
[cached/cache_eol_species.mjs:145–155, 397–399]
`saveCache`가 atomic이 아니다(`writeFileSync`로 truncate-write). 사용자가 실수로 두 인스턴스를 동시에 실행하면 incremental save가 race로 한 쪽 변경분이 사라진다.

수정 제안 — atomic 쓰기 + 단일 실행 보장 lockfile:

```js
function saveCache(cache) {
  cache.savedAt = new Date().toISOString();
  const json = JSON.stringify(cache, null, 2);
  const tmp = `${OUTPUT_FILE}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, json, 'utf8');
  fs.renameSync(tmp, OUTPUT_FILE);
  try {
    const projTmp = `${PROJECT_OUTPUT_FILE}.tmp.${process.pid}`;
    fs.writeFileSync(projTmp, json, 'utf8');
    fs.renameSync(projTmp, PROJECT_OUTPUT_FILE);
  } catch (err) {
    console.warn(`project/ 사본 저장 실패: ${err.message}`);
  }
}

const LOCK_FILE = `${OUTPUT_FILE}.lock`;
function acquireLock() {
  try {
    fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
    process.on('exit', () => { try { fs.unlinkSync(LOCK_FILE); } catch {} });
  } catch (err) {
    if (err.code === 'EEXIST') {
      const owner = fs.readFileSync(LOCK_FILE, 'utf8');
      throw new Error(`이미 실행 중 (lockfile PID=${owner}). 강제 해제: rm ${LOCK_FILE}`);
    }
    throw err;
  }
}
// main() 시작부에 acquireLock() 호출
```

#### W-9. Node 스크립트 — `--only` 매칭이 raw 입력을 trim 안 함
[cached/cache_eol_species.mjs:349]
`s.canonical === opts.only || s.rawScientificName === opts.only`. 사용자가 셸에서 `--only "Papilio xuthus "` (끝 공백 포함) 같은 인수를 넘기면 일치 0건이 되어 헷갈린다.

수정 제안:

```js
const onlyKey = opts.only.trim();
targets = targets.filter((s) =>
  s.canonical === onlyKey
  || (s.rawScientificName || '').trim() === onlyKey
  || canonicalize(opts.only) === s.canonical
);
```

#### W-10. `cached/`와 `project/` 두 사본의 분기 — 어느 쪽이 source of truth인지 불명확
[cached/cache_eol_species.mjs:148–154]
현재 두 파일을 `diff -q`하면 다르다(검토 시점). incremental save 도중이라면 자연스러우나, 빌드 산출물을 git에 트래킹할지 결정이 필요하다.

수정 제안 — `cached/`를 source of truth로 두고 빌드 시점에 복사하는 npm 스크립트, 또는 `project/eol_species_cache.json`을 .gitignore에 추가:

```jsonc
// cached/package.json scripts 섹션 (예시)
{
  "scripts": {
    "build-eol": "node cache_eol_species.mjs",
    "sync-eol": "cp eol_species_cache.json ../project/eol_species_cache.json"
  }
}
```

---

### Suggestion (선택)

#### S-1. `enrichSpeciesWithEol` 60줄+ — 6개 로직 블록을 헬퍼로 분리
[project/index.html:2085–2143]
가독성을 위해:

```js
function mergeCommonName(target, vKo) { /* ... */ }
function mergeHabitat(target, tHabitat, tGeographic) { /* ... */ }
function mergeHabitatRegions(target, tGeographic) { /* ... */ }
function synthesizeDescription(target, t, v) { /* ... */ }
function parseAuthorship(target) { /* ... */ }

function enrichSpeciesWithEol(species) {
  /* 가드... */
  const next = { ...species };
  mergeCommonName(next, v.ko);
  mergeHabitat(next, t.habitat, t.geographic);
  mergeHabitatRegions(next, t.geographic);
  synthesizeDescription(next, t, v);
  parseAuthorship(next);
  next.eolPageId = entry.pageId;
  next.eolCanonical = canonical;
  return next;
}
```

#### S-2. `summarizeTraits`의 빈 배열들 — 모두 빈 배열이면 캐시에서 생략하여 크기 절감
[cached/cache_eol_species.mjs:246–291]
현재 모든 종에 `{ habitat: [], geographic: [], ... others: [] }`가 들어있다. 약 7개 키 × 빈 배열 = 종당 80바이트 낭비. ok 상태가 1000건이면 80KB.

```js
function summarizeTraits(traits) {
  const out = { /* ... 동일 ... */ };
  // ... 동일 ...
  const cleaned = {};
  for (const [k, v] of Object.entries(out)) {
    if (Array.isArray(v) && v.length === 0) continue;
    if (v === null) continue;
    cleaned[k] = v;
  }
  return cleaned;
}
```
브라우저 측 `enrichSpeciesWithEol`은 이미 `Array.isArray()` 가드를 갖고 있어 호환됨.

#### S-3. Node 스크립트 — `loadInputSpecies`의 `set` 변수명을 `byCanonical`로 변경
[cached/cache_eol_species.mjs:99] Map인데 변수명이 `set`이라 의미 혼동.

#### S-4. `fetchTraits`의 `LIMIT 500` — 매직 넘버 상수화 + 잘림 감지
[cached/cache_eol_species.mjs:235]

```js
const TRAITS_PER_SPECIES_LIMIT = 500;
// 쿼리에서 LIMIT ${TRAITS_PER_SPECIES_LIMIT}
if (traits.length === TRAITS_PER_SPECIES_LIMIT) {
  console.warn(`  traits 응답이 LIMIT(${TRAITS_PER_SPECIES_LIMIT})에 도달 — 일부 잘림 가능`);
}
```

#### S-5. `console.log`의 키 노출 방지 가드 (방어적)
현재 스크립트 어디에도 `opts.apiKey`를 출력하지 않으나, 향후 디버깅 코드 추가 시 실수 방지용 유틸:

```js
function maskApiKey(s, apiKey) {
  if (!apiKey || typeof s !== 'string') return s;
  return s.includes(apiKey) ? s.replace(apiKey, '***REDACTED***') : s;
}
// 모든 console.log를 safeLog(opts, ...)으로 통일하면 더 안전
```

#### S-6. `taxonomy.genus/species` 자동 채움 — canonical에서 토큰화하면 무료로 채울 수 있음
[project/index.html:1471–1474, enrich 함수]
`renderSpeciesSorted`에서 `item.genus`, `item.species`가 입력에 있으면 사용하나, 없을 때 placeholder의 null을 그대로 둔다.

```js
// enrichSpeciesWithEol 안, canonical 결정 후
const parts = canonical.split(' ');
if (!next.taxonomy.genus && parts[0]) next.taxonomy.genus = parts[0];
if (!next.taxonomy.species && parts[1]) next.taxonomy.species = parts.slice(1).join(' ');
```

#### S-7. 캐시 schemaVersion을 프론트엔드에서도 검증 (C-5 패치에 포함됨)

---

### 종합 평가

EOL 통합 변경분은 보안 요구사항을 잘 지켰고(API 키 환경변수만, 캐시 파일에 토큰 누출 없음, `.claude/settings.local.json`은 글로벌 ignore로 제외) 프론트엔드 fetch 폴백/`r.ok` 검사/`textContent` 기반 출력 경로(`setSlot` 일관 사용)도 견고하다. 다만 **`enrichSpeciesWithEol`의 mutate 패턴과 race 가드(C-1, C-2)**, **Node 스크립트의 Cypher 인젝션 표면(C-3, C-4)**이 향후 데이터 출처가 확장되거나 동시 호출이 늘 때 즉시 결함이 되므로 우선 처리할 것을 권장한다.
