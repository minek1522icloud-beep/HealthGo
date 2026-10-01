import SwiftUI

struct HealthGoWatchSettingsView: View {
    @AppStorage("watch_ai_response_style") private var aiResponseStyle = "compact"
    @AppStorage("watch_start_page") private var startPage = "home"
    @AppStorage("watch_large_text") private var largeText = false
    @AppStorage("watch_privacy_preview") private var privacyPreview = true
    @AppStorage("watch_daily_notifications") private var dailyNotifications = true
    @AppStorage("watch_activity_haptics") private var activityHaptics = true
    @AppStorage("watch_local_xp") private var localXP = 0
    @AppStorage("watch_daily_mask") private var dailyMask = 0

    @State private var showResetConfirmation = false

    var body: some View {
        List {
            Section("AI") {
                Picker("Długość odpowiedzi", selection: $aiResponseStyle) {
                    Text("Krótka").tag("compact")
                    Text("Standardowa").tag("standard")
                    Text("Dokładna").tag("detailed")
                }
            }

            Section("Wygląd") {
                Toggle("Większy tekst", isOn: $largeText)
                Picker("Ekran startowy", selection: $startPage) {
                    Text("HealthGo").tag("home")
                    Text("AI").tag("ai")
                }
            }

            Section("Zadania i aktywność") {
                Toggle("Przypomnienia zadań", isOn: $dailyNotifications)
                Toggle("Haptyka aktywności", isOn: $activityHaptics)
                LabeledContent("XP zegarka", value: "\(localXP)")
            }

            Section("Prywatność") {
                Toggle("Ukrywaj podgląd treści", isOn: $privacyPreview)
                Text("Dostęp do HealthKit jest przyznawany przez system i możesz go później zmienić w ustawieniach Apple.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Section("Połączenie") {
                LabeledContent("AI", value: "Firebase AI Logic")
                LabeledContent("Zdrowie", value: "HealthKit")
                LabeledContent("Konto", value: "Niesparowane")
            }

            Section("Aplikacja") {
                LabeledContent("Wersja", value: "Watch Professional 0.2")
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
                dailyNotifications = true
                activityHaptics = true
                localXP = 0
                dailyMask = 0
            }
            Button("Anuluj", role: .cancel) {}
        }
    }
}
