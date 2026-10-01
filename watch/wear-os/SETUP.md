# Wear OS — konfiguracja

Ta wersja jest przeznaczona dla zegarków z Wear OS, np. Google Pixel Watch i nowszych Samsung Galaxy Watch z Wear OS.

## 1. W Android Studio

1. Utwórz projekt Wear OS z Jetpack Compose.
2. Ustaw package name na `com.healthgo.wear`.
3. Skopiuj pliki z `app/src/main` do projektu.
4. Dodaj Firebase do aplikacji Android w projekcie HealthGo.
5. Pobierz `google-services.json` i dodaj go do modułu `app`.
6. Dodaj zależności:
   - Firebase AI Logic
   - Firebase App Check Play Integrity
   - Wear Compose Material 3

## 2. App Check

W Firebase App Check zarejestruj aplikację Android/Wear OS i użyj Play Integrity. Do wersji testowej w emulatorze można użyć debug provider.

## 3. Pierwsza wersja

Na razie jest ekran HealthGo i test AI. Plan Dnia, konto i prawdziwe dane aktywności będą synchronizowane w kolejnym etapie.
