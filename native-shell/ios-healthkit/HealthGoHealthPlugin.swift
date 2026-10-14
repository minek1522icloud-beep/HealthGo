import Foundation
import HealthKit
import Capacitor

/// Read-only bridge. Never fabricates measurements or uploads health data.
@objc(HealthGoHealthPlugin)
public class HealthGoHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthGoHealthPlugin"
    public let jsName = "HealthGoHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readToday", returnType: CAPPluginReturnPromise)
    ]

    private let store = HKHealthStore()
    private let steps = HKQuantityType(.stepCount)
    private let distance = HKQuantityType(.distanceWalkingRunning)
    private let energy = HKQuantityType(.activeEnergyBurned)
    private let heart = HKQuantityType(.heartRate)
    private let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!

    @objc func availability(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func requestAccess(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health nie jest dostępne na tym urządzeniu.")
            return
        }
        let read: Set<HKObjectType> = [steps, distance, energy, heart, sleep]
        store.requestAuthorization(toShare: [], read: read) { requested, error in
            if let error {
                call.reject("Nie udało się poprosić o dostęp do Apple Health: \(error.localizedDescription)")
                return
            }
            // HealthKit intentionally does not reveal whether read access was denied.
            // Request completion must not be treated as proof of permission.
            call.resolve(["requested": requested])
        }
    }

    private func sum(_ type: HKQuantityType, unit: HKUnit, start: Date, end: Date, done: @escaping (Double?) -> Void) {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
        let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, error in
            guard error == nil else { done(nil); return }
            done(stats?.sumQuantity()?.doubleValue(for: unit))
        }
        store.execute(query)
    }

    private func latestHeart(start: Date, end: Date, done: @escaping (Double?) -> Void) {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
        let query = HKSampleQuery(sampleType: heart, predicate: predicate, limit: 1,
                                  sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, error in
            guard error == nil else { done(nil); return }
            let value = (samples?.first as? HKQuantitySample)?.quantity
                .doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
            done(value)
        }
        store.execute(query)
    }

    private func recentSleep(start: Date, end: Date, done: @escaping (Double?) -> Void) {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
        let query = HKSampleQuery(sampleType: sleep, predicate: predicate, limit: HKObjectQueryNoLimit,
                                  sortDescriptors: nil) { _, samples, error in
            guard error == nil else { done(nil); return }
            let asleep: Set<Int>
            if #available(iOS 16.0, *) {
                asleep = [
                    HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                    HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                    HKCategoryValueSleepAnalysis.asleepREM.rawValue,
                    HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
                ]
            } else {
                asleep = [HKCategoryValueSleepAnalysis.asleep.rawValue]
            }
            let minutes = (samples as? [HKCategorySample] ?? [])
                .filter { asleep.contains($0.value) }
                .reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) / 60.0 }
            done(minutes > 0 ? minutes : nil)
        }
        store.execute(query)
    }

    @objc func readToday(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Apple Health nie jest dostępne na tym urządzeniu.")
            return
        }
        let now = Date()
        let start = Calendar.current.startOfDay(for: now)
        let sleepStart = Calendar.current.date(byAdding: .hour, value: -12, to: start) ?? start
        let dayFormatter = DateFormatter()
        dayFormatter.dateFormat = "yyyy-MM-dd"
        dayFormatter.locale = Locale(identifier: "en_US_POSIX")
        dayFormatter.timeZone = .current
        let day = dayFormatter.string(from: now)

        let group = DispatchGroup()
        let lock = NSLock()
        var values: [String: Double] = [:]
        func collect(_ key: String, _ startQuery: (@escaping (Double?) -> Void) -> Void) {
            group.enter()
            startQuery { value in
                if let value, value.isFinite, value >= 0 {
                    lock.lock()
                    values[key] = value
                    lock.unlock()
                }
                group.leave()
            }
        }

        collect("steps") { self.sum(self.steps, unit: .count(), start: start, end: now, done: $0) }
        collect("distanceKm") { self.sum(self.distance, unit: .meterUnit(with: .kilo), start: start, end: now, done: $0) }
        collect("activeCalories") { self.sum(self.energy, unit: .kilocalorie(), start: start, end: now, done: $0) }
        collect("heartRate") { self.latestHeart(start: start, end: now, done: $0) }
        collect("sleepMinutes") { self.recentSleep(start: sleepStart, end: now, done: $0) }

        group.notify(queue: .main) {
            call.resolve([
                "available": true,
                "day": day,
                "updatedAt": ISO8601DateFormatter().string(from: now),
                "source": "Apple Health",
                "steps": values["steps"] as Any? ?? NSNull(),
                "distanceKm": values["distanceKm"] as Any? ?? NSNull(),
                "activeCalories": values["activeCalories"] as Any? ?? NSNull(),
                "heartRate": values["heartRate"] as Any? ?? NSNull(),
                "sleepMinutes": values["sleepMinutes"] as Any? ?? NSNull()
            ])
        }
    }
}
