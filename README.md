# Faz agora!

Gerenciador de tarefas livre, sem anúncios ou telemetria, para Android e Linux. O núcleo funciona offline; o usuário pode sincronizar os mesmos dados entre plataformas com uma pasta WebDAV configurada por ele.

## Disponibilidade

- Android: o aplicativo já está publicado no [F-Droid](https://f-droid.org/packages/com.willian.willdo/); as versões mais atualizadas aparecem primeiro nas [releases do GitHub](https://github.com/willf444/faz-agora/releases).
- Linux: [baixar diretamente o pacote Debian 2.3.11](https://github.com/willf444/faz-agora/releases/download/v2.3.11/faz-agora_2.3.11_all.deb); inclusão no Debian em preparação.
- Flathub: pacote validado localmente; nova submissão planejada após o período de histórico de desenvolvimento solicitado pelo Flathub.
- Código-fonte e versões diretas: publicados neste repositório.

## Recursos

- Tarefas rápidas ou com data e hora e recorrência diária, semanal, mensal, anual ou personalizada.
- Descrições e subtarefas formatadas, com checklist.
- Busca em tarefas pendentes e concluídas.
- Notificações locais.
- Sincronização WebDAV bidirecional.
- Interface escura e compacta.
- A interface Android está disponível somente em português brasileiro.

## Privacidade e conexões

O app não tem anúncios, telemetria ou rastreamento. O conteúdo das tarefas permanece no dispositivo, exceto quando o usuário configura sua sincronização WebDAV. No Android, a senha WebDAV fica no armazenamento seguro do sistema e somente URLs HTTPS são aceitas.

A seção de apoio consulta `faz.whats.men` para exibir o total mensal de doações. Ao solicitar um Pix, o app envia o valor escolhido e o e-mail para criar o pagamento e consulta seu estado. O conteúdo das tarefas não é enviado a esse serviço. Essa conexão é separada do WebDAV.

## Sincronização WebDAV

1. Escolha uma pasta em um servidor WebDAV.
2. No Linux, selecione a pasta montada que conterá `task.json`.
3. No Android, informe a URL HTTPS, o usuário e a senha.
4. Use **Salvar e sincronizar** na primeira conexão.

O arquivo `task.json` é criado quando necessário. O Android não aceita WebDAV por HTTP simples.

## Desenvolvimento Android

O app usa React Native e Expo. Com Node.js e npm instalados:

```bash
npm ci
npx expo start
```

Para preparar um APK local assinado, configure as credenciais de assinatura locais e use `npm run build:apk`. O build pode baixar dependências do npm e Gradle. Nunca inclua credenciais, chaves, APKs ou dados reais de tarefas no Git.

## Linux

O app requer Python 3 e PyQt6. Instale PyQt6 pelo sistema/ambiente virtual e execute:

```bash
python3 faz-agora.py
```

Para gerar o pacote Debian localmente, execute `npm run build:deb`; o arquivo é criado em `dist/`.

## Flatpak

O manifesto está em `packaging/flatpak/men.whats.FazAgora.yml`; o ID é `men.whats.FazAgora`.

## Apoie o projeto

O projeto é mantido por um desenvolvedor independente. Mais informações estão na área **Sobre o Faz agora!** e em [faz.whats.men/apoie](https://faz.whats.men/apoie). Conheça também [whats.men](https://whats.men). A API em `server/` atende a área de apoio/Pix; ela não armazena nem sincroniza tarefas.

## Licença

Copyright © 2026 Willian Ferreira. Distribuído sob a [GNU GPL v3.0 ou posterior](LICENSE).
