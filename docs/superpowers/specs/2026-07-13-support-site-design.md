# KoIn Pedia 지원 사이트 설계서

- 작성일: 2026-07-13
- 대상: `infoURL/`, `.github/workflows/pages.yml`
- 목적: App Store Connect가 요구하는 Support URL과 Privacy Policy URL 확보

## 배경

App Store 제출에는 접속 가능한 지원 URL과 개인정보 처리방침 URL이 필요하다.
앱 내부에는 이미 `#pageCredits`(출처 및 라이선스)와 `#pagePrivacy`(개인정보처리방침, 시행일 2026-07-10)가
구현되어 있으나, 심사자와 이용자가 앱 밖에서 볼 수 있는 공개 페이지가 없다.
앱 내 방침 10조는 "변경 시 앱 내 화면과 공개 페이지를 통해 고지한다"고 명시하고 있어,
공개 페이지의 문구는 앱 내 문구와 일치해야 한다.

## 구조

```
infoURL/
├── index.html      지원 — 앱 소개 · 기능 · FAQ · 문의 · 앱 정보
├── privacy.html    개인정보처리방침 (앱 #pagePrivacy 본문과 동일)
├── credits.html    출처 및 라이선스 (앱 #pageCredits 본문과 동일)
├── style.css       세 페이지 공용 스타일
└── fonts/
    └── LINESeedKR-Rg.woff2

.github/workflows/pages.yml
```

`infoURL/`은 자체 완결형이다. GitHub Pages는 이 디렉토리만 서빙하므로 `project/`의
CSS·폰트를 참조할 수 없다. 본문 폰트인 LINE Seed KR만 복사하고, 도감 UI 장식용인
Cormorant Garamond·Inter는 지원 사이트에 쓰이지 않으므로 가져오지 않는다.

색상은 앱의 다크 테마 토큰을 재사용해 같은 인상을 준다.

| 토큰 | 값 |
|------|-----|
| `--bg-deep` | `#0a0a0a` |
| `--bg-card` | `#1a1d1b` |
| `--green-soft` | `#8ca892` |
| `--text-primary` | `#edefec` |
| `--text-secondary` | `#90a198` |

## 페이지 내용

### index.html — 지원

앱 소개(16목 94과 300종, 국립생물자원관 eCatalog 기반), 주요 기능, FAQ, 문의처, 앱 정보.

FAQ는 심사와 문의에서 실제로 걸리는 지점을 다룬다.

- 계정·로그인이 필요 없다
- 즐겨찾기·최근 본 곤충·프로필은 기기에만 저장되며 앱 삭제 시 함께 사라진다
- 곤충 사진은 iNaturalist 서버에서 내려받으므로 네트워크가 필요하다
- 카메라·사진 권한은 프로필 사진과 배경 설정에만 쓰이고 iOS 설정에서 철회할 수 있다
- 종 정보 오류는 이메일로 제보한다

앱 정보: 버전 1.0, iOS 15.0 이상, 문의 hwanghs5290@gmail.com.

### privacy.html — 개인정보처리방침

앱 `#pagePrivacy`의 10개 절을 그대로 옮긴다. 새로 작성하지 않는다.
본문은 앱의 실제 동작과 일치한다. 코드에서 확인한 사실:

- 수집·전송 코드 없음. 분석·광고 SDK 없음
- `localStorage` 키 5개(`entoma_favorites`, `entoma_recent`, `user_avatar`, `user_bg`, `user_profile_info`)에만 저장
- `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` — 프로필 사진·배경 용도
- 원격 이미지 호스트: `inaturalist-open-data.s3.amazonaws.com`, `static.inaturalist.org`, `species.nibr.go.kr`

### credits.html — 출처 및 라이선스

앱 `#pageCredits`의 데이터·이미지·서체·오픈소스 출처를 그대로 옮긴다.
iNaturalist 사진은 Creative Commons 라이선스이므로 저작자 표시 의무가 있고,
이를 공개 URL로도 충족해 둔다.

## 배포

`actions/upload-pages-artifact`로 `./infoURL`만 업로드하고 `actions/deploy-pages`로 배포한다.
`korean_H`(기본 브랜치)와 `appstore-prep` push, 그리고 수동 실행(`workflow_dispatch`)에 반응하며,
`infoURL/**` 변경에만 동작하도록 경로 필터를 건다.

배포 URL:

| App Store Connect 필드 | URL |
|------------------------|-----|
| Support URL | `https://c-caffe1ne.github.io/insect/` |
| Privacy Policy URL | `https://c-caffe1ne.github.io/insect/privacy.html` |

수동 조치 한 가지가 필요하다: 저장소 Settings → Pages → Source를 **GitHub Actions**로 변경.
`appstore-prep`에서 배포가 거부되면 `github-pages` 환경의 브랜치 보호 규칙 때문이며,
`korean_H`로 머지하면 배포된다.

## 범위 밖

`project/`와 `ios/`는 수정하지 않는다. 앱 내 방침·출처 페이지는 이미 동작하므로 그대로 둔다.
