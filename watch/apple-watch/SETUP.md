# Apple Watch — konfiguracja

Kod jest przygotowany jako źródła SwiftUI dla targetu watchOS.

## 1. Wymagania

- Mac
- Xcode 26.2 lub nowszy
- projekt Firebase HealthGo

Firebase AI Logic obsługuje watchOS, ale aplikacja zegarka musi być osobno zarejestrowana jako aplikacja Apple w Firebase.

## 2. Xcode

1. Utwórz nowy projekt watchOS albo dodaj target watchOS.
2. Dodaj pliki Swift z tego katalogu.
3. Przez Swift Package Manager dodaj:
   - FirebaseAILogic
   - FirebaseAppCheck
4. Z Firebase pobierz plik `GoogleService-Info.plist` dla aplikacji zegarka i dodaj go do targetu watchOS.
5. W Firebase App Check zarejestruj aplikację zegarka z dostawcą obsługiwanym przez watchOS.
6. Uruchom na symulatorze lub prawdziwym Apple Watch.

## 3. Pierwsza wersja

Działa ekran HealthGo i ekran AI. Plan Dnia i prawdziwe dane aktywności będą podłączane w następnym etapie.
