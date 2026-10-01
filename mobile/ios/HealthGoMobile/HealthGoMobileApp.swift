import SwiftUI
import FirebaseCore

@main struct HealthGoMobileApp: App {
    init(){ FirebaseApp.configure() }
    var body: some Scene { WindowGroup { ContentView() } }
}
