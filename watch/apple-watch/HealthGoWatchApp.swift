import SwiftUI
import FirebaseCore

@main
struct HealthGoWatchApp: App {
    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            HealthGoWatchHomeView()
        }
    }
}
