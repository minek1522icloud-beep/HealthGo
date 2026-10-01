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
private const val KEY_DAILY_NOTIFICATIONS = "daily_notifications"
private const val KEY_ACTIVITY_HAPTICS = "activity_haptics"

data class WearSettingsState(
    val aiStyle: String = "compact",
    val largeText: Boolean = false,
    val privacyPreview: Boolean = true,
    val dailyNotifications: Boolean = true,
    val activityHaptics: Boolean = true
)

fun loadWearSettings(context: Context): WearSettingsState {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return WearSettingsState(
        aiStyle = prefs.getString(KEY_AI_STYLE, "compact") ?: "compact",
        largeText = prefs.getBoolean(KEY_LARGE_TEXT, false),
        privacyPreview = prefs.getBoolean(KEY_PRIVACY_PREVIEW, true),
        dailyNotifications = prefs.getBoolean(KEY_DAILY_NOTIFICATIONS, true),
        activityHaptics = prefs.getBoolean(KEY_ACTIVITY_HAPTICS, true)
    )
}

private fun saveWearSettings(context: Context, state: WearSettingsState) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_AI_STYLE, state.aiStyle)
        .putBoolean(KEY_LARGE_TEXT, state.largeText)
        .putBoolean(KEY_PRIVACY_PREVIEW, state.privacyPreview)
        .putBoolean(KEY_DAILY_NOTIFICATIONS, state.dailyNotifications)
        .putBoolean(KEY_ACTIVITY_HAPTICS, state.activityHaptics)
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
        Text(
            "Długość: " + when (state.aiStyle) {
                "compact" -> "Krótka"
                "standard" -> "Standardowa"
                else -> "Dokładna"
            }
        )
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

        Text("Zadania")
        Button(onClick = { update(state.copy(dailyNotifications = !state.dailyNotifications)) }) {
            Text(if (state.dailyNotifications) "Przypomnienia: WŁ." else "Przypomnienia: WYŁ.")
        }

        Text("Aktywność")
        Button(onClick = { update(state.copy(activityHaptics = !state.activityHaptics)) }) {
            Text(if (state.activityHaptics) "Haptyka: WŁ." else "Haptyka: WYŁ.")
        }

        Text("Prywatność")
        Button(onClick = { update(state.copy(privacyPreview = !state.privacyPreview)) }) {
            Text(if (state.privacyPreview) "Ukrywanie podglądu: WŁ." else "Ukrywanie podglądu: WYŁ.")
        }

        Text("Połączenia")
        Text("AI: Firebase AI Logic")
        Text("Czujniki: Android Sensor API")
        Text("Konto: niesparowane")
        Text("Wersja: Wear Professional 0.2")

        Button(onClick = {
            update(WearSettingsState())
        }) {
            Text("Przywróć ustawienia")
        }

        Button(onClick = onBack) {
            Text("Wróć")
        }
    }
}
