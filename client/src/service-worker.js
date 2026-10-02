/* eslint-disable no-restricted-globals */

// Triage's service worker (Workbox via Create React App's InjectManifest).
// Precaches the app shell so Triage opens offline; API calls always go to
// the network because job data and judgments must be fresh.
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";

clientsClaim();

// Build assets; the manifest is injected at build time.
precacheAndRoute(self.__WB_MANIFEST);

// App-shell routing: navigations get index.html, except API and file URLs.
const fileExtensionRegexp = new RegExp("/[^/?]+\\.[^/]+$");
registerRoute(({ request, url }) => {
  if (request.mode !== "navigate") return false;
  if (url.pathname.startsWith("/_") || url.pathname.startsWith("/api")) return false;
  if (url.pathname.match(fileExtensionRegexp)) return false;
  return true;
}, createHandlerBoundToURL(process.env.PUBLIC_URL + "/index.html"));

// Same-origin images (icons).
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.endsWith(".png"),
  new StaleWhileRevalidate({ cacheName: "images", plugins: [new ExpirationPlugin({ maxEntries: 50 })] })
);

// Google Fonts so the typography survives offline.
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts", plugins: [new ExpirationPlugin({ maxEntries: 20 })] })
);

// Lets the page trigger skipWaiting via registration.waiting.postMessage.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
