# Faz agora! (Android)

Versão mobile do gerenciador de tarefas **Faz agora!** baseada no script desktop `faz-agora.py`. Desenvolvido em **React Native** com **Expo (SDK 51)** e interface em **Material Design 3**.

---

## 🚀 Funcionalidades

- **Criação rápida**: Adicione tarefas imediatamente no topo sem data (equivalente ao `quick_add` do desktop).
- **Criação e edição completa**:
  - Título com validação.
  - Data e hora com seletor nativo Android.
  - Recorrência inteligente (**Diariamente**, **Semanalmente**, **Mensalmente no mesmo dia**, **Anualmente no mesmo dia**).
  - Recorrência personalizada a cada quantidade de horas, dias ou semanas.
  - Editor visual com negrito, itálico, listas, títulos e links, mantendo compatibilidade com o arquivo compartilhado do desktop.
  - Gerenciamento de subtarefas (checklist interativo).
- **Lógica de Recorrência Fiel ao Desktop**:
  - Conclusão adiantada solicita confirmação antes de avançar.
  - Avanço automático para a próxima ocorrência recalculando o vencimento exato e reagendando as notificações.
- **Notificações Locais**:
  - Notificações agendadas localmente com canal de alta prioridade, som e vibração.
- **Persistência Local**:
  - Armazenamento offline no dispositivo com `@react-native-async-storage/async-storage`.
  - Ordenação idêntica ao `faz-agora.py`: tarefas com vencimento primeiro, tarefas sem data em ordem alfabética e tarefas concluídas ordenadas pela data de conclusão mais recente.
- **Sincronização WebDAV**:
  - Mesclagem bidirecional do `task.json`, incluindo edições e exclusões feitas no APK ou no desktop.
  - Senha armazenada pelo armazenamento seguro do Android.
  - Sincronização manual pelo ícone no cabeçalho ou automática ao abrir o aplicativo.
- **Busca e Limpeza**:
  - Busca instantânea por título, detalhes markdown, subtarefas e status.
  - Botão para limpar todas as tarefas concluídas.

---

## 📱 Como Testar no Celular (Expo Go)

1. No computador, abra a pasta do projeto no terminal:
   ```bash
   cd ~/Projetos/Tarefas/willdo-mobile
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npx expo start
   ```

3. No seu celular Android:
   - Instale o aplicativo **Expo Go** na Google Play Store.
   - Abra o Expo Go e escaneie o **QR Code** exibido no terminal (garanta que o computador e o celular estejam na mesma rede Wi-Fi).

---

## 📦 Como Gerar o Arquivo APK para Instalar no Android

O APK é compilado e assinado inteiramente no computador, sem login, envio do projeto ou construção pelo EAS. A chave de assinatura fica somente no armazenamento local e não entra no Git.

Execute:
```bash
cd ~/Projetos/Tarefas/willdo-mobile
npm run build:apk
```

Ao terminar, o APK assinado será criado na raiz do projeto. Para gerar o pacote destinado a lojas compatíveis com AAB, use `npm run build:aab`.

---

## ☁️ Conectar o APK ao Faz agora! do Linux

1. No Linux, escolha como diretório de tarefas uma pasta WebDAV montada. O desktop usará o arquivo `task.json` dessa pasta e perceberá alterações externas automaticamente.
2. No APK, toque na engrenagem do cabeçalho.
3. Informe a URL da pasta no servidor WebDAV, o usuário e a senha. O aplicativo cria o `task.json` automaticamente na primeira sincronização.
4. Toque em **Salvar e sincronizar**.

Use preferencialmente uma URL HTTPS. O primeiro sync une as tarefas existentes nos dois lados; nos próximos, o aplicativo considera a última sincronização para propagar também as exclusões.
