import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const serviceWorkerRegistration = `
if ("serviceWorker" in navigator) {
  var refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then(function (registration) {
        // Ativa imediatamente um worker novo que ja esteja esperando.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        registration.addEventListener("updatefound", function () {
          var worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", function () {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              worker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
        // Checa atualizacao ao abrir e toda vez que o app volta pro foco
        // (reabrir a PWA) — se houver versao nova, ativa e recarrega sozinho.
        var checkUpdate = function () { registration.update().catch(function () {}); };
        checkUpdate();
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible") checkUpdate();
        });
      })
      .catch(function (error) {
        console.warn("[PWA] Service worker registration failed:", error);
      });
  });
}
`;

const baseStyles = `
html,
body,
#root {
  background: #0A1628;
  min-height: 100%;
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

html {
  min-height: 100%;
}

body {
  margin: 0;
  overflow: hidden;
}

/*
 * O react-native-web nao herda font-family no texto por padrao. Esta regra
 * (especificidade de #id) forca Inter em tudo dentro do app, mas PERDE para
 * estilos inline — entao a marca (Space Grotesk inline) e os icones
 * (Material Icons inline) continuam com a fonte correta.
 */
#root * {
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0A1628" />
        <meta name="background-color" content="#0A1628" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OneVox" />
        <meta
          name="description"
          content="OneVox Mobile: comunicacao assistiva com voz clonada."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" sizes="196x196" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/pwa-icon-192.png" />
        <style dangerouslySetInnerHTML={{ __html: baseStyles }} />
        <ScrollViewStyleReset />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerRegistration }} />
      </body>
    </html>
  );
}
