(() => {
  "use strict";

  const CHANNEL = "REPLAY_SPORTS_DOWNLOADER_V1";

  if (globalThis.__replaySportsDownloaderBridge) {
    return;
  }

  globalThis.__replaySportsDownloaderBridge = true;

  function toMilliseconds(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (value && typeof value.toMillis === "function") {
      return value.toMillis();
    }

    const converted = Number(value);
    if (Number.isFinite(converted)) {
      return converted;
    }

    throw new Error("Data do vídeo inválida.");
  }

  function pad(value, size = 2) {
    return String(value).padStart(size, "0");
  }

  function buildFilename(moment, index) {
    const date = new Date(moment);

    if (Number.isNaN(date.getTime())) {
      return `${pad(index + 1, 3)}_video.mp4`;
    }

    const stamp = [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-") + "_" + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join("-");

    return `${pad(index + 1, 3)}_${stamp}.mp4`;
  }

  async function collectVideos(requestedLimit) {
    const replayUtils = typeof utils !== "undefined" ? utils : null;
    const replayStorage = typeof storage !== "undefined" ? storage : null;
    const user = replayUtils?.appStates?.userLogged;

    if (!user || typeof user.getRecentUserVideos !== "function") {
      throw new Error(
        "Conta não encontrada. Entre no Replay Sports e abra Vídeos Recentes."
      );
    }

    if (!replayStorage?.ref) {
      throw new Error("O Firebase Storage ainda não foi inicializado.");
    }

    const maximum = Math.min(
      Number(replayUtils.freeVideosLimit) || 500,
      500
    );
    const limit = Math.max(
      1,
      Math.min(Number(requestedLimit) || maximum, maximum)
    );
    const videos = await user.getRecentUserVideos(limit);

    if (!Array.isArray(videos)) {
      throw new Error("A resposta da listagem de vídeos é inválida.");
    }

    const items = [];
    const failures = [];

    for (let index = 0; index < videos.length; index += 1) {
      const video = videos[index];

      try {
        if (!video?.path) {
          throw new Error("Caminho ausente");
        }

        const moment = toMilliseconds(video.momento);
        const url = await replayStorage
          .ref()
          .child(video.path)
          .getDownloadURL();

        if (typeof url !== "string" || !url.startsWith("https://")) {
          throw new Error("URL de download inválida");
        }

        items.push({
          filename: buildFilename(moment, index),
          moment,
          path: String(video.path),
          url
        });
      } catch (error) {
        failures.push({
          number: index + 1,
          path: String(video?.path || "desconhecido"),
          error: error?.message || String(error)
        });
      }
    }

    return {
      totalFound: videos.length,
      items,
      failures
    };
  }

  window.addEventListener("message", async event => {
    if (event.source !== window) {
      return;
    }

    const message = event.data;

    if (
      !message ||
      message.channel !== CHANNEL ||
      message.direction !== "request" ||
      message.action !== "collect"
    ) {
      return;
    }

    const response = {
      channel: CHANNEL,
      direction: "response",
      requestId: message.requestId
    };

    try {
      response.ok = true;
      response.data = await collectVideos(message.limit);
    } catch (error) {
      response.ok = false;
      response.error = error?.message || String(error);
    }

    window.postMessage(response, window.location.origin);
  });
})();

