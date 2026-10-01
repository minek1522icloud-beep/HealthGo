# Jak uruchomić HealthGo na Wear OS

## Najpierw Firebase

W projekcie Firebase HealthGo dodaj nową aplikację Android.

- Package name: `com.healthgo.wear`
- App nickname: `HealthGo Wear OS`

Pobierz plik `google-services.json` i umieść go tutaj:

`watch/wear-os/app/google-services.json`

Bez tego pliku aplikacja uruchomi się dopiero po dokończeniu konfiguracji Firebase.

## Android Studio

1. Zainstaluj aktualne Android Studio.
2. Otwórz folder `watch/wear-os` jako projekt.
3. Poczekaj na Gradle Sync.
4. Jeśli Android Studio poprosi o SDK, zainstaluj Android API 37.
5. W Device Manager utwórz emulator Wear OS albo podłącz prawdziwy zegarek Wear OS.
6. Wybierz moduł `app`.
7. Kliknij Run ▶.

## App Check podczas testów

Debug build korzysta z Firebase App Check Debug Provider.

Przy pierwszym uruchomieniu w Logcat pojawi się debug token App Check.

W Firebase:

App Check → Apps → HealthGo Wear OS → Manage debug tokens → Add debug token

Wklej token z Logcat. Po tym HealthGo AI powinno działać na emulatorze lub zegarku w buildzie debug.

## Wersja produkcyjna

Release build używa Play Integrity zamiast Debug Provider.

Przed publikacją w Google Play trzeba skonfigurować Play Integrity dla aplikacji `com.healthgo.wear`.

## Apple Watch

Apple Watch wymaga osobnego targetu watchOS i Maca z Xcode. Źródła są w `watch/apple-watch`.
