package com.healthgo.mobile

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import org.json.JSONObject
import java.time.*

data class HealthSnapshot(
    val steps:Long?,
    val distanceKm:Double?,
    val activeMinutes:Long?,
    val sleepMinutes:Long?,
    val heartRate:Double?
)

class HealthSync(context:Context) {
    val client=HealthConnectClient.getOrCreate(context)
    val permissions=setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class)
    )

    suspend fun readToday():HealthSnapshot{
        val zone=ZoneId.systemDefault()
        val start=LocalDate.now(zone).atStartOfDay(zone).toInstant()
        val end=Instant.now()
        val aggregate=client.aggregate(
            AggregateRequest(
                metrics=setOf(StepsRecord.COUNT_TOTAL,DistanceRecord.DISTANCE_TOTAL),
                timeRangeFilter=TimeRangeFilter.between(start,end)
            )
        )
        val hr=client.readRecords(
            ReadRecordsRequest(
                HeartRateRecord::class,
                timeRangeFilter=TimeRangeFilter.between(start,end)
            )
        ).records.flatMap{it.samples}.maxByOrNull{it.time}?.beatsPerMinute?.toDouble()

        val sleepStart=LocalDate.now(zone).minusDays(1).atTime(12,0).atZone(zone).toInstant()
        val sleeps=client.readRecords(
            ReadRecordsRequest(
                SleepSessionRecord::class,
                timeRangeFilter=TimeRangeFilter.between(sleepStart,end)
            )
        ).records
        val sleepMinutes=sleeps.sumOf{
            Duration.between(it.startTime,it.endTime).toMinutes().coerceAtLeast(0)
        }
        return HealthSnapshot(
            aggregate[StepsRecord.COUNT_TOTAL],
            aggregate[DistanceRecord.DISTANCE_TOTAL]?.inKilometers,
            null,
            sleepMinutes.takeIf{it>0},
            hr
        )
    }

    suspend fun upload(snapshot:HealthSnapshot,session:HealthGoSession){
        val uid=session.userId?:error("Zaloguj się do HealthGo.")
        val today=LocalDate.now().toString()
        val body=JSONObject()
            .put("user_id",uid)
            .put("activity_date",today)
            .put("source","Android · Health Connect")
            .put("updated_at",Instant.now().toString())

        snapshot.steps?.let{body.put("steps",it)}
        snapshot.distanceKm?.let{body.put("distance_meters",it*1000.0)}
        snapshot.activeMinutes?.let{body.put("active_minutes",it)}
        snapshot.sleepMinutes?.let{body.put("sleep_minutes",it)}
        snapshot.heartRate?.let{body.put("heart_rate",it)}

        session.request(
            "/rest/v1/activity_daily?on_conflict=user_id,activity_date",
            "POST",
            body,
            "resolution=merge-duplicates,return=minimal"
        )
        session.registerDevice(
            externalId="health-connect-$uid",
            name="Health Connect",
            deviceType="health-platform",
            connectionType="health_connect",
            connected=true
        )
    }
}
