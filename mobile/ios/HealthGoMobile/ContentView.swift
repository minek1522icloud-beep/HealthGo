import SwiftUI
import FirebaseAuth

struct ContentView: View {
    @State private var email=""
    @State private var password=""
    @State private var status="Zaloguj się tym samym kontem co w HealthGo."
    @State private var syncing=false
    private let sync=HealthSync()
    var body: some View {
        NavigationStack {
            Form {
                Section("Konto HealthGo") {
                    TextField("E-mail",text:$email).textInputAutocapitalization(.never).keyboardType(.emailAddress)
                    SecureField("Hasło",text:$password)
                    Button("Zaloguj się"){ Task{await login()} }
                }
                Section("Urządzenie") {
                    Text("Apple Watch / zgodne urządzenie → Apple Health → HealthGo")
                    Button("Połącz dane zdrowotne"){Task{await authorize()}}
                    Button(syncing ? "Synchronizuję…" : "Synchronizuj teraz"){Task{await syncNow()}}.disabled(syncing)
                }
                Section { Text(status).foregroundStyle(.secondary) }
            }.navigationTitle("HealthGo")
            .task {
                if let user=Auth.auth().currentUser { email=user.email ?? ""; status="Zalogowano: "+(user.email ?? "konto HealthGo"); await authorize() }
            }
        }
    }
    private func login() async {
        guard !email.isEmpty,!password.isEmpty else {status="Wpisz e-mail i hasło.";return}
        do { _=try await Auth.auth().signIn(withEmail:email,password:password);status="Zalogowano. Nadaj dostęp do danych.";await authorize() }
        catch { status="Nie udało się zalogować: "+error.localizedDescription }
    }
    private func authorize() async {
        guard Auth.auth().currentUser != nil else {status="Najpierw zaloguj się do HealthGo.";return}
        do { try await sync.authorize();status="Dane zdrowotne są połączone.";await syncNow() }
        catch { status=error.localizedDescription }
    }
    private func syncNow() async {
        guard !syncing else{return};syncing=true;defer{syncing=false}
        do { let s=try await sync.readToday();try await sync.upload(s);status="Zsynchronizowano z HealthGo." }
        catch { status="Synchronizacja nieudana: "+error.localizedDescription }
    }
}
