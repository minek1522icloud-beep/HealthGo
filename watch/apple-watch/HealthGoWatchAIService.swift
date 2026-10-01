import Foundation
import FirebaseAILogic

@MainActor
final class HealthGoWatchAIService: ObservableObject {
    @Published var answer: String = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    private lazy var model = FirebaseAI
        .firebaseAI(backend: .googleAI())
        .generativeModel(modelName: "gemini-3.8-flash")

    func ask(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        isLoading = true
        errorMessage = nil

        let style = UserDefaults.standard.string(forKey: "watch_ai_response_style") ?? "compact"
        let styleInstruction: String
        switch style {
        case "detailed":
            styleInstruction = "Odpowiadaj dokładnie, ale nadal czytelnie na małym ekranie."
        case "standard":
            styleInstruction = "Odpowiadaj zwięźle, ale z potrzebnym wyjaśnieniem."
        default:
            styleInstruction = "Odpowiadaj bardzo krótko i konkretnie."
        }

        let prompt = """
        Jesteś HealthGo AI. Odpowiadaj po polsku.
        \(styleInstruction)
        Nie wymyślaj danych zdrowotnych użytkownika. W ważnych sprawach zdrowotnych zaznacz, że AI może się mylić.
        Pytanie użytkownika: \(trimmed)
        """

        do {
            let response = try await model.generateContent(prompt)
            answer = response.text ?? "Brak odpowiedzi."
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}
