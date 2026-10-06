import SwiftUI

struct ContentView: View {
    @StateObject private var session=HealthGoSession()
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
                    TextField("E-mail",text:$email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    SecureField("Hasło",text:$password)

                    if session.isAuthenticated {
                        Text("Zalogowano: \(session.email)")
                            .foregroundStyle(.secondary)
                        Button("Wyloguj",role:.destructive) {
                            session.logout()
                            healthConnected=false
                            status="Wylogowano."
                        }
                    } else {
                        Button("Zaloguj się"){ Task{await login()} }
                    }
                }

                Section("Apple Watch i Apple Health") {
                    Text("Apple Watch zapisuje pomiary w Apple Health. HealthGo może po Twojej zgodzie odczytać kroki, dystans, sen i ostatni zapis tętna.")
                    Button(healthConnected ? "Apple Health połączone ✓" : "Połącz Apple Health") {
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
                email=session.email
                if session.isAuthenticated {
                    status="Konto HealthGo jest zalogowane. Połącz Apple Health."
                }
            }
        }
    }

    private func login() async {
        do {
            try await session.login(email:email,password:password)
            self.email=session.email
            status="Zalogowano. Teraz połącz Apple Health."
        } catch {
            status="Nie udało się zalogować: "+error.localizedDescription
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
            status="Apple Health połączone. HealthGo może odczytać dozwolone dane."
            await syncNow()
        } catch {
            healthConnected=false
            status=error.localizedDescription
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
                status="Zsynchronizowano z HealthGo. Ostatnie tętno: \(Int(heart.rounded())) bpm."
            } else {
                status="Zsynchronizowano z HealthGo. Apple Health nie udostępniło teraz pomiaru tętna."
            }
        } catch {
            status="Synchronizacja nieudana: "+error.localizedDescription
        }
    }
}
