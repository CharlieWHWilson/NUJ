import Capacitor

class NujBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(BadgePlugin())
    }
}