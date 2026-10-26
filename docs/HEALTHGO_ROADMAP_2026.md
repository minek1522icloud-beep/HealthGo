# HealthGo — plan rozwoju

> Dokument planistyczny. Pozycja w planie nie oznacza automatycznie, że funkcja jest już wdrożona i przetestowana.

## Uzgodnione zasady

- Najpierw rozwijamy funkcje aplikacji i stabilizujemy je; integrację ze smartwatchami odkładamy na później.
- Nie pokazujemy fikcyjnych pomiarów, lokalizacji, osiągnięć ani statusów synchronizacji.
- Dane zdrowotne, rodzinne i lokalizacyjne udostępniamy wyłącznie zgodnie z uprawnieniami i zgodami.
- Czynności, które zmieniają dane lub coś publikują, wymagają świadomego działania użytkownika.
- Funkcje wymagające backendu, API albo uprawnień systemowych oznaczamy jako wymagające osobnej integracji i testów.

## Etap 1 — Glossy AI i głos

- Oryginalny, błyszczący avatar w turkusowo-miętowym stylu.
- Animacja czuwania, słuchania i mówienia; respektowanie ustawienia ograniczenia animacji.
- Wprowadzanie tekstu przez rozpoznawanie mowy, jeśli przeglądarka je obsługuje.
- Opcjonalne czytanie odpowiedzi na głos; użytkownik włącza je samodzielnie.
- Czat tekstowy pozostaje dostępny niezależnie od obsługi głosu.
- Mikrofon działa wyłącznie po akcji użytkownika i zgodzie przeglądarki.
- Odczyt odpowiedzi korzysta z wbudowanej syntezy mowy przeglądarki; jakość i dostępność głosów zależy od urządzenia.

## Etap 2 — Rodzina 2.0

- Rodzinny pulpit, profile i role oraz zapraszanie kodem.
- Wyzwania, poziomy, odznaki, punkty i nagrody kosmetyczne.
- Raporty i statystyki wyłącznie dla danych, które użytkownik zgodził się udostępnić.
- Kalendarz rodzinny, wydarzenia i przypomnienia.
- Planowanie posiłków oraz wspólna lista zakupów.
- Czat, ogłoszenia i wspomnienia z kontrolą dostępu.
- Apteczka, kontakty awaryjne i planowanie rodzinnych wycieczek.
- Tryb uproszczony z większymi przyciskami i interfejsem dostosowanym do roli.
- Bezpieczeństwo dzieci, prywatność oraz możliwość cofnięcia udostępniania danych.

## Etap 3 — HealthGo AI 2.0 w całej aplikacji

- Asystent kontekstowy dostępny we wszystkich zakładkach.
- Rozmowa tekstowa i głosowa.
- Pamięć wybranych preferencji pod kontrolą użytkownika.
- Wyszukiwanie aktualnych informacji w wiarygodnych źródłach i podawanie odnośników.
- Wyjaśnianie wykresów i podsumowywanie rzeczywistych danych.
- Pomoc w korzystaniu z aplikacji oraz przygotowywanie czynności do potwierdzenia.
- Rozróżnianie danych, szacunków i braku informacji.
- Jasna informacja, gdy funkcja wymaga internetu albo zewnętrznego serwisu.

## Etap 4 — Planer i funkcje rodzinne

- Wspólny kalendarz, zadania i wydarzenia.
- Pomysły na aktywności, wycieczki i posiłki.
- Lista zakupów, albumy i wspomnienia.
- Sezonowe wyzwania, dekoracje, awatary i odznaki.
- Powiadomienia konfigurowane przez użytkownika.

## Etap 5 — Motywy sezonowe

- Halloween, Boże Narodzenie, Wielkanoc, lato i motyw standardowy.
- Oddzielna weryfikacja ikon i instalacji dla PWA, iOS, Androida i desktopu.

## Etap 6 — Testy i stabilizacja

- Testy na telefonach i komputerach, w tym układy mobilne i dostępność.
- Testy błędów sieci, braku uprawnień, pustych danych i odzyskiwania stanu.
- Kontrola dostępu, prywatności, synchronizacji i bezpieczeństwa.
- Sprawdzenie, czy interfejs jasno komunikuje status funkcji.

## Odłożone na później — zegarki i urządzenia ubieralne

Integracja smartwatchy, pomiarów zdrowotnych z urządzeń i dodatkowych uprawnień systemowych nie wchodzi do bieżącego zakresu. Wrócimy do niej dopiero po ustabilizowaniu pozostałych funkcji.
