package com.healthgo.wear

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class WearSensorController(private val context: Context) : SensorEventListener {
    private val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private var baselineSteps: Float? = null

    var heartRateBpm by mutableStateOf<Float?>(null)
        private set

    var stepsSinceOpen by mutableStateOf<Int?>(null)
        private set

    var heartRateAvailable by mutableStateOf(false)
        private set

    var stepSensorAvailable by mutableStateOf(false)
        private set

    fun start() {
        val heart = manager.getDefaultSensor(Sensor.TYPE_HEART_RATE)
        val steps = manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

        heartRateAvailable = heart != null
        stepSensorAvailable = steps != null

        if (
            heart != null &&
            context.checkSelfPermission(Manifest.permission.BODY_SENSORS) == PackageManager.PERMISSION_GRANTED
        ) {
            manager.registerListener(this, heart, SensorManager.SENSOR_DELAY_NORMAL)
        }

        if (
            steps != null &&
            context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
        ) {
            manager.registerListener(this, steps, SensorManager.SENSOR_DELAY_NORMAL)
        }
    }

    fun stop() {
        manager.unregisterListener(this)
    }

    fun resetSessionSteps() {
        baselineSteps = null
        stepsSinceOpen = null
    }

    override fun onSensorChanged(event: SensorEvent?) {
        val e = event ?: return
        when (e.sensor.type) {
            Sensor.TYPE_HEART_RATE -> {
                val value = e.values.firstOrNull()
                if (value != null && value > 0f) heartRateBpm = value
            }
            Sensor.TYPE_STEP_COUNTER -> {
                val total = e.values.firstOrNull() ?: return
                val base = baselineSteps ?: total.also { baselineSteps = it }
                stepsSinceOpen = (total - base).toInt().coerceAtLeast(0)
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
