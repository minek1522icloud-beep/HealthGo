# HealthGo — Apple Watch / Apple Health (pierwszy etap)

## Zakres
- **Urządzenia:** źródło Apple Health, przyciski Połącz, Synchronizuj teraz, Rozłącz; bez liczb tętna i kroków.
- **Start / Aktywność:** dane odczytane przez HealthKit po zgodzie użytkownika: kroki, dystans, ostatnie tętno, sen; dodatkowo aktywne kalorie na Start.
- Parowanie Apple Watch odbywa się w systemowej aplikacji **Watch**. Apple Health nie potwierdza, czy dany pomiar pochodzi właśnie z Apple Watch.
- Swift/HealthKit są dostępne wyłącznie w **podpisanej natywnej aplikacji iOS**. Safari/PWA nie ma dostępu do HealthKit.
- Dane z tego mostu są utrzymywane lokalnie w pamięci bieżącej sesji HealthGo; integracja nie wysyła ich automatycznie na serwer.
- Odłączenie wyłącza lokalną synchronizację i usuwa lokalny odczyt z widoków. Nie rozparowuje zegarka i nie cofa systemowej zgody HealthKit.

## Architektura
- `native-shell/ios-healthkit/HealthGoHealthPlugin.swift`: read-only Capacitor plugin `HealthGoHealth`.
- `native-shell/ios-healthkit/HealthGoBridgeViewController.swift`: rejestracja pluginu.
- `scripts/patch-capacitor-ios-healthkit.py`: dodanie plików Swift, uprawnień i wpisów do wygenerowanego projektu Xcode po `cap add/sync`. Przerwij budowę, jeśli szablon Xcode uległ zmianie.
- `www/healthgo-apple-health53.js`: przyciski i bezpieczny przepływ zgody HealthKit.
- `www/healthgo-services.js`: aktualizacja danych Start/Aktywność tylko dla aktualnie zalogowanego konta.
- `.github/workflows/native-ios.yml`: testy, przygotowanie pakietu i kompilacja Xcode dla symulatora.

## Weryfikacja
Automatyczne testy JavaScript sprawdzają:
1. Zakaz pozorowanego połączenia w Safari.
2. Prośbę o dostęp wyłącznie po naciśnięciu Połącz.
3. Pobieranie rzeczywistych danych z mostu, bez zastępczych pomiarów.
4. Rozłącz i rozdzielenie danych pomiędzy kontami.
5. Oddzielenie widoku Urządzenia od statystyk.

**Kompilacja symulatora nie zastępuje testu na prawdziwym iPhonie.** Instalacja na urządzeniu wymaga podpisania iOS i prawidłowo skonfigurowanej funkcji HealthKit w identyfikatorze aplikacji.

## Test manualny na iPhonie po podpisaniu aplikacji
1. Sparuj Apple Watch w aplikacji Watch i potwierdź, że aplikacja Zdrowie zawiera dane.
2. Uruchom natywne HealthGo na iPhonie i zaloguj się.
3. Przejdź do Urządzenia i dotknij **Połącz Apple Health**.
4. Udziel uprawnień w systemowym oknie zgody, następnie dotknij **Synchronizuj teraz**.
5. Potwierdź, że odczyty są dostępne w Start/Aktywność, a w Urządzeniach pozostaje tylko status.
6. Przetestuj odmowę zgody, brak pomiarów, odłączenie i zmianę konta.
7. Sprawdź, że po Rozłącz Apple Watch nadal pozostaje sparowany z iPhonem.

**Ograniczenie:** HealthKit nie ujawnia aplikacji, czy użytkownik odmówił konkretnego uprawnienia tylko do odczytu. Brak danych nie jest dowodem usterki.
