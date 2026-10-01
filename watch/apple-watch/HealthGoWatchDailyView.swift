import SwiftUI

struct HealthGoWatchDailyView: View {
    @AppStorage("watch_daily_date") private var savedDate = ""
    @AppStorage("watch_daily_mask") private var completedMask = 0
    @AppStorage("watch_local_xp") private var localXP = 0

    private let tasks = [
        ("📅", "Uporządkuj plan", "Dodaj albo popraw jeden punkt planu.", 35),
        ("🌿", "Krótka przerwa", "Zrób spokojną przerwę od ekranu.", 20),
        ("🚶", "Trochę ruchu", "Wybierz lekką aktywność odpowiednią dla Ciebie.", 25)
    ]

    private var today: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    var body: some View {
        List {
            Section {
                Text("XP na zegarku: \(localXP)")
                    .font(.headline)
                Text("Postęp jest zapisany lokalnie na tym zegarku. Synchronizacja konta będzie używana dopiero po bezpiecznym sparowaniu urządzenia.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Section("Zadania Dnia") {
                ForEach(tasks.indices, id: \.self) { index in
                    let task = tasks[index]
                    Button {
                        complete(index)
                    } label: {
                        HStack {
                            Text(task.0)
                            VStack(alignment: .leading) {
                                Text(task.1)
                                Text(task.2)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(isDone(index) ? "✓" : "+\(task.3)")
                                .font(.caption)
                        }
                    }
                    .disabled(isDone(index))
                }
            }
        }
        .navigationTitle("Dzisiaj")
        .onAppear(perform: resetIfNeeded)
    }

    private func isDone(_ index: Int) -> Bool {
        (completedMask & (1 << index)) != 0
    }

    private func complete(_ index: Int) {
        resetIfNeeded()
        guard !isDone(index) else { return }
        completedMask |= (1 << index)
        localXP += tasks[index].3
    }

    private func resetIfNeeded() {
        guard savedDate != today else { return }
        savedDate = today
        completedMask = 0
    }
}
