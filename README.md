# Faz agora!

Gerenciador de tarefas livre, sem anúncios e sem rastreamento, disponível para Android e Linux.

O Faz agora! funciona offline e pode sincronizar tarefas entre dispositivos por meio de um servidor WebDAV escolhido pelo usuário. Os aplicativos Android e Linux utilizam o mesmo arquivo `task.json`.

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

## Sincronização WebDAV

1. Configure ou escolha uma pasta em seu servidor WebDAV.
2. No Linux, selecione a pasta montada que conterá `task.json`.
3. No Android, informe a URL da pasta WebDAV, o usuário e a senha.
4. Use **Salvar e sincronizar** na primeira conexão.

O arquivo `task.json` será criado automaticamente quando necessário. Use sempre HTTPS ao informar credenciais diretamente no Android.

## Apoie o projeto

O Faz agora! é mantido por um desenvolvedor independente. Apoios voluntários ajudam a custear servidor, domínio, ferramentas e manutenção.

Mais informações estão disponíveis na área **Sobre o Faz agora!** dos aplicativos.

Conheça também [whats.men](https://whats.men), um projeto para divulgar redes sociais e contatos em um único link.

## Servidor de apoio

A pasta `server/` contém a API utilizada exclusivamente para gerar contribuições voluntárias via Pix e apresentar o progresso mensal. Credenciais e dados de pagamentos não fazem parte deste repositório.

O servidor não é necessário para armazenar ou sincronizar tarefas.

## Licença

Copyright © 2026 Willian Ferreira.

Este projeto é software livre, distribuído sob a licença [GNU General Public License v3.0 ou posterior](LICENSE).
