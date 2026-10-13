# HealthGo · Integracja Terra (opcjonalna)

Status: **szkielet serwera i aplikacji wdrożony, integracja pozostaje NIEAKTYWNA bez kluczy Terra**. Wbudowane bezpłatne ścieżki Bluetooth LE, HealthKit w natywnym iOS i Health Connect w natywnym Androidzie pozostają bez zmian.

## Koszty i zgody

Terra API to **usługa płatna**. Według cennika https://tryterra.co/pricing w październiku 2026 plan Quick Start kosztował od **499 USD miesięcznie** przy rozliczeniu miesięcznym lub od 399 USD miesięcznie przy opłaceniu roku. Nie uruchamiamy płatności z HealthGo. Dla konta prowadzonego przez osobę niepełnoletnią decyzję o abonamencie i warunkach należy omówić z rodzicem/opiekunem. Nie udostępniaj nikomu kluczy ani haseł na czacie.

## Co jest gotowe

- Publiczna strona `www/healthgo-terra50.js` wyświetla stan Terra, zweryfikowane połączenia i minimalne dzienne pomiary.
- Endpoint `healthgo-terra-link` wymaga ważnego JWT Supabase, autoryzuje właściciela konta i **tylko na wyraźne kliknięcie** może poprosić Terra o oficjalne okno logowania. Losowy, 15-minutowy `reference_id` wiąże podpisany webhook z konkretnym użytkownikiem.
- Endpoint `healthgo-terra-webhook` weryfikuje `terra-signature` z HMAC-SHA256 na **surowym body**, ignoruje starsze niż 5 minut żądania i używa danych wyłącznie z potwierdzonych połączeń.
- Minimalne `daily`: kroki, dystans, aktywne minuty — osobne tabele `hg_terra_connections`, `hg_terra_daily_metrics` z RLS. Bez przesyłania pełnych profili, dokładnej lokalizacji, danych menstruacyjnych, surowych próbek, bez nadawania XP.
- Odłączenie przez panel usuwa zapisane przez Terra dzienne pomiary i unieważnia połączenie Terra, jeśli API potwierdzi odebranie uprawnień.

## Czego potrzeba, aby aktywować **po odrębnej decyzji o płatnym planie**

1. Administrator ma aktywne konto Terra i dostęp do panelu Terra. Sprawdza wymagania dotyczące wieku, opłat i zgody na przetwarzanie danych zdrowotnych.
2. Administrator dodaje **sekrety serwerowe** w Supabase Project Settings → Edge Functions → Secrets (nigdy w GitHubie, publicznym JS ani czacie):
   - `TERRA_DEV_ID` — identyfikator dewelopera Terra
   - `TERRA_API_KEY` — tajny klucz API Terra
   - `TERRA_WEBHOOK_SECRET` — tajny klucz do podpisywania webhooków Terra.
3. W panelu Terra konfiguruje Destination / webhook **HTTPS**:
   `https://oqrfapmdcofguwdvhbeo.supabase.co/functions/v1/healthgo-terra-webhook`
   i włącza tylko potrzebne rodzaje zdarzeń: `auth`, `deauth`, `access_revoked`, `daily`, `healthcheck`. Podpis Terra jest obowiązkowy.
4. Test w środowisku Terra Testing lub Staging, wyłącznie na koncie testowym z jego świadomą zgodą. Wybór modelu zegarka w HealthGo **nie potwierdza obsługi danej marki przez Terra**. W oficjalnym widgetcie zobaczysz źródła rzeczywiście udostępnione na koncie Terra.
5. Kontrola RLS, zgód, odłączania i usuwania danych na prawdziwym koncie testowym przed włączeniem produkcyjnym. Nie oznaczać integracji jako „Gotowa” przed wynikiem tych prób.

## Diagnostyka

- Ekran `Terra nie jest jeszcze skonfigurowana` jest **prawidłowy** dopóki sekretów nie ustawiono.
- Webhook odpowiada 503 bez sekretu i 401 na nieprawidłowy podpis. **Nigdy** nie wyłączaj sprawdzania podpisu.
- Endpoint użytkownika wymaga Supabase JWT i autentyfikuje użytkownika serwerowo.
- Nie zapisujemy surowych danych Terra ani ich nie pokazujemy innym kontom.
- Dane otrzymane od Terra są oddzielne od głównej tabeli `activity_daily`; scalanie statystyk wymaga osobnej polityki unikania duplikatów, której nie włączamy domyślnie.

Źródła: https://docs.tryterra.co/reference/health-and-fitness-api/destinations ,
https://docs.tryterra.co/reference/health-and-fitness-api/event-types ,
https://docs.tryterra.co/reference .
