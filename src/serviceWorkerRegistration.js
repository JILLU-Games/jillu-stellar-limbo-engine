/**
 * Service Worker Registration for PWA Support
 */

export function register() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    window.addEventListener("load", () => {
      const swUrl = "/sw.js";
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) return;
            installingWorker.onstatechange = () => {
              if (installingWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  console.log("New content available for Casino Limbo. Refresh to update.");
                } else {
                  console.log("Casino Limbo cached for offline use.");
                }
              }
            };
          };
        })
        .catch((error) => {
          console.warn("Error during service worker registration:", error);
        });
    });
  }
}

export function unregister() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
