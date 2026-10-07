package com.healthgo.mobile

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Context
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class BleWatch(
    val device:BluetoothDevice,
    val name:String,
    val address:String,
    val rssi:Int
)

data class BleConnection(
    val name:String,
    val address:String,
    val batteryLevel:Int?,
    val supportsHeartRate:Boolean,
    val supportsBattery:Boolean,
    val supportsDeviceInfo:Boolean
)

class BluetoothWatchManager(private val context:Context){
    private val manager=context.getSystemService(BluetoothManager::class.java)
    private val adapter:BluetoothAdapter? get()=manager?.adapter
    private var activeGatt:BluetoothGatt?=null

    companion object{
        private val BATTERY_SERVICE=UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb")
        private val BATTERY_LEVEL=UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb")
        private val HEART_RATE_SERVICE=UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
        private val DEVICE_INFO_SERVICE=UUID.fromString("0000180a-0000-1000-8000-00805f9b34fb")
    }

    fun isAvailable():Boolean=adapter!=null
    fun isEnabled():Boolean=adapter?.isEnabled==true

    @SuppressLint("MissingPermission")
    suspend fun scan(durationMs:Long=6500):List<BleWatch>{
        val bt=adapter?:error("Ten telefon nie obsługuje Bluetooth.")
        if(!bt.isEnabled)error("Włącz Bluetooth w telefonie i spróbuj ponownie.")
        val scanner=bt.bluetoothLeScanner?:error("Skanowanie Bluetooth jest niedostępne.")
        val found=linkedMapOf<String,BleWatch>()
        val callback=object:ScanCallback(){
            override fun onScanResult(callbackType:Int,result:ScanResult){
                val d=result.device
                val name=(result.scanRecord?.deviceName ?: d.name ?: "Zegarek / opaska").trim()
                found[d.address]=BleWatch(d,name,d.address,result.rssi)
            }
            override fun onBatchScanResults(results:MutableList<ScanResult>){
                results.forEach{onScanResult(0,it)}
            }
            override fun onScanFailed(errorCode:Int){
                // Wynik błędu zostanie obsłużony po zakończeniu krótkiego skanowania.
            }
        }
        scanner.startScan(callback)
        try{delay(durationMs)}finally{runCatching{scanner.stopScan(callback)}}
        return found.values.sortedByDescending{it.rssi}
    }

    @SuppressLint("MissingPermission")
    suspend fun connect(watch:BleWatch):BleConnection=withTimeout(20000){
        disconnect()
        suspendCancellableCoroutine{continuation->
            var finished=false
            var pendingBattery=false
            var heart=false
            var battery=false
            var info=false

            fun complete(gatt:BluetoothGatt,batteryLevel:Int?){
                if(finished)return
                finished=true
                activeGatt=gatt
                continuation.resume(
                    BleConnection(
                        name=watch.name,
                        address=watch.address,
                        batteryLevel=batteryLevel,
                        supportsHeartRate=heart,
                        supportsBattery=battery,
                        supportsDeviceInfo=info
                    )
                )
            }
            fun fail(gatt:BluetoothGatt?,message:String){
                if(finished)return
                finished=true
                runCatching{gatt?.close()}
                continuation.resumeWithException(IllegalStateException(message))
            }

            val callback=object:BluetoothGattCallback(){
                override fun onConnectionStateChange(gatt:BluetoothGatt,status:Int,newState:Int){
                    if(status!=BluetoothGatt.GATT_SUCCESS){
                        fail(gatt,"Zegarek odrzucił połączenie Bluetooth.")
                        return
                    }
                    when(newState){
                        BluetoothProfile.STATE_CONNECTED->{
                            if(!gatt.discoverServices())fail(gatt,"Nie udało się odczytać usług zegarka.")
                        }
                        BluetoothProfile.STATE_DISCONNECTED->{
                            if(!finished)fail(gatt,"Połączenie z zegarkiem zostało przerwane.")
                        }
                    }
                }

                override fun onServicesDiscovered(gatt:BluetoothGatt,status:Int){
                    if(status!=BluetoothGatt.GATT_SUCCESS){
                        fail(gatt,"Nie udało się odczytać możliwości zegarka.")
                        return
                    }
                    heart=gatt.getService(HEART_RATE_SERVICE)!=null
                    val batteryService=gatt.getService(BATTERY_SERVICE)
                    battery=batteryService!=null
                    info=gatt.getService(DEVICE_INFO_SERVICE)!=null
                    val characteristic=batteryService?.getCharacteristic(BATTERY_LEVEL)
                    if(characteristic!=null){
                        pendingBattery=true
                        if(!gatt.readCharacteristic(characteristic)){
                            pendingBattery=false
                            complete(gatt,null)
                        }
                    }else complete(gatt,null)
                }

                @Deprecated("Deprecated in Android API but required for older supported phones")
                override fun onCharacteristicRead(gatt:BluetoothGatt,characteristic:BluetoothGattCharacteristic,status:Int){
                    if(!pendingBattery||characteristic.uuid!=BATTERY_LEVEL)return
                    pendingBattery=false
                    val level=if(status==BluetoothGatt.GATT_SUCCESS){
                        characteristic.value?.firstOrNull()?.toInt()?.and(0xff)
                    }else null
                    complete(gatt,level)
                }
            }

            val gatt=watch.device.connectGatt(context,false,callback,BluetoothDevice.TRANSPORT_LE)
            continuation.invokeOnCancellation{
                runCatching{gatt.disconnect()}
                runCatching{gatt.close()}
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun disconnect(){
        val gatt=activeGatt
        activeGatt=null
        runCatching{gatt?.disconnect()}
        runCatching{gatt?.close()}
    }
}
