# Testowanie prawdziwego HealthGo na iPhonie z Windowsa

## Co otrzymujemy

GitHub Actions buduje `HealthGo-iPhone-TEST-unsigned.ipa` z plików aplikacji HealthGo. To kompilacja dla **fizycznego iPhone'a (iPhoneOS/arm64)**, a nie archiwum źródłowe Xcode ani skrót strony WWW. Pakiet zawiera plugin Swift `HealthGoHealth` i wymagany opis uprawnień Apple Health.

**UWAGA: IPA JEST NIEPODPISANA.** Nie otworzy się po kliknięciu w aplikacji Pliki. Dopiero instalacja z poprawnym podpisem i provisioningiem pozwala na uruchomienie jej na iPhonie.

## Instalacja testowa z Windows (bez Maca)

Oficjalna witryna narzędzia do lokalnego podpisywania i instalowania aplikacji: https://sideloadly.io/ . Używaj wyłącznie pobranego przez siebie instalatora z oficjalnej witryny.

1. Na własnym komputerze Windows pobierz i zainstaluj aktualne **iTunes i iCloud bezpośrednio od Apple**, zgodnie z instrukcją narzędzia. Jeśli już są zainstalowane, nie trzeba ich usuwać bez potrzeby.
2. Pobierz z GitHub Actions artefakt `HealthGo-iPhone-TEST-unsigned` i rozpakuj go. W środku znajduje się `HealthGo-iPhone-TEST-unsigned.ipa` oraz suma SHA-256.
3. Podłącz odblokowanego iPhone'a przewodem USB. Potwierdź **Zaufaj temu komputerowi**, tylko jeśli to Twój komputer.
4. Otwórz iTunes i upewnij się, że widzi iPhone'a.
5. Uruchom Sideloadly na Windowsie, wybierz swój iPhone, wskaż **plik `.ipa`** i wykonaj instalację lokalnie, postępując zgodnie z instrukcjami programu.
6. Jeśli narzędzie poprosi o Apple ID, podawaj je tylko w zaufanym programie na własnym komputerze, nigdy w GitHub Actions, tej rozmowie, ani w plikach projektu. Przy instalacji kontem Apple wymagane może być uwierzytelnienie dwuskładnikowe.
7. Na iPhonie z iOS 16+ może być konieczne włączenie **Trybu deweloperskiego** (Ustawienia → Prywatność i ochrona → Tryb deweloperski) oraz zaakceptowanie profilu dewelopera zgodnie z instrukcjami iOS.
8. Uruchom **HealthGo**, zaloguj się, otwórz **Urządzenia** i sprawdź przyciski **Połącz Apple Health**, **Synchronizuj teraz**, **Rozłącz**.

Jeśli **AltServer** działa na Twoim komputerze, możesz także korzystać z AltStore Classic. Sideloadly nie wymaga uruchamiania AltServer.

## Co może zablokować instalację

- Niepoprawne podpisanie aplikacji lub brak właściwego profilu provisioning.
- **HealthKit** jest uprawnieniem Apple. Sam plik .ipa zawiera kod i konfigurację HealthKit, lecz instalator używający bezpłatnego Apple ID może nie być w stanie poprawnie nadać uprawnienia HealthKit. W takim przypadku nie udajemy, że integracja działa: konieczne jest podpisanie profilem obsługującym HealthKit i przetestowanie na prawdziwym urządzeniu.
- Na bezpłatnym koncie Apple podpisana testowo aplikacja zwykle wygasa po **7 dniach**; następnie konieczne jest ponowne podpisanie/odświeżenie.
- Jeśli iPhone nie pojawia się w Windows, najpierw sprawdź kabel, zaufanie do komputera i iTunes.
- Gdy Sideloadly zgłosi kod błędu, zachowaj dokładny komunikat, a nie instaluj losowych aplikacji obiecujących „naprawę certyfikatu”.

Oficjalne informacje Apple o koncie testowym: https://developer.apple.com/help/account/basics/about-your-developer-account
Oficjalne wymagania HealthKit: https://developer.apple.com/documentation/healthkit/setting-up-healthkit
Wskazówki instalacji narzędzia: https://sideloadly.io/faq.html

## Sprawdzenie prawdziwych danych Apple Watch

1. Sparuj Apple Watch z iPhonem w systemowej aplikacji **Watch**.
2. Potwierdź w aplikacji **Zdrowie**, że są dostępne ostatnie pomiary.
3. W natywnym HealthGo naciśnij **Połącz Apple Health** i zatwierdź dostęp do potrzebnych danych.
4. Na ekranie **Start** i w **Aktywności** sprawdź odczyty oraz źródło; w **Urządzeniach** nie wyświetlamy wartości tętna czy kroków.
5. Naciśnij **Rozłącz**. Powinno to wyłączyć synchronizację HealthGo bez rozłączania zegarka z iPhonem.
6. Sprawdź działanie przy braku zgody, braku odczytów, przy zmianie konta i po ponownym uruchomieniu aplikacji.

**Ważne:** Apple Health agreguje różne źródła danych. Odczyt kroków i tętna przez HealthKit nie dowodzi, że pochodzą konkretnie z Apple Watch.

Wynik kompilacji w GitHub Actions nie dowodzi jeszcze, że uprawnienia HealthKit działają na fizycznym iPhonie.
