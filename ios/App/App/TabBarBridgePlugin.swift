import Foundation
import Capacitor

extension Notification.Name {
    static let nativeTabBarSelect = Notification.Name("nativeTabBarSelect")
}

/// 웹(JS) → 네이티브: 웹 페이지 전환이 일어날 때 네이티브 UITabBar의 선택 상태를 맞춰준다.
@objc(TabBarBridgePlugin)
public class TabBarBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TabBarBridgePlugin"
    public let jsName = "TabBarBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "select", returnType: CAPPluginReturnPromise)
    ]

    @objc func select(_ call: CAPPluginCall) {
        guard let tab = call.getString("tab") else {
            call.reject("tab is required")
            return
        }
        NotificationCenter.default.post(name: .nativeTabBarSelect, object: tab)
        call.resolve()
    }
}
