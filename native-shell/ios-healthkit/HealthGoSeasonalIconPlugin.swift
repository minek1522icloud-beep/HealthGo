import Foundation
import UIKit
import Capacitor

@objc(HealthGoSeasonalIconPlugin)
public class HealthGoSeasonalIconPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthGoSeasonalIconPlugin"
    public let jsName = "HealthGoSeasonalIcon"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "syncSeasonalIcon", returnType: CAPPluginReturnPromise)
    ]

    @objc func syncSeasonalIcon(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard UIApplication.shared.supportsAlternateIcons else {
                call.resolve(["supported": false, "reason": "alternate-icons-unavailable"])
                return
            }
            let target = Self.iconName(for: Date())
            guard UIApplication.shared.alternateIconName != target else {
                call.resolve(["supported": true, "icon": target ?? "default", "changed": false])
                return
            }
            UIApplication.shared.setAlternateIconName(target) { error in
                if let error { call.reject("Nie udało się zmienić ikony HealthGo: \(error.localizedDescription)") }
                else { call.resolve(["supported": true, "icon": target ?? "default", "changed": true]) }
            }
        }
    }

    private static func iconName(for date: Date) -> String? {
        let cal = Calendar(identifier: .gregorian)
        let month = cal.component(.month, from: date)
        if month == 10 { return "HalloweenIcon" }
        if month == 12 { return "ChristmasIcon" }
        if (6...8).contains(month) { return "SummerIcon" }
        return isEasterSeason(date, calendar: cal) ? "EasterIcon" : nil
    }

    private static func isEasterSeason(_ date: Date, calendar: Calendar) -> Bool {
        let y=calendar.component(.year, from: date), a=y%19, b=y/100, c=y%100
        let d=b/4, e=b%4, f=(b+8)/25, g=(b-f+1)/3
        let h=(19*a+b-d-g+15)%30, i=c/4, k=c%4, l=(32+2*e+2*i-h-k)%7, m=(a+11*h+22*l)/451
        let month=(h+l-7*m+114)/31, day=((h+l-7*m+114)%31)+1
        var parts=DateComponents(); parts.year=y; parts.month=month; parts.day=day
        guard let easter=calendar.date(from: parts),
              let palm=calendar.date(byAdding: .day, value: -7, to: easter),
              let monday=calendar.date(byAdding: .day, value: 1, to: easter),
              let after=calendar.date(byAdding: .day, value: 1, to: monday) else { return false }
        return date >= palm && date < after
    }
}
