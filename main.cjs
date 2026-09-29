const {
  app,
  BrowserWindow,
  Menu,
  dialog
} = require("electron");

const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");

// ========================================
// HEALTHGO
// ========================================

app.setAppUserModelId("com.healthgo.app");

let mainWindow = null;
let webServer = null;
let aiServer = null;
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

function startAIServer() {
  const serverFile =
    path.join(
      getAppRoot(),
      "healthgo-ai-server.mjs"
    );

  if (
    !fs.existsSync(
      serverFile
    )
  ) {
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

        ELECTRON_RUN_AS_NODE:
          "1"
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

      if (
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        dialog
          .showMessageBox(
            mainWindow,
            {
              type: "info",

              title:
                "HealthGo",

              message:
                "Aktualizacja została pobrana",

              detail:
                "HealthGo uruchomi się ponownie, aby dokończyć aktualizację.",

              buttons: [
                "OK"
              ],

              defaultId: 0,

              noLink: true
            }
          )
          .finally(
            () => {
              setTimeout(
                () => {
                  autoUpdater
                    .quitAndInstall(
                      false,
                      true
                    );
                },
                500
              );
            }
          );
      } else {
        autoUpdater
          .quitAndInstall(
            false,
            true
          );
      }
    }
  );

  // Dajemy aplikacji chwilę
  // na pełne uruchomienie.
  setTimeout(
    () => {
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
    },
    4000
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

      webPreferences: {
        contextIsolation:
          true,

        nodeIntegration:
          false,

        webSecurity:
          true
      }
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

              webPreferences: {
                contextIsolation:
                  true,

                nodeIntegration:
                  false,

                webSecurity:
                  true
              }
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

      startAIServer();

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
        aiServer.kill();
      } catch (_) {}
    }

    if (webServer) {
      try {
        webServer.close();
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