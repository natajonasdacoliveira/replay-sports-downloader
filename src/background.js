"use strict";

const STATE_KEY = "replayDownloadStateV1";
const ALARM_NAME = "replayDownloadNextV1";
const TERMINAL_STATUSES = new Set([
  "idle",
  "complete",
  "complete_with_errors",
  "cancelled"
]);

let processing = false;

function defaultState() {
  return {
    status: "idle",
    queue: [],
    total: 0,
    nextIndex: 0,
    completed: 0,
    failed: 0,
    failures: [],
    activeDownloadId: null,
    currentName: null,
    delayMs: 2000,
    nextAt: null,
    startedAt: null,
    finishedAt: null
  };
}

function getStoredState() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([STATE_KEY], result => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(result[STATE_KEY] || defaultState());
    });
  });
}

function setStoredState(state) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STATE_KEY]: state }, () => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function publicState(state) {
  const { queue: _queue, ...safeState } = state;
  return safeState;
}

function startBrowserDownload(options) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(options, downloadId => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      if (!Number.isInteger(downloadId)) {
        reject(new Error("O navegador não iniciou o download."));
        return;
      }

      resolve(downloadId);
    });
  });
}

function cancelBrowserDownload(downloadId) {
  return new Promise(resolve => {
    chrome.downloads.cancel(downloadId, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

function searchBrowserDownload(downloadId) {
  return new Promise((resolve, reject) => {
    chrome.downloads.search({ id: downloadId }, results => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(results?.[0] || null);
    });
  });
}

function cleanFilename(filename, index) {
  const fallback = `${String(index + 1).padStart(3, "0")}_video.mp4`;
  const cleaned = String(filename || fallback)
    .replace(/[<>:"\\|?*\u0000-\u001F]/g, "-")
    .replace(/\.\.+/g, ".")
    .replace(/^\.+/, "")
    .slice(0, 180);

  return `ReplaySports/${cleaned || fallback}`;
}

function scheduleNext(state) {
  const when = Date.now() + state.delayMs;
  state.status = "waiting";
  state.nextAt = when;
  chrome.alarms.create(ALARM_NAME, { when });
  return setStoredState(state);
}

async function finishQueue(state) {
  state.status = state.failed > 0 ? "complete_with_errors" : "complete";
  state.queue = [];
  state.activeDownloadId = null;
  state.currentName = null;
  state.nextAt = null;
  state.finishedAt = Date.now();
  await setStoredState(state);
}

async function finishCurrent(success, errorMessage) {
  const state = await getStoredState();

  if (state.status === "cancelled" || TERMINAL_STATUSES.has(state.status)) {
    return;
  }

  const item = state.queue[state.nextIndex];

  if (success) {
    state.completed += 1;
  } else {
    state.failed += 1;
    state.failures.push({
      number: state.nextIndex + 1,
      filename: item?.filename || state.currentName || "desconhecido",
      error: errorMessage || "Download interrompido"
    });
  }

  state.nextIndex += 1;
  state.activeDownloadId = null;
  state.currentName = null;

  if (state.nextIndex >= state.total) {
    await finishQueue(state);
  } else {
    await scheduleNext(state);
  }
}

async function processNext() {
  if (processing) {
    return;
  }

  processing = true;

  try {
    const state = await getStoredState();

    if (state.status !== "running" || state.activeDownloadId !== null) {
      return;
    }

    if (state.nextIndex >= state.total) {
      await finishQueue(state);
      return;
    }

    const item = state.queue[state.nextIndex];
    state.activeDownloadId = "starting";
    state.currentName = item.filename;
    state.nextAt = null;
    await setStoredState(state);

    try {
      const downloadId = await startBrowserDownload({
        url: item.url,
        filename: cleanFilename(item.filename, state.nextIndex),
        conflictAction: "uniquify",
        saveAs: false
      });
      const latest = await getStoredState();

      if (latest.status === "cancelled") {
        await cancelBrowserDownload(downloadId);
        return;
      }

      latest.activeDownloadId = downloadId;
      await setStoredState(latest);
    } catch (error) {
      await finishCurrent(false, error?.message || String(error));
    }
  } finally {
    processing = false;
  }
}

async function startQueue(items, delayMs) {
  const current = await getStoredState();

  if (current.status === "running" || current.status === "waiting") {
    throw new Error("Já existe uma fila de downloads em andamento.");
  }

  const queue = items.map((item, index) => {
    const url = new URL(item.url);

    if (url.protocol !== "https:") {
      throw new Error(`URL insegura no item ${index + 1}.`);
    }

    return {
      url: url.href,
      filename: String(item.filename || "")
    };
  });

  if (queue.length === 0) {
    throw new Error("Nenhum vídeo válido foi encontrado.");
  }

  const state = defaultState();
  state.status = "running";
  state.queue = queue;
  state.total = queue.length;
  state.delayMs = Math.max(1000, Math.min(Number(delayMs) || 2000, 60000));
  state.startedAt = Date.now();
  await setStoredState(state);
  await processNext();
  return publicState(await getStoredState());
}

async function cancelQueue() {
  const state = await getStoredState();
  const activeDownloadId = Number.isInteger(state.activeDownloadId)
    ? state.activeDownloadId
    : null;

  state.status = "cancelled";
  state.queue = [];
  state.activeDownloadId = null;
  state.currentName = null;
  state.nextAt = null;
  state.finishedAt = Date.now();
  await setStoredState(state);
  chrome.alarms.clear(ALARM_NAME);

  if (activeDownloadId !== null) {
    await cancelBrowserDownload(activeDownloadId);
  }

  return publicState(state);
}

async function recoverQueue() {
  const state = await getStoredState();

  if (state.status === "waiting") {
    const when = Math.max(Date.now() + 100, Number(state.nextAt) || Date.now());
    chrome.alarms.create(ALARM_NAME, { when });
    return;
  }

  if (state.status !== "running") {
    return;
  }

  if (Number.isInteger(state.activeDownloadId)) {
    try {
      const download = await searchBrowserDownload(state.activeDownloadId);

      if (!download) {
        await finishCurrent(false, "Download não encontrado após reiniciar.");
      } else if (download.state === "complete") {
        await finishCurrent(true);
      } else if (download.state === "interrupted") {
        await finishCurrent(false, download.error || "Download interrompido");
      }
    } catch (error) {
      console.error("Falha ao recuperar download", error);
    }

    return;
  }

  if (state.activeDownloadId === "starting") {
    state.activeDownloadId = null;
    await setStoredState(state);
  }

  await processNext();
}

chrome.downloads.onChanged.addListener(change => {
  if (!change.state?.current) {
    return;
  }

  getStoredState()
    .then(state => {
      if (state.activeDownloadId !== change.id) {
        return;
      }

      if (change.state.current === "complete") {
        return finishCurrent(true);
      }

      if (change.state.current === "interrupted") {
        return finishCurrent(
          false,
          change.error?.current || "Download interrompido"
        );
      }
    })
    .catch(error => console.error("Falha ao atualizar a fila", error));
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== ALARM_NAME) {
    return;
  }

  getStoredState()
    .then(async state => {
      if (state.status !== "waiting") {
        return;
      }

      state.status = "running";
      state.nextAt = null;
      await setStoredState(state);
      await processNext();
    })
    .catch(error => console.error("Falha ao continuar a fila", error));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let task;

  if (message?.type === "REPLAY_START_QUEUE") {
    task = startQueue(message.items || [], message.delayMs);
  } else if (message?.type === "REPLAY_GET_STATUS") {
    task = getStoredState().then(publicState);
  } else if (message?.type === "REPLAY_CANCEL_QUEUE") {
    task = cancelQueue();
  } else {
    return false;
  }

  task
    .then(state => sendResponse({ ok: true, state }))
    .catch(error => {
      sendResponse({
        ok: false,
        error: error?.message || String(error)
      });
    });

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  getStoredState()
    .then(state => setStoredState(state))
    .catch(error => console.error("Falha ao inicializar estado", error));
});

chrome.runtime.onStartup.addListener(() => {
  recoverQueue().catch(error => console.error("Falha ao retomar fila", error));
});

recoverQueue().catch(error => console.error("Falha ao recuperar fila", error));

