import SwiftUI

struct HealthGoWatchActivityView: View {
    @StateObject private var health = HealthGoWatchHealthStore()

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Aktywność")
                        .font(.headline)
                    Text(health.statusText)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Button(health.isLoading ? "Odczytuję…" : "Połącz / odśwież dane") {
                    health.requestAuthorization()
                }
                .disabled(health.isLoading)
            }

            Section("Dzisiaj") {
                metric("Kroki", value: health.steps.map { String(Int($0)) }, icon: "figure.walk")
                metric("Dystans", value: health.distanceKm.map { String(format: "%.2f km", $0) }, icon: "location")
                metric("Aktywna energia", value: health.activeEnergyKcal.map { String(format: "%.0f kcal", $0) }, icon: "flame")
                metric("Ostatnie tętno", value: health.heartRateBpm.map { String(format: "%.0f bpm", $0) }, icon: "heart")
            }

            Section {
                Text("HealthGo pokazuje tylko dane przekazane przez HealthKit po Twojej zgodzie. Brak danych oznacza brak odczytu, a nie zero.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Aktywność")
    }

    @ViewBuilder
    private func metric(_ title: String, value: String?, icon: String) -> some View {
        HStack {
            Image(systemName: icon)
            VStack(alignment: .leading) {
                Text(title)
                    .font(.caption)
                Text(value ?? "Brak danych")
                    .font(.headline)
            }
        }
    }
}
