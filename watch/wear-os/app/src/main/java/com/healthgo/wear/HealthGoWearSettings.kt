package com.healthgo.wear

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Text

private const val PREFS = "healthgo_watch_settings"
private const val KEY_AI_STYLE = "ai_response_style"
private const val KEY_LARGE_TEXT = "large_text"
private const val KEY_PRIVACY_PREVIEW = "privacy_preview"

data class WearSettingsState(
    val aiStyle: String = "compact",
    val largeText: Boolean = false,
    val privacyPreview: Boolean = true
)

fun loadWearSettings(context: Context): WearSettingsState {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return WearSettingsState(
        aiStyle = prefs.getString(KEY_AI_STYLE, "compact") ?: "compact",
        largeText = prefs.getBoolean(KEY_LARGE_TEXT, false),
        privacyPreview = prefs.getBoolean(KEY_PRIVACY_PREVIEW, true)
    )
}

private fun saveWearSettings(context: Context, state: WearSettingsState) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_AI_STYLE, state.aiStyle)
        .putBoolean(KEY_LARGE_TEXT, state.largeText)
        .putBoolean(KEY_PRIVACY_PREVIEW, state.privacyPreview)
        .apply()
}

@Composable
fun HealthGoWearSettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var state by remember { mutableStateOf(loadWearSettings(context)) }

    fun update(next: WearSettingsState) {
        state = next
        saveWearSettings(context, next)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text("Ustawienia")

        Text("AI")
        Text("Długość odpowiedzi: ${when (state.aiStyle) {
            "compact" -> "Krótka"
            "standard" -> "Standardowa"
            else -> "Dokładna"
        }}")

        Button(onClick = {
            val next = when (state.aiStyle) {
                "compact" -> "standard"
                "standard" -> "detailed"
                else -> "compact"
            }
            update(state.copy(aiStyle = next))
        }) {
            Text("Zmień długość AI")
        }

        Text("Wygląd")
        Button(onClick = { update(state.copy(largeText = !state.largeText)) }) {
            Text(if (state.largeText) "Większy tekst: WŁ." else "Większy tekst: WYŁ.")
        }

        Text("Prywatność")
        Button(onClick = { update(state.copy(privacyPreview = !state.privacyPreview)) }) {
            Text(if (state.privacyPreview) "Podgląd prywatny: WŁ." else "Podgląd prywatny: WYŁ.")
        }

        Text("Połączenie")
        Text("Firebase AI Logic")
        Text("Wersja: Wear Alpha")

        Button(onClick = {
            val defaults = WearSettingsState()
            update(defaults)
        }) {
            Text("Przywróć ustawienia")
        }

        Button(onClick = onBack) {
            Text("Wróć")
        }
    }
}
