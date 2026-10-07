import Foundation
import CoreBluetooth
import Combine

struct BluetoothDeviceItem: Identifiable, Equatable {
    let id: UUID
    let name: String
    let rssi: Int

    var signalText: String {
        if rssi >= -60 { return "mocny sygnał" }
        if rssi >= -80 { return "średni sygnał" }
        return "słaby sygnał"
    }
}

struct BluetoothConnectionInfo {
    let id: UUID
    let name: String
    let batteryLevel: Int?
    let supportsHeartRate: Bool
    let supportsBattery: Bool
    let supportsDeviceInfo: Bool
}

final class BluetoothWatchManager: NSObject, ObservableObject {
    @Published private(set) var devices: [BluetoothDeviceItem] = []
    @Published private(set) var scanning = false
    @Published private(set) var status = "Bluetooth gotowy."
    @Published private(set) var connectedName: String?
    @Published private(set) var batteryLevel: Int?
    @Published private(set) var heartRate: Int?

    var onConnected: ((BluetoothConnectionInfo) -> Void)?

    private var central: CBCentralManager!
    private var peripherals: [UUID: CBPeripheral] = [:]
    private var active: CBPeripheral?
    private var supportsHeartRate = false
    private var supportsBattery = false
    private var supportsDeviceInfo = false

    private let batteryService = CBUUID(string:"180F")
    private let batteryCharacteristic = CBUUID(string:"2A19")
    private let heartService = CBUUID(string:"180D")
    private let heartMeasurement = CBUUID(string:"2A37")
    private let deviceInfoService = CBUUID(string:"180A")

    override init() {
        super.init()
        central=CBCentralManager(delegate:self,queue:.main)
    }

    func startScan() {
        guard central.state == .poweredOn else {
            status = bluetoothStateMessage(central.state)
            return
        }
        devices=[]
        peripherals=[:]
        scanning=true
        status="Szukam zegarków i opasek Bluetooth…"
        central.scanForPeripherals(withServices:nil,options:[
            CBCentralManagerScanOptionAllowDuplicatesKey:false
        ])
        DispatchQueue.main.asyncAfter(deadline:.now()+7) { [weak self] in
            self?.stopScan()
        }
    }

    func stopScan() {
        guard scanning else { return }
        central.stopScan()
        scanning=false
        if devices.isEmpty {
            status="Nie znaleziono urządzeń. Zbliż zegarek do telefonu i upewnij się, że jego Bluetooth jest aktywny."
        } else {
            status="Znaleziono \(devices.count) urządzeń. Wybierz swój zegarek."
        }
    }

    func connect(_ item:BluetoothDeviceItem) {
        guard let peripheral=peripherals[item.id] else {
            status="To urządzenie nie jest już dostępne. Wyszukaj ponownie."
            return
        }
        stopScan()
        if let active,active.identifier != peripheral.identifier {
            central.cancelPeripheralConnection(active)
        }
        self.active=peripheral
        peripheral.delegate=self
        connectedName=nil
        batteryLevel=nil
        heartRate=nil
        supportsHeartRate=false
        supportsBattery=false
        supportsDeviceInfo=false
        status="Łączę z \(item.name)…"
        central.connect(peripheral,options:nil)
    }

    func disconnect() {
        guard let active else { return }
        central.cancelPeripheralConnection(active)
    }

    private func bluetoothStateMessage(_ state:CBManagerState) -> String {
        switch state {
        case .poweredOff: return "Włącz Bluetooth w iPhonie i spróbuj ponownie."
        case .unauthorized: return "HealthGo nie ma zgody na Bluetooth. Włącz ją w Ustawieniach iPhone’a."
        case .unsupported: return "Ten iPhone nie obsługuje wymaganego Bluetooth."
        case .resetting: return "Bluetooth uruchamia się ponownie. Spróbuj za chwilę."
        case .unknown: return "Bluetooth jeszcze się uruchamia."
        default: return "Bluetooth jest gotowy."
        }
    }

    private func publishConnection() {
        guard let active else { return }
        let name=active.name?.trimmingCharacters(in:.whitespacesAndNewlines)
        let safeName=(name?.isEmpty == false ? name! : "Zegarek / opaska")
        connectedName=safeName
        let features=[
            supportsHeartRate ? "tętno" : nil,
            supportsBattery ? "bateria" : nil,
            supportsDeviceInfo ? "informacje o urządzeniu" : nil
        ].compactMap{$0}

        if features.isEmpty {
            status="Połączono z \(safeName). Zegarek nie udostępnia standardowych usług zdrowotnych BLE; dane mogą wymagać aplikacji producenta lub Apple Health."
        } else {
            var text="Połączono z \(safeName). Obsługiwane: "+features.joined(separator:", ")
            if let batteryLevel { text += " · bateria \(batteryLevel)%" }
            status=text+"."
        }

        onConnected?(
            BluetoothConnectionInfo(
                id:active.identifier,
                name:safeName,
                batteryLevel:batteryLevel,
                supportsHeartRate:supportsHeartRate,
                supportsBattery:supportsBattery,
                supportsDeviceInfo:supportsDeviceInfo
            )
        )
    }

