"use strict";

const elements = {
  limit: document.getElementById("limit"),
  delay: document.getElementById("delay"),
  start: document.getElementById("start"),
  cancel: document.getElementById("cancel"),
  progress: document.getElementById("progress"),
  statusTitle: document.getElementById("status-title"),
  statusCount: document.getElementById("status-count"),
  statusDetail: document.getElementById("status-detail"),
  warning: document.getElementById("warning")
};

let preparing = false;

function runtimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "A extensão não respondeu."));
        return;
      }

      resolve(response);
    });
  });
}

function activeTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      if (!tabs?.[0]?.id) {
        reject(new Error("Nenhuma aba ativa foi encontrada."));
        return;
      }

      resolve(tabs[0]);
    });
  });
}

function tabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, response => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(
          new Error(
            "Não foi possível acessar o Replay Sports. Recarregue a aba " +
              "depois de instalar a extensão."
          )
        );
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "A página não respondeu."));
        return;
      }

      resolve(response.data);
    });
  });
}

function isReplayUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "www.replay.esp.br" ||
        url.hostname === "replay.esp.br")
    );
  } catch {
    return false;
  }
}

function showWarning(text) {
  elements.warning.textContent = text || "";
  elements.warning.hidden = !text;
}

function render(state) {
  const total = Number(state?.total) || 0;
  const done = (Number(state?.completed) || 0) + (Number(state?.failed) || 0);
  const active = state?.status === "running" || state?.status === "waiting";

  elements.progress.max = Math.max(total, 1);
  elements.progress.value = Math.min(done, total);
  elements.statusCount.textContent = `${done} / ${total}`;
  elements.cancel.hidden = !active;
  elements.start.disabled = active || preparing;
  elements.limit.disabled = active || preparing;
  elements.delay.disabled = active || preparing;

  if (preparing) {
    elements.statusTitle.textContent = "Preparando";
    elements.statusDetail.textContent =
      "Consultando a conta e obtendo os links dos vídeos...";
    return;
  }

  switch (state?.status) {
    case "running":
      elements.statusTitle.textContent = "Baixando";
      elements.statusDetail.textContent = state.currentName
        ? `Arquivo atual: ${state.currentName}`
        : "Iniciando o próximo arquivo...";
      break;
    case "waiting":
      elements.statusTitle.textContent = "Aguardando";
      elements.statusDetail.textContent =
        "Intervalo de segurança antes do próximo vídeo.";
      break;
    case "complete":
      elements.statusTitle.textContent = "Concluído";
      elements.statusDetail.textContent =
        `${state.completed} vídeo(s) baixado(s) com sucesso.`;
      showWarning("");
      break;
    case "complete_with_errors":
      elements.statusTitle.textContent = "Concluído com falhas";
      elements.statusDetail.textContent =
        `${state.completed} baixado(s), ${state.failed} com falha.`;
      showWarning(
        state.failures
          ?.map(item => `#${item.number}: ${item.error}`)
          .join(" | ") || "Alguns downloads falharam."
      );
      break;
    case "cancelled":
      elements.statusTitle.textContent = "Interrompido";
      elements.statusDetail.textContent =
        "A fila foi interrompida. Os arquivos já concluídos foram mantidos.";
      break;
    default:
      elements.statusTitle.textContent = "Pronto";
      elements.statusDetail.textContent =
        "Abra a tela Vídeos Recentes no Replay Sports.";
  }
}

async function refreshStatus() {
  try {
    const response = await runtimeMessage({ type: "REPLAY_GET_STATUS" });
    render(response.state);
  } catch (error) {
    elements.statusTitle.textContent = "Erro";
    elements.statusDetail.textContent = error.message;
  }
}

elements.start.addEventListener("click", async () => {
  showWarning("");
  preparing = true;
  render({ status: "idle", total: 0 });

  try {
    const tab = await activeTab();

    if (!isReplayUrl(tab.url)) {
      throw new Error(
        "Abra https://www.replay.esp.br/app/ e entre na sua conta primeiro."
      );
    }

    const limit = Math.max(1, Math.min(Number(elements.limit.value) || 500, 500));
    const delayMs = Math.max(
      1000,
      Math.min(Number(elements.delay.value) || 2, 60) * 1000
    );
    const result = await tabMessage(tab.id, {
      type: "REPLAY_COLLECT_VIDEOS",
      limit
    });

    if (result.failures?.length) {
      showWarning(
        `${result.failures.length} item(ns) não puderam ser preparado(s).`
      );
    }

    if (!result.items?.length) {
      throw new Error("Nenhum vídeo disponível para download.");
    }

    const response = await runtimeMessage({
      type: "REPLAY_START_QUEUE",
      items: result.items,
      delayMs
    });

    preparing = false;
    render(response.state);
  } catch (error) {
    preparing = false;
    elements.statusTitle.textContent = "Não foi possível iniciar";
    elements.statusDetail.textContent = error.message;
    elements.start.disabled = false;
    elements.limit.disabled = false;
    elements.delay.disabled = false;
  }
});

elements.cancel.addEventListener("click", async () => {
  try {
    const response = await runtimeMessage({ type: "REPLAY_CANCEL_QUEUE" });
    render(response.state);
  } catch (error) {
    elements.statusTitle.textContent = "Erro ao interromper";
    elements.statusDetail.textContent = error.message;
  }
});

refreshStatus();
setInterval(refreshStatus, 1000);

