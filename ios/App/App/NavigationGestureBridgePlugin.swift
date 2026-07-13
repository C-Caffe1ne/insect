import Foundation
import Capacitor

/// 웹(JS) → 네이티브: 커스텀 엣지 스와이프 뒤로가기 제스처를 페이지별로 켜고 끈다.
/// 되돌릴 히스토리가 없는 탭 루트 페이지(홈/검색/내 정보)에서는 제스처를 비활성화하고,
/// 목/종 상세처럼 뒤로 갈 곳이 있는 페이지에서만 켠다.
/// 실제 전환(스냅샷 슬라이드 + 목적지 프리뷰)은 EntomaBridgeViewController의
/// SwipeBackController가 수행한다.
@objc(NavigationGestureBridgePlugin)
public class NavigationGestureBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NavigationGestureBridgePlugin"
    public let jsName = "NavigationGestureBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise)
    ]

    @objc func setEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled", true)
        DispatchQueue.main.async { [weak self] in
            (self?.bridge?.viewController as? EntomaBridgeViewController)?.setSwipeBackEnabled(enabled)
        }
        call.resolve()
    }
}
