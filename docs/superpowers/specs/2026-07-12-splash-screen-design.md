# 앱 시작 로딩화면(스플래시) 설계

- **날짜**: 2026-07-12
- **대상**: ENTOMA · KR (KoIn Pedia) — iOS 앱 전용
- **상태**: 승인됨

## 문제

앱을 실행하면 흰 화면이 한 번 번쩍인 뒤 검은 앱이 나타난다. 그 사이 `search_index.json` / `nibr_cache.json` 을 fetch 하는 동안 "오늘의 곤충" 카드와 테마 그리드는 `불러오는 중…` 플레이스홀더 상태로 노출된다.

원인은 두 가지다.

1. `Splash.imageset` 이 Capacitor 기본 흰색 이미지이고, `LaunchScreen.storyboard` 의 배경이 `systemBackgroundColor`(라이트 모드에서 흰색)다. 반면 웹 앱은 다크 전용(`theme-color: #0a0a0a`)이다.
2. `@capacitor/splash-screen` 플러그인이 설치되어 있지 않다. 따라서 런치스크린은 WebView가 생성되는 즉시 사라지고, 콘텐츠가 페인트되기까지의 공백이 그대로 사용자에게 보인다.

## 목표

- 앱 아이콘을 탭한 순간부터 첫 화면이 완전히 그려질 때까지, 이음매 없는 정적 로고 화면 하나를 보여준다.
- 흰색 깜빡임을 제거한다.
- `불러오는 중…` 플레이스홀더가 시작 시점에 노출되지 않게 한다.

## 비목표

- 애니메이션, 진행률 표시, 워드마크, 앱 통계 노출. 화면은 **로고만, 정적**이다.
- 브라우저 배포 대응. iOS 앱 전용이다.

## 접근법

**네이티브 스플래시 전담.** `@capacitor/splash-screen` 을 `launchAutoHide: false` 로 설치해 런치스크린 뷰가 WebView 위에 계속 떠 있게 하고, 데이터 로드가 끝나면 JS에서 걷어낸다.

웹 오버레이(`index.html` 안의 `#splash` div)는 만들지 않는다. 정적 로고 화면은 네이티브 스플래시가 원래 하는 일 그 자체이고, 웹 오버레이를 추가하면 네이티브 뷰가 사라진 뒤 웹이 첫 페인트를 하기까지의 공백에서 로고가 두 번 그려지며 미세하게 점프한다. 뷰 하나가 끝까지 살아 있다가 페이드아웃하면 이음매는 **구조적으로 존재하지 않는다**.

```
앱 아이콘 탭
   ↓
iOS가 LaunchScreen.storyboard 렌더 (검정 + 로고)
   ↓  WebView 생성 · HTML 파싱 — 스플래시는 WebView 위에 유지
   ↓  (launchAutoHide: false → 자동으로 사라지지 않음)
   ↓  JSON fetch → renderThemeSections() → 페인트 완료
   ↓
JS가 SplashScreen.hide({ fadeOutDuration: 300 }) 호출
   ↓  네이티브 뷰 페이드아웃 → 이미 다 그려진 앱이 드러남
```

## 컴포넌트

### 1. 스플래시 에셋

`Insect Order png/ver.3_W.png` (1024², 곤충이 프레임을 꽉 채운 앱 아이콘 아트워크)를 그대로 쓸 수 없다. `LaunchScreen.storyboard` 의 imageView가 `scaleAspectFill` 이므로 정사각 캔버스가 세로 화면에서 좌우로 크게 잘린다. iPhone 15 Pro(1179×2556) 기준 가시 영역은 캔버스 폭의 약 46%뿐이다. 꽉 찬 곤충은 양옆이 날아간다.

따라서 **2732×2732 검정(`#0a0a0a`) 캔버스 중앙에 로고를 820px(캔버스의 30%)로 축소 합성**한다. 어떤 기기 비율로 잘려도 로고는 가시 영역 안에 들어온다.

합성은 Swift + CoreGraphics 로 한다. 이 머신에는 Pillow도 ImageMagick도 없고, Xcode의 `swift` 는 있다. 합성 스크립트는 일회성이므로 저장소에 커밋하지 않는다.

산출물은 `ios/App/App/Assets.xcassets/Splash.imageset/` 의 세 파일(`splash-2732x2732.png`, `-1.png`, `-2.png`)을 **동일한 합성본으로** 덮어쓴다. Capacitor 규약상 1x/2x/3x 슬롯이 모두 같은 2732² 이미지를 가리킨다.

### 2. 스토리보드 배경색

`LaunchScreen.storyboard` 의 `systemColor="systemBackgroundColor"` 를 고정 색 `#0a0a0a` 로 바꾼다. 캔버스·플러그인 `backgroundColor` 와 같은 값이어야 경계가 보이지 않는다. 이 변경이 없으면 라이트 모드 기기에서 이미지 여백이 흰색으로 새어나온다. 에셋 교체만으로는 부족하다.

### 3. 다크 모드 고정

`ios/App/App/Info.plist` 에 `UIUserInterfaceStyle = Dark` 를 추가한다. 앱이 이미 다크 전용이므로, 라이트 모드 기기에서 WebView 기본 배경이나 시스템 UI가 흰색으로 새는 것을 막는다.

### 4. 해제 게이트

`project/index.html` 스크립트 **최하단**에 추가한다.

