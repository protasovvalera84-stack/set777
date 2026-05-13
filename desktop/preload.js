/**
 * Meshlink Desktop — Preload script
 * Exposes safe APIs to the renderer process.
 */

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("meshlink", {
  platform: process.platform,
  isDesktop: true,
  version: require("./package.json").version,
});
