import Foundation
import Combine
import HealthKit

@MainActor
final class HealthGoWatchHealthStore: ObservableObject {
    @Published var steps: Double?
    @Published var distanceKm: Double?
    @Published var activeEnergyKcal: Double?
    @Published var heartRateBpm: Double?
    @Published var statusText = "Dane Zdrowie nie są jeszcze połączone."
    @Published var isLoading = false

    private let store = HKHealthStore()

    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else {
            statusText = "HealthKit nie jest dostępny na tym urządzeniu."
            return
        }

        var readTypes = Set<HKObjectType>()
        [
            HKObjectType.quantityType(forIdentifier: .stepCount),
            HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning),
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned),
            HKObjectType.quantityType(forIdentifier: .heartRate)
        ].compactMap { $0 }.forEach { readTypes.insert($0) }

        isLoading = true
        store.requestAuthorization(toShare: [], read: readTypes) { [weak self] success, error in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.isLoading = false
                if success {
                    self.statusText = "Połączono z danymi Zdrowie."
                    self.refresh()
                } else {
                    self.statusText = error == nil ? "Brak zgody na odczyt danych." : "Nie udało się uzyskać dostępu do danych Zdrowie."
                }
            }
        }
    }

    func refresh() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        isLoading = true

        readTodaySum(.stepCount, unit: .count()) { [weak self] value in
            Task { @MainActor [weak self] in self?.steps = value }
        }
        readTodaySum(.distanceWalkingRunning, unit: .meterUnit(with: .kilo)) { [weak self] value in
            Task { @MainActor [weak self] in self?.distanceKm = value }
        }
        readTodaySum(.activeEnergyBurned, unit: .kilocalorie()) { [weak self] value in
            Task { @MainActor [weak self] in self?.activeEnergyKcal = value }
        }
        readLatestHeartRate { [weak self] value in
            Task { @MainActor [weak self] in
                self?.heartRateBpm = value
                self?.isLoading = false
            }
        }
    }

    private func readTodaySum(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        completion: @escaping (Double?) -> Void
    ) {
        guard let type = HKObjectType.quantityType(forIdentifier: identifier) else {
            completion(nil)
            return
        }

        let start = Calendar.current.startOfDay(for: Date())
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date())
        let query = HKStatisticsQuery(
            quantityType: type,
            quantitySamplePredicate: predicate,
            options: .cumulativeSum
        ) { _, result, _ in
            completion(result?.sumQuantity()?.doubleValue(for: unit))
        }
        store.execute(query)
    }

    private func readLatestHeartRate(completion: @escaping (Double?) -> Void) {
        guard let type = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            completion(nil)
            return
        }

        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(
            sampleType: type,
            predicate: nil,
            limit: 1,
            sortDescriptors: [sort]
        ) { _, samples, _ in
            guard let sample = samples?.first as? HKQuantitySample else {
                completion(nil)
                return
            }
            completion(sample.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute())))
        }
        store.execute(query)
    }
}
