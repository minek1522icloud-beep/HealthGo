import SwiftUI

struct HealthGoWatchHomeView: View {
    @AppStorage("watch_local_xp") private var localXP = 0

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("HealthGo")
                                .font(.headline)
                            Text("XP zegarka: \(localXP)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "heart.fill")
                    }
                }

                Section("Dzisiaj") {
                    NavigationLink {
                        HealthGoWatchDailyView()
                    } label: {
                        Label("Zadania Dnia", systemImage: "checklist")
                    }

                    NavigationLink {
                        HealthGoWatchActivityView()
                    } label: {
                        Label("Aktywność", systemImage: "figure.walk")
                    }
                }

                Section("HealthGo") {
                    NavigationLink {
                        HealthGoWatchAIView()
                    } label: {
                        Label("HealthGo AI", systemImage: "sparkles")
                    }

                    NavigationLink {
                        WatchComingSoonView(
                            title: "Plan Dnia",
                            text: "Podgląd pełnego Planu Dnia pojawi się po sparowaniu zegarka z kontem HealthGo."
                        )
                    } label: {
                        Label("Plan Dnia", systemImage: "calendar")
                    }
                }

                Section("Aplikacja") {
                    NavigationLink {
                        HealthGoWatchSettingsView()
                    } label: {
                        Label("Ustawienia", systemImage: "gearshape")
                    }
                }

                Section {
                    Text("Dane aktywności są pobierane z HealthKit wyłącznie po zgodzie użytkownika.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("HealthGo")
        }
    }
}

struct WatchComingSoonView: View {
    let title: String
    let text: String

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text(title)
                    .font(.headline)
                Text(text)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
            }
            .padding()
        }
    }
}
