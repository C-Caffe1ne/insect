import Foundation
import Capacitor

extension Notification.Name {
    static let nativeTabBarSelect = Notification.Name("nativeTabBarSelect")
    static let nativeTabBarSetHidden = Notification.Name("nativeTabBarSetHidden")
}

/// 웹(JS) → 네이티브: 웹 페이지 전환이 일어날 때 네이티브 UITabBar의 선택 상태를 맞춰준다.
@objc(TabBarBridgePlugin)
public class TabBarBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TabBarBridgePlugin"
    public let jsName = "TabBarBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "select", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setHidden", returnType: CAPPluginReturnPromise)
    ]

    @objc func select(_ call: CAPPluginCall) {
        guard let tab = call.getString("tab") else {
            call.reject("tab is required")
            return
        }
        NotificationCenter.default.post(name: .nativeTabBarSelect, object: tab)
        call.resolve()
    }

    /// 웹(JS) → 네이티브: 사진 크롭 등 전체화면 편집 중 UITabBar를 숨기거나 다시 표시한다.
    @objc func setHidden(_ call: CAPPluginCall) {
        let hidden = call.getBool("hidden") ?? false
        NotificationCenter.default.post(name: .nativeTabBarSetHidden, object: hidden)
        call.resolve()
    }
}
