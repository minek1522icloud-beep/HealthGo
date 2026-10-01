# HealthGo Mobile Sync

Telefon jest mostem między zegarkiem a kontem HealthGo.

## Android
Moduł `mobile/android` korzysta z Health Connect. Użytkownik sam zatwierdza dostęp do kroków, dystansu, tętna i snu. HealthGo nie łączy się z zegarkiem z pominięciem zabezpieczeń producenta.

## iPhone
Moduł `mobile/ios` korzysta z Apple Health / HealthKit i wymaga zgody użytkownika.

Oba moduły zapisują ujednolicony dokument:
`users/{uid}/health/latest`

Pola: `steps`, `distanceKm`, `activeMinutes`, `sleepMinutes`, `heartRate`, `source`, `updatedAt`.

Do uruchomienia produkcyjnego trzeba dodać konfigurację Firebase właściwą dla aplikacji (`google-services.json` na Androidzie i `GoogleService-Info.plist` na iOS), skonfigurować logowanie oraz reguły Firestore ograniczające zapis/odczyt do właściciela UID.
