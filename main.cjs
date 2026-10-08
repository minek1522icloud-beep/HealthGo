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
const { normalizeLocalAIResponse } = require("./local-ai-response.cjs");
const { RECOMMENDED_MODEL, chooseConversationModel } = require("./desktop-ai-models.cjs");
const { createAutomaticUpdateChecks } = require("./desktop-update-scheduler.cjs");
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
let updateIsDownloading = false;
let updateChecks = null;

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

              if (requestUrl.pathname === '/api/ai/status' && req.method === 'GET') {
                (async () => {
                  try {
                    const ready = await isOllamaRunning();
                    let models = [];
                    if (ready) {
                      const controller = new AbortController();
                      const timer = setTimeout(() => controller.abort(), 2500);
                      try {
                        const response = await fetch(OLLAMA_BASE_URL + '/api/tags', {signal:controller.signal});
                        if (response.ok) {
                          const tags = await response.json();
                          models = Array.isArray(tags.models)
                            ? tags.models.map(m => String(m.name || m.model || '')).filter(Boolean)
                            : [];
                        }
                      } catch (_) {} finally { clearTimeout(timer); }
                    }
                    aiWriteJson(res, 200, {
                      desktop: true,
                      version: app.getVersion(),
                      localAvailable: ready,
                      installedModels: models.length,
                      localModel: chooseConversationModel(models,OLLAMA_MODEL),
                      recommendedModel: RECOMMENDED_MODEL,
                      modelReady: !!chooseConversationModel(models,OLLAMA_MODEL),
                      modelDownload: {...modelDownload}
                    }, '');
                  } catch (_) {
                    aiWriteJson(res, 200, {desktop:true,version:app.getVersion(),localAvailable:false,installedModels:0,localModel:null,
                      recommendedModel:RECOMMENDED_MODEL,modelReady:false,modelDownload:{...modelDownload}}, '');
                  }
                })();
                return;
              }

              if (requestUrl.pathname === '/api/ai/install-model' && req.method === 'POST') {
                // Never allow a third-party page to silently trigger a multi-GB download.
                const allowedOrigin=['http://127.0.0.1:5500','http://localhost:5500'].includes(String(req.headers.origin||''));
                if(!allowedOrigin){
                  aiWriteJson(res,403,{error:'Brak autoryzacji do pobrania modelu.'},'');
                  return;
                }
                if(modelDownload.active){
                  aiWriteJson(res,202,{started:true,model:RECOMMENDED_MODEL},'');
                  return;
                }
                void pullRecommendedModel();
                aiWriteJson(res,202,{started:true,model:RECOMMENDED_MODEL},'');
                return;
              }

              if (requestUrl.pathname === '/api/ai' && req.method === 'POST') {
                (async () => {
                  try {
                    const data = await readAiBody(req);
                    const answer = await askLocalOllama(data);
                    aiWriteJson(res, 200, {answer}, '');
                  } catch (error) {
                    console.error('HealthGo AI same-origin:', error);
                    let status = 503;
                    let code = 'LOCAL_ERROR';
                    let message = 'Lokalne HealthGo AI jest niedostępne.';
                    if (error?.message === 'OLLAMA_NOT_RUNNING') {
                      code = 'OLLAMA_NOT_RUNNING';
                      message = 'Program Ollama nie jest uruchomiony lub zainstalowany.';
                    } else if (error?.message === 'OLLAMA_NO_MODELS' || error?.message === 'OLLAMA_INSTRUCT_REQUIRED') {
                      code = 'OLLAMA_INSTRUCT_REQUIRED';
                      message = 'Lokalne AI wymaga modelu do zwykłych rozmów. Zainstaluj Qwen3 4B Instruct (około 2,5 GB).';
                    } else if (error?.status === 404) {
                      code = 'OLLAMA_MODEL_MISSING';
                      message = 'Wybrany model AI nie jest dostępny w Ollamie.';
                    } else if (error?.message === 'OLLAMA_EMPTY_RESPONSE') {
                      code = 'OLLAMA_EMPTY_RESPONSE';
                      message = 'Model AI zakończył generowanie bez treści odpowiedzi.';
                    } else if (error?.message === 'OLLAMA_DRAFT_RESPONSE') {
                      code = 'OLLAMA_DRAFT_RESPONSE';
                      message = 'Model zwrócił roboczy tekst zamiast gotowej odpowiedzi.';
                    } else if (error?.status >= 500) {
                      code = 'OLLAMA_SERVER_ERROR';
                      message = 'Silnik Ollama zgłosił błąd przetwarzania modelu.';
                    } else if (error?.name === 'AbortError') {
                      status = 504;
                      code = 'LOCAL_TIMEOUT';
                      message = 'Lokalny model AI nie odpowiedział na czas.';
                    }
                    aiWriteJson(res, status, {error: message, code}, '');
                  }
                })();
                return;
              }

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
const OLLAMA_MODEL = process.env.HEALTHGO_OLLAMA_MODEL || RECOMMENDED_MODEL;
const modelDownload={active:false,status:'',percent:0,error:'',success:false};
let modelDownloadTask=null;
let activeOllamaModel = OLLAMA_MODEL;

