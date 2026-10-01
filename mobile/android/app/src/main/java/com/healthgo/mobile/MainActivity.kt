package com.healthgo.mobile

import android.os.Bundle
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity: ComponentActivity() {
    private lateinit var sync: HealthSync
    private lateinit var status: TextView
    private val healthPermissions = registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { granted ->
        status.text = if(granted.containsAll(sync.permissions)) "Dostęp przyznany. Możesz synchronizować." else "HealthGo potrzebuje wybranych zgód, aby odczytać dane."
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState); sync=HealthSync(this)
        val box=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(48,64,48,48) }
        box.addView(TextView(this).apply { text="HealthGo · Urządzenia"; textSize=28f })
        box.addView(TextView(this).apply { text="Zegarek → telefon → Health Connect → HealthGo"; textSize=16f })
        status=TextView(this).apply { text="Najpierw nadaj dostęp do danych zdrowotnych."; setPadding(0,32,0,24) }; box.addView(status)
        box.addView(Button(this).apply { text="Połącz dane zdrowotne"; setOnClickListener { healthPermissions.launch(sync.permissions) } })
        box.addView(Button(this).apply { text="Synchronizuj teraz"; setOnClickListener { lifecycleScope.launch { runCatching { val s=sync.readToday(); sync.upload(s); s }.onSuccess { status.text="Zsynchronizowano prawdziwe dane z Health Connect." }.onFailure { status.text="Nie udało się: "+(it.message?:"błąd") } } } })
        setContentView(box)
    }
}
