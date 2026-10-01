import SwiftUI

struct HealthGoWatchSettingsView: View {
    @AppStorage("watch_ai_response_style") private var aiResponseStyle = "compact"
    @AppStorage("watch_start_page") private var startPage = "home"
    @AppStorage("watch_large_text") private var largeText = false
    @AppStorage("watch_privacy_preview") private var privacyPreview = true

    @State private var showResetConfirmation = false

    var body: some View {
        List {
            Section("AI") {
                Picker("Długość odpowiedzi", selection: $aiResponseStyle) {
                    Text("Krótka").tag("compact")
                    Text("Standardowa").tag("standard")
                    Text("Dokładna").tag("detailed")
                }

                Text("Na zegarku krótsze odpowiedzi są wygodniejsze do czytania.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Section("Wygląd") {
                Toggle("Większy tekst", isOn: $largeText)

                Picker("Ekran startowy", selection: $startPage) {
                    Text("HealthGo").tag("home")
                    Text("AI").tag("ai")
                }
            }

            Section("Prywatność") {
                Toggle("Ukrywaj podgląd treści", isOn: $privacyPreview)

                Text("HealthGo nie powinien pokazywać prywatnej treści poza aplikacją bez Twojej zgody.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Section("Połączenie") {
                LabeledContent("AI", value: "Firebase AI Logic")
                LabeledContent("Tryb", value: "Online")
            }

            Section("Aplikacja") {
                LabeledContent("Wersja", value: "Watch Alpha")
                LabeledContent("Platforma", value: "watchOS")

                Button("Przywróć ustawienia") {
                    showResetConfirmation = true
                }
                .foregroundStyle(.red)
            }
        }
        .navigationTitle("Ustawienia")
        .confirmationDialog(
            "Przywrócić ustawienia domyślne?",
            isPresented: $showResetConfirmation,
            titleVisibility: .visible
        ) {
            Button("Przywróć", role: .destructive) {
                aiResponseStyle = "compact"
                startPage = "home"
                largeText = false
                privacyPreview = true
            }
            Button("Anuluj", role: .cancel) {}
        }
    }
}
