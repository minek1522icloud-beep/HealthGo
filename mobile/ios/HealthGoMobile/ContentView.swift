import SwiftUI

struct ContentView: View {
    @StateObject private var session=HealthGoSession()
    @StateObject private var bluetooth=BluetoothWatchManager()
    @State private var email=""
    @State private var password=""
    @State private var status="Zaloguj się tym samym kontem co w HealthGo."
    @State private var syncing=false
    @State private var healthConnected=false

    private let sync=HealthSync()

    var body: some View {
        NavigationStack {
            Form {
                Section("Konto HealthGo") {
                    if session.isAuthenticated {
                        Text("Zalogowano: \(session.email)")
                            .foregroundStyle(.secondary)
                        Button("Wyloguj",role:.destructive) {
                            bluetooth.disconnect()
                            session.logout()
                            healthConnected=false
                            status="Wylogowano."
                        }
                    } else {
                        TextField("E-mail",text:$email)
                            .textInputAutocapitalization(.never)
                            .keyboardType(.emailAddress)
                            .textContentType(.username)
                        SecureField("Hasło",text:$password)
                            .textContentType(.password)

                        Button(session.busy ? "Logowanie…" : "Zaloguj się") {
                            Task{await login()}
                        }
                        .disabled(session.busy)

                        Button("Kontynuuj z Google") {
                            Task{await loginGoogle()}
                        }
                        .disabled(session.busy)
                    }
                }

                Section("Zegarek sportowy Bluetooth") {
                    Text("Dla prostych zegarków i opasek HealthGo może wyszukać urządzenie bezpośrednio przez Bluetooth. Jeśli zegarek używa zamkniętego protokołu producenta, HealthGo pokaże to zamiast tworzyć fikcyjne dane.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    Button(bluetooth.scanning ? "Szukam zegarków…" : "Szukaj zegarka") {
                        bluetooth.startScan()
                    }
                    .disabled(!session.isAuthenticated || bluetooth.scanning)

                    if !bluetooth.devices.isEmpty {
                        ForEach(bluetooth.devices) { device in
                            Button {
                                bluetooth.connect(device)
                            } label: {
                                HStack {
                                    VStack(alignment:.leading,spacing:3) {
                                        Text(device.name)
                                        Text(device.signalText)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Image(systemName:"chevron.right")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }

                    if let name=bluetooth.connectedName {
                        HStack {
                            Image(systemName:"checkmark.circle.fill")
                                .foregroundStyle(.green)
                            Text("Połączono: \(name)")
                        }
                        if let battery=bluetooth.batteryLevel {
                            Text("Bateria: \(battery)%")
                                .foregroundStyle(.secondary)
                        }
                        if let heart=bluetooth.heartRate {
                            Text("Tętno z usługi BLE: \(heart) bpm")
                                .foregroundStyle(.secondary)
                        }
                        Button("Rozłącz zegarek",role:.destructive) {
                            bluetooth.disconnect()
                        }
                    }

                    Text(bluetooth.status)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Dane zdrowotne telefonu") {
                    Text("Zgodne zegarki mogą też przekazywać dane do aplikacji Zdrowie. HealthGo może po Twojej zgodzie odczytać kroki, dystans, sen i ostatni zapis tętna.")

                    Button(healthConnected ? "Dane zdrowotne połączone ✓" : "Połącz dane zdrowotne") {
                        Task{await authorize()}
                    }
                    .disabled(!session.isAuthenticated)

                    Button(syncing ? "Synchronizuję…" : "Synchronizuj teraz") {
                        Task{await syncNow()}
                    }
                    .disabled(!session.isAuthenticated || !healthConnected || syncing)
                }

                Section("Stan") {
                    Text(status).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("HealthGo")
            .task {
                bluetooth.onConnected={ info in
                    Task { @MainActor in
                        guard session.isAuthenticated else { return }
                        do {
                            try await session.registerDevice(
                                externalId:"ble-"+info.id.uuidString.lowercased(),
                                name:info.name,
                                deviceType:"wearable",
                                connectionType:"ble",
                                batteryLevel:info.batteryLevel,
                                connected:true
                            )
                            status="Zegarek \(info.name) zapisany na koncie HealthGo."
                        } catch {
                            status="Zegarek jest połączony, ale nie udało się zapisać go na koncie: "+error.localizedDescription
                        }
                    }
                }

                bluetooth.onDisconnected={ info in
                    Task { @MainActor in
                        guard session.isAuthenticated else { return }
                        do {
                            try await session.registerDevice(
                                externalId:"ble-"+info.id.uuidString.lowercased(),
                                name:info.name,
                                deviceType:"wearable",
                                connectionType:"ble",
                                batteryLevel:info.batteryLevel,
                                connected:false
                            )
                        } catch {
                            status="Zegarek rozłączono, ale nie udało się zaktualizować stanu na koncie."
                        }
                    }
                }

                await session.restore()
                email=session.email
                if session.isAuthenticated {
                    status="Konto HealthGo jest zalogowane. Możesz połączyć zegarek lub dane zdrowotne."
                }
            }
            .onOpenURL { url in
                guard url.scheme=="healthgo" else{return}
                if url.host=="connect-health" {
                    Task{await authorize()}
                } else if url.host=="connect-bluetooth" {
                    bluetooth.startScan()
                }
            }
        }
    }

    private func login() async {
        do {
            try await session.login(email:email,password:password)
            self.email=session.email
            password=""
            status="Zalogowano. Możesz połączyć zegarek lub dane zdrowotne."
        } catch {
            status="Nie udało się zalogować: "+error.localizedDescription
        }
    }

    private func loginGoogle() async {
        do {
            try await session.loginGoogle()
            email=session.email
            status="Zalogowano przez Google. Możesz połączyć zegarek lub dane zdrowotne."
        } catch {
            status="Logowanie Google nie powiodło się: "+error.localizedDescription
        }
    }

    private func authorize() async {
        guard session.isAuthenticated else {
            status="Najpierw zaloguj się do HealthGo."
            return
        }
        do {
            try await sync.authorize()
            healthConnected=true
            status="Dane zdrowotne połączone. Synchronizuję dozwolone dane."
            await syncNow()
        } catch {
            healthConnected=false
            status="Nie udało się połączyć danych zdrowotnych: "+error.localizedDescription
        }
    }

    private func syncNow() async {
        guard !syncing else{return}
        syncing=true
        defer{syncing=false}
        do {
            let snapshot=try await sync.readToday()
            try await sync.upload(snapshot,session:session)
            if let heart=snapshot.heartRate {
                status="Zsynchronizowano z HealthGo. Ostatnie zapisane tętno: \(Int(heart.rounded())) bpm."
            } else {
                status="Zsynchronizowano z HealthGo. System zdrowotny nie udostępnił teraz pomiaru tętna."
            }
        } catch {
            status="Synchronizacja nieudana: "+error.localizedDescription
        }
    }
}
