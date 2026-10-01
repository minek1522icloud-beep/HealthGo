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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private const val PROGRESS_PREFS = "healthgo_watch_progress"
private const val KEY_DATE = "daily_date"
private const val KEY_MASK = "daily_mask"
private const val KEY_XP = "local_xp"

private data class WearDailyTask(val icon: String, val title: String, val text: String, val xp: Int)

private val wearDailyTasks = listOf(
    WearDailyTask("📅", "Uporządkuj plan", "Dodaj albo popraw jeden punkt planu.", 35),
    WearDailyTask("🌿", "Krótka przerwa", "Zrób spokojną przerwę od ekranu.", 20),
    WearDailyTask("🚶", "Trochę ruchu", "Wybierz lekką aktywność odpowiednią dla Ciebie.", 25)
)

fun loadWearLocalXp(context: Context): Int =
    context.getSharedPreferences(PROGRESS_PREFS, Context.MODE_PRIVATE).getInt(KEY_XP, 0)

@Composable
fun HealthGoWearDailyScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(PROGRESS_PREFS, Context.MODE_PRIVATE) }
    val today = remember { SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date()) }

    var savedDate by remember { mutableStateOf(prefs.getString(KEY_DATE, "") ?: "") }
    var mask by remember { mutableIntStateOf(prefs.getInt(KEY_MASK, 0)) }
    var xp by remember { mutableIntStateOf(prefs.getInt(KEY_XP, 0)) }

    fun resetIfNeeded() {
        if (savedDate == today) return
        savedDate = today
        mask = 0
        prefs.edit().putString(KEY_DATE, today).putInt(KEY_MASK, 0).apply()
    }

    fun done(index: Int): Boolean = (mask and (1 shl index)) != 0

    resetIfNeeded()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text("Zadania Dnia")
        Text("XP zegarka: $xp")
        Text("Postęp jest lokalny na tym zegarku do czasu bezpiecznego sparowania konta HealthGo.")

        wearDailyTasks.forEachIndexed { index, task ->
            Text("${task.icon} ${task.title}")
            Text(task.text)
            Button(
                enabled = !done(index),
                onClick = {
                    if (done(index)) return@Button
                    mask = mask or (1 shl index)
                    xp += task.xp
                    prefs.edit().putInt(KEY_MASK, mask).putInt(KEY_XP, xp).apply()
                }
            ) {
                Text(if (done(index)) "✓ Zrobione" else "+${task.xp} XP")
            }
        }

        Button(onClick = onBack) {
            Text("Wróć")
        }
    }
}