function sleep(ms) {
  return new Promise(
    (resolve) => setTimeout(resolve, ms)
  );
}

async function getInstalledOllamaModels() {
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4500);
  try {
    const response=await fetch(OLLAMA_BASE_URL+'/api/tags',{signal:controller.signal});
    if(!response.ok)throw new Error('OLLAMA_TAGS_FAILED');
    const data=await response.json();
    return Array.isArray(data.models)
      ?data.models.map(item=>String(item.name||item.model||'')).filter(Boolean)
      :[];
  } finally { clearTimeout(timer); }
}

async function chooseOllamaModel() {
  const names=await getInstalledOllamaModels();
  if(!names.length)throw new Error('OLLAMA_NO_MODELS');
  const choice=chooseConversationModel(names,OLLAMA_MODEL);
  if(!choice)throw new Error('OLLAMA_INSTRUCT_REQUIRED');
  return choice;
}

async function pullRecommendedModel() {
  if(modelDownloadTask)return modelDownloadTask;
  modelDownload.active=true;
  modelDownload.status='Przygotowuję pobieranie modelu…';
  modelDownload.percent=0;
  modelDownload.error='';
  modelDownload.success=false;

  modelDownloadTask=(async()=>{
    if(!await ensureOllamaRunning())throw new Error('OLLAMA_NOT_RUNNING');
    const names=await getInstalledOllamaModels();
    if(names.includes(RECOMMENDED_MODEL)){
      modelDownload.percent=100;
      modelDownload.status='Model jest już zainstalowany.';
      modelDownload.success=true;
      return;
    }
    const response=await fetch(OLLAMA_BASE_URL+'/api/pull',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:RECOMMENDED_MODEL,stream:true})
    });
    if(!response.ok||!response.body){
      throw new Error('MODEL_DOWNLOAD_HTTP_'+response.status);
    }
    const reader=response.body.getReader();
    const decoder=new TextDecoder();
    let buffer='';
    let success=false;
    let events=0;
    function applyLine(line){
      const text=line.trim();
      if(!text)return;
      const data=JSON.parse(text);
      if(data.error)throw new Error('MODEL_DOWNLOAD_ERROR');
      events++;
      modelDownload.status=String(data.status||'Pobieranie modelu…').slice(0,100);
      const total=Number(data.total||0),done=Number(data.completed||0);
      if(total>0)modelDownload.percent=Math.max(0,Math.min(99,Math.floor(done/total*100)));
      if(data.status==='success')success=true;
    }
    try {
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        buffer+=decoder.decode(value,{stream:true});
        let pos;
        while((pos=buffer.indexOf('\n'))>=0){
          const line=buffer.slice(0,pos);buffer=buffer.slice(pos+1);
          applyLine(line);
        }
      }
      buffer+=decoder.decode();
      if(buffer.trim())applyLine(buffer);
    } finally { reader.releaseLock(); }
    if(!success||events===0)throw new Error('MODEL_DOWNLOAD_INCOMPLETE');
    const installed=await getInstalledOllamaModels();
    if(!installed.includes(RECOMMENDED_MODEL))throw new Error('MODEL_INSTALL_NOT_CONFIRMED');
    modelDownload.percent=100;
    modelDownload.status='Model zainstalowany. HealthGo AI jest gotowe.';
    modelDownload.success=true;
  })().catch(error=>{
    modelDownload.error=String(error?.message||'MODEL_DOWNLOAD_ERROR');
    modelDownload.status='Nie udało się pobrać modelu. Sprawdź internet i miejsce na dysku.';
    console.error('HealthGo local model download:',modelDownload.error);
  }).finally(()=>{
    modelDownload.active=false;
    modelDownloadTask=null;
  });
  return modelDownloadTask;
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

  let spawnFailed = false;
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
        spawnFailed = true;
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
    if (spawnFailed) return false;

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

      const allowedPermission =
        permission === "geolocation" ||
        permission === "bluetooth" ||
        permission === "bluetoothScanning";

      callback(
        allowedPermission &&
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

      const allowedPermission =
        permission === "geolocation" ||
        permission === "bluetooth" ||
        permission === "bluetoothScanning";

      return (
        allowedPermission &&
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

  if (!ready) {
    throw new Error(
      "OLLAMA_NOT_RUNNING"
    );
  }

  activeOllamaModel = await chooseOllamaModel();

  const message =
    String(
      data.message || ""
    ).trim();

  const responseMode =
    ["average", "medium", "high"].includes(
      String(data.responseMode || "")
    )
      ? String(data.responseMode)
      : "average";

  const responseProfile = {
    average: {
      history: 4,
      maxTokens: 420,
      timeoutMs: 60000,
      instruction:
        "Odpowiadaj krótko i konkretnie. Zwykle 2–5 zdań. Priorytetem jest szybka odpowiedź bez zbędnego rozwijania."
    },
    medium: {
      history: 8,
      maxTokens: 900,
      timeoutMs: 90000,
      instruction:
        "Odpowiadaj z umiarkowaną ilością szczegółów. Wyjaśnij najważniejsze powody i kroki, ale unikaj niepotrzebnego rozwlekania."
    },
    high: {
      history: 12,
      maxTokens: 1600,
      timeoutMs: 135000,
      instruction:
        "Odpowiadaj dokładniej i bardziej szczegółowo. Sprawdź założenia, wyjaśnij istotne kroki i uwzględnij ważne zastrzeżenia."
    }
  }[responseMode];

  if (!message) {
    throw new Error(
      "EMPTY_MESSAGE"
    );
  }

  const history =
    Array.isArray(data.history)
      ? data.history
          .slice(-responseProfile.history)
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
                (item.role === "assistant"
                  ? normalizeLocalAIResponse(item.content)
                  : item.content).slice(0,4000)
            })
          )
          .filter(item => item.content.length > 0)
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
      responseProfile.timeoutMs
    );

  try {
    // A model may return only unmarked English drafting text. Retry once
    // without exposing that draft to the user or conversation history.
    for (let attempt = 0; attempt < 2; attempt += 1) {
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

                // Qwen3 models can spend their short output allowance on
                // hidden reasoning and return an empty message.content.
                // Ollama supports think:false for normal chat replies.
                think:
                  false,

                keep_alive:
                  "10m",

                options: {
                  num_predict:
                    responseProfile.maxTokens
                },

                messages: [
                  {
                    role:
                      "system",

                    content:
                      "Jesteś HealthGo AI. " +
                      "Odpowiadaj jasno i po polsku, chyba że użytkownik poprosi o inny język. " +
                      "Pomagasz w nauce, technologii, programowaniu, grach, planowaniu i funkcjach HealthGo. " +
                      "Nie udawaj, że widzisz dane lub obrazy, których model nie otrzymał. " +
                      "W sprawach zdrowotnych podawaj wyłącznie ogólne, ostrożne informacje. " +
                      responseProfile.instruction +
                      " Podawaj wyłącznie końcową odpowiedź dla użytkownika. " +
                      "Nie omawiaj własnego procesu pisania, nie cytuj poleceń ani reguł systemowych. " +
                      (attempt ? "Odpowiedz bezpośrednio, najlepiej jednym krótkim zdaniem po polsku." : "")
                  },

                  ...history,

                  {
                    role:
                      "user",

                    content:
                      message + imageNote
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

    const answer = normalizeLocalAIResponse(result?.message?.content);
    if (!answer) {
      const code = String(result?.message?.content || '').trim()
        ? 'OLLAMA_DRAFT_RESPONSE'
        : 'OLLAMA_EMPTY_RESPONSE';
      console.warn('HealthGo AI: model returned no safe final answer; retry:', attempt === 0, 'reason:', result?.done_reason || 'unknown');
      if (attempt === 0) continue;
      const error = new Error(code);
      error.reason = result?.done_reason || 'unknown';
      throw error;
    }
    return answer;
    }
    throw new Error('OLLAMA_EMPTY_RESPONSE');
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
      updateIsDownloading = true;
      console.log(
        "HealthGo Update: dostępna wersja:",
        info.version
      );
    }
  );

  autoUpdater.on(
    "update-not-available",
    (info) => {
      updateIsDownloading = false;
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
      updateIsDownloading = false;
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
      updateIsDownloading = false;
      updateChecks?.stop();

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

  // Sprawdzamy automatycznie przy uruchomieniu, co 10 minut oraz po
  // powrocie do okna HealthGo (jeżeli od ostatniego sprawdzenia minęły
  // co najmniej 2 minuty). Pobieranie i instalacja nie wymagają kliknięcia.
  updateChecks = createAutomaticUpdateChecks({
    check: () => autoUpdater.checkForUpdates(),
    isBusy: () => updateIsInstalling || updateIsDownloading,
    intervalMs: 10 * 60 * 1000,
    minGapMs: 2 * 60 * 1000,
    onError: (error, reason) => {
      console.error(
        "HealthGo Update - kontrola " + reason + " nie powiodła się:",
        error
      );
    }
  });
  updateChecks.start();
  mainWindow?.on("focus", () => {
    void updateChecks?.checkNow("focus");
  });
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
  // BLUETOOTH DEVICE PICKER
  // ========================================

  const bluetoothDevices =
    new Map();

  let bluetoothCallback =
    null;

  let bluetoothPickerTimer =
    null;

  let bluetoothPickerOpen =
    false;

  mainWindow.webContents.on(
    "select-bluetooth-device",
    (event, deviceList, callback) => {
      event.preventDefault();

      bluetoothCallback =
        callback;

      for (const device of deviceList || []) {
        if (
          device &&
          device.deviceId
        ) {
          bluetoothDevices.set(
            device.deviceId,
            device
          );
        }
      }

      if (bluetoothPickerOpen) {
        return;
      }

      if (bluetoothPickerTimer) {
        clearTimeout(
          bluetoothPickerTimer
        );
      }

      bluetoothPickerTimer =
        setTimeout(
          async () => {
            const devices =
              Array.from(
                bluetoothDevices.values()
              )
                .filter(
                  (device) =>
                    device.deviceName
                )
                .slice(
                  0,
                  8
                );

            if (!devices.length) {
              bluetoothDevices.clear();

              const cb =
                bluetoothCallback;

              bluetoothCallback =
                null;

              if (cb) {
                cb("");
              }

              return;
            }

            bluetoothPickerOpen =
              true;

            const buttons =
              devices
                .map(
                  (device) =>
                    device.deviceName
                )
                .concat(
                  "Anuluj"
                );

            try {
              const result =
                await dialog.showMessageBox(
                  mainWindow,
                  {
                    type:
                      "question",

                    title:
                      "HealthGo · Bluetooth",

                    message:
                      "Wybierz urządzenie",

                    detail:
                      "HealthGo połączy się tylko z urządzeniem, które wybierzesz.",

                    buttons,

                    cancelId:
                      buttons.length -
                      1,

                    defaultId:
                      0,

                    noLink:
                      true
                  }
                );

              const cb =
                bluetoothCallback;

              bluetoothCallback =
                null;

              if (cb) {
                const selected =
                  devices[
                    result.response
                  ];

                cb(
                  selected
                    ? selected.deviceId
                    : ""
                );
              }
            } finally {
              bluetoothDevices.clear();

              bluetoothPickerOpen =
                false;
            }
          },
          900
        );
    }
  );

  // ========================================
  // GOOGLE LOGIN
  // ========================================

  mainWindow
    .webContents
    .setWindowOpenHandler(
      ({ url }) => {
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

        const returnToMain = (event, url) => {
          if (isHealthGoOrigin(url)) {
            event.preventDefault();

            if (
              mainWindow &&
              !mainWindow.isDestroyed()
            ) {
              mainWindow.loadURL(url);
              mainWindow.show();
              mainWindow.focus();
            }

            if (!childWindow.isDestroyed()) {
              childWindow.close();
            }

            return;
          }

          if (!isAllowedAuthPopupUrl(url)) {
            event.preventDefault();
          }
        };

        childWindow.webContents.on(
          "will-navigate",
          returnToMain
        );

        childWindow.webContents.on(
          "will-redirect",
          returnToMain
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

app.on("before-quit", () => {
  updateChecks?.stop();
});

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
