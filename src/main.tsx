import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { errorCollector } from "./lib/errorCollector";

// Start collecting errors immediately
errorCollector.init();

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker for offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failed (dev mode or unsupported)
    });
  });
}
