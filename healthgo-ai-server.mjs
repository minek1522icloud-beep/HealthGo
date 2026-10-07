import http from "node:http";

const PORT = 8787;
const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const MODEL = "qwen3:4b";

function json(res, status, body, origin = "") {
  if (
    origin === "http://127.0.0.1:5500" ||
    origin === "http://localhost:5500"
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const origin = String(req.headers.origin || "");

  if (
    origin === "http://127.0.0.1:5500" ||
    origin === "http://localhost:5500"
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && req.url === "/api/health") {
    return json(res, 200, {
      ok: true,
      model: MODEL
    }, origin);
  }

  if (req.method !== "POST" || req.url !== "/api/ai") {
    return json(res, 404, {
      error: "Nie znaleziono endpointu."
    }, origin);
  }

  try {
    let body = "";

    for await (const chunk of req) {
      body += chunk;

      if (body.length > 12_000_000) {
        return json(res, 413, {
          error: "Wiadomość jest za duża."
        }, origin);
      }
    }

    const data = JSON.parse(body || "{}");
    const message = String(data.message || "").trim();
    const responseMode = ["average", "medium", "high"].includes(String(data.responseMode || ""))
      ? String(data.responseMode)
      : "average";
    const responseProfile = {
      average: {
        history: 6,
        maxTokens: 220,
        timeoutMs: 55_000,
        instruction: "Odpowiadaj krótko i konkretnie. Zwykle 2–5 zdań. Priorytetem jest szybka odpowiedź bez zbędnego rozwijania."
      },
      medium: {
        history: 10,
        maxTokens: 420,
        timeoutMs: 85_000,
        instruction: "Odpowiadaj z umiarkowaną ilością szczegółów. Wyjaśnij najważniejsze powody i kroki, ale unikaj niepotrzebnego rozwlekania."
      },
      high: {
        history: 12,
        maxTokens: 760,
        timeoutMs: 120_000,
        instruction: "Odpowiadaj dokładniej i bardziej szczegółowo. Sprawdź założenia, wyjaśnij istotne kroki i uwzględnij ważne zastrzeżenia."
      }
    }[responseMode];

    if (!message) {
      return json(res, 400, {
        error: "Napisz wiadomość."
      }, origin);
    }

    const history = Array.isArray(data.history)
      ? data.history
          .slice(-responseProfile.history)
          .filter(
            (item) =>
              item &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string"
          )
          .map((item) => ({
            role: item.role,
            content: item.content.slice(0, 4000)
          }))
      : [];

    const imageNote = data.image
      ? "\n\nUżytkownik dołączył obraz. Ten lokalny model tekstowy nie widzi obrazu, więc powiedz to wprost i poproś o opis zdjęcia zamiast zgadywać."
      : "";

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      responseProfile.timeoutMs
    );

    let response;

    try {
      response = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          stream: false,
          options: {
            num_predict: responseProfile.maxTokens
          },
          messages: [
            {
              role: "system",
              content:
                "Jesteś HealthGo AI. " +
                "Odpowiadaj jasno i po polsku, chyba że użytkownik poprosi o inny język. " +
                "Pomagasz w nauce, technologii, programowaniu, grach, planowaniu i funkcjach HealthGo. " +
                "Nie udawaj, że widzisz dane lub obrazy, których model nie otrzymał. " +
                "W sprawach zdrowotnych podawaj wyłącznie ogólne, ostrożne informacje i zachęcaj do kontaktu z zaufaną osobą dorosłą lub specjalistą, gdy sytuacja tego wymaga. " +
                responseProfile.instruction
            },
            ...history,
            {
              role: "user",
              content: message + imageNote
            }
          ]
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Ollama:", result);

      return json(res, 502, {
        error:
          "Lokalne HealthGo AI chwilowo nie może odpowiedzieć."
      }, origin);
    }

    const answer =
      result?.message?.content?.trim();

    return json(res, 200, {
      answer:
        answer ||
        "Nie udało mi się przygotować odpowiedzi."
    }, origin);
  } catch (error) {
    console.error("Błąd HealthGo AI:", error);

    const message =
      error?.name === "AbortError"
        ? "Lokalny model AI nie odpowiedział na czas."
        : "Nie udało się połączyć z lokalnym AI.";

    return json(res, 503, {
      error: message
    }, origin);
  }
});

server.on("error", (error) => {
  console.error("HealthGo AI server:", error);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("❤️ HealthGo AI uruchomione lokalnie!");
  console.log("🤖 Model:", MODEL);
  console.log("🌐 Serwer: http://127.0.0.1:" + PORT);
  console.log("🔒 AI działa lokalnie przez Ollama.");
  console.log("");
});
