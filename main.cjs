const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

app.setAppUserModelId("com.healthgo.app");

let mainWindow = null;
let webServer = null;
let aiServer = null;

const PORT = 5500;

// ========================================
// ŚCIEŻKI
// ========================================

function getAppRoot() {
  return app.getAppPath();
}

function getWwwPath() {
  return path.join(getAppRoot(), "www");
}

function getIconPath() {
  const ico = path.join(getAppRoot(), "icon.ico");

  if (fs.existsSync(ico)) {
    return ico;
  }

  return path.join(getAppRoot(), "icon.png");
}

// ========================================
// TYPY PLIKÓW
// ========================================

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
  };

  return types[ext] || "application/octet-stream";
}

// ========================================
// SERWER WWW
// ========================================

function startWebServer() {
  return new Promise((resolve, reject) => {
    const wwwPath = getWwwPath();
    const indexPath = path.join(wwwPath, "index.html");

    console.log("HealthGo WWW:", wwwPath);
    console.log("HealthGo INDEX:", indexPath);

    if (!fs.existsSync(wwwPath)) {
      reject(
        new Error(
          "Nie znaleziono folderu WWW: " + wwwPath
        )
      );
      return;
    }

    if (!fs.existsSync(indexPath)) {
      reject(
        new Error(
          "Nie znaleziono pliku index.html: " + indexPath
        )
      );
      return;
    }

    webServer = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(
          req.url,
          `http://127.0.0.1:${PORT}`
        );

        let pathname = decodeURIComponent(
          requestUrl.pathname
        );

        // Główna strona
        if (
          pathname === "/" ||
          pathname === ""
        ) {
          pathname = "/index.html";
        }

        pathname = pathname.replace(
          /^\/+/,
          ""
        );

        let requestedFile = path.resolve(
          wwwPath,
          pathname
        );

        const safeWwwPath =
          path.resolve(wwwPath) + path.sep;

        // Ochrona przed wyjściem poza WWW
        if (
          requestedFile !==
            path.resolve(indexPath) &&
          !requestedFile.startsWith(
            safeWwwPath
          )
        ) {
          res.writeHead(403, {
            "Content-Type":
              "text/plain; charset=utf-8"
          });

          res.end("403");
          return;
        }

        // Jeżeli adres wskazuje na folder,
        // próbujemy index.html.
        if (
          fs.existsSync(requestedFile) &&
          fs.statSync(requestedFile).isDirectory()
        ) {
          requestedFile = path.join(
            requestedFile,
            "index.html"
          );
        }

        if (!fs.existsSync(requestedFile)) {
          res.writeHead(404, {
            "Content-Type":
              "text/plain; charset=utf-8"
          });

          res.end("404");
          return;
        }

        fs.readFile(
          requestedFile,
          (error, data) => {
            if (error) {
              res.writeHead(500, {
                "Content-Type":
                  "text/plain; charset=utf-8"
              });

              res.end(
                "500 - Blad odczytu pliku"
              );

              return;
            }

            res.writeHead(200, {
              "Content-Type":
                getContentType(
                  requestedFile
                ),

              "Cache-Control":
                "no-store, no-cache, must-revalidate"
            });

            res.end(data);
          }
        );
      } catch (error) {
        console.error(error);

        res.writeHead(500, {
          "Content-Type":
            "text/plain; charset=utf-8"
        });

        res.end("500");
      }
    });

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
  });
}

// ========================================
// HEALTHGO AI
// ========================================

function startAIServer() {
  const serverFile = path.join(
    getAppRoot(),
    "healthgo-ai-server.mjs"
  );

  if (!fs.existsSync(serverFile)) {
    console.warn(
      "Nie znaleziono healthgo-ai-server.mjs"
    );

    return;
  }

  aiServer = spawn(
    process.execPath,
    [serverFile],
    {
      cwd: getAppRoot(),

      windowsHide: true,

      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1"
      }
    }
  );

  aiServer.on(
    "error",
    (error) => {
      console.error(
        "HealthGo AI:",
        error
      );
    }
  );
}

// ========================================
// OKNO HEALTHGO
// ========================================

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,

    minWidth: 900,
    minHeight: 650,

    icon: getIconPath(),

    frame: false,

    autoHideMenuBar: true,

    backgroundColor: "#07111f",

    show: false,

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  mainWindow.setMenu(null);

  // ========================================
  // GOOGLE LOGIN
  // ========================================

  mainWindow.webContents.setWindowOpenHandler(
    ({ url }) => {
      const allowed =
        url.startsWith(
          "https://accounts.google.com"
        ) ||
        url.includes(
          "firebaseapp.com"
        ) ||
        url.includes(
          "googleapis.com"
        );

      if (!allowed) {
        return {
          action: "deny"
        };
      }

      return {
        action: "allow",

        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,

          minWidth: 420,
          minHeight: 600,

          parent: mainWindow,
          modal: true,

          icon: getIconPath(),

          autoHideMenuBar: true,

          backgroundColor: "#ffffff",

          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true
          }
        }
      };
    }
  );

  // Usunięcie File / Edit / View / Window
  // z okna Google.
  mainWindow.webContents.on(
    "did-create-window",
    (childWindow) => {
      childWindow.setMenu(null);

      childWindow.setAutoHideMenuBar(
        true
      );

      childWindow.setMenuBarVisibility(
        false
      );
    }
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
    }
  );
}

// ========================================
// START HEALTHGO
// ========================================

app.whenReady().then(
  async () => {
    try {
      await startWebServer();

      startAIServer();

      createWindow();
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
        aiServer.kill();
      } catch (_) {}
    }

    if (webServer) {
      try {
        webServer.close();
      } catch (_) {}
    }

    if (
      process.platform !== "darwin"
    ) {
      app.quit();
    }
  }
);