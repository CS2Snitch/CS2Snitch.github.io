"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jackpotDesktop", {
  toggleFullscreen: function () {
    return ipcRenderer.invoke("window:toggle-fullscreen");
  },
  isFullscreen: function () {
    return ipcRenderer.invoke("window:is-fullscreen");
  },
  platform: process.platform
});
