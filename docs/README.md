# Documentação do Faz agora!

- [`../README.md`](../README.md): apresentação pública, instalação e privacidade.
- [`../packaging/fdroid/com.willian.willdo.yml`](../packaging/fdroid/com.willian.willdo.yml): espelho da receita Android/F-Droid mantido junto ao código. A branch do MR é a fonte de verdade para a revisão ativa.
- `local/HANDOFF.md`: contexto de continuidade para a próxima pessoa/IA. Contém decisões internas e fica fora do Git.
- `local/fdroid-release.md`: procedimento e estado detalhado da correção/submissão F-Droid 2.3.15 (com histórico 2.3.14); privado/local, não enviar a serviços públicos.
- `local/flathub-novembro-2026.md`: plano local da próxima submissão Flathub.
- `local/archive/`: registros antigos preservados para consulta histórica; não são estado atual.

`docs/local/` está no `.gitignore`. Não copie seu conteúdo para commits, issues, releases ou comentários públicos. Credenciais, dados reais de tarefas e mecanismos comerciais privados também não devem ser publicados.

## Estado atual — 2026-11-02

- GitHub: a release `v2.3.15` contém agora os APKs assinados pela chave permitida, gerados na execução `41472912929`: 351 SHA-256 `0385b53f136f66591f583d35e48499f120093aa49b5ce90212b6bec246f2c59b`; 352 SHA-256 `0cbdef09f9b95e18e3ec25f9f886a6fd8b874422df1990b4877b5d57120a080f`. O 352 original foi testado no Samsung A56; o novo difere dele apenas pelos build IDs de duas bibliotecas nativas.
- F-Droid: MR [!53840](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/53840) continua aberto. A pipeline oficial `2986853180` falhou no job `17495916845`: o APK 351 difere em `libexpo-modules-core.so` e `librnscreens.so`; o 352 ainda não foi comparado. A versão 2.3.15 não está pronta para publicação.
- A diferença foi isolada ao build ID ELF: em cada biblioteca só 20 bytes variam. Nosso workflow usava `/build/build/<appid>`; o CI do F-Droid executa de `/home/vagrant/build/<appid>`. A documentação do F-Droid identifica caminhos de build como causa de IDs diferentes. O workflow foi ajustado para reproduzir esse caminho.
- O APK 351 unsigned da execução `41472912929` tem o mesmo SHA-256 do 351 unsigned oficial (`7dd9678c0eb8086209418e84c722d9689aaa2dac0a1e3ad9d7a98aea6f4b2a39`). Os assets foram atualizados; falta pedir nova execução oficial para validar os dois ABI e depois aguardar merge/publicação. O MR segue aberto; a consulta autenticada às notas em 2026-11-02 não encontrou resposta após nossa mensagem de 26/10.