    private func parseHeartRate(_ data:Data) -> Int? {
        let bytes=[UInt8](data)
        guard bytes.count >= 2 else { return nil }
        let sixteenBit=(bytes[0] & 0x01) != 0
        if sixteenBit {
            guard bytes.count >= 3 else { return nil }
            return Int(bytes[1]) | (Int(bytes[2]) << 8)
        }
        return Int(bytes[1])
    }
}

extension BluetoothWatchManager: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central:CBCentralManager) {
        status=bluetoothStateMessage(central.state)
        if central.state != .poweredOn {
            scanning=false
            devices=[]
        }
    }

    func centralManager(
        _ central:CBCentralManager,
        didDiscover peripheral:CBPeripheral,
        advertisementData:[String:Any],
        rssi RSSI:NSNumber
    ) {
        let advertised=advertisementData[CBAdvertisementDataLocalNameKey] as? String
        let rawName=(advertised ?? peripheral.name ?? "Zegarek / opaska").trimmingCharacters(in:.whitespacesAndNewlines)
        let name=rawName.isEmpty ? "Zegarek / opaska" : rawName
        peripherals[peripheral.identifier]=peripheral
        let item=BluetoothDeviceItem(id:peripheral.identifier,name:name,rssi:RSSI.intValue)
        if let index=devices.firstIndex(where:{$0.id==item.id}) {
            devices[index]=item
        } else {
            devices.append(item)
        }
        devices.sort{$0.rssi > $1.rssi}
    }

    func centralManager(_ central:CBCentralManager,didConnect peripheral:CBPeripheral) {
        status="Połączono. Sprawdzam możliwości zegarka…"
        peripheral.discoverServices([batteryService,heartService,deviceInfoService])
    }

    func centralManager(
        _ central:CBCentralManager,
        didFailToConnect peripheral:CBPeripheral,
        error:Error?
    ) {
        status="Nie udało się połączyć z zegarkiem: "+(error?.localizedDescription ?? "błąd Bluetooth")
        if active?.identifier == peripheral.identifier { active=nil }
    }

    func centralManager(
        _ central:CBCentralManager,
        didDisconnectPeripheral peripheral:CBPeripheral,
        error:Error?
    ) {
        if active?.identifier == peripheral.identifier {
            connectedName=nil
            active=nil
            batteryLevel=nil
            heartRate=nil
            status=error == nil ? "Zegarek Bluetooth rozłączony." : "Połączenie z zegarkiem zostało przerwane."
        }
    }
}

extension BluetoothWatchManager: CBPeripheralDelegate {
    func peripheral(_ peripheral:CBPeripheral,didDiscoverServices error:Error?) {
        if let error {
            status="Nie udało się odczytać możliwości zegarka: "+error.localizedDescription
            publishConnection()
            return
        }

        let services=peripheral.services ?? []
        supportsHeartRate=services.contains{$0.uuid==heartService}
        supportsBattery=services.contains{$0.uuid==batteryService}
        supportsDeviceInfo=services.contains{$0.uuid==deviceInfoService}

        for service in services {
            if service.uuid == batteryService {
                peripheral.discoverCharacteristics([batteryCharacteristic],for:service)
            } else if service.uuid == heartService {
                peripheral.discoverCharacteristics([heartMeasurement],for:service)
            }
        }
        publishConnection()
    }

    func peripheral(
        _ peripheral:CBPeripheral,
        didDiscoverCharacteristicsFor service:CBService,
        error:Error?
    ) {
        guard error == nil else { return }
        for characteristic in service.characteristics ?? [] {
            if characteristic.uuid == batteryCharacteristic {
                peripheral.readValue(for:characteristic)
            }
            if characteristic.uuid == heartMeasurement {
                peripheral.setNotifyValue(true,for:characteristic)
            }
        }
    }

    func peripheral(
        _ peripheral:CBPeripheral,
        didUpdateValueFor characteristic:CBCharacteristic,
        error:Error?
    ) {
        guard error == nil,let data=characteristic.value else { return }
        if characteristic.uuid == batteryCharacteristic,let first=data.first {
            batteryLevel=Int(first)
            publishConnection()
        }
        if characteristic.uuid == heartMeasurement,let value=parseHeartRate(data) {
            heartRate=value
            status="Połączono z \(connectedName ?? peripheral.name ?? "zegarkiem") · tętno \(value) bpm"
        }
    }
}
