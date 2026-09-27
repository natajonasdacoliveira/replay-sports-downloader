# Replay Sports Downloader

Extensão Manifest V3 para baixar, de forma sequencial, os vídeos recentes da
conta autenticada no Replay Sports. Funciona no Chrome, Opera e Firefox.

## Recursos

- consulta apenas a conta já autenticada em `replay.esp.br`;
- baixa um vídeo por vez pelo gerenciador nativo do navegador;
- intervalo configurável de 1 a 60 segundos;
- fila e progresso persistentes quando o popup é fechado;
- retomada da fila após o processo em segundo plano reiniciar;
- botão para interromper a fila;
- arquivos organizados em `Downloads/ReplaySports`;
- sem bibliotecas remotas, telemetria ou envio de dados para terceiros.

## Baixar

Abra a página de [Releases](https://github.com/natajonasdacoliveira/replay-sports-downloader/releases/latest)
e baixe o pacote do seu navegador:

- `replay-sports-downloader-chromium.zip` para Chrome ou Opera;
- `replay-sports-downloader-firefox.zip` para Firefox.

Extraia o ZIP antes de instalar.

## Instalar no Chrome

1. Baixe e extraia `replay-sports-downloader-chromium.zip`.
2. Abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Escolha a pasta extraída, onde está o arquivo `manifest.json`.

## Instalar no Opera

1. Baixe e extraia `replay-sports-downloader-chromium.zip`.
2. Abra `opera://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Escolha a pasta extraída, onde está o arquivo `manifest.json`.

## Instalar no Firefox para teste

1. Baixe e extraia `replay-sports-downloader-firefox.zip`.
2. Abra `about:debugging#/runtime/this-firefox`.
3. Clique em **Carregar extensão temporária**.
4. Selecione o arquivo `manifest.json` da pasta extraída.

O Firefox comum remove extensões temporárias ao reiniciar. Para instalação
permanente, o pacote precisa ser assinado pelo Mozilla Add-ons (AMO). O
manifesto já declara que a extensão não coleta nem transmite dados.

## Usar

1. Entre em `https://www.replay.esp.br/app/`.
2. Abra **Vídeos Recentes**.
3. Clique no ícone da extensão.
4. Defina a quantidade e o intervalo.
5. Clique em **Baixar vídeos recentes**.
6. Autorize múltiplos downloads se o navegador solicitar.

O popup pode ser fechado depois que a fila começar. Abra-o novamente para ver
o progresso ou interromper a fila.

## Desenvolvimento

Esta seção é necessária apenas para quem deseja alterar o código. Para gerar os
pacotes localmente no PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

Os diretórios descompactados e os ZIPs serão criados em `dist`.

## Permissões

- `activeTab`: identifica a aba do Replay Sports escolhida pelo usuário;
- `downloads`: inicia e acompanha os downloads;
- `alarms`: continua a fila após o intervalo configurado;
- `storage`: preserva o estado da fila;
- acesso somente a `replay.esp.br`: conversa com a sessão autenticada da página.

Use apenas para baixar vídeos aos quais a sua própria conta tenha acesso.
