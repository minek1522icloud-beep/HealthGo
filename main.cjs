const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  session,
  shell
} = require("electron");

const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");
const {
  isHealthGoOrigin,
  isAllowedAuthPopupUrl,
  secureWebPreferences,
  guardMainNavigation
} = require("./desktop-security.cjs");

// ========================================
// HEALTHGO
// ========================================

app.setAppUserModelId("com.healthgo.app");

let mainWindow = null;
const desktopOAuth = require('./desktop-oauth.cjs').createDesktopOAuth(
  url => shell.openExternal(url), () => mainWindow
);
let webServer = null;
let aiServer = null;
let ollamaProcess = null;
let ollamaStartingPromise = null;
let updateIsInstalling = false;

const PORT = 5500;

// ========================================
// ŚCIEŻKI
// ========================================

function getAppRoot() {
  return app.getAppPath();
}

function getWwwPath() {
  return path.join(
    getAppRoot(),
    "www"
  );
}

function getIconPath() {
  const ico = path.join(
    getAppRoot(),
    "icon.ico"
  );

  if (fs.existsSync(ico)) {
    return ico;
  }

  return path.join(
    getAppRoot(),
    "icon.png"
  );
}

function getUpdateMarkerPath() {
  return path.join(
    app.getPath("userData"),
    "healthgo-update.json"
  );
}

// ========================================
// INFORMACJA PO AKTUALIZACJI
// ========================================

