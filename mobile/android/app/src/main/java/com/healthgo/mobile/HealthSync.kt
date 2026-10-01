package com.healthgo.mobile

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateRequest
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.time.*

data class HealthSnapshot(val steps: Long?, val distanceKm: Double?, val activeMinutes: Long?, val sleepMinutes: Long?, val heartRate: Double?)

class HealthSync(private val context: Context) {
    val client = HealthConnectClient.getOrCreate(context)
    val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class)
    )

    suspend fun readToday(): HealthSnapshot {
        val zone = ZoneId.systemDefault()
        val start = LocalDate.now(zone).atStartOfDay(zone).toInstant()
        val end = Instant.now()
        val aggregate = client.aggregate(AggregateRequest(
            metrics=setOf(StepsRecord.COUNT_TOTAL, DistanceRecord.DISTANCE_TOTAL),
            timeRangeFilter=TimeRangeFilter.between(start,end)
        ))
        val hr = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, timeRangeFilter=TimeRangeFilter.between(start,end)))
            .records.flatMap { it.samples }.maxByOrNull { it.time }?.beatsPerMinute
        val sleepStart = LocalDate.now(zone).minusDays(1).atTime(12,0).atZone(zone).toInstant()
        val sleeps = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class,timeRangeFilter=TimeRangeFilter.between(sleepStart,end))).records
        val sleepMinutes = sleeps.sumOf { Duration.between(it.startTime,it.endTime).toMinutes().coerceAtLeast(0) }
        return HealthSnapshot(aggregate[StepsRecord.COUNT_TOTAL], aggregate[DistanceRecord.DISTANCE_TOTAL]?.inKilometers, null, sleepMinutes.takeIf{it>0}, hr)
    }

    suspend fun upload(snapshot: HealthSnapshot) {
        val uid=FirebaseAuth.getInstance().currentUser?.uid ?: error("Zaloguj się do HealthGo")
        val data=hashMapOf<String,Any?>(
            "steps" to snapshot.steps, "distanceKm" to snapshot.distanceKm,
            "activeMinutes" to snapshot.activeMinutes, "sleepMinutes" to snapshot.sleepMinutes,
            "heartRate" to snapshot.heartRate, "source" to "Android · Health Connect",
            "updatedAt" to com.google.firebase.Timestamp.now()
        )
        FirebaseFirestore.getInstance().collection("users").document(uid).collection("health").document("latest").set(data).await()
    }
}
