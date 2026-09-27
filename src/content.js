(() => {
  "use strict";

  const CHANNEL = "REPLAY_SPORTS_DOWNLOADER_V1";
  const BRIDGE_ID = "replay-sports-downloader-page-bridge";

  function injectBridge() {
    if (document.getElementById(BRIDGE_ID)) {
      return;
    }

    const script = document.createElement("script");
    script.id = BRIDGE_ID;
    script.src = chrome.runtime.getURL("page-bridge.js");
    script.async = false;
    script.addEventListener("load", () => script.remove(), { once: true });
    (document.head || document.documentElement).appendChild(script);
  }

  function requestVideoList(limit) {
    injectBridge();

    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
      const timeout = setTimeout(() => {
        window.removeEventListener("message", receiveResponse);
        reject(
          new Error(
            "A página não respondeu. Recarregue o Replay Sports e tente novamente."
          )
        );
      }, 120000);

      function receiveResponse(event) {
        const response = event.data;

        if (
          event.source !== window ||
          !response ||
          response.channel !== CHANNEL ||
          response.direction !== "response" ||
          response.requestId !== requestId
        ) {
          return;
        }

        clearTimeout(timeout);
        window.removeEventListener("message", receiveResponse);

        if (response.ok) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || "Falha ao consultar os vídeos."));
        }
      }

      window.addEventListener("message", receiveResponse);
      window.postMessage(
        {
          channel: CHANNEL,
          direction: "request",
          action: "collect",
          requestId,
          limit
        },
        window.location.origin
      );
    });
  }

  injectBridge();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "REPLAY_COLLECT_VIDEOS") {
      return false;
    }

    requestVideoList(message.limit)
      .then(data => sendResponse({ ok: true, data }))
      .catch(error => {
        sendResponse({
          ok: false,
          error: error?.message || String(error)
        });
      });

    return true;
  });
})();

