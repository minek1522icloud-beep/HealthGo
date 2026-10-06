import Foundation
import HealthKit

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
        guard HKHealthStore.isHealthDataAvailable() else {
            throw NSError(domain:"HealthGo",code:1,userInfo:[NSLocalizedDescriptionKey:"Apple Health nie jest dostępne na tym urządzeniu."])
        }
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
                let value=(samples?.first as? HKQuantitySample)?.quantity.doubleValue(for:HKUnit.count().unitDivided(by:.minute()))
                cont.resume(returning:value)
            }
            store.execute(q)
        }
    }

    private func sleepMinutes(from start: Date, to end: Date) async throws -> Double? {
        try await withCheckedThrowingContinuation { cont in
            let pred=HKQuery.predicateForSamples(withStart:start,end:end)
            let q=HKSampleQuery(sampleType:sleep,predicate:pred,limit:HKObjectQueryNoLimit,sortDescriptors:nil) { _,samples,error in
                if let error { cont.resume(throwing:error); return }
                let asleep=Set([
                    HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                    HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                    HKCategoryValueSleepAnalysis.asleepREM.rawValue,
                    HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
                ])
                let total=(samples as? [HKCategorySample] ?? [])
                    .filter{asleep.contains($0.value)}
                    .reduce(0.0){$0+$1.endDate.timeIntervalSince($1.startDate)/60}
                cont.resume(returning:total>0 ? total:nil)
            }
            store.execute(q)
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

    @MainActor
    func upload(_ snapshot: HealthSnapshot, session: HealthGoSession) async throws {
        guard let uid=session.userId else {
            throw NSError(domain:"HealthGo",code:2,userInfo:[NSLocalizedDescriptionKey:"Zaloguj się do HealthGo."])
        }

        let endpoint=URL(string:"https://oqrfapmdcofguwdvhbeo.supabase.co/rest/v1/activity_daily?on_conflict=user_id,activity_date")!
        var request=try session.authorizedRequest(url:endpoint)
        request.httpMethod="POST"
        request.setValue("resolution=merge-duplicates,return=minimal",forHTTPHeaderField:"Prefer")

        let formatter=DateFormatter()
        formatter.calendar=Calendar(identifier:.gregorian)
        formatter.locale=Locale(identifier:"en_US_POSIX")
        formatter.dateFormat="yyyy-MM-dd"

        var body:[String:Any]=[
            "user_id":uid,
            "activity_date":formatter.string(from:Date()),
            "source":"iPhone · Apple Health",
            "updated_at":ISO8601DateFormatter().string(from:Date())
        ]
        if let value=snapshot.steps { body["steps"]=Int(value.rounded()) }
        if let value=snapshot.distanceKm { body["distance_meters"]=value*1000 }
        if let value=snapshot.heartRate { body["heart_rate"]=value }
        if let value=snapshot.sleepMinutes { body["sleep_minutes"]=Int(value.rounded()) }

        request.httpBody=try JSONSerialization.data(withJSONObject:body)
        let (data,response)=try await URLSession.shared.data(for:request)
        guard let http=response as? HTTPURLResponse,(200..<300).contains(http.statusCode) else {
            let message=(try? JSONSerialization.jsonObject(with:data) as? [String:Any])?["message"] as? String
                ?? "Nie udało się zapisać danych Apple Health."
            throw NSError(domain:"HealthGo",code:(response as? HTTPURLResponse)?.statusCode ?? 3,userInfo:[NSLocalizedDescriptionKey:message])
        }
    }
}
