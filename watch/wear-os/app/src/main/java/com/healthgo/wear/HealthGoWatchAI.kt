package com.healthgo.wear

import com.google.firebase.Firebase
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class HealthGoWatchAI {
    private val model = Firebase
        .ai(backend = GenerativeBackend.googleAI())
        .generativeModel("gemini-3.8-flash")

    suspend fun ask(message: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val prompt = """
                Jesteś HealthGo AI. Odpowiadaj po polsku, krótko i konkretnie, tak aby odpowiedź dobrze mieściła się na ekranie zegarka.
                Nie wymyślaj danych zdrowotnych użytkownika.
                Pytanie użytkownika: ${message.trim()}
            """.trimIndent()

            model.generateContent(prompt).text ?: "Brak odpowiedzi."
        }
    }
}
