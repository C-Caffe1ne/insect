import UIKit
import WebKit
import Capacitor

/// 기본 CAPBridgeViewController를 확장해 커스텀 네이티브 플러그인을 등록한다.
class EntomaBridgeViewController: CAPBridgeViewController {
    private var swipeBack: SwipeBackController?

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TabBarBridgePlugin())
        bridge?.registerPluginInstance(NavigationGestureBridgePlugin())

        guard let webView = bridge?.webView else { return }

        // WKWebView 내장 back-forward 제스처는 same-document SPA에서 콘텐츠 없는 빈(흰)
        // 스냅샷을 슬라이드하므로 쓰지 않는다. 대신 아래 커스텀 인터랙티브 전환을 구동한다.
        webView.allowsBackForwardNavigationGestures = false

        // 웹뷰 배경을 앱 배경색(--bg-deep #0a0a0a)으로 맞춰, 어떤 빈 영역도 흰색으로
        // 번쩍이지 않게 한다.
        let appBg = UIColor(red: 0x0a / 255.0, green: 0x0a / 255.0, blue: 0x0a / 255.0, alpha: 1)
        webView.isOpaque = false
        webView.backgroundColor = appBg
        webView.scrollView.backgroundColor = appBg

        // 커스텀 엣지 스와이프 뒤로가기 — 드래그를 따라 목적지 페이지의 실제 콘텐츠가
        // 드러나는 완전한 네이티브 전환. 기본 비활성, 웹에서 페이지별로 토글한다.
        swipeBack = SwipeBackController(webView: webView) { [weak self] js, completion in
            self?.bridge?.webView?.evaluateJavaScript(js) { result, _ in completion(result) }
        }
    }

    /// NavigationGestureBridgePlugin에서 호출 — 페이지별 스와이프 뒤로가기 on/off.
    func setSwipeBackEnabled(_ enabled: Bool) {
        swipeBack?.isEnabled = enabled
    }
}

/// WKWebView 위에서 iOS 네이티브 느낌의 인터랙티브 엣지 스와이프 뒤로가기를 구현한다.
///
/// 웹(EntomaSwipeNav)과 협업한다:
///  1. `.began`  — 현재 페이지 스냅샷을 캡처해 위에 올리고, `begin()`으로 목적지 페이지를
///                 스냅샷 아래에 미리 렌더한다.
///  2. `.changed` — 스냅샷을 손가락 따라 오른쪽으로 밀고, 목적지는 iOS 패럴랙스로 따라온다.
///  3. `.ended`  — 임계값을 넘으면 `commit()`(히스토리 실제 back), 아니면 `cancel()`(원복).
final class SwipeBackController: NSObject, UIGestureRecognizerDelegate {

    private weak var webView: WKWebView?
    private let evaluate: (String, @escaping (Any?) -> Void) -> Void
    private let edgePan = UIScreenEdgePanGestureRecognizer()

    private var snapshot: UIView?
    private var dimView: UIView?
    private var isTransitioning = false // 스냅샷을 올린 전환 진행 중
    private var isSettling = false      // commit/cancel 마무리 애니메이션 진행 중

    private let parallax: CGFloat = 0.5 // 목적지가 왼쪽으로 밀려 있는 정도(화면 폭 기준)
    private let maxDim: CGFloat = 0.12   // 목적지 위 어둠 오버레이 최대 불투명도
    private let paintSettleDelay = 0.05  // 취소 시 복원 페이지 리페인트를 기다렸다 스냅샷 제거(초)

    var isEnabled: Bool {
        get { edgePan.isEnabled }
        set { edgePan.isEnabled = newValue }
    }

