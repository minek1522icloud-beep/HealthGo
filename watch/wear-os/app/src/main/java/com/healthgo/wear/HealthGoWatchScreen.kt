package com.healthgo.wear

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.launch

@Composable
fun HealthGoWatchScreen() {
    var answer by remember { mutableStateOf("HealthGo Watch Alpha") }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val ai = remember { HealthGoWatchAI() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text("HealthGo")

        Button(
            onClick = {
                loading = true
                scope.launch {
                    val result = ai.ask("Powiedz krótko, co możesz zrobić w HealthGo.")
                    answer = result.getOrElse { "AI niedostępne: ${it.message}" }
                    loading = false
                }
            }
        ) {
            Text(if (loading) "Łączę..." else "Test AI")
        }

        Text(answer)
        Text("Plan Dnia i Aktywność zostaną podłączone w kolejnym etapie.")
    }
}
