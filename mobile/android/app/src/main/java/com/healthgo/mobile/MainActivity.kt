package com.healthgo.mobile

import android.os.Bundle
import android.text.InputType
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class MainActivity: ComponentActivity() {
    private lateinit var sync: HealthSync
    private lateinit var status: TextView
    private lateinit var email: EditText
    private lateinit var password: EditText
    private val auth by lazy { FirebaseAuth.getInstance() }
    private val healthPermissions=registerForActivityResult(PermissionController.createRequestPermissionResultContract()){granted->
        status.text=if(granted.containsAll(sync.permissions)) "Dostęp przyznany. Synchronizacja HealthGo jest gotowa." else "Nie wszystkie uprawnienia zostały przyznane."
        if(granted.containsAll(sync.permissions)) startAutoSync()
    }
    override fun onCreate(savedInstanceState:Bundle?){
        super.onCreate(savedInstanceState); sync=HealthSync(this)
        val box=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(48,64,48,48)}
        box.addView(TextView(this).apply{text="HealthGo";textSize=30f})
        box.addView(TextView(this).apply{text="Zegarek → telefon → Health Connect → konto HealthGo";textSize=15f})
        email=EditText(this).apply{hint="E-mail HealthGo";inputType=InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS};box.addView(email)
        password=EditText(this).apply{hint="Hasło";inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD};box.addView(password)
        box.addView(Button(this).apply{text="Zaloguj się";setOnClickListener{login()}})
        status=TextView(this).apply{setPadding(0,28,0,20)};box.addView(status)
        box.addView(Button(this).apply{text="Połącz dane zdrowotne";setOnClickListener{requestHealth()}})
        box.addView(Button(this).apply{text="Synchronizuj teraz";setOnClickListener{syncNow()}})
        setContentView(box)
        auth.currentUser?.let{email.setText(it.email?:"");status.text="Zalogowano: "+(it.email?:"konto HealthGo");requestHealth()}
    }
    private fun login(){val e=email.text.toString().trim();val p=password.text.toString();if(e.isBlank()||p.isBlank()){status.text="Wpisz e-mail i hasło.";return};status.text="Logowanie…";auth.signInWithEmailAndPassword(e,p).addOnCompleteListener{t->if(t.isSuccessful){status.text="Zalogowano. Teraz nadaj dostęp do danych.";requestHealth()}else status.text="Nie udało się zalogować: "+(t.exception?.localizedMessage?:"błąd")}}
    private fun requestHealth(){if(auth.currentUser==null){status.text="Najpierw zaloguj się do konta HealthGo.";return};val provider=HealthConnectClient.getSdkStatus(this);if(provider!=HealthConnectClient.SDK_AVAILABLE){status.text="Health Connect nie jest dostępny na tym telefonie.";return};lifecycleScope.launch{val granted=sync.client.permissionController.getGrantedPermissions();if(granted.containsAll(sync.permissions)){status.text="Dane zdrowotne są połączone.";startAutoSync()}else healthPermissions.launch(sync.permissions)}}
    private fun syncNow(){lifecycleScope.launch{runCatching{val s=sync.readToday();sync.upload(s)}.onSuccess{status.text="Zsynchronizowano z HealthGo."}.onFailure{status.text="Synchronizacja nieudana: "+(it.localizedMessage?:"błąd")}}}
    private fun startAutoSync(){lifecycleScope.launch{while(isActive){runCatching{val s=sync.readToday();sync.upload(s)};delay(15*60*1000L)}}}
}