function saveUpdateMarker(version) {
  try {
    fs.writeFileSync(
      getUpdateMarkerPath(),
      JSON.stringify(
        {
          version: version
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    console.error(
      "Nie udało się zapisać informacji o aktualizacji:",
      error
    );
  }
}

function checkUpdateMarker() {
  try {
    const markerPath =
      getUpdateMarkerPath();

    if (!fs.existsSync(markerPath)) {
      return false;
    }

    const data = JSON.parse(
      fs.readFileSync(
        markerPath,
        "utf8"
      )
    );

    if (
      data &&
      data.version === app.getVersion()
    ) {
      try {
        fs.unlinkSync(markerPath);
      } catch (_) {}

      return true;
    }

    return false;
  } catch (error) {
    console.error(
      "Błąd odczytu informacji o aktualizacji:",
      error
    );

    return false;
  }
}

// ========================================
// TYPY PLIKÓW
// ========================================

function getContentType(filePath) {
  const ext =
    path.extname(filePath).toLowerCase();

  const types = {
    ".html":
      "text/html; charset=utf-8",

    ".css":
      "text/css; charset=utf-8",

    ".js":
      "text/javascript; charset=utf-8",

    ".mjs":
      "text/javascript; charset=utf-8",

    ".json":
      "application/json; charset=utf-8",

    ".png":
      "image/png",

    ".jpg":
      "image/jpeg",

    ".jpeg":
      "image/jpeg",

    ".gif":
      "image/gif",

    ".svg":
      "image/svg+xml",

    ".ico":
      "image/x-icon",

    ".webp":
      "image/webp",

    ".woff":
      "font/woff",

    ".woff2":
      "font/woff2"
  };

  return (
    types[ext] ||
    "application/octet-stream"
  );
}

// ========================================
// SERWER WWW
// ========================================

function startWebServer() {
  return new Promise(
    (resolve, reject) => {
      const wwwPath =
        getWwwPath();

      const indexPath =
        path.join(
          wwwPath,
          "index.html"
        );

      console.log(
        "HealthGo WWW:",
        wwwPath
      );

      console.log(
        "HealthGo INDEX:",
        indexPath
      );

      if (!fs.existsSync(wwwPath)) {
        reject(
          new Error(
            "Nie znaleziono folderu WWW: " +
              wwwPath
          )
        );

        return;
      }

      if (!fs.existsSync(indexPath)) {
        reject(
          new Error(
            "Nie znaleziono pliku index.html: " +
              indexPath
          )
        );

        return;
      }

      webServer =
        http.createServer(
          (req, res) => {
            try {
              const requestUrl =
                new URL(
                  req.url,
                  `http://127.0.0.1:${PORT}`
                );

              const tileMatch = requestUrl.pathname.match(/^\/map-tiles\/(\d+)\/(\d+)\/(\d+)\.png$/);
              if (tileMatch && req.method === 'GET') {
                const [, z, x, y] = tileMatch;
                const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
                fetch(tileUrl, {headers:{'User-Agent':'HealthGo/1.0 (desktop map)'}})
                  .then(async (upstream) => {
                    if (!upstream.ok) throw new Error('OSM_TILE_'+upstream.status);
                    const data = Buffer.from(await upstream.arrayBuffer());
                    res.writeHead(200, {'Content-Type':'image/png','Cache-Control':'public, max-age=86400'});
                    res.end(data);
                  })
                  .catch((error) => {
                    console.error('HealthGo map tile:', error.message);
                    if (!res.headersSent) res.writeHead(502, {'Content-Type':'text/plain; charset=utf-8'});
                    res.end('Map tile unavailable');
                  });
                return;
              }

              if (requestUrl.pathname === '/auth/callback') {
                const ok = req.method === 'GET' && desktopOAuth.callback(requestUrl);
                res.writeHead(ok ? 200 : 400, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
                res.end(ok ? 'Wróć do HealthGo. Możesz zamknąć tę kartę.' : 'Ta próba logowania wygasła. Rozpocznij ponownie w HealthGo.');
                return;
              }
              let pathname =
                decodeURIComponent(
                  requestUrl.pathname
                );

              if (
                pathname === "/" ||
                pathname === ""
              ) {
                pathname =
                  "/index.html";
              }

              pathname =
                pathname.replace(
                  /^\/+/,
                  ""
                );

              let requestedFile =
                path.resolve(
                  wwwPath,
                  pathname
                );

              const safeWwwPath =
                path.resolve(
                  wwwPath
                ) + path.sep;

              if (
                requestedFile !==
                  path.resolve(
                    indexPath
                  ) &&
                !requestedFile.startsWith(
                  safeWwwPath
                )
              ) {
                res.writeHead(
                  403,
                  {
                    "Content-Type":
                      "text/plain; charset=utf-8"
                  }
                );

                res.end("403");

                return;
              }

              if (
                fs.existsSync(
                  requestedFile
                ) &&
                fs
                  .statSync(
                    requestedFile
                  )
                  .isDirectory()
              ) {
                requestedFile =
                  path.join(
                    requestedFile,
                    "index.html"
                  );
              }

              if (
                !fs.existsSync(
                  requestedFile
                )
              ) {
                res.writeHead(
                  404,
                  {
                    "Content-Type":
                      "text/plain; charset=utf-8"
                  }
                );

                res.end("404");

                return;
              }

              fs.readFile(
                requestedFile,
                (error, data) => {
                  if (error) {
                    res.writeHead(
                      500,
                      {
                        "Content-Type":
                          "text/plain; charset=utf-8"
                      }
                    );

                    res.end(
                      "500 - Blad odczytu pliku"
                    );

                    return;
                  }

                  res.writeHead(
                    200,
                    {
                      "Content-Type":
                        getContentType(
                          requestedFile
                        ),

                      "Cache-Control":
                        "no-store, no-cache, must-revalidate"
                    }
                  );

                  res.end(data);
                }
              );
            } catch (error) {
              console.error(error);

              res.writeHead(
                500,
                {
                  "Content-Type":
                    "text/plain; charset=utf-8"
                }
              );

              res.end("500");
            }
          }
        );

      webServer.on(
        "error",
        reject
      );

      webServer.listen(
        PORT,
        "127.0.0.1",
        () => {
          console.log(
            `HealthGo działa: http://127.0.0.1:${PORT}`
          );

          resolve();
        }
      );
    }
  );
}

// ========================================
// HEALTHGO AI
// ========================================

const AI_PORT = 8787;
const OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.HEALTHGO_OLLAMA_MODEL || "qwen3:4b";
let activeOllamaModel = OLLAMA_MODEL;

function sleep(ms) {
  return new Promise(
    (resolve) => setTimeout(resolve, ms)
  );
}

async function chooseOllamaModel() {
  try {
    const response = await fetch(OLLAMA_BASE_URL + "/api/tags");
    if (!response.ok) return OLLAMA_MODEL;
    const data = await response.json();
    const names = Array.isArray(data.models) ? data.models.map(m => String(m.name || m.model || '')).filter(Boolean) : [];
    const exact = names.find(n => n === OLLAMA_MODEL);
    if (exact) return exact;
    const preferred = names.find(n => /^qwen/i.test(n)) || names.find(n => /llama|gemma|mistral|phi/i.test(n)) || names[0];
    return preferred || OLLAMA_MODEL;
  } catch (_) {
    return OLLAMA_MODEL;
  }
}

async function isOllamaRunning() {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    1800
  );

  try {
    const response = await fetch(
      OLLAMA_BASE_URL + "/api/tags",
      {
        signal: controller.signal
      }
    );

    return response.ok;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function findOllamaExecutable() {
  const candidates = [
    process.env.LOCALAPPDATA
      ? path.join(
          process.env.LOCALAPPDATA,
          "Programs",
          "Ollama",
          "ollama.exe"
        )
      : null,

    process.env.LOCALAPPDATA
      ? path.join(
          process.env.LOCALAPPDATA,
          "Ollama",
          "ollama.exe"
        )
      : null,

    process.env.USERPROFILE
      ? path.join(
          process.env.USERPROFILE,
          "AppData",
          "Local",
          "Programs",
          "Ollama",
          "ollama.exe"
        )
      : null,

    process.env.ProgramFiles
      ? path.join(
          process.env.ProgramFiles,
          "Ollama",
          "ollama.exe"
        )
      : null
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log(
        "HealthGo AI: znaleziono Ollamę:",
        candidate
      );

      return candidate;
    }
  }

  console.log(
    "HealthGo AI: nie znaleziono stałej ścieżki Ollamy, próbuję PATH."
  );

  return "ollama";
}

async function startOllamaOnce() {
  if (await isOllamaRunning()) {
    return true;
  }

  const executable =
    findOllamaExecutable();

  try {
    const child = spawn(
      executable,
      ["serve"],
      {
        windowsHide: true,
        stdio: "ignore",
        detached: false
      }
    );

    ollamaProcess = child;

    child.on(
      "error",
      (error) => {
        console.error(
          "HealthGo AI - błąd procesu Ollama:",
          error
        );
      }
    );

    child.on(
      "exit",
      (code) => {
        console.log(
          "HealthGo AI: proces Ollama zakończył się kodem:",
          code
        );

        if (ollamaProcess === child) {
          ollamaProcess = null;
        }
      }
    );
  } catch (error) {
    console.error(
      "HealthGo AI - nie udało się uruchomić Ollamy:",
      error
    );

    return false;
  }

  for (let i = 0; i < 40; i += 1) {
    await sleep(500);

    if (await isOllamaRunning()) {
      console.log(
        "HealthGo AI: Ollama działa."
      );

      return true;
    }
  }

  console.warn(
    "HealthGo AI: Ollama nie uruchomiła API w wymaganym czasie."
  );

  return false;
}

async function ensureOllamaRunning() {
  if (await isOllamaRunning()) {
    return true;
  }

  if (!ollamaStartingPromise) {
    ollamaStartingPromise =
      startOllamaOnce()
        .finally(
          () => {
            ollamaStartingPromise = null;
          }
        );
  }

  return await ollamaStartingPromise;
}

function configureHealthGoPermissions() {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const origin =
        details?.requestingUrl ||
        webContents?.getURL?.() ||
        "";

      callback(
        permission === "geolocation" &&
        isHealthGoOrigin(origin)
      );
    }
  );

  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) => {
      const origin =
        requestingOrigin ||
        webContents?.getURL?.() ||
        "";

      return (
        permission === "geolocation" &&
        isHealthGoOrigin(origin)
      );
    }
  );
}

