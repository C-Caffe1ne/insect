import UIKit
import Capacitor

/// 기본 CAPBridgeViewController를 확장해 커스텀 네이티브 플러그인을 등록한다.
class EntomaBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TabBarBridgePlugin())
    }
}
