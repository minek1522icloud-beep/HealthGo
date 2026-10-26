# HealthGo Family 2.0 — specyfikacja funkcji

Ten dokument opisuje zakres do wdrożenia. Nie jest potwierdzeniem, że wszystkie wymienione elementy już działają.

## Główne obszary

1. **Pulpit rodziny** — profile, zaproszenia, skrót do kalendarza, wyzwań i udostępnionych raportów.
2. **Członkowie i uprawnienia** — role, zaproszenia kodem, usuwanie członka, cofanie dostępu i jasne zgody na udostępnianie.
3. **Aktywność i wyzwania** — dobrowolne cele, wyzwania grupowe, odznaki i nagrody kosmetyczne; bez kar za brak aktywności i bez rankingów oceniających zdrowie.
4. **Organizacja** — kalendarz, wydarzenia, przypomnienia, plany posiłków i wspólna lista zakupów.
5. **Komunikacja** — ogłoszenia i rodzinny czat, jeżeli obsłuży je bezpieczny backend.
6. **Wspomnienia** — albumy i historia wspólnych wydarzeń z kontrolą dostępu.
7. **Pomoc** — apteczka informacyjna, kontakty awaryjne i planowanie wycieczek.
8. **Dostosowanie interfejsu** — uproszczony widok z większymi przyciskami i mniejszą liczbą elementów.
9. **AI Rodziny** — pomysły na wydarzenia, posiłki i aktywności; AI korzysta wyłącznie z danych udostępnionych do tego celu.
10. **Motywy sezonowe** — Halloween, święta, Wielkanoc i lato.

## Wymagania bezpieczeństwa

- Każdy członek widzi tylko informacje dozwolone przez uprawnienia i udostępnienie.
- Dane zdrowotne nie są automatycznie widoczne dla całej rodziny.
- Dziecko powinno mieć odpowiednie zabezpieczenia i ustawienia zależne od wieku.
- Przed wysłaniem zaproszenia, wiadomości lub zmianą danych użytkownik potwierdza działanie.
- Każdy stan i wynik musi wynikać z rzeczywistych danych; nie generujemy fikcyjnych statystyk.
- Funkcje czatu, synchronizacji, powiadomień i współdzielonych danych wymagają weryfikacji backendu oraz testów uprawnień.

## Kolejność wdrażania

1. Zweryfikować obecny model danych i istniejące funkcje rodziny.
2. Uporządkować pulpit i stany puste/błędów.
3. Uzupełnić profile, zaproszenia i role.
4. Dodać kalendarz oraz wyzwania.
5. Dodać komunikację, listy i wspomnienia tylko po sprawdzeniu backendu.
6. Przetestować uprawnienia i widoczność danych między kontami.