function aiWriteJson(
  res,
  status,
  data,
  origin
) {
  if (
    origin === "http://127.0.0.1:5500" ||
    origin === "http://localhost:5500"
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
  }

  res.setHeader(
    "Vary",
    "Origin"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.writeHead(
    status,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Cache-Control":
        "no-store"
    }
  );

  res.end(
    JSON.stringify(data)
  );
}

async function readAiBody(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;

    if (body.length > 12_000_000) {
      throw new Error(
        "BODY_TOO_LARGE"
      );
    }
  }

  return JSON.parse(
    body || "{}"
  );
}

async function askLocalOllama(data) {
  const ready =
    await ensureOllamaRunning();

  activeOllamaModel = await chooseOllamaModel();

  if (!ready) {
    throw new Error(
      "OLLAMA_NOT_RUNNING"
    );
  }

  const message =
    String(
      data.message || ""
    ).trim();

  if (!message) {
    throw new Error(
      "EMPTY_MESSAGE"
    );
  }

  const history =
    Array.isArray(data.history)
      ? data.history
          .slice(-12)
          .filter(
            (item) =>
              item &&
              (
                item.role === "user" ||
                item.role === "assistant"
              ) &&
              typeof item.content === "string"
          )
          .map(
            (item) => ({
              role: item.role,
              content:
                item.content.slice(
                  0,
                  4000
                )
            })
          )
      : [];

  const imageNote =
    data.image
      ? "\n\nUżytkownik dołączył obraz. Ten model tekstowy nie widzi obrazu. Powiedz to wprost i nie zgaduj, co jest na zdjęciu."
      : "";

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      120000
    );

  try {
    const response =
      await fetch(
        OLLAMA_BASE_URL +
          "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          signal:
            controller.signal,

          body:
            JSON.stringify(
              {
                model:
                  activeOllamaModel,

                stream:
                  false,

                messages: [
                  {
                    role:
                      "system",

                    content:
                      "Jesteś HealthGo AI. " +
                      "Odpowiadaj jasno i po polsku, chyba że użytkownik poprosi o inny język. " +
                      "Pomagasz w nauce, technologii, programowaniu, grach, planowaniu i funkcjach HealthGo. " +
                      "Nie udawaj, że widzisz dane lub obrazy, których model nie otrzymał. " +
                      "W sprawach zdrowotnych podawaj wyłącznie ogólne, ostrożne informacje."
                  },

                  ...history,

                  {
                    role:
                      "user",

                    content:
                      message +
                      imageNote
                  }
                ]
              }
            )
        }
      );

    const result =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      const error =
        new Error(
          result?.error ||
          "OLLAMA_REQUEST_FAILED"
        );

      error.status =
        response.status;

      throw error;
    }

    const answer =
      result?.message?.content?.trim();

    if (!answer) {
      throw new Error(
        "EMPTY_OLLAMA_ANSWER"
      );
    }

    return answer;
  } finally {
    clearTimeout(timeout);
  }
}

