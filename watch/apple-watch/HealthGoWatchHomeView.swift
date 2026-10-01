import SwiftUI

struct HealthGoWatchHomeView: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink {
                        HealthGoWatchAIView()
                    } label: {
                        Label("HealthGo AI", systemImage: "sparkles")
                    }

                    NavigationLink {
                        WatchComingSoonView(
                            title: "Plan Dnia",
                            text: "Synchronizacja Planu Dnia z kontem HealthGo będzie dodana w kolejnym etapie."
                        )
                    } label: {
                        Label("Plan Dnia", systemImage: "calendar")
                    }

                    NavigationLink {
                        WatchComingSoonView(
                            title: "Aktywność",
                            text: "HealthGo pokaże tu wyłącznie prawdziwe dane po uzyskaniu wymaganych uprawnień."
                        )
                    } label: {
                        Label("Aktywność", systemImage: "figure.walk")
                    }
                }

                Section {
                    Text("HealthGo Watch Alpha")
                        .font(.footnote)
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
