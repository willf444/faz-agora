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
- A execução `41472912929` passou usando `/home/vagrant/build/<appid>`, como o CI oficial. O APK 351 unsigned que geramos tem exatamente o mesmo SHA-256 do 351 unsigned do job oficial anterior (`7dd9678c…`).
- Os assets 351/352 da release foram substituídos pelos APKs assinados com a chave permitida: 351 `0385b53f…` e 352 `0cbdef09…`. O 352 novo difere do 352 já testado no A56 somente pelos build IDs em `libexpo-modules-core.so` e `librnscreens.so`; os demais arquivos são idênticos.
- A versão 2.3.15 ainda precisa de uma nova pipeline oficial para validar os dois assets e do merge no MR antes de ser considerada atualizada no F-Droid.
- O MR continua aberto e a versão 2.3.15 não está validada para publicação no F-Droid. A release GitHub atual contém referências que ainda não passaram na comparação oficial. Não afirmar que a atualização está pronta.
- O 352 original foi testado no Samsung A56 e notificou corretamente. O APK substituto tem os mesmos arquivos de app; só diferem os dois build IDs. Não pedir novo teste sem necessidade.

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
