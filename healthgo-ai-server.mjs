import http from "node:http";

const PORT = 8787;

// Ollama działa lokalnie na komputerze
const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const MODEL = "qwen3:4b";

const server = http.createServer(async (req, res) => {

  // Pozwala HealthGo połączyć się z serwerem
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // HealthGo wysyła pytania tutaj
  if (req.method !== "POST" || req.url !== "/api/ai") {
    res.writeHead(404, {
      "Content-Type": "application/json; charset=utf-8"
    });

    return res.end(JSON.stringify({
      error: "Nie znaleziono endpointu."
    }));
  }

  try {

    let body = "";

    for await (const chunk of req) {
      body += chunk;
    }

    const data = JSON.parse(body || "{}");
    const message = String(data.message || "").trim();

    if (!message) {
      res.writeHead(400, {
        "Content-Type": "application/json; charset=utf-8"
      });

      return res.end(JSON.stringify({
        error: "Napisz wiadomość."
      }));
    }

    // Wysyłamy pytanie do lokalnej Ollamy
    const response = await fetch(OLLAMA_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        model: MODEL,

        stream: false,

        messages: [

          {
            role: "system",

            content:
              "Jesteś HealthGo AI. " +
              "Odpowiadaj jasno i po polsku, chyba że użytkownik poprosi o inny język. " +
              "Pomagasz w nauce, technologii, programowaniu, grach, " +
              "planowaniu, jedzeniu oraz funkcjach aplikacji HealthGo. " +
              "W sprawach zdrowotnych podawaj tylko ogólne i ostrożne informacje."
          },

          {
            role: "user",
            content: message
          }

        ]

      })

    });

    const result = await response.json();

    if (!response.ok) {

      console.error("Ollama:", result);

      res.writeHead(500, {
        "Content-Type": "application/json; charset=utf-8"
      });

      return res.end(JSON.stringify({
        error: "Lokalne HealthGo AI chwilowo nie może odpowiedzieć."
      }));

    }

    const answer = result?.message?.content?.trim();

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8"
    });

    return res.end(JSON.stringify({
      answer:
        answer ||
        "Nie udało mi się przygotować odpowiedzi."
    }));

  } catch (error) {

    console.error("Błąd HealthGo AI:", error);

    res.writeHead(500, {
      "Content-Type": "application/json; charset=utf-8"
    });

    return res.end(JSON.stringify({
      error:
        "Nie udało się połączyć z lokalnym AI. Sprawdź, czy Ollama jest uruchomiona."
    }));

  }

});

server.listen(PORT, "127.0.0.1", () => {

  console.log("");
  console.log("💙 HealthGo AI uruchomione lokalnie!");
  console.log("🤖 Model: qwen3:4b");
  console.log(`🌐 Serwer: http://127.0.0.1:${PORT}`);
  console.log("🔒 AI działa lokalnie przez Ollama.");
  console.log("");

});