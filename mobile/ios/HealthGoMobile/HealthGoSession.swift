import Foundation
import Combine
import AuthenticationServices
import CryptoKit
import Security
import UIKit

private struct StoredHealthGoSession: Codable {
    let accessToken: String
    let refreshToken: String
    let userId: String
    let email: String
    let expiresAt: Int
}

private enum HealthGoSecureStore {
    static let service = "com.healthgo.HealthGoMobile.supabase"
    static let account = "session"

    static func load() -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var value: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &value) == errSecSuccess else { return nil }
        return value as? Data
    }

    static func save(_ data: Data) throws {
        clear()
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else {
            throw NSError(domain:"HealthGo",code:20,userInfo:[NSLocalizedDescriptionKey:"Nie udało się bezpiecznie zapisać sesji HealthGo."])
        }
    }

    static func clear() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}

private final class HealthGoOAuthAnchor: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first(where: { $0.isKeyWindow }) ?? UIWindow()
    }
}

private extension Data {
    var base64URL: String {
        base64EncodedString()
            .replacingOccurrences(of:"+",with:"-")
            .replacingOccurrences(of:"/",with:"_")
            .replacingOccurrences(of:"=",with:"")
    }
}

@MainActor
final class HealthGoSession: ObservableObject {
    @Published var email = ""
    @Published var accessToken: String?
    @Published var userId: String?
    @Published var busy = false

    private var refreshToken: String?
    private var expiresAt: Int = 0
    private var webAuthSession: ASWebAuthenticationSession?
    private let anchor = HealthGoOAuthAnchor()

    private let baseURL = URL(string:"https://oqrfapmdcofguwdvhbeo.supabase.co")!
    private let apiKey = "sb_publishable_AuERvskDwwmm13In-B45zA_yKP6IElB"
    private let oauthRedirect = "https://minek1522icloud-beep.github.io/HealthGo/mobile-oauth-callback.html"

    var isAuthenticated: Bool { accessToken != nil && userId != nil }

    init() {
        guard let data=HealthGoSecureStore.load(),
              let stored=try? JSONDecoder().decode(StoredHealthGoSession.self,from:data) else { return }
        accessToken=stored.accessToken
        refreshToken=stored.refreshToken
        userId=stored.userId
        email=stored.email
        expiresAt=stored.expiresAt
    }

    func restore() async {
        guard isAuthenticated else { return }
        do {
            if expiresAt <= Int(Date().timeIntervalSince1970)+60 {
                try await refresh()
            } else {
                try await verifyUser()
            }
        } catch {
            logout()
        }
    }

    func login(email: String, password: String) async throws {
        let clean=email.trimmingCharacters(in:.whitespacesAndNewlines)
        guard !clean.isEmpty,!password.isEmpty else {
            throw NSError(domain:"HealthGo",code:10,userInfo:[NSLocalizedDescriptionKey:"Wpisz e-mail i hasło."])
        }
        busy=true
        defer{busy=false}
        let data=try await authRequest(path:"/auth/v1/token?grant_type=password",body:["email":clean,"password":password])
        try storeAuthResponse(data,fallbackEmail:clean)
    }

    func loginGoogle() async throws {
        busy=true
        defer{busy=false}

        let verifier=Self.randomVerifier()
        let challenge=Data(SHA256.hash(data:Data(verifier.utf8))).base64URL

        var components=URLComponents(string:baseURL.absoluteString+"/auth/v1/authorize")!
        components.queryItems=[
            URLQueryItem(name:"provider",value:"google"),
            URLQueryItem(name:"redirect_to",value:oauthRedirect),
            URLQueryItem(name:"code_challenge",value:challenge),
            URLQueryItem(name:"code_challenge_method",value:"s256"),
            URLQueryItem(name:"prompt",value:"select_account")
        ]
        guard let url=components.url else {
            throw NSError(domain:"HealthGo",code:21,userInfo:[NSLocalizedDescriptionKey:"Nie udało się otworzyć Google."])
        }

        let callback:URL=try await withCheckedThrowingContinuation { (continuation:CheckedContinuation<URL,Error>) in
            let auth=ASWebAuthenticationSession(url:url,callbackURLScheme:"healthgo"){callbackURL,error in
                if let error {continuation.resume(throwing:error);return}
                guard let callbackURL else {
                    continuation.resume(throwing:NSError(domain:"HealthGo",code:22,userInfo:[NSLocalizedDescriptionKey:"Google nie zwrócił danych logowania."]))
                    return
                }
                continuation.resume(returning:callbackURL)
            }
            auth.presentationContextProvider=self.anchor
            auth.prefersEphemeralWebBrowserSession=false
            self.webAuthSession=auth
            if !auth.start() {
                self.webAuthSession=nil
                continuation.resume(throwing:NSError(domain:"HealthGo",code:23,userInfo:[NSLocalizedDescriptionKey:"Nie udało się uruchomić okna Google."]))
            }
        }

        guard callback.scheme=="healthgo",callback.host=="auth-callback" else {
            throw NSError(domain:"HealthGo",code:24,userInfo:[NSLocalizedDescriptionKey:"Nieprawidłowy powrót z Google."])
        }
        let items=URLComponents(url:callback,resolvingAgainstBaseURL:false)?.queryItems ?? []
        if let error=items.first(where:{$0.name=="error_description"})?.value ?? items.first(where:{$0.name=="error"})?.value {
            throw NSError(domain:"HealthGo",code:25,userInfo:[NSLocalizedDescriptionKey:error])
        }
        guard let code=items.first(where:{$0.name=="code"})?.value,!code.isEmpty else {
            throw NSError(domain:"HealthGo",code:26,userInfo:[NSLocalizedDescriptionKey:"Google nie zwrócił kodu logowania."])
        }

        let data=try await authRequest(
            path:"/auth/v1/token?grant_type=pkce",
            body:["auth_code":code,"code_verifier":verifier]
        )
        try storeAuthResponse(data,fallbackEmail:"")
    }

