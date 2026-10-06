import Foundation

@MainActor
final class HealthGoSession: ObservableObject {
    @Published var email = ""
    @Published var accessToken: String?
    @Published var userId: String?

    private let baseURL = URL(string: "https://oqrfapmdcofguwdvhbeo.supabase.co")!
    private let apiKey = "sb_publishable_AuERvskDwwmm13In-B45zA_yKP6IElB"

    var isAuthenticated: Bool { accessToken != nil && userId != nil }

    init() {
        accessToken = UserDefaults.standard.string(forKey: "healthgo.supabase.accessToken")
        userId = UserDefaults.standard.string(forKey: "healthgo.supabase.userId")
        email = UserDefaults.standard.string(forKey: "healthgo.supabase.email") ?? ""
    }

    func login(email: String, password: String) async throws {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanEmail.isEmpty, !password.isEmpty else {
            throw NSError(domain: "HealthGo", code: 10, userInfo: [NSLocalizedDescriptionKey: "Wpisz e-mail i hasło."])
        }

        var request = URLRequest(url: baseURL.appending(path: "/auth/v1/token").appending(queryItems: [
            URLQueryItem(name: "grant_type", value: "password")
        ]))
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "email": cleanEmail,
            "password": password
        ])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw NSError(domain: "HealthGo", code: 11, userInfo: [NSLocalizedDescriptionKey: "Brak odpowiedzi serwera logowania."])
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["msg"] as? String
                ?? "Nie udało się zalogować."
            throw NSError(domain: "HealthGo", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: message])
        }

        struct AuthResponse: Decodable {
            struct User: Decodable { let id: String; let email: String? }
            let access_token: String
            let user: User
        }

        let result = try JSONDecoder().decode(AuthResponse.self, from: data)
        self.accessToken = result.access_token
        self.userId = result.user.id
        self.email = result.user.email ?? cleanEmail

        UserDefaults.standard.set(result.access_token, forKey: "healthgo.supabase.accessToken")
        UserDefaults.standard.set(result.user.id, forKey: "healthgo.supabase.userId")
        UserDefaults.standard.set(self.email, forKey: "healthgo.supabase.email")
    }

    func logout() {
        accessToken = nil
        userId = nil
        UserDefaults.standard.removeObject(forKey: "healthgo.supabase.accessToken")
        UserDefaults.standard.removeObject(forKey: "healthgo.supabase.userId")
        UserDefaults.standard.removeObject(forKey: "healthgo.supabase.email")
    }

    func authorizedRequest(url: URL) throws -> URLRequest {
        guard let token = accessToken else {
            throw NSError(domain: "HealthGo", code: 12, userInfo: [NSLocalizedDescriptionKey: "Zaloguj się do HealthGo."])
        }
        var request = URLRequest(url: url)
        request.setValue(apiKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return request
    }
}
