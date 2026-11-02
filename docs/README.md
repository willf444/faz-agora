# Documentação do Faz agora!

- [`../README.md`](../README.md): apresentação pública, instalação e privacidade.
- [`../packaging/fdroid/com.willian.willdo.yml`](../packaging/fdroid/com.willian.willdo.yml): espelho da receita Android/F-Droid mantido junto ao código. A branch do MR é a fonte de verdade para a revisão ativa.
- `local/HANDOFF.md`: contexto de continuidade para a próxima pessoa/IA. Contém decisões internas e fica fora do Git.
- `local/fdroid-release.md`: procedimento e estado detalhado da correção/submissão F-Droid 2.3.15 (com histórico 2.3.14); privado/local, não enviar a serviços públicos.
- `local/flathub-novembro-2026.md`: plano local da próxima submissão Flathub.
- `local/archive/`: registros antigos preservados para consulta histórica; não são estado atual.

`docs/local/` está no `.gitignore`. Não copie seu conteúdo para commits, issues, releases ou comentários públicos. Credenciais, dados reais de tarefas e mecanismos comerciais privados também não devem ser publicados.

## Estado atual — 2026-11-02

- GitHub: a release `v2.3.15` contém os APKs 351/352 da execução `40342315030`; o 352 foi testado no Samsung A56 e notificou corretamente. Esses assets ainda não passaram na comparação oficial.
- F-Droid: MR [!53840](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/53840) continua aberto. A pipeline oficial `2986853180` falhou no job `17495916845`: o APK 351 difere em `libexpo-modules-core.so` e `librnscreens.so`; o 352 ainda não foi comparado. A versão 2.3.15 não está pronta para publicação.
- A diferença foi isolada ao build ID ELF: em cada biblioteca só 20 bytes variam. Nosso workflow usava `/build/build/<appid>`; o CI do F-Droid executa de `/home/vagrant/build/<appid>`. A documentação do F-Droid identifica caminhos de build como causa de IDs diferentes. O workflow foi ajustado para reproduzir esse caminho, mas ainda precisa ser executado e comparado.
- Próximo passo: rodar o workflow atualizado, comparar o 351 e 352 com a receita oficial e só então atualizar assets/pedir nova validação. O MR foi consultado em 2026-11-02 e seguia aberto; a API de notas não permitiu confirmar mensagens posteriores.
