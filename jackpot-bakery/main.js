"use strict";

const path = require("path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 640,
    minHeight: 480,
    show: false,
    backgroundColor: "#160d20",
    autoHideMenuBar: true,
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile("index.html");
  mainWindow.once("ready-to-show", function () {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(function (details) {
    if (/^https?:\/\//i.test(details.url)) shell.openExternal(details.url);
    return { action: "deny" };
  });

  mainWindow.on("closed", function () {
    mainWindow = null;
  });
}

ipcMain.handle("window:toggle-fullscreen", function () {
  if (!mainWindow) return false;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});

ipcMain.handle("window:is-fullscreen", function () {
  return Boolean(mainWindow && mainWindow.isFullScreen());
});

app.whenReady().then(function () {
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
