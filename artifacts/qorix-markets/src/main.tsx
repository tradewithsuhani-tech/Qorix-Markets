import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Check for SW updates every hour
        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch((error) => {
        console.warn("SW registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
