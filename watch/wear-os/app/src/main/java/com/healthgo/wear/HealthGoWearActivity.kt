package com.healthgo.wear

import android.Manifest
import android.os.SystemClock
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import kotlinx.coroutines.delay
import java.util.Locale

@Composable
fun HealthGoWearActivityScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val sensors = remember { WearSensorController(context) }
    var running by remember { mutableStateOf(false) }
    var startedAt by remember { mutableLongStateOf(0L) }
    var elapsedSeconds by remember { mutableLongStateOf(0L) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        sensors.stop()
        sensors.start()
    }

    DisposableEffect(Unit) {
        sensors.start()
        onDispose { sensors.stop() }
    }

    LaunchedEffect(running) {
        while (running) {
            elapsedSeconds = ((SystemClock.elapsedRealtime() - startedAt) / 1000L).coerceAtLeast(0L)
            delay(1000)
        }
    }

    val min = elapsedSeconds / 60
    val sec = elapsedSeconds % 60

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text("Aktywność")

        Text(
            sensors.heartRateBpm?.let { String.format(Locale.US, "Tętno: %.0f bpm", it) }
                ?: if (sensors.heartRateAvailable) "Tętno: brak odczytu" else "Tętno: brak czujnika"
        )

        Text(
            sensors.stepsSinceOpen?.let { "Kroki od otwarcia: $it" }
                ?: if (sensors.stepSensorAvailable) "Kroki od otwarcia: brak odczytu" else "Kroki: brak czujnika"
        )

        Button(onClick = {
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.BODY_SENSORS,
                    Manifest.permission.ACTIVITY_RECOGNITION
                )
            )
        }) {
            Text("Zezwól na czujniki")
        }

        Text(String.format(Locale.US, "Czas sesji: %02d:%02d", min, sec))

        Button(onClick = {
            if (running) {
                running = false
            } else {
                sensors.resetSessionSteps()
                elapsedSeconds = 0L
                startedAt = SystemClock.elapsedRealtime()
                running = true
            }
        }) {
            Text(if (running) "Zakończ sesję" else "Rozpocznij sesję")
        }

        Text("HealthGo pokazuje wyłącznie dane odczytane z czujników po nadaniu zgody. Kroków nie opisuje jako całodzienne, jeśli zegarek przekazuje tylko licznik sesji.")

        Button(onClick = onBack) {
            Text("Wróć")
        }
    }
}
