# 구현 완료 — App Store 등록 준비 (더미 핸들러 수정 + 설정 정비 + 출처 페이지)

## 수정한 파일

### `project/index.html`
1. **알림 설정 섹션 전체 삭제** (구 697–711): `dailyNotification` 토글 + `toggle-switch` 마크업 제거.
2. **앱 정보 섹션 재구성**:
   - 버전 항목: 빈 껍데기 → `<span class="settings-item-value" id="settingsVersion">` (JS가 `1.0` 주입).
   - 데이터 출처 항목: 빈 껍데기 → chevron 버튼 `<button class="settings-button settings-nav-btn" id="creditsNavBtn">` (→ `#pageCredits` 진입).
   - settings-item-content 닫는 태그의 비정상 26칸 들여쓰기를 정상 들여쓰기로 정리.
3. **지원 섹션 정비**:
   - 앱 평가하기 항목 통째 삭제.
   - 오류 및 버그 제보: `<button id="reportBug">` → `<a class="settings-button" id="reportBug" href="mailto:hwanghs5290@gmail.com">` 앵커로 교체.
4. **신규 페이지 `#pageCredits`** 추가 (`#pageSettings` 바로 다음). 액션바(`creditsBackBtn`) + 4개 섹션(데이터/이미지/서체/오픈소스).
5. **설정 JS 블록 전면 교체** (구 3581–3659): 죽은 설정 스캐폴딩 전부 삭제하고 1회성 top-level 초기화로 대체.
6. **`_subPageBackTarget`**에 `pageCredits: 'pageSettings'` 추가.
7. **scroll-to-top FAB 조건**에 `page.id === 'pageCredits'` 추가.

### `project/style.css`
1. `.settings-button` 베이스에 `display:inline-flex; align-items/justify-content:center; box-sizing:border-box; text-decoration:none;` 추가 — `<a>`가 `<button>`과 동일하게 렌더되도록(인라인 `<a>`는 `min-width` 무시 + 밑줄 발생 문제 해결).
2. `/* ── 출처 및 라이선스 ── */` 섹션 신규 추가: `.settings-item-value`, `.settings-nav-btn`(+`:hover`), `.credits-title`, `.credits-body`, `.credits-source`, `.credits-link`(+`:hover`).
3. 페이지 페이드 애니메이션 셀렉터를 `#pageSettings, #pageCredits`로 확장.

모든 신규 CSS는 커스텀 프로퍼티(`--text-primary`, `--text-secondary`, `--text-muted`, `--green-soft`, `--green-mid`, `--bg-input`, `--border-subtle`, `--radius-pill`, `--font-body`, `--font-display`)만 사용. 하드코딩 색상 없음.

## 삭제한 심볼 + 삭제 전 grep 참조 확인

`grep -n` 으로 각 심볼의 전 참조처를 확인한 뒤 삭제했다. 확인 결과 모든 참조가 삭제 대상 블록(구 3581–3659) 내부에만 존재 → 외부 의존 없음.

| 삭제 심볼 | 삭제 전 참조처 (grep) | 판정 |
|---|---|---|
| `DEFAULT_SETTINGS` | 3582(정의), 3589(loadSettings 내부) | 블록 내부 전용 → 삭제 안전 |
| `loadSettings` | 3587(정의), 3605, 3612, 3658 | 전부 삭제 대상 블록 내 → 안전 |
| `saveSettings` | 3593(정의), 3614 | 안전 |
| `applySettings` | 3598(정의), 3659 | no-op, 안전 |
| `initSettingsPage` | 3604(정의), 3642(pageshow 핸들러) | 안전 |
| `insectAppSettings` (LS키) | 3588, 3594 (loadSettings/saveSettings 내부) | 두 함수 삭제로 함께 소멸 |
| `dailyNotification` | 706(html), 3583, 3608, 3611, 3613 | 안전 |
| `rateApp` | 744(html), 3628 | 안전 |
| `updateNav(...)` 호출 | 3636, 3648 (정의처 0곳) | 미정의 함수 호출 → 삭제 |
| 주석 처리된 `navSettings` 블록 | 3651–3655 | 죽은 코드 → 삭제 |
| `pageshow:pageSettings` 리스너 | 3641–3643 | 리스너 누수 원인 → 삭제 |

`profileSettingsBtn` 리스너는 유지하되 내부 `updateNav('navSettings')` 한 줄만 제거.

## `#pageCredits` 셀렉터 목록 (QA 셀렉터 교차 검증용)

