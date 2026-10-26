# Documentação do Faz agora!

- [`../README.md`](../README.md): apresentação pública, instalação e privacidade.
- [`../packaging/fdroid/com.willian.willdo.yml`](../packaging/fdroid/com.willian.willdo.yml): espelho da receita Android/F-Droid mantido junto ao código. A branch do MR é a fonte de verdade para a revisão ativa.
- `local/HANDOFF.md`: contexto de continuidade para a próxima pessoa/IA. Contém decisões internas e fica fora do Git.
- `local/fdroid-release.md`: procedimento e estado detalhado da correção/submissão F-Droid 2.3.15 (com histórico 2.3.14); privado/local, não enviar a serviços públicos.
- `local/flathub-novembro-2026.md`: plano local da próxima submissão Flathub.
- `local/archive/`: registros antigos preservados para consulta histórica; não são estado atual.

`docs/local/` está no `.gitignore`. Não copie seu conteúdo para commits, issues, releases ou comentários públicos. Credenciais, dados reais de tarefas e mecanismos comerciais privados também não devem ser publicados.

## Estado atual — 2026-10-26

- GitHub: release `v2.3.15` contém somente os APKs 351/352 gerados pelo workflow reproduzível `40342315030`; o 352 foi testado no Samsung A56 e notificou corretamente.
- F-Droid: MR [!53840](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/53840) continua aberto. A mensagem com hashes e pedido de rerun foi enviada no fio correto (`note_4091789858`); ainda não está publicado no catálogo.
- Próximo passo: aguardar a pipeline oficial validar os assets, depois merge e entrada no catálogo. Não alterar os assets novamente sem evidência de falha.
