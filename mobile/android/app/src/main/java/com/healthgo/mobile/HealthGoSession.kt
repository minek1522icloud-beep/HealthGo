package com.healthgo.mobile

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

class HealthGoSession(context: Context) {
    private val prefs=context.getSharedPreferences("healthgo_supabase_session",Context.MODE_PRIVATE)
    private val baseUrl="https://oqrfapmdcofguwdvhbeo.supabase.co"
    private val apiKey="sb_publishable_AuERvskDwwmm13In-B45zA_yKP6IElB"

    val email:String get()=prefs.getString("email","")?:""
    val userId:String? get()=prefs.getString("user_id",null)
    val isAuthenticated:Boolean get()=!prefs.getString("access_token",null).isNullOrBlank()&&!userId.isNullOrBlank()

    suspend fun login(email:String,password:String){
        val clean=email.trim()
        require(clean.isNotEmpty()&&password.isNotEmpty()){"Wpisz e-mail i hasło."}
        val body=JSONObject().put("email",clean).put("password",password)
        val result=requestRaw("/auth/v1/token?grant_type=password","POST",body,false)
        storeAuth(JSONObject(result))
    }

    fun logout(){prefs.edit().clear().apply()}

    suspend fun request(path:String,method:String="GET",body:JSONObject?=null,prefer:String?=null):String{
        ensureFreshToken()
        return requestRaw(path,method,body,true,prefer)
    }

    suspend fun registerDevice(
        externalId:String,
        name:String,
        deviceType:String="wearable",
        connectionType:String="ble",
        batteryLevel:Int?=null,
        connected:Boolean=true
    ){
        request(
            "/rest/v1/rpc/healthgo_register_device",
            "POST",
            JSONObject()
                .put("p_external_id",externalId)
                .put("p_name",name)
                .put("p_platform","Android")
                .put("p_device_type",deviceType)
                .put("p_connection_type",connectionType)
                .put("p_battery_level",batteryLevel ?: JSONObject.NULL)
                .put("p_connected",connected)
        )
    }

    private suspend fun ensureFreshToken(){
        if(!isAuthenticated)error("Zaloguj się do HealthGo.")
        val expires=prefs.getLong("expires_at",0L)
        if(expires>Instant.now().epochSecond+60)return
        val refresh=prefs.getString("refresh_token",null)
        if(refresh.isNullOrBlank()){logout();error("Sesja wygasła. Zaloguj się ponownie.")}
        val result=requestRaw(
            "/auth/v1/token?grant_type=refresh_token",
            "POST",
            JSONObject().put("refresh_token",refresh),
            false
        )
        storeAuth(JSONObject(result))
    }

    private fun storeAuth(json:JSONObject){
        val token=json.optString("access_token")
        val refresh=json.optString("refresh_token")
        val user=json.optJSONObject("user")
        val uid=user?.optString("id").orEmpty()
        if(token.isBlank()||uid.isBlank())error("Supabase nie zwrócił poprawnej sesji.")
        val expiresAt=if(json.has("expires_at"))json.optLong("expires_at")
        else Instant.now().epochSecond+json.optLong("expires_in",3600L)
        prefs.edit()
            .putString("access_token",token)
            .putString("refresh_token",refresh)
            .putString("user_id",uid)
            .putString("email",user?.optString("email").orEmpty())
            .putLong("expires_at",expiresAt)
            .apply()
    }

    private suspend fun requestRaw(
        path:String,
        method:String,
        body:JSONObject?,
        useAuth:Boolean,
        prefer:String?=null
    ):String=withContext(Dispatchers.IO){
        val conn=(URL(baseUrl+path).openConnection() as HttpURLConnection).apply{
            requestMethod=method
            connectTimeout=15000
            readTimeout=20000
            setRequestProperty("apikey",apiKey)
            setRequestProperty("Accept","application/json")
            setRequestProperty("Content-Type","application/json")
            if(useAuth){
                val token=prefs.getString("access_token",null)?:error("Zaloguj się do HealthGo.")
                setRequestProperty("Authorization","Bearer $token")
            }
            if(!prefer.isNullOrBlank())setRequestProperty("Prefer",prefer)
            if(body!=null){
                doOutput=true
                outputStream.use{it.write(body.toString().toByteArray(Charsets.UTF_8))}
            }
        }
        try{
            val code=conn.responseCode
            val stream=if(code in 200..299)conn.inputStream else conn.errorStream
            val text=stream?.bufferedReader()?.use{it.readText()}.orEmpty()
            if(code !in 200..299){
                val message=runCatching{JSONObject(text).optString("message").ifBlank{JSONObject(text).optString("error_description")}}.getOrNull()
                error(message?.takeIf{it.isNotBlank()}?:"Błąd HealthGo ($code).")
            }
            text
        }finally{conn.disconnect()}
    }
}
