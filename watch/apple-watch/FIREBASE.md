# Firebase dla Apple Watch

Aplikacja zegarka nie może korzystać z rejestracji webowej HealthGo. Trzeba dodać osobną aplikację Apple do tego samego projektu Firebase.

Proponowany bundle ID:

`com.healthgo.watch`

Po rejestracji pobierz `GoogleService-Info.plist` i dodaj go do targetu watchOS.

Firebase AI Logic oficjalnie obsługuje watchOS. Przy włączonym App Check aplikacja zegarka również musi być zarejestrowana w App Check z dostawcą wspieranym przez watchOS.
