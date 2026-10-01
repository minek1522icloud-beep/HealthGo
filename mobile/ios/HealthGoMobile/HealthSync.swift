import Foundation
import HealthKit
import FirebaseAuth
import FirebaseFirestore

struct HealthSnapshot {
    let steps: Double?
    let distanceKm: Double?
    let heartRate: Double?
    let sleepMinutes: Double?
}

final class HealthSync {
    let store = HKHealthStore()
    private let step = HKQuantityType(.stepCount)
    private let distance = HKQuantityType(.distanceWalkingRunning)
    private let heart = HKQuantityType(.heartRate)
    private let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!

    func authorize() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { throw NSError(domain:"HealthGo",code:1,userInfo:[NSLocalizedDescriptionKey:"HealthKit jest niedostępny"]) }
        try await store.requestAuthorization(toShare: [], read: [step,distance,heart,sleep])
    }

    private func sum(_ type: HKQuantityType, unit: HKUnit, from start: Date, to end: Date) async throws -> Double? {
        try await withCheckedThrowingContinuation { cont in
            let pred=HKQuery.predicateForSamples(withStart:start,end:end)
            let q=HKStatisticsQuery(quantityType:type,quantitySamplePredicate:pred,options:.cumulativeSum) { _,stats,error in
                if let error { cont.resume(throwing:error); return }
                cont.resume(returning:stats?.sumQuantity()?.doubleValue(for:unit))
            }
            store.execute(q)
        }
    }

    private func latestHeart(from start: Date, to end: Date) async throws -> Double? {
        try await withCheckedThrowingContinuation { cont in
            let pred=HKQuery.predicateForSamples(withStart:start,end:end)
            let q=HKSampleQuery(sampleType:heart,predicate:pred,limit:1,sortDescriptors:[NSSortDescriptor(key:HKSampleSortIdentifierEndDate,ascending:false)]) { _,samples,error in
                if let error { cont.resume(throwing:error); return }
                let v=(samples?.first as? HKQuantitySample)?.quantity.doubleValue(for:HKUnit.count().unitDivided(by:.minute()))
                cont.resume(returning:v)
            }; store.execute(q)
        }
    }

    private func sleepMinutes(from start: Date, to end: Date) async throws -> Double? {
        try await withCheckedThrowingContinuation { cont in
            let pred=HKQuery.predicateForSamples(withStart:start,end:end)
            let q=HKSampleQuery(sampleType:sleep,predicate:pred,limit:HKObjectQueryNoLimit,sortDescriptors:nil) { _,samples,error in
                if let error { cont.resume(throwing:error); return }
                let asleep=Set([HKCategoryValueSleepAnalysis.asleepCore.rawValue,HKCategoryValueSleepAnalysis.asleepDeep.rawValue,HKCategoryValueSleepAnalysis.asleepREM.rawValue,HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue])
                let total=(samples as? [HKCategorySample] ?? []).filter{asleep.contains($0.value)}.reduce(0.0){$0+$1.endDate.timeIntervalSince($1.startDate)/60}
                cont.resume(returning:total>0 ? total:nil)
            }; store.execute(q)
        }
    }

    func readToday() async throws -> HealthSnapshot {
        let now=Date(), start=Calendar.current.startOfDay(for:now)
        let yesterdayNoon=Calendar.current.date(byAdding:.hour,value:-12,to:start)!
        async let s=sum(step,unit:.count(),from:start,to:now)
        async let d=sum(distance,unit:.meterUnit(with:.kilo),from:start,to:now)
        async let h=latestHeart(from:start,to:now)
        async let sl=sleepMinutes(from:yesterdayNoon,to:now)
        return try await HealthSnapshot(steps:s,distanceKm:d,heartRate:h,sleepMinutes:sl)
    }

    func upload(_ s: HealthSnapshot) async throws {
        guard let uid=Auth.auth().currentUser?.uid else { throw NSError(domain:"HealthGo",code:2,userInfo:[NSLocalizedDescriptionKey:"Zaloguj się do HealthGo"]) }
        try await Firestore.firestore().collection("users").document(uid).collection("health").document("latest").setData([
            "steps":s.steps as Any,"distanceKm":s.distanceKm as Any,"heartRate":s.heartRate as Any,"sleepMinutes":s.sleepMinutes as Any,
            "source":"iPhone · Apple Health","updatedAt":FieldValue.serverTimestamp()
        ],merge:true)
    }
}
