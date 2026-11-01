# HealthGo Family 2.0 — zatwierdzony zakres wdrożenia

Ten dokument opisuje zatwierdzony zakres. Wpisanie funkcji do planu nie oznacza, że są już wdrożone lub działają produkcyjnie.

## Kierunek wizualny
- Całe HealthGo korzysta z jasnego, białego interfejsu.
- Akcenty: zieleń i mięta/turkus; karty z delikatnymi obramowaniami i cieniami.
- Jednolity styl na telefonie, tablecie i komputerze.
- Czytelny, uproszczony widok z większymi przyciskami.

## Moduły Family 2.0

1. **Family Home** — pulpit rodziny, profile, skróty do czatu, kalendarza, zadań, wyzwań i udostępnionych raportów.
2. **Członkowie i role** — rodzic/opiekun, dziecko i członek rodziny; zaproszenia, zatwierdzanie, zarządzanie dostępem i opuszczanie rodziny.
3. **Dołączanie do rodziny** — unikalny kod rodzinny oraz indywidualny link zaproszenia; wygasanie i unieważnianie zaproszeń.
4. **Czat rodzinny** — jeden wspólny czat rodzinny.
5. **Grupy tematyczne** — mniejsze grupy tworzone wewnątrz rodziny, np. Rodzice, Dzieci, Wspólne spacery, Posiłki i Wydarzenia.
6. **Komunikacja** — tekst, zdjęcia, nagrania głosowe, reakcje, odpowiedzi, przypięte wiadomości i powiadomienia.
7. **Panel rodzica** — wyłącznie dane i statystyki udostępnione rodzicowi zgodnie z uprawnieniami.
8. **Aktywność i wyzwania** — dobrowolne cele, kroki i aktywność udostępniona przez członków, wyzwania grupowe, odznaki i nagrody kosmetyczne.
9. **Organizacja** — kalendarz, wydarzenia, przypomnienia, zadania rodzinne, cele rodzinne i ważne daty.
10. **Posiłki** — jadłospisy, przepisy i wspólna lista zakupów.
11. **Rodzinny album** — albumy i zdjęcia ze szczegółową kontrolą dostępu.
12. **Raporty** — dzienne, tygodniowe i miesięczne podsumowania oparte wyłącznie na rzeczywistych, udostępnionych danych.
13. **Family AI** — pomysły na wydarzenia, posiłki i aktywności; asystent korzysta wyłącznie z danych jawnie udostępnionych do tego celu.
14. **Kontakty awaryjne** — zapisane kontakty i informacje pomocne w sytuacji awaryjnej.
15. **Powiadomienia rodzinne** — zaproszenia, wiadomości, wydarzenia, zadania i wyzwania.
16. **Synchronizacja** — synchronizacja uprawnionych danych między urządzeniami.
17. **Dostępność** — uproszczony widok, większe cele dotykowe i czytelne komunikaty.

## Wymagania bezpieczeństwa i prywatności

- Każdy członek widzi wyłącznie dane objęte jego uprawnieniami.
- Dane zdrowotne nie są domyślnie widoczne dla całej rodziny.
- Udostępnianie kroków, aktywności, lokalizacji, zdjęć i raportów wymaga osobnych ustawień/zgód.
- Prywatne rozmowy z AI nie są udostępniane rodzinie ani czytane przez Family AI.
- Dzieci wymagają adekwatnych zabezpieczeń, zgód i ograniczeń zależnych od wieku oraz obowiązujących przepisów.
- Linki i kody zaproszeń są losowe, jednorazowe lub ograniczone czasowo, możliwe do unieważnienia i chronione przed zgadywaniem.
- Czat i grupy muszą mieć członkostwo kontrolowane po stronie serwera, reguły RLS, ochronę przed podszywaniem się i możliwość zgłaszania treści.
- Przed wysłaniem wiadomości, zaproszenia lub zmianą danych użytkownik potwierdza działanie.
- Nie generujemy fikcyjnych statystyk, aktywności ani osiągnięć.

## Kolejność wdrażania

1. Audyt istniejącego Family, Supabase, RLS, kont i uprawnień.
2. Globalny jasny motyw i nowy Family Home.
3. Członkowie, role, kod i link zaproszenia.
4. Kalendarz, zadania, cele i wyzwania.
5. Czat rodzinny i grupy tematyczne — dopiero po wdrożeniu oraz przetestowaniu bezpiecznego backendu i polityk RLS.
6. Album, posiłki, raporty, kontakty awaryjne i powiadomienia.
7. Family AI i synchronizacja.
8. Testy wielokontowe, mobilne, dostępności, prywatności i regresji całej aplikacji.

## Status
- Globalny arkusz jasnego motywu dodany na gałęzi roboczej.
- Pełny zakres Family 2.0 zatwierdzony do realizacji.
- Pozostałe moduły wymagają implementacji i testów; nie należy oznaczać ich jako gotowe, dopóki nie zostaną zweryfikowane.