    func logout() {
        accessToken=nil
        refreshToken=nil
        userId=nil
        email=""
        expiresAt=0
        HealthGoSecureStore.clear()
    }

    func authorizedRequest(url: URL) async throws -> URLRequest {
        if expiresAt <= Int(Date().timeIntervalSince1970)+60 {
            try await refresh()
        }
        guard let token=accessToken else {
            throw NSError(domain:"HealthGo",code:12,userInfo:[NSLocalizedDescriptionKey:"Zaloguj się do HealthGo."])
        }
        var request=URLRequest(url:url)
        request.setValue(apiKey,forHTTPHeaderField:"apikey")
        request.setValue("Bearer \(token)",forHTTPHeaderField:"Authorization")
        request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        return request
    }

    private func refresh() async throws {
        guard let token=refreshToken,!token.isEmpty else {
            throw NSError(domain:"HealthGo",code:27,userInfo:[NSLocalizedDescriptionKey:"Sesja HealthGo wygasła. Zaloguj się ponownie."])
        }
        let data=try await authRequest(path:"/auth/v1/token?grant_type=refresh_token",body:["refresh_token":token])
        try storeAuthResponse(data,fallbackEmail:email)
    }

    private func verifyUser() async throws {
        guard let token=accessToken else { return }
        var request=URLRequest(url:baseURL.appending(path:"/auth/v1/user"))
        request.httpMethod="GET"
        request.setValue(apiKey,forHTTPHeaderField:"apikey")
        request.setValue("Bearer \(token)",forHTTPHeaderField:"Authorization")
        let (data,response)=try await URLSession.shared.data(for:request)
        try Self.requireSuccess(data:data,response:response)
    }

    private func authRequest(path:String,body:[String:Any]) async throws -> Data {
        var request=URLRequest(url:URL(string:baseURL.absoluteString+path)!)
        request.httpMethod="POST"
        request.setValue(apiKey,forHTTPHeaderField:"apikey")
        request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        request.httpBody=try JSONSerialization.data(withJSONObject:body)
        let (data,response)=try await URLSession.shared.data(for:request)
        try Self.requireSuccess(data:data,response:response)
        return data
    }

    private func storeAuthResponse(_ data:Data,fallbackEmail:String) throws {
        struct AuthResponse:Decodable {
            struct User:Decodable {let id:String;let email:String?}
            let access_token:String
            let refresh_token:String
            let expires_in:Int?
            let expires_at:Int?
            let user:User
        }
        let result=try JSONDecoder().decode(AuthResponse.self,from:data)
        accessToken=result.access_token
        refreshToken=result.refresh_token
        userId=result.user.id
        email=result.user.email ?? fallbackEmail
        expiresAt=result.expires_at ?? (Int(Date().timeIntervalSince1970)+(result.expires_in ?? 3600))
        let stored=StoredHealthGoSession(
            accessToken:result.access_token,
            refreshToken:result.refresh_token,
            userId:result.user.id,
            email:email,
            expiresAt:expiresAt
        )
        try HealthGoSecureStore.save(JSONEncoder().encode(stored))
    }

    private static func requireSuccess(data:Data,response:URLResponse) throws {
        guard let http=response as? HTTPURLResponse,(200..<300).contains(http.statusCode) else {
            var message="Operacja HealthGo nie powiodła się."
            if let obj=try? JSONSerialization.jsonObject(with:data) as? [String:Any] {
                message=(obj["msg"] as? String)
                    ?? (obj["error_description"] as? String)
                    ?? (obj["message"] as? String)
                    ?? (obj["error"] as? String)
                    ?? message
            }
            throw NSError(domain:"HealthGo",code:(response as? HTTPURLResponse)?.statusCode ?? 500,userInfo:[NSLocalizedDescriptionKey:message])
        }
    }

    private static func randomVerifier() -> String {
        var bytes=[UInt8](repeating:0,count:32)
        if SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)==errSecSuccess {
            return Data(bytes).base64URL
        }
        return UUID().uuidString.replacingOccurrences(of:"-",with:"")
    }
}
