import Foundation
import Capacitor
import UIKit

@objc(BadgePlugin)
public class BadgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BadgePlugin"
    public let jsName = "Badge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise)
    ]

    @objc func set(_ call: CAPPluginCall) {
        let count = max(call.getInt("count") ?? 0, 0)

        DispatchQueue.main.async {
            UIApplication.shared.applicationIconBadgeNumber = count
            call.resolve(["count": UIApplication.shared.applicationIconBadgeNumber])
        }
    }

    @objc func get(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["count": UIApplication.shared.applicationIconBadgeNumber])
        }
    }
}
