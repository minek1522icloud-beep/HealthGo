package com.healthgo.mobile

import android.Manifest
import android.app.AlertDialog
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class MainActivity:ComponentActivity(){
    private lateinit var sync:HealthSync
    private lateinit var session:HealthGoSession
    private lateinit var bluetooth:BluetoothWatchManager
    private lateinit var status:TextView
    private lateinit var email:EditText
    private lateinit var password:EditText
    private var autoSyncJob:Job?=null
    private var pendingBluetoothScan=false

    private val healthPermissions=registerForActivityResult(PermissionController.createRequestPermissionResultContract()){granted->
        val ok=granted.containsAll(sync.permissions)
        status.text=if(ok)"Dostęp przyznany. Synchronizacja HealthGo jest gotowa." else "Nie wszystkie uprawnienia zdrowotne zostały przyznane."
        if(ok)startAutoSync()
    }

    private val bluetoothPermissions=registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()){result->
        val ok=requiredBluetoothPermissions().all{permission->
            result[permission]==true||ContextCompat.checkSelfPermission(this,permission)==PackageManager.PERMISSION_GRANTED
        }
        if(ok&&pendingBluetoothScan){
            pendingBluetoothScan=false
            doScanForWatch()
        }else{
            pendingBluetoothScan=false
            status.text="Bez zgody na Bluetooth HealthGo nie może wyszukać zegarka."
        }
    }

    override fun onCreate(savedInstanceState:Bundle?){
        super.onCreate(savedInstanceState)
        session=HealthGoSession(this)
        sync=HealthSync(this)
        bluetooth=BluetoothWatchManager(this)

        val box=LinearLayout(this).apply{
            orientation=LinearLayout.VERTICAL
            setPadding(48,64,48,48)
        }
        box.addView(TextView(this).apply{text="HealthGo";textSize=30f})
        box.addView(TextView(this).apply{text="Zegarek → telefon → HealthGo";textSize=15f})

        email=EditText(this).apply{
            hint="E-mail HealthGo"
            inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        }
        password=EditText(this).apply{
            hint="Hasło"
            inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        box.addView(email)
        box.addView(password)
        box.addView(Button(this).apply{text="Zaloguj się";setOnClickListener{login()}})

        status=TextView(this).apply{setPadding(0,28,0,20)}
        box.addView(status)

        box.addView(Button(this).apply{text="Połącz zegarek Bluetooth";setOnClickListener{scanForWatch()}})
        box.addView(Button(this).apply{text="Połącz dane zdrowotne";setOnClickListener{requestHealth()}})
        box.addView(Button(this).apply{text="Synchronizuj teraz";setOnClickListener{syncNow()}})
        box.addView(Button(this).apply{
            text="Rozłącz zegarek"
            setOnClickListener{
                bluetooth.disconnect()
                status.text="Zegarek Bluetooth rozłączony."
            }
        })

        setContentView(box)

        if(session.isAuthenticated){
            email.setText(session.email)
            status.text="Zalogowano: ${session.email.ifBlank{"konto HealthGo"}}"
        }else status.text="Zaloguj się tym samym kontem co w HealthGo."
    }

    private fun login(){
        val e=email.text.toString().trim()
        val p=password.text.toString()
        if(e.isBlank()||p.isBlank()){
            status.text="Wpisz e-mail i hasło."
            return
        }
        status.text="Logowanie…"
        lifecycleScope.launch{
            runCatching{session.login(e,p)}
                .onSuccess{
                    password.setText("")
                    email.setText(session.email)
                    status.text="Zalogowano. Możesz połączyć zegarek lub dane zdrowotne."
                }
                .onFailure{status.text="Nie udało się zalogować: ${it.localizedMessage?:"błąd"}"}
        }
    }

    private fun requestHealth(){
        if(!session.isAuthenticated){
            status.text="Najpierw zaloguj się do konta HealthGo."
            return
        }
        val provider=HealthConnectClient.getSdkStatus(this)
        if(provider!=HealthConnectClient.SDK_AVAILABLE){
            status.text=if(provider==HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
                "Health Connect wymaga instalacji lub aktualizacji w telefonie."
            else "Health Connect nie jest dostępny na tym telefonie."
            return
        }
        lifecycleScope.launch{
            val granted=sync.client.permissionController.getGrantedPermissions()
            if(granted.containsAll(sync.permissions)){
                status.text="Dane zdrowotne są połączone."
                startAutoSync()
            }else healthPermissions.launch(sync.permissions)
        }
    }

    private fun syncNow(){
        if(!session.isAuthenticated){
            status.text="Najpierw zaloguj się do HealthGo."
            return
        }
        lifecycleScope.launch{
            runCatching{
                val snapshot=sync.readToday()
                sync.upload(snapshot,session)
            }.onSuccess{
                status.text="Zsynchronizowano dane zdrowotne z HealthGo."
            }.onFailure{
                status.text="Synchronizacja nieudana: ${it.localizedMessage?:"błąd"}"
            }
        }
    }

    private fun startAutoSync(){
        autoSyncJob?.cancel()
        autoSyncJob=lifecycleScope.launch{
            while(isActive){
                runCatching{
                    val snapshot=sync.readToday()
                    sync.upload(snapshot,session)
                }
                delay(15*60*1000L)
            }
        }
    }

    private fun requiredBluetoothPermissions():Array<String>{
        return if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S){
            arrayOf(Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT)
        }else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
    }

    private fun hasBluetoothPermissions():Boolean=
        requiredBluetoothPermissions().all{
            ContextCompat.checkSelfPermission(this,it)==PackageManager.PERMISSION_GRANTED
        }

    private fun scanForWatch(){
        if(!session.isAuthenticated){
            status.text="Najpierw zaloguj się do HealthGo."
            return
        }
        if(!bluetooth.isAvailable()){
            status.text="Ten telefon nie obsługuje Bluetooth."
            return
        }
        if(!bluetooth.isEnabled()){
            status.text="Włącz Bluetooth w telefonie i spróbuj ponownie."
            return
        }
        if(!hasBluetoothPermissions()){
            pendingBluetoothScan=true
            bluetoothPermissions.launch(requiredBluetoothPermissions())
            return
        }
        doScanForWatch()
    }

    private fun doScanForWatch(){
        status.text="Szukam zegarków i opasek Bluetooth…"
        lifecycleScope.launch{
            runCatching{bluetooth.scan()}
                .onSuccess{devices->
                    if(devices.isEmpty()){
                        status.text="Nie znaleziono urządzeń. Zbliż zegarek do telefonu i upewnij się, że Bluetooth zegarka jest aktywny."
                    }else showWatchChooser(devices)
                }
                .onFailure{
                    status.text="Skanowanie nie powiodło się: ${it.localizedMessage?:"błąd Bluetooth"}"
                }
        }
    }

    private fun showWatchChooser(devices:List<BleWatch>){
        val labels=devices.map{
            val signal=when{
                it.rssi>=-60->"mocny sygnał"
                it.rssi>=-80->"średni sygnał"
                else->"słaby sygnał"
            }
            "${it.name} · $signal"
        }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Wybierz zegarek")
            .setItems(labels){_,which->connectWatch(devices[which])}
            .setNegativeButton("Anuluj",null)
            .show()
        status.text="Znaleziono ${devices.size} urządzeń. Wybierz swój zegarek."
    }

    private fun connectWatch(watch:BleWatch){
        status.text="Łączę z ${watch.name}…"
        lifecycleScope.launch{
            runCatching{
                val connection=bluetooth.connect(watch)
                session.registerDevice(
                    externalId="ble-${connection.address}",
                    name=connection.name,
                    deviceType="wearable",
                    connectionType="ble",
                    batteryLevel=connection.batteryLevel,
                    connected=true
                )
                connection
            }.onSuccess{connection->
                val features=buildList{
                    if(connection.supportsHeartRate)add("tętno")
                    if(connection.supportsBattery)add("bateria")
                    if(connection.supportsDeviceInfo)add("informacje o urządzeniu")
                }
                status.text=if(features.isEmpty())
                    "Połączono z ${connection.name}. Zegarek nie udostępnia standardowych usług zdrowotnych BLE; dane mogą wymagać aplikacji producenta lub Health Connect."
                else "Połączono z ${connection.name}. Obsługiwane: ${features.joinToString(", ")}${connection.batteryLevel?.let{" · bateria $it%"}?:""}."
            }.onFailure{
                status.text="Nie udało się połączyć z zegarkiem: ${it.localizedMessage?:"błąd Bluetooth"}"
            }
        }
    }

    override fun onDestroy(){
        autoSyncJob?.cancel()
        bluetooth.disconnect()
        super.onDestroy()
    }
}
