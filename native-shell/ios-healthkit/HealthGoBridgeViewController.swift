import Capacitor

/// Installed as the actual storyboard entry point, so the JS bridge can find HealthGoHealth.
class HealthGoBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(HealthGoHealthPlugin())
    }
}