function startAIServer() {
  return new Promise(
    (resolve, reject) => {
      aiServer =
        http.createServer(
          async (req, res) => {
            const origin =
              String(
                req.headers.origin ||
                ""
              );

            if (
              origin ===
                "http://127.0.0.1:5500" ||
              origin ===
                "http://localhost:5500"
            ) {
              res.setHeader(
                "Access-Control-Allow-Origin",
                origin
              );
            }

            res.setHeader(
              "Vary",
              "Origin"
            );

            res.setHeader(
              "Access-Control-Allow-Headers",
              "Content-Type"
            );

            res.setHeader(
              "Access-Control-Allow-Methods",
              "GET, POST, OPTIONS"
            );

            if (
              req.method ===
              "OPTIONS"
            ) {
              res.writeHead(204);
              res.end();
              return;
            }

            if (
              req.method ===
                "GET" &&
              req.url ===
                "/api/health"
            ) {
              const ollama =
                await isOllamaRunning();

              aiWriteJson(
                res,
                200,
                {
                  ok: true,
                  bridge: true,
                  ollama,
                  model:
                    activeOllamaModel
                },
                origin
              );

              return;
            }

            if (
              req.method !==
                "POST" ||
              req.url !==
                "/api/ai"
            ) {
              aiWriteJson(
                res,
                404,
                {
                  error:
                    "Nie znaleziono endpointu."
                },
                origin
              );

              return;
            }

            try {
              const data =
                await readAiBody(
                  req
                );

              const answer =
                await askLocalOllama(
                  data
                );

              aiWriteJson(
                res,
                200,
                {
                  answer
                },
                origin
              );
            } catch (error) {
              console.error(
                "HealthGo AI request:",
                error
              );

              let status = 503;
              let message =
                "Nie udało się połączyć z lokalnym HealthGo AI.";

              if (
                error?.message ===
                "EMPTY_MESSAGE"
              ) {
                status = 400;
                message =
                  "Napisz wiadomość.";
              } else if (
                error?.message ===
                "BODY_TOO_LARGE"
              ) {
                status = 413;
                message =
                  "Wiadomość jest za duża.";
              } else if (
                error?.name ===
                "AbortError"
              ) {
                status = 504;
                message =
                  "Model AI nie odpowiedział na czas.";
              } else if (
                error?.status ===
                404
              ) {
                message =
                  "Wybrany model AI nie jest dostępny w Ollamie.";
              }

              aiWriteJson(
                res,
                status,
                {
                  error: message
                },
                origin
              );
            }
          }
        );

      aiServer.once(
        "error",
        (error) => {
          console.error(
            "HealthGo AI server:",
            error
          );

          reject(error);
        }
      );

      aiServer.listen(
        AI_PORT,
        "127.0.0.1",
        () => {
          console.log(
            "HealthGo AI bridge działa: http://127.0.0.1:" +
            AI_PORT
          );

          resolve();
        }
      );
    }
  );
}

