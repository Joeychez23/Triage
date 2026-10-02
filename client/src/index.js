import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Installable PWA with an offline app shell. Registration only happens in
// production builds (see serviceWorkerRegistration.js).
// serviceWorkerRegistration.register();
