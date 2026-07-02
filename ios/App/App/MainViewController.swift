import UIKit
import Capacitor

/// 네이티브 UITabBar(Liquid Glass) + Capacitor 웹뷰 컨테이너.
/// 웹 쪽 하단 네비게이션(.bottom-nav)은 iOS 네이티브 셸에서 숨겨지고, 이 진짜 UITabBar가 대신한다.
class MainViewController: UIViewController, UITabBarDelegate {

    private let bridgeVC = EntomaBridgeViewController()
    private let tabBar = UITabBar()

    private let discoverItem = UITabBarItem(title: "홈", image: UIImage(systemName: "house"), selectedImage: UIImage(systemName: "house.fill"))
    private let searchItem = UITabBarItem(title: "검색", image: UIImage(systemName: "magnifyingglass"), selectedImage: UIImage(systemName: "magnifyingglass"))
    private let profileItem = UITabBarItem(title: "내정보", image: UIImage(systemName: "person.crop.circle"), selectedImage: UIImage(systemName: "person.crop.circle.fill"))

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black

        setupTabBar()
        setupBridgeViewController()

        NotificationCenter.default.addObserver(self, selector: #selector(handleWebTabSync(_:)), name: .nativeTabBarSelect, object: nil)
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
            bridgeVC.view.bottomAnchor.constraint(equalTo: tabBar.topAnchor)
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
}