    init(webView: WKWebView, evaluate: @escaping (String, @escaping (Any?) -> Void) -> Void) {
        self.webView = webView
        self.evaluate = evaluate
        super.init()
        edgePan.edges = .left
        edgePan.delegate = self
        edgePan.isEnabled = false
        edgePan.addTarget(self, action: #selector(handlePan(_:)))
        webView.addGestureRecognizer(edgePan)
    }

    // 웹뷰 세로 스크롤 제스처와 동시에 인식되게 해, 엣지에서 시작한 팬이 막히지 않게 한다.
    func gestureRecognizer(_ g: UIGestureRecognizer,
                           shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        return true
    }

    @objc private func handlePan(_ g: UIScreenEdgePanGestureRecognizer) {
        guard let webView = webView, let container = webView.superview else { return }
        let width = container.bounds.width

        switch g.state {
        case .began:
            beginTransition(container: container, webView: webView, width: width)
        case .changed:
            guard isTransitioning, !isSettling else { return }
            applyProgress(g.translation(in: container).x / width, width: width, webView: webView)
        case .ended, .cancelled, .failed:
            guard isTransitioning, !isSettling else { return }
            let progress = max(0, min(1, g.translation(in: container).x / width))
            let velocity = g.velocity(in: container).x
            let commit = (g.state == .ended) && (progress > 0.5 || velocity > 800)
            finish(commit: commit, width: width, webView: webView)
        default:
            break
        }
    }

    private func beginTransition(container: UIView, webView: WKWebView, width: CGFloat) {
        guard !isTransitioning else { return }

        // 현재(서브)페이지 스냅샷을 먼저 캡처한다. 실패하면 애니메이션 없이 즉시 뒤로간다.
        guard let snap = webView.snapshotView(afterScreenUpdates: false) else {
            evaluate("window.EntomaSwipeNav && EntomaSwipeNav.begin()") { [weak self] ok in
                guard (ok as? Bool) == true else { return }
                self?.evaluate("window.EntomaSwipeNav.commit()") { _ in }
            }
            return
        }

        isTransitioning = true
        webView.scrollView.isScrollEnabled = false // 전환 중 세로 스크롤 개입 방지

        snap.frame = webView.frame
        snap.isUserInteractionEnabled = true // 전환 중 하위 터치 삼킴
        snap.layer.shadowColor = UIColor.black.cgColor
        snap.layer.shadowOpacity = 0.22
        snap.layer.shadowRadius = 8
        snap.layer.shadowOffset = CGSize(width: -3, height: 0)

        let dim = UIView(frame: webView.frame)
        dim.backgroundColor = UIColor.black.withAlphaComponent(maxDim)
        dim.isUserInteractionEnabled = false

        container.insertSubview(dim, aboveSubview: webView)
        container.insertSubview(snap, aboveSubview: dim)
        snapshot = snap
        dimView = dim

        // 목적지(webView)를 웹에서 프리뷰 렌더. 목적지가 없으면 전환을 접는다.
        evaluate("window.EntomaSwipeNav ? (EntomaSwipeNav.begin() ? '1' : '0') : '0'") { [weak self] r in
            guard let self = self, self.isTransitioning else { return }
            if (r as? String) != "1" { self.teardown(webView: webView) }
        }

        applyProgress(0, width: width, webView: webView)
    }

    private func applyProgress(_ raw: CGFloat, width: CGFloat, webView: WKWebView) {
        let p = max(0, min(1, raw))
        snapshot?.transform = CGAffineTransform(translationX: width * p, y: 0)
        webView.transform = CGAffineTransform(translationX: -width * parallax * (1 - p), y: 0)
        dimView?.backgroundColor = UIColor.black.withAlphaComponent(maxDim * (1 - p))
        snapshot?.layer.shadowOpacity = Float(0.22 * (1 - p))
    }

    private func finish(commit: Bool, width: CGFloat, webView: WKWebView) {
        isSettling = true
        let duration = 0.28

        if commit {
            UIView.animate(withDuration: duration, delay: 0, options: [.curveEaseOut], animations: {
                self.snapshot?.transform = CGAffineTransform(translationX: width, y: 0)
                webView.transform = .identity
                self.dimView?.backgroundColor = UIColor.black.withAlphaComponent(0)
                self.snapshot?.layer.shadowOpacity = 0
            }, completion: { _ in
                // 목적지는 이미 보이는 상태. 히스토리만 실제로 되돌려 스택을 맞춘다.
                self.evaluate("window.EntomaSwipeNav && EntomaSwipeNav.commit()") { _ in }
                self.teardown(webView: webView)
            })
        } else {
            UIView.animate(withDuration: duration, delay: 0, options: [.curveEaseOut], animations: {
                self.snapshot?.transform = .identity
                webView.transform = CGAffineTransform(translationX: -width * self.parallax, y: 0)
                self.dimView?.backgroundColor = UIColor.black.withAlphaComponent(self.maxDim)
                self.snapshot?.layer.shadowOpacity = 0.22
            }, completion: { _ in
                // 스냅샷이 전체를 덮은 상태에서 먼저 원래 페이지 DOM을 복원하고 webView
                // 위치도 정상화한다(둘 다 스냅샷 아래라 보이지 않음).
                webView.transform = .identity
                self.evaluate("window.EntomaSwipeNav && EntomaSwipeNav.cancel()") { _ in
                    // evaluateJavaScript 콜백은 JS 실행 완료 시점이라 WKWebView가 복원된
                    // 페이지를 아직 다시 그리기 전일 수 있다. 그 상태에서 스냅샷을 걷으면
                    // 안 그려진(혹은 직전 목적지) 프레임이 노출돼 깜빡인다. 리페인트 시간을
                    // 준 뒤 스냅샷을 제거한다.
                    DispatchQueue.main.asyncAfter(deadline: .now() + self.paintSettleDelay) {
                        self.teardown(webView: webView)
                    }
                }
            })
        }
    }

    private func teardown(webView: WKWebView) {
        snapshot?.removeFromSuperview()
        dimView?.removeFromSuperview()
        snapshot = nil
        dimView = nil
        webView.transform = .identity
        webView.scrollView.isScrollEnabled = true
        isTransitioning = false
        isSettling = false
    }
}
