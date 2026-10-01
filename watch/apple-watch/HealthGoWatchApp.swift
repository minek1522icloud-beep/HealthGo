import SwiftUI
import FirebaseCore

@main
struct HealthGoWatchApp: App {
    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            HealthGoWatchRootView()
        }
    }
}

struct HealthGoWatchRootView: View {
    @AppStorage("watch_start_page") private var startPage = "home"
    @AppStorage("watch_large_text") private var largeText = false

    var body: some View {
        Group {
            if startPage == "ai" {
                NavigationStack {
                    HealthGoWatchAIView()
                }
            } else {
                HealthGoWatchHomeView()
            }
        }
        .dynamicTypeSize(largeText ? .xLarge : .medium)
    }
}
