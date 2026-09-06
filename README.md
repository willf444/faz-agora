# WillDo Mobile (Android)

Versão mobile do gerenciador de tarefas **WillDo** baseada no script desktop `willdo.py`. Desenvolvido em **React Native** com **Expo (SDK 51)** e interface em **Material Design 3**.

---

## 🚀 Funcionalidades

- **Criação rápida**: Adicione tarefas imediatamente no topo sem data (equivalente ao `quick_add` do desktop).
- **Criação e edição completa**:
  - Título com validação.
  - Data e hora com seletor nativo Android.
  - Recorrência inteligente (**Diariamente**, **Semanalmente**, **Mensalmente no mesmo dia**, **Anualmente no mesmo dia**).
  - Editor e pré-visualizador de **Markdown** com barra de ferramentas (`**negrito**`, `*itálico*`, `- lista`, `# título`, `[link]`).
  - Gerenciamento de subtarefas (checklist interativo).
- **Lógica de Recorrência Fiel ao Desktop**:
  - Conclusão adiantada solicita confirmação antes de avançar.
  - Avanço automático para a próxima ocorrência recalculando o vencimento exato e reagendando as notificações.
- **Notificações Locais**:
  - Notificações agendadas localmente com canal de alta prioridade, som e vibração.
- **Persistência Local**:
  - Armazenamento offline no dispositivo com `@react-native-async-storage/async-storage`.
  - Ordenação idêntica ao `willdo.py`: tarefas com vencimento primeiro, tarefas sem data em ordem alfabética e tarefas concluídas ordenadas pela data de conclusão mais recente.
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

O projeto está configurado com o `eas.json` com perfil `preview` (`buildType: "apk"`), permitindo compilar diretamente na nuvem gratuita do Expo sem precisar configurar Java ou Android Studio no computador.

### Passo 1: Fazer login no Expo / EAS
Se ainda não tiver conta (é gratuita), cadastre-se em [expo.dev/signup](https://expo.dev/signup).
No terminal:
```bash
cd ~/Projetos/Tarefas/willdo-mobile
npx eas-cli login
```

### Passo 2: Configurar o projeto no EAS (apenas na 1ª vez)
```bash
npx eas-cli project:init
```

### Passo 3: Iniciar o Build do APK
Execute o comando:
```bash
npx eas-cli build -p android --profile preview
```
*O EAS iniciará o build nos servidores em nuvem do Expo. Ao finalizar, será exibido no terminal um link direto para baixar o arquivo `.apk` pronto para instalar em qualquer celular Android.*
