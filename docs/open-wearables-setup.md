# HealthGo 5.2 — własny Open Wearables (zamiast płatnego Terra)

**Status:** kod HealthGo, SQL i bezpieczny endpoint Supabase są przygotowane. Połączenia kont przez Open Wearables **nie są aktywne**, dopóki nie uruchomisz swojej instalacji serwerowej, nie podłączysz kont deweloperskich producentów i nie wprowadzisz poniższych sekretów. Kod MIT jest darmowy; hosting i niektóre usługi mogą kosztować.

## Bezpieczeństwo i prywatność

- Nie publikuj API key, haseł producentów ani tokenów użytkowników na GitHubie czy w rozmowie. Wszystkie klucze konfiguruje administrator bezpośrednio w panelach.
- Każdy użytkownik HealthGo łączy własne konto poprzez oficjalny ekran OAuth dostawcy. Wybranie marki nie oznacza połączenia.
- `healthgo-open-wearables` wymaga uwierzytelnionego JWT Supabase i sprawdza konto za pomocą `auth.getUser`.
- Serwerowy `OW_API_KEY` nigdy nie dociera do aplikacji WWW.
- Tabela `hg_open_wearables_links` ma RLS i nie udostępnia wierszy aplikacjom bezpośrednio.
- Na tym etapie HealthGo pokazuje wyłącznie listę połączeń i daty synchronizacji. Nie pobiera ani nie dopisuje danych do `activity_daily`, nie nalicza XP. Transfer szczegółowych wyników będzie osobnym etapem po przetestowaniu bezpieczeństwa oraz zgód.

## 1. Lokalnie — Windows CMD / Docker Desktop

Sprawdź wcześniej, czy masz Docker Desktop z obsługą WSL2, oraz Git. Następnie w CMD:

```bat
git clone https://github.com/the-momentum/open-wearables.git
cd open-wearables
copy backend\config\.env.example backend\config\.env
copy frontend\.env.example frontend\.env
docker compose up -d
docker compose ps
```

Panele testowe: portal `http://localhost:3000`, API `http://localhost:8000/docs`. Zmień wszystkie domyślne hasła administratora **przed wystawieniem instancji do sieci**. Nie używaj publicznych danych zdrowotnych ani własnego konta producenta do testów na serwerze bez zabezpieczeń.

## 2. Połączenie z działającym HealthGo

**Uwaga:** lokalny `localhost:8000` nie jest osiągalny z chmury Supabase. Do działania na iPhonie potrzebujesz własnego bezpiecznego **serwera HTTPS działającego stale**, najlepiej z uwierzytelnionym połączeniem do instancji Open Wearables. Nie wystawiaj publicznie panelu administracyjnego bez odpowiednich zabezpieczeń.

Konto Open Wearables utwórz w portalu administratora i tam wygeneruj klucz API. Zgodnie z dokumentacją autoryzuje on żądania nagłówkiem `X-Open-Wearables-API-Key`.

W Supabase → Project Settings → Edge Functions → Secrets dodaj **bez wklejania kluczy do czatu**:

| Nazwa | Przeznaczenie |
|---|---|
| `OW_BASE_URL` | Adres Twojego kontrolowanego serwera z HTTPS, np. `https://wearables.twoja-domena.pl` (bez ścieżki /api) |
| `OW_API_KEY` | Prywatny klucz API z portalu Open Wearables |

Wymagane zmienne `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` dostarcza standardowa konfiguracja Supabase.

Po ustawieniu sekretów endpoint `/functions/v1/healthgo-open-wearables` stanie się gotowy do połączeń. Jeśli instancja jest niedostępna, HealthGo pokaże błąd połączenia, a nie fikcyjne pomiary.

## 3. Uprawnienia producentów

Producent może wymagać zgłoszenia i zatwierdzenia konta deweloperskiego. Open Wearables wspiera OAuth dostawców, ale bez ich kluczy nie może połączyć prawdziwego zegarka. W HealthGo dostępne mogą być np. Garmin, Polar, Suunto, WHOOP, Oura, Strava, Ultrahuman oraz Google Health API, **zależnie od konfiguracji i zgody dostawcy**.

Apple Health i Health Connect wymagają osobnych uprawnień natywnej aplikacji i nie działają przez sam skrót Safari. Xiaomi, Huawei i część innych marek wymagają własnych metod producenta i nie mają gwarantowanej obsługi w Open Wearables.

## 4. Bezpieczny test

1. Na początku testuj na oddzielnym koncie i bez prawdziwych pomiarów zdrowotnych.
2. Sprawdź widoczność nowego ekranu Urządzenia, stan „serwer nieuruchomiony” i brak fałszywego przycisku „Połączono”.
3. Po skonfigurowaniu serwera, kont producentów i OAuth sprawdź połączenie na własnym koncie testowym.
4. Zweryfikuj, że inny użytkownik HealthGo nie widzi konta pierwszego użytkownika.
5. Sprawdź rozłączenie, cofnięcie uprawnień i historię w panelu Open Wearables.
6. Dopiero potem podejmij decyzję o uruchomieniu integracji z rzeczywistymi danymi zdrowotnymi.

## Dokumentacja

- https://github.com/the-momentum/open-wearables
- https://openwearables.io/docs
- https://openwearables.io/docs/quickstart
- https://openwearables.io/oauth

**Terra**: dotychczasowe funkcje Supabase i pliki Terra pozostają w repozytorium w stanie nieaktywnym. Nie wyświetlamy ich w nowym centrum Urządzeń i nie kasujemy nieodwracalnie danych historycznych.
