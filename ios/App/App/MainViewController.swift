import UIKit
import Capacitor

extension UIColor {
    /// style.css 의 --bg-deep(#0a0a0a) 및 LaunchScreen.storyboard 배경과 동일한 값.
    /// 세 곳이 같아야 런치스크린 → 스플래시 → 앱 사이에 색 경계가 보이지 않는다.
    static let splashBackground = UIColor(red: 10 / 255, green: 10 / 255, blue: 10 / 255, alpha: 1)
}

/// 네이티브 UITabBar(Liquid Glass) + Capacitor 웹뷰 컨테이너.
/// 웹 쪽 하단 네비게이션(.bottom-nav)은 iOS 네이티브 셸에서 숨겨지고, 이 진짜 UITabBar가 대신한다.
class MainViewController: UIViewController, UITabBarDelegate {

    private let bridgeVC = EntomaBridgeViewController()
    private let tabBar = UITabBar()
    private let splashView = UIImageView()

    /// JS 가 스플래시를 못 걷어내는 상황(스크립트 오류 등)에서도 앱이 갇히지 않도록 하는 최후 보루.
    private let splashFallbackSeconds: TimeInterval = 8

    private let discoverItem = UITabBarItem(title: "홈", image: UIImage(systemName: "house"), selectedImage: UIImage(systemName: "house.fill"))
    private let searchItem = UITabBarItem(title: "검색", image: UIImage(systemName: "magnifyingglass"), selectedImage: UIImage(systemName: "magnifyingglass"))
    private let profileItem = UITabBarItem(title: "내정보", image: UIImage(systemName: "person.crop.circle"), selectedImage: UIImage(systemName: "person.crop.circle.fill"))

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .splashBackground

        setupTabBar()
        setupBridgeViewController()
        setupSplash()   // 탭바보다 나중에 addSubview — 스플래시가 탭바 위를 덮어야 한다

        NotificationCenter.default.addObserver(self, selector: #selector(handleWebTabSync(_:)), name: .nativeTabBarSelect, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleWebTabHidden(_:)), name: .nativeTabBarSetHidden, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(handleSplashHide), name: .nativeSplashHide, object: nil)

        DispatchQueue.main.asyncAfter(deadline: .now() + splashFallbackSeconds) { [weak self] in
            self?.handleSplashHide()
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    private func setupBridgeViewController() {
        addChild(bridgeVC)
        bridgeVC.view.translatesAutoresizingMaskIntoConstraints = false
        view.insertSubview(bridgeVC.view, belowSubview: tabBar)
        bridgeVC.didMove(toParent: self)

        NSLayoutConstraint.activate([
            bridgeVC.view.topAnchor.constraint(equalTo: view.topAnchor),
            bridgeVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func setupTabBar() {
        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        tabBar.standardAppearance = appearance
        tabBar.scrollEdgeAppearance = appearance

        discoverItem.tag = 0
        searchItem.tag = 1
        profileItem.tag = 2

        tabBar.items = [discoverItem, searchItem, profileItem]
        tabBar.selectedItem = discoverItem
        tabBar.delegate = self
        tabBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(tabBar)

        NSLayoutConstraint.activate([
            tabBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tabBar.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    // MARK: - 스플래시
    /// LaunchScreen.storyboard 와 똑같은 "Splash" 에셋을 같은 contentMode 로 전체화면에 깐다.
    /// 시스템 런치스크린 → 이 뷰로 넘어올 때 픽셀이 일치하므로 이음매가 보이지 않는다.
    private func setupSplash() {
        splashView.image = UIImage(named: "Splash")
        splashView.contentMode = .scaleAspectFill
        splashView.clipsToBounds = true
        splashView.backgroundColor = .splashBackground
        splashView.isUserInteractionEnabled = true   // 스플래시가 떠 있는 동안 탭 차단
        splashView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(splashView)

        NSLayoutConstraint.activate([
            splashView.topAnchor.constraint(equalTo: view.topAnchor),
            splashView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splashView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            splashView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    @objc private func handleSplashHide() {
        DispatchQueue.main.async {
            guard self.splashView.superview != nil else { return }
            UIView.animate(withDuration: 0.3, animations: {
                self.splashView.alpha = 0
            }, completion: { _ in
                self.splashView.removeFromSuperview()
            })
        }
    }

    // MARK: - 네이티브 탭 → 웹 페이지 전환
    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        let tab: String
        switch item.tag {
        case 1: tab = "search"
        case 2: tab = "profile"
        default: tab = "discover"
        }
        bridgeVC.bridge?.webView?.evaluateJavaScript("window.nativeTabSelect('\(tab)')")
    }

    // MARK: - 웹 페이지 전환 → 네이티브 탭 동기화
    @objc private func handleWebTabSync(_ note: Notification) {
        guard let tab = note.object as? String else { return }
        let item: UITabBarItem
        switch tab {
        case "search": item = searchItem
        case "profile": item = profileItem
        default: item = discoverItem
        }
        DispatchQueue.main.async {
            self.tabBar.selectedItem = item
        }
    }

    // MARK: - 웹(크롭 등 전체화면 편집) → 네이티브 탭바 숨김/표시
    @objc private func handleWebTabHidden(_ note: Notification) {
        let hidden = (note.object as? Bool) ?? false
        DispatchQueue.main.async {
            guard self.tabBar.isHidden != hidden else { return }
            if !hidden { self.tabBar.isHidden = false }
            UIView.animate(withDuration: 0.2, animations: {
                self.tabBar.alpha = hidden ? 0 : 1
            }, completion: { _ in
                self.tabBar.isHidden = hidden
            })
        }
    }
}
