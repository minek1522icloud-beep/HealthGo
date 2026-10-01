import SwiftUI

struct ContentView: View {
    @State private var status="Najpierw nadaj dostęp do danych zdrowotnych."
    private let sync=HealthSync()
    var body: some View {
        NavigationStack {
            VStack(alignment:.leading,spacing:18) {
                Text("HealthGo · Urządzenia").font(.largeTitle.bold())
                Text("Zegarek → iPhone → Apple Health → HealthGo").foregroundStyle(.secondary)
                Text(status).padding(.vertical)
                Button("Połącz dane zdrowotne") { Task { do { try await sync.authorize(); status="Dostęp ustawiony. Możesz synchronizować." } catch { status=error.localizedDescription } } }.buttonStyle(.borderedProminent)
                Button("Synchronizuj teraz") { Task { do { let s=try await sync.readToday(); try await sync.upload(s); status="Zsynchronizowano prawdziwe dane z Apple Health." } catch { status=error.localizedDescription } } }.buttonStyle(.bordered)
                Spacer()
            }.padding().navigationTitle("Urządzenia")
        }
    }
}
