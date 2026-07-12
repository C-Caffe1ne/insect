import Foundation
import Capacitor

extension Notification.Name {
    static let nativeSplashHide = Notification.Name("nativeSplashHide")
}

/// 웹(JS) → 네이티브: 첫 화면 렌더가 끝나면 MainViewController 의 스플래시를 걷어낸다.
/// @capacitor/splash-screen 을 쓰지 않는 이유 — 그 플러그인은 스플래시를 Capacitor 웹뷰
/// 컨테이너(bridgeVC.view) 안에 넣는데, 이 앱은 웹뷰를 네이티브 UITabBar 아래에 삽입하므로
/// 탭바가 스플래시 위에 그려진다. 스플래시는 탭바까지 덮어야 하니 MainViewController 가 직접 소유한다.
@objc(SplashBridgePlugin)
public class SplashBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SplashBridgePlugin"
    public let jsName = "SplashBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise)
    ]

    @objc func hide(_ call: CAPPluginCall) {
        NotificationCenter.default.post(name: .nativeSplashHide, object: nil)
        call.resolve()
    }
}
