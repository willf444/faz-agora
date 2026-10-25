# LEIA-ME PRIMEIRO

Antes de modificar, compilar, publicar ou enviar qualquer mensagem sobre este projeto, leia este arquivo e depois:

1. [`docs/README.md`](docs/README.md), o índice da documentação;
2. [`docs/local/HANDOFF.md`](docs/local/HANDOFF.md), o estado completo de continuidade;
3. [`docs/local/fdroid-release.md`](docs/local/fdroid-release.md), o procedimento específico do F-Droid.

## Estado atual — 2026-10-25

- O código principal está no GitHub em `willf444/faz-agora`.
- A release `v2.3.15` contém os APKs corrigidos 351 (32-bit) e 352 (64-bit), compilados sem ProGuard.
- O APK 352 foi instalado em um Samsung A56 e uma tarefa futura notificou e tocou o som corretamente.
- O MR oficial do F-Droid é [!53840](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/53840). Ele ainda está aberto e não significa publicação no catálogo.
- O patch da receita está preparado no commit [`7f3c386`](https://gitlab.com/willf444/fdroiddata/-/commit/7f3c386b089452c88308021b62c573625de774de). A solicitação ao mantenedor já foi enviada no fio correto; a etapa pendente é ele aplicar o patch e executar a pipeline oficial.
- A primeira pipeline oficial com o patch (`2986853180`) compilou o 351, mas rejeitou a referência anterior porque suas bibliotecas nativas diferiam. O 351 foi substituído pelo APK produzido pela própria pipeline; o 352 ainda precisa ser obtido da pipeline oficial.

## Organização local

- Código: `src/`, `android/`, `server/`, `scripts/`.
- Cópias históricas de build: `dist/fdroid-candidates/`.
- APK de teste ativo: `dist/test-apks/faz-agora-v2.3.15-352-fdroid-teste.apk`.
- APKs antigos: `dist/test-apks/archive/`.
- Clones auxiliares do F-Droid: `dist/fdroiddata-workspaces/`.
- Documentação privada: `docs/local/`; nunca publicar seu conteúdo.

## Regras obrigatórias

- Não declarar que a versão está no F-Droid antes de o MR ser mesclado e aparecer no catálogo.
- Não alterar os assets públicos ou abrir outro MR sem evidência nova e revisão do estado remoto.
- Para referências F-Droid, usar somente APKs produzidos pela pipeline oficial; um build local/GitHub Actions não é referência de reprodutibilidade.
- Não publicar conversa, planos internos, dados de tarefas, credenciais ou detalhes comerciais privados.
- Não ler, imprimir ou copiar senhas/chaves de `credentials.json` e `credentials/`.
- Antes de qualquer mensagem pública, mostrar o texto em português ao mantenedor e confirmar o fio correto.
- Builds Android pesados devem ser executados pelo mantenedor em outra aba quando solicitado; não iniciar automaticamente.

Se houver conflito entre um registro histórico e o estado atual acima, o estado atual e o `HANDOFF.md` mais recente prevalecem.
