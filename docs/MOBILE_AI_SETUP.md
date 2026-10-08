# HealthGo Mobile AI — konfiguracja produkcyjna

HealthGo na Windows korzysta najpierw z lokalnego Ollama. Wersja PWA (iPhone / Android)
korzysta z Firebase AI Logic i wymaga prawidłowo działającego **Firebase App Check**.
Przełączanie AI na niezabezpieczony klucz w JavaScript nie jest rozwiązaniem.

## Wymagane ustawienia Firebase dla administratora

1. Zaloguj się do Firebase Console i wybierz projekt `healthgo-e45be`.
2. W Firebase **App Check → Apps** sprawdź, czy istnieje zarejestrowana aplikacja
   webowa HealthGo i czy używa poprawnego klucza **reCAPTCHA Enterprise (score based)**.
3. W Google Cloud Console w tym samym projekcie przejdź do reCAPTCHA Enterprise.
   Klucz webowy musi zawierać dokładny **hostname rzeczywistej strony HealthGo**,
   na przykład nazwę hosta GitHub Pages, jeśli tam działa PWA.
   Dodaje się sam hostname, bez `https://` i ścieżki.
   Nie zakładaj, że przykładowy adres to prawdziwy adres publikacji.
4. Zweryfikuj, czy API reCAPTCHA Enterprise jest włączone i czy klucz oraz
   projekt odpowiadają ustawieniom Firebase.
5. W Firebase App Check → APIs sprawdź stan **Firebase AI Logic**,
   liczbę odrzuconych żądań i poprawność attestation przed testami produkcyjnymi.
   Nie wyłączaj zabezpieczeń produkcyjnych.
6. Otwórz HealthGo na **iPhone / Android** → AI → wyślij pytanie.
   Jeśli pojawi się błąd, kliknij **Sprawdź połączenie AI**
   i odczytaj **kod diagnostyczny**:
   - `MOBILE_APP_CHECK`: niepowodzenie uwierzytelnienia App Check
   - `MOBILE_ACCESS`: brak autoryzacji Firebase AI Logic
   - `MOBILE_RATE_LIMIT`: limit zapytań
   - `MOBILE_PROVIDER`: błąd modelu lub usługi Gemini
   - `MOBILE_NETWORK` / `MOBILE_TIMEOUT`: sieć lub zbyt długi czas odpowiedzi
   - `MOBILE_SDK`: problem z pakietem JS
7. Sprawdź kolejne pytania i wszystkie tryby AI — *Asystent, Plan, Jedzenie, Aktywność, Odkrywanie*.

## Co obejmują testy repozytorium

Testy imitują SDK Firebase, odświeżenie tokenu, błędy App Check,
wiele wiadomości, tryby AI i historię. Nie zastępują uruchomienia
prawdziwego App Check i Gemini na fizycznym telefonie.