```js
const _dataReady = Promise.all([loadSearchIndex(), loadNibrCache(), loadInatPhotoCache()])
  .catch(() => {})
  .then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const _minTime = new Promise(r => setTimeout(r, 1200));
const _hardCap = new Promise(r => setTimeout(r, 5000));

Promise.race([Promise.all([_dataReady, _minTime]), _hardCap]).then(hideSplash);
```

설계 근거:

- **`Promise.all([_dataReady, _minTime])`** — "둘 중 늦은 쪽". 데이터가 빨리 와도 최소 1.2초는 노출해 스플래시가 번쩍이지 않게 하고, 느린 기기에서는 데이터를 끝까지 기다려 `불러오는 중…` 이 새어나오지 않게 한다.
- **세 loader 재호출** — `loadSearchIndex` / `loadNibrCache` / `loadInatPhotoCache` 는 각각 `searchIndexLoading` / `nibrCacheLoading` / `inatPhotoCacheLoading` 에 프로미스를 메모이즈한다. 재호출 비용은 0이다.
- **최하단 배치 + 이중 `requestAnimationFrame`** — `index.html:1745` 의 `renderThemeSections()` 가 실제로 **페인트된 뒤에** 걷히도록 보장한다. 같은 메모이즈 프로미스에 등록된 `.then` 은 등록 순서대로 실행되므로, 게이트를 1745행보다 뒤에 두면 `renderThemeSections()` 가 먼저 돈다. 이중 rAF가 그 결과의 페인트를 기다린다. 이걸 빼면 렌더 직전에 스플래시가 사라져 빈 화면이 한 프레임 보인다.
- **`.catch(() => {})`** — fetch가 실패해도 스플래시는 반드시 걷힌다.
- **`_hardCap`** — 극단적 네트워크 지연에서도 5초 뒤 강제 해제. 스플래시에 갇히는 경우를 없앤다.

`hideSplash` 는 전역 브리지를 통해 플러그인에 접근한다.

```js
function hideSplash() {
  window.Capacitor?.Plugins?.SplashScreen?.hide({ fadeOutDuration: 300 });
}
```

Capacitor 네이티브 런타임이 `window.Capacitor` 를 주입하므로 `import` 도 번들러도 필요 없다. CLAUDE.md 의 "외부 `.js` 파일 추가 금지" 규칙을 지킨다. 브라우저에서 열면 `window.Capacitor` 가 없어 옵셔널 체이닝이 no-op이 되며, 스플래시 자체가 없으므로 무해하다.

### 5. Capacitor 설정

`capacitor.config.json`:

```json
{
  "appId": "com.dokhupedia.app",
  "appName": "KoIn Pedia",
  "webDir": "project",
  "plugins": {
    "SplashScreen": {
      "launchAutoHide": false,
      "backgroundColor": "#0a0a0aff"
    }
  }
}
```

`launchAutoHide: false` 가 이 설계의 핵심이다. 이것이 없으면 플러그인이 기본 지연 후 스스로 스플래시를 내려 게이트가 무의미해진다.

## 실패 모드

| 상황 | 결과 |
|---|---|
| JSON fetch 실패 | `.catch()` 가 흡수 → 1.2초 후 정상 해제. 앱은 빈 상태로 진입 (기존 동작과 동일) |
| 네트워크 극단적 지연 | 5초 하드캡이 강제 해제 |
| 브라우저 열람 | `window.Capacitor` 부재 → `hideSplash` no-op |
| 라이트 모드 기기 | 스토리보드 배경 검정 고정 + `UIUserInterfaceStyle = Dark` 로 흰색 노출 없음 |

## 변경 파일

| 파일 | 변경 |
|---|---|
| `package.json` | `@capacitor/splash-screen` 의존성 추가 |
| `capacitor.config.json` | `plugins.SplashScreen` 블록 추가 |
| `project/index.html` | 스크립트 최하단에 `hideSplash` + 해제 게이트 (약 10줄) |
| `ios/App/App/Assets.xcassets/Splash.imageset/*.png` | 검정 + 로고 합성본 3개로 교체 |
| `ios/App/App/Base.lproj/LaunchScreen.storyboard` | 배경색 → 검정 고정 |
| `ios/App/App/Info.plist` | `UIUserInterfaceStyle = Dark` 추가 |
| `ios/App/CapApp-SPM/Package.swift` | `npx cap sync ios` 가 자동 갱신 (직접 수정 금지) |

## 빌드 절차

프로젝트는 CocoaPods가 아니라 SPM 기반이다 (Capacitor 8.4.1, `ios/App/CapApp-SPM/`).

1. `npm i @capacitor/splash-screen`
2. `npx cap sync ios` — `Package.swift` 에 플러그인 의존성이 자동으로 물린다
3. **Xcode 재빌드** — 네이티브 에셋과 의존성이 바뀌므로 `cap sync` 만으로는 반영되지 않는다

## 검증

실기기 또는 시뮬레이터에서 앱을 콜드 스타트해 확인한다.

- 흰색 프레임이 단 한 번도 보이지 않는다 (라이트 모드 기기에서도).
- 로고 화면이 최소 1.2초 유지된 뒤 부드럽게 페이드아웃한다.
- 페이드아웃 직후 화면에 `불러오는 중…` 플레이스홀더가 없다.
- 기내 모드(fetch 전면 실패)에서도 스플래시가 걷히고 앱에 진입한다.
