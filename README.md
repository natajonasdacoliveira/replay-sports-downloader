# Replay Sports Downloader

Extensão Manifest V3 para baixar, de forma sequencial, os vídeos recentes da
conta autenticada no Replay Sports. O mesmo código funciona no Chrome, Opera e
Firefox; os pacotes têm manifestos separados por causa da implementação
diferente de processos em segundo plano nos navegadores.

## Recursos

- consulta apenas a conta já autenticada em `replay.esp.br`;
- baixa um vídeo por vez pelo gerenciador nativo do navegador;
- intervalo configurável de 1 a 60 segundos;
- fila e progresso persistentes quando o popup é fechado;
- retomada da fila após o processo em segundo plano reiniciar;
- botão para interromper a fila;
- arquivos organizados em `Downloads/ReplaySports`;
- sem bibliotecas remotas, telemetria ou envio de dados para terceiros.

## Gerar os pacotes

No PowerShell, execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

Os diretórios descompactados e os arquivos ZIP serão criados em `dist`.

## Instalar no Chrome

1. Execute `build.ps1`.
2. Abra `chrome://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Escolha `dist/chromium`.

## Instalar no Opera

1. Execute `build.ps1`.
2. Abra `opera://extensions`.
3. Ative **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Escolha `dist/chromium`.

## Instalar no Firefox para teste

1. Execute `build.ps1`.
2. Abra `about:debugging#/runtime/this-firefox`.
3. Clique em **Carregar extensão temporária**.
4. Selecione `dist/firefox/manifest.json`.

O Firefox comum remove extensões temporárias ao reiniciar. Para instalação
permanente, o pacote `dist/replay-sports-downloader-firefox.zip` precisa ser
assinado pelo Mozilla Add-ons (AMO). O manifesto já declara que a extensão não
coleta nem transmite dados.

## Usar

1. Entre em `https://www.replay.esp.br/app/`.
2. Abra **Vídeos Recentes**.
3. Clique no ícone da extensão.
4. Defina a quantidade e o intervalo.
5. Clique em **Baixar vídeos recentes**.
6. Autorize múltiplos downloads se o navegador solicitar.

O popup pode ser fechado depois que a fila começar. Consulte-o novamente para
ver o progresso ou interromper a fila.

## Permissões

- `activeTab`: identifica a aba do Replay Sports escolhida pelo usuário;
- `downloads`: inicia e acompanha os downloads;
- `alarms`: continua a fila após o intervalo configurado;
- `storage`: preserva o estado da fila;
- acesso somente a `replay.esp.br`: conversa com a sessão autenticada da página.

Use apenas para baixar vídeos aos quais a sua própria conta tenha acesso.