// ========================================
// AUTOMATYCZNE AKTUALIZACJE
// ========================================

function setupAutoUpdater() {
  // Podczas "npm start"
  // aktualizator nie jest uruchamiany.
  if (!app.isPackaged) {
    console.log(
      "HealthGo Update: tryb developerski - pomijam."
    );

    return;
  }

  // Ustawiamy źródło aktualizacji jawnie, żeby zainstalowane
  // HealthGo nie zależało wyłącznie od wygenerowanego app-update.yml.
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "minek1522icloud-beep",
    repo: "HealthGo"
  });

  autoUpdater.autoDownload =
    true;

  autoUpdater.autoInstallOnAppQuit =
    true;

  autoUpdater.on(
    "checking-for-update",
    () => {
      console.log(
        "HealthGo Update: sprawdzanie aktualizacji..."
      );
    }
  );

  autoUpdater.on(
    "update-available",
    (info) => {
      console.log(
        "HealthGo Update: dostępna wersja:",
        info.version
      );
    }
  );

  autoUpdater.on(
    "update-not-available",
    (info) => {
      console.log(
        "HealthGo Update: aplikacja jest aktualna:",
        info.version
      );
    }
  );

  autoUpdater.on(
    "download-progress",
    (progress) => {
      console.log(
        "HealthGo Update: pobieranie:",
        Math.round(
          progress.percent
        ) + "%"
      );
    }
  );

  autoUpdater.on(
    "error",
    (error) => {
      console.error(
        "HealthGo Update - błąd:",
        error
      );
    }
  );

  autoUpdater.on(
    "update-downloaded",
    (info) => {
      if (updateIsInstalling) {
        return;
      }

      updateIsInstalling =
        true;

      console.log(
        "HealthGo Update: pobrano wersję:",
        info.version
      );

      saveUpdateMarker(
        info.version
      );

      // Bez pytania użytkownika: po pobraniu instalujemy
      // aktualizację od razu i ponownie uruchamiamy HealthGo.
      setTimeout(
        () => {
          autoUpdater
            .quitAndInstall(
              false,
              true
            );
        },
        300
      );
    }
  );

  // Sprawdzamy aktualizację od razu po uruchomieniu aplikacji.
  autoUpdater
    .checkForUpdates()
    .catch(
      (error) => {
        console.error(
          "HealthGo Update - nie udało się sprawdzić aktualizacji:",
          error
        );
      }
    );
}

// ========================================
// OKNO HEALTHGO
// ========================================

