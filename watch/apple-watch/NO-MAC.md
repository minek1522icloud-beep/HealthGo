# HealthGo na Apple Watch bez własnego Maca

Repozytorium potrafi teraz budować aplikację watchOS na macOS w GitHub Actions.

Workflow:

`.github/workflows/apple-watch-build.yml`

generuje projekt Xcode z `project.yml`, pobiera Firebase Apple SDK i kompiluje wersję dla symulatora Apple Watch.

## Co daje ten build

- sprawdza, czy kod watchOS się kompiluje,
- tworzy gotową aplikację dla symulatora,
- zapisuje ZIP jako artifact GitHub Actions.

## Prawdziwy Apple Watch

Do instalacji na fizycznym Apple Watch aplikacja musi być podpisana przez Apple. Bez własnego Maca praktyczną drogą jest dystrybucja przez TestFlight/App Store Connect albo podpisany build dla zarejestrowanego urządzenia.

Do tego potrzebne są dane Apple Developer / App Store Connect i osobna aplikacja Apple w Firebase dla bundle ID:

`com.healthgo.watch`

Po dodaniu tej aplikacji do Firebase trzeba pobrać `GoogleService-Info.plist` i dodać go do tego katalogu.

Nie zapisuj w repozytorium prywatnych kluczy Apple, certyfikatów ani plików .p8.
