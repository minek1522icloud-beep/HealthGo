package com.healthgo.wear

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
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.launch

private enum class WatchPage {
    HOME, DAILY, ACTIVITY, SETTINGS
}

@Composable
fun HealthGoWatchScreen() {
    val context = LocalContext.current
    var page by remember { mutableStateOf(WatchPage.HOME) }

    when (page) {
        WatchPage.DAILY -> {
            HealthGoWearDailyScreen(onBack = { page = WatchPage.HOME })
            return
        }
        WatchPage.ACTIVITY -> {
            HealthGoWearActivityScreen(onBack = { page = WatchPage.HOME })
            return
        }
        WatchPage.SETTINGS -> {
            HealthGoWearSettingsScreen(onBack = { page = WatchPage.HOME })
            return
        }
        WatchPage.HOME -> Unit
    }

    var answer by remember { mutableStateOf("HealthGo Watch Professional") }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val ai = remember { HealthGoWatchAI() }
    val settings = loadWearSettings(context)
    val answerSize = if (settings.largeText) 17.sp else 14.sp
    val localXp = loadWearLocalXp(context)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text("HealthGo")
        Text("XP zegarka: $localXp")

        Button(onClick = { page = WatchPage.DAILY }) {
            Text("Zadania Dnia")
        }

        Button(onClick = { page = WatchPage.ACTIVITY }) {
            Text("Aktywność")
        }

        Button(
            onClick = {
                loading = true
                scope.launch {
                    val currentSettings = loadWearSettings(context)
                    val result = ai.ask(
                        "Powiedz krótko, co możesz zrobić w HealthGo.",
                        currentSettings.aiStyle
                    )
                    answer = result.getOrElse { "AI niedostępne: ${it.message}" }
                    loading = false
                }
            }
        ) {
            Text(if (loading) "Łączę..." else "HealthGo AI")
        }

        Text(answer, fontSize = answerSize)

        Button(onClick = { page = WatchPage.SETTINGS }) {
            Text("Ustawienia")
        }

        Text("Dane z czujników są pokazywane tylko po zgodzie. Brak odczytu oznacza brak danych, a nie zero.")
    }
}