### id (JS 참조 존재 여부 명시)
| id | 위치 | JS 참조 |
|---|---|---|
| `pageCredits` | `<div class="page">` | `showPage('pageCredits',...)`(2곳), `_subPageBackTarget`, FAB 조건, `allPages`(querySelectorAll('.page')) 자동 포함 |
| `creditsBackBtn` | 액션바 버튼 | `document.getElementById('creditsBackBtn')` → click 리스너 |
| `creditsNavBtn` | 설정>데이터 출처 버튼(#pageSettings 내) | `document.getElementById('creditsNavBtn')` → click 리스너 |
| `settingsVersion` | 설정>버전 값 span(#pageSettings 내) | `document.getElementById('settingsVersion').textContent = APP_VERSION` |
| `reportBug` | 설정>제보 앵커(#pageSettings 내) | `document.getElementById('reportBug').href = ...` |

### CSS 클래스 (신규)
`credits-title`, `credits-body`, `credits-source`, `credits-link` (모두 style.css에 정의됨), 재사용: `settings-container`, `settings-section`, `settings-section-title`, `profile-action-bar`, `action-btn`.

### `data-slot`
`#pageCredits`에는 `data-slot` 속성을 사용하지 않음(정적 고지 페이지 — 동적 바인딩 슬롯 불필요). 값 주입은 `#settingsVersion`(textContent)과 `#reportBug`(href) 두 곳뿐이며 둘 다 `#pageSettings` 소속.

## 완료 기준 자체 검증 (실제 grep 출력 근거)

1. **`grep -n "updateNav\|dailyNotification\|rateApp\|support@example.com" project/index.html` → 0건**: 실행 결과 매치 없음(exit=1). ✅
2. **`grep -n "alert(" project/index.html` → 0건**: 실행 결과 매치 없음(exit=1). ✅
3. **버전 1.0 표시**: `705: <span class="settings-item-value" id="settingsVersion">` + `3618: const APP_VERSION = '1.0';` + `3622: _settingsVersionEl.textContent = APP_VERSION;`. ✅
4. **설정 > 데이터 출처 → #pageCredits → 뒤로 → #pageSettings**: `creditsNavBtn` click → `showPage('pageCredits',{dir:'forward'})`(3636); `creditsBackBtn` click → `showPage('pageSettings',{restoreScroll:true,dir:'back'})`(3652). ✅
5. **설정 5회 열어도 리스너 미중복**: `pageshow:pageSettings` 리스너 제거됨(grep 0건). 모든 설정/크레딧 리스너를 top-level 모듈 스코프에서 `getElementById` 후 1회 등록 → 페이지 재진입 시 재등록 경로 없음. ✅
6. **`#pageCredits` 셀렉터 1:1 정합**: 위 셀렉터 표의 모든 id가 JS 참조와 일치(누락/오타 0). CSS 클래스 4종 모두 style.css에 정의 확인(`.credits-title/body/source/link`). ✅

추가 검증: 인라인 스크립트(134,086자) `node --check` 통과 — 구문 오류 없음.

## 범위 밖이라 손대지 않은 항목

- **고아 CSS `toggle-switch`/`toggle-slider`**(style.css): 알림 섹션 삭제로 미사용이 되었으나, `@media (prefers-reduced-motion)` 블록이 이를 참조하고 있어 제거 시 부수효과 위험이 있어 유지. 무해한 죽은 CSS. 후속 정리 권장.
- **기존 사용자 `insectAppSettings` LocalStorage 잔여값**: 더 이상 읽거나 쓰지 않음. 마이그레이션/클린업은 이번 범위 밖으로 판단해 미처리(무해).
- **CLAUDE.md 문서 드리프트**: `insectAppSettings`가 `defaultHomeTab`을 담는다는 서술은 실제 코드와 불일치(코드에 존재한 적 없음). doc-writer가 CLAUDE.md 정정 필요(요구사항 B-1 명시 사항).
- **`_subPageBackTarget`에 `pageSettings`가 없는 별개 이슈**: 요구사항 D-2 지시대로 이번 작업에서 건드리지 않음.
- `ios/`, 데이터 JSON, 네이티브 Swift/Info.plist: 지시대로 미수정.

## 해석 근거 (요구사항 모호 지점)

- **reportBug 앵커 + encodeURIComponent**: 정적 href만으로는 `encodeURIComponent` 요구를 충족할 수 없어, HTML에 폴백 `href="mailto:hwanghs5290@gmail.com"`를 두고 JS에서 subject/body(앱 버전 포함)를 `encodeURIComponent`로 인코딩해 최종 href를 주입. JS 미실행 시에도 기본 mailto는 동작.
- **데이터 출처 chevron**: `.settings-button` 재사용 지시에 따라 `.settings-nav-btn` modifier로 min-width/padding만 축소해 아이콘 전용 버튼으로 구현.
