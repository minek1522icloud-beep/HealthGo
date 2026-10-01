# Konfiguracja HealthGo Mobile

Kod telefonu jest gotowy na wspólne konto HealthGo.

## Wymagane przed instalacją produkcyjną
1. W Firebase dodaj aplikację Android o identyfikatorze `com.healthgo.mobile` i umieść wygenerowany `google-services.json` w `mobile/android/app/`.
2. W Firebase dodaj aplikację iOS o identyfikatorze `com.healthgo.HealthGoMobile` i dodaj `GoogleService-Info.plist` do targetu iOS.
3. Włącz logowanie Email/Password w Firebase Authentication.
4. Wdróż reguły z `firebase/firestore.rules`.
5. Android: użytkownik nadaje HealthGo uprawnienia Health Connect. Zegarek musi zapisywać swoje dane do Health Connect.
6. iPhone: użytkownik nadaje HealthGo uprawnienia Apple Health. Zegarek/urządzenie musi zapisywać dane do Apple Health.

Nie umieszczaj prywatnych kluczy podpisywania ani haseł w repozytorium.
