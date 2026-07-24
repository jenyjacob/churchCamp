import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js")
      .then(reg => {
        console.log("[PWA] Service Worker registered successfully scope:", reg.scope);
        // Force update check on load
        reg.update();
      })
      .catch(err => {
        console.error("[PWA] Service Worker registration failed:", err);
      });
  });

  // Automatically reload page when new service worker activates and takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

