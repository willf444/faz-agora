# LEIA-ME PRIMEIRO

Antes de modificar, compilar, publicar ou enviar qualquer mensagem sobre este projeto, leia este arquivo e depois:

1. [`docs/README.md`](docs/README.md), o índice da documentação;
2. [`docs/local/HANDOFF.md`](docs/local/HANDOFF.md), o estado completo de continuidade;
3. [`docs/local/fdroid-release.md`](docs/local/fdroid-release.md), o procedimento específico do F-Droid.

## Estado atual — 2026-11-02

- O código principal está no GitHub em `willf444/faz-agora`.
- A release `v2.3.15` contém os APKs 351 (32-bit) e 352 (64-bit), compilados por nosso workflow com `fdroid build --on-server` no `buildserver-trixie`.
- O APK 352 foi instalado em um Samsung A56 e uma tarefa futura notificou e tocou o som corretamente.
- O MR oficial do F-Droid é [!53840](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/53840). Ele ainda está aberto e não significa publicação no catálogo.
- Nossa execução `40342315030` passou, mas não reproduziu o APK oficial. A pipeline oficial `2986853180`, job `17495916845`, falhou na comparação do 351: duas bibliotecas nativas diferiam apenas no build ID. A causa provável foi identificada: nosso workflow compilava de `/build`, enquanto o CI oficial compila de `/home/vagrant`; o F-Droid documenta que o caminho de build altera esses IDs.
- O workflow local foi ajustado para usar `/home/vagrant/build/<appid>` e os mesmos parâmetros de `fdroid build` do CI. Ainda precisa ser executado e comparado; até lá a atualização continua sem validação oficial.
- O MR continua aberto e a versão 2.3.15 não está validada para publicação no F-Droid. A release GitHub atual contém referências que ainda não passaram na comparação oficial. Não afirmar que a atualização está pronta.
- O 352 dessa execução própria continua sendo o APK testado no Samsung A56 e notificou corretamente. Não pedir novo teste do usuário; primeiro corrigir a reprodução do 351 e gerar os dois artefatos no mesmo ambiente efetivo da pipeline oficial.

## Organização local

- Código: `src/`, `android/`, `server/`, `scripts/`.
- Cópias históricas de build: `dist/fdroid-candidates/`.
- APK de teste ativo: `dist/test-apks/faz-agora-v2.3.15-352-reproducible-teste.apk`.
- APKs antigos: `dist/test-apks/archive/`.
- Clones auxiliares do F-Droid: `dist/fdroiddata-workspaces/`.
- Documentação privada: `docs/local/`; nunca publicar seu conteúdo.

## Regras obrigatórias

- Não declarar que a versão está no F-Droid antes de o MR ser mesclado e aparecer no catálogo.
- Não alterar os assets públicos ou abrir outro MR sem evidência nova e revisão do estado remoto.
- Para referências F-Droid, reproduzir também o caminho de trabalho do CI: `/home/vagrant/build/<appid>`, no `buildserver-trixie`, com `fdroid build --verbose --test --refresh-scanner --on-server --no-tarball`. Usar apenas a imagem Docker não basta.
- Não publicar conversa, planos internos, dados de tarefas, credenciais ou detalhes comerciais privados.
- Não ler, imprimir ou copiar senhas/chaves de `credentials.json` e `credentials/`.
- Antes de qualquer mensagem pública, verificar se já houve resposta e mostrar o texto em português ao mantenedor; usar o fio do MR correto.
- Builds Android pesados devem ser executados pelo mantenedor em outra aba quando solicitado; não iniciar automaticamente.

Se houver conflito entre um registro histórico e o estado atual acima, o estado atual e o `HANDOFF.md` mais recente prevalecem.
