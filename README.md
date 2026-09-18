# Faz agora!

Gerenciador de tarefas livre, sem anúncios e sem rastreamento, disponível para Android e Linux.

O Faz agora! funciona offline e pode sincronizar tarefas entre dispositivos por meio de um servidor WebDAV escolhido pelo usuário. Os aplicativos Android e Linux utilizam o mesmo arquivo `task.json`.

## Disponibilidade

- Android: APK disponível na [versão 2.3.12](https://github.com/willf444/faz-agora/releases/tag/v2.3.12); [inclusão no F-Droid em análise](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/48910).
- Linux: [baixar diretamente o pacote Debian 2.3.11](https://github.com/willf444/faz-agora/releases/download/v2.3.11/faz-agora_2.3.11_all.deb); inclusão no Debian em preparação.
- Flathub: pacote validado localmente; nova submissão planejada após o período de histórico de desenvolvimento solicitado pelo Flathub.
- Código-fonte e versões diretas: publicados neste repositório.

## Recursos

- Tarefas rápidas ou com data e hora.
- Recorrência diária, semanal, mensal, anual ou personalizada.
- Descrições e subtarefas com formatação visual.
- Checklist interativo de subtarefas.
- Busca em tarefas pendentes e concluídas.
- Notificações locais.
- Sincronização WebDAV bidirecional.
- Funcionamento offline.
- Interface escura e compacta.

## Privacidade

O Faz agora! não possui anúncios, telemetria ou rastreamento. As tarefas permanecem no dispositivo, salvo quando o próprio usuário configura a sincronização WebDAV.

No Android, a senha WebDAV é armazenada no armazenamento seguro do sistema. No Linux, a conexão com o compartilhamento WebDAV é gerenciada pelo ambiente do usuário.

## Android

O aplicativo Android foi desenvolvido com React Native e Expo. Para executar o projeto em modo de desenvolvimento:

```bash
npm install
npx expo start
```

Para gerar localmente um APK assinado, depois de configurar a chave de assinatura:

```bash
npm run build:apk
```

O script de construção não envia o código para serviços externos.

## Linux

O aplicativo para Linux requer Python 3 e PyQt6:

```bash
python3 -m pip install PyQt6
python3 faz-agora.py
```

As tarefas são armazenadas em `task.json`. Para compartilhar tarefas com o Android, selecione no aplicativo uma pasta WebDAV já montada pelo sistema.

Para gerar o pacote Debian localmente:

```bash
npm run build:deb
```

O arquivo `.deb` será criado na pasta `dist/`.

## Flatpak

O manifesto para construção e futura submissão ao Flathub está em `packaging/flatpak/men.whats.FazAgora.yml`. O identificador do aplicativo Linux é `men.whats.FazAgora`.

## Sincronização WebDAV

1. Configure ou escolha uma pasta em seu servidor WebDAV.
2. No Linux, selecione a pasta montada que conterá `task.json`.
3. No Android, informe a URL da pasta WebDAV, o usuário e a senha.
4. Use **Salvar e sincronizar** na primeira conexão.

O arquivo `task.json` será criado automaticamente quando necessário. Use sempre HTTPS ao informar credenciais diretamente no Android.

## Apoie o projeto

O Faz agora! é mantido por um desenvolvedor independente. Apoios voluntários ajudam a custear servidor, domínio, ferramentas e manutenção.

Mais informações estão disponíveis na área **Sobre o Faz agora!** dos aplicativos.

Também é possível [apoiar o projeto pelo navegador](https://faz.whats.men/apoie).

Conheça também [whats.men](https://whats.men), um projeto para divulgar redes sociais e contatos em um único link.

## Servidor de apoio

A pasta `server/` contém a API utilizada exclusivamente para gerar contribuições voluntárias via Pix e apresentar o progresso mensal. Credenciais e dados de pagamentos não fazem parte deste repositório.

O servidor não é necessário para armazenar ou sincronizar tarefas.

## Licença

Copyright © 2026 Willian Ferreira.

Este projeto é software livre, distribuído sob a licença [GNU General Public License v3.0 ou posterior](LICENSE).