function createWindow(
  showUpdatedMessage
) {
  Menu.setApplicationMenu(
    null
  );

  mainWindow =
    new BrowserWindow({
      width: 1500,
      height: 950,

      minWidth: 900,
      minHeight: 650,

      icon:
        getIconPath(),

      frame: false,

      autoHideMenuBar:
        true,

      backgroundColor:
        "#07111f",

      show: false,

      webPreferences:
        secureWebPreferences()
    });

  mainWindow.setMenu(
    null
  );

  // ========================================
  // GOOGLE LOGIN
  // ========================================

  mainWindow
    .webContents
    .setWindowOpenHandler(
      ({ url }) => {
        if (desktopOAuth.launch(url)) return { action: 'deny' };
        const allowed =
          isAllowedAuthPopupUrl(
            url
          );

        if (!allowed) {
          return {
            action: "deny"
          };
        }

        return {
          action: "allow",

          overrideBrowserWindowOptions:
            {
              width: 520,
              height: 720,

              minWidth: 420,
              minHeight: 600,

              parent:
                mainWindow,

              modal: true,

              icon:
                getIconPath(),

              autoHideMenuBar:
                true,

              backgroundColor:
                "#ffffff",

              webPreferences:
                secureWebPreferences()
            }
        };
      }
    );

  // ========================================
  // USUNIĘCIE MENU Z GOOGLE LOGIN
  // ========================================

  mainWindow
    .webContents
    .on(
      "did-create-window",
      (childWindow) => {
        childWindow.setMenu(
          null
        );

        childWindow
          .setAutoHideMenuBar(
            true
          );

        childWindow
          .setMenuBarVisibility(
            false
          );
      }
    );

  // Nie pozwalamy głównemu oknu przejść na obcą stronę.
  guardMainNavigation(
    mainWindow.webContents
  );

  // ========================================
  // OTWARCIE HEALTHGO
  // ========================================

  mainWindow.loadURL(
    `http://127.0.0.1:${PORT}/index.html`
  );

  mainWindow.once(
    "ready-to-show",
    () => {
      mainWindow.maximize();

      mainWindow.show();

      // Po ponownym uruchomieniu
      // pokazujemy potwierdzenie.
      if (
        showUpdatedMessage
      ) {
        setTimeout(
          () => {
            if (
              mainWindow &&
              !mainWindow.isDestroyed()
            ) {
              dialog.showMessageBox(
                mainWindow,
                {
                  type:
                    "info",

                  title:
                    "HealthGo",

                  message:
                    "Aktualizacja zakończona",

                  detail:
                    `HealthGo został zaktualizowany do wersji ${app.getVersion()}.`,

                  buttons: [
                    "OK"
                  ],

                  defaultId:
                    0,

                  noLink:
                    true
                }
              );
            }
          },
          1200
        );
      }
    }
  );

  mainWindow.on(
    "closed",
    () => {
      mainWindow =
        null;
    }
  );
}

// ========================================
// START HEALTHGO
// ========================================

app.whenReady().then(
  async () => {
    try {
      const showUpdatedMessage =
        checkUpdateMarker();

      await startWebServer();

      configureHealthGoPermissions();

      await startAIServer();

      ensureOllamaRunning()
        .catch(
          (error) => {
            console.error(
              "HealthGo AI - uruchamianie Ollamy w tle:",
              error
            );
          }
        );

      createWindow(
        showUpdatedMessage
      );

      setupAutoUpdater();
    } catch (error) {
      console.error(
        "HealthGo nie wystartował:",
        error
      );

      app.quit();
    }
  }
);

// ========================================
// ZAMYKANIE
// ========================================

app.on(
  "window-all-closed",
  () => {
    if (aiServer) {
      try {
        aiServer.close();
      } catch (_) {}
    }

    if (webServer) {
      try {
        webServer.close();
      } catch (_) {}
    }

    if (ollamaProcess) {
      try {
        ollamaProcess.kill();
      } catch (_) {}
    }

    if (
      process.platform !==
      "darwin"
    ) {
      app.quit();
    }
  }
);
