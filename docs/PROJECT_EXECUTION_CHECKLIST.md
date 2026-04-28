# NBA Metricas - Project Execution Checklist

## Ultima atualizacao

- Data: 2026-04-28
- Branch: `main`
- Ultimo commit conhecido: `38537c9 feat: add today decision dashboard`
- Status geral: Migracao operacional local, sync_runs, settlement e acuracia real validados; odds snapshots bloqueado por secret BoltOdds; proximo foco e produto do usuario/testes.

## Como usar este arquivo

- Use este checklist como quadro operacional sequencial do projeto.
- Ao concluir uma tarefa, troque `[ ]` por `[x]`, adicione data, commit e uma nota curta.
- Cada tarefa deve manter dono AIOS, dependencia, aceite e verificacao.
- Se uma tarefa mudar de escopo, crie uma nova linha em vez de apagar historico relevante.
- A fonte estrategica complementar e `docs/NBA_METRICAS_EVOLUTION_PLAN.md`.

## Legenda de status

- `[x]` concluido e validado.
- `[ ]` pendente.
- `Bloqueado:` motivo objetivo para impedimento.
- `Commit:` hash do commit que entregou ou validou a tarefa.
- `Verificacao:` comando, endpoint ou criterio manual usado.

## Fase 0: Fundacao ja entregue

- [x] F0.01 - Criar plano mestre de evolucao.
  - Dono: aios-po
  - Depende de: diagnostico do sistema atual
  - Aceite: `docs/NBA_METRICAS_EVOLUTION_PLAN.md` existe e cobre produto, arquitetura, dados, sprints e criterios.
  - Verificacao: leitura do arquivo; `git log -1 --oneline`
  - Concluido em: 2026-04-28
  - Commit: `7fc9088`

- [x] F0.02 - Corrigir base de qualidade.
  - Dono: aios-devops
  - Depende de: `package.json`, `next.config.mjs`, ESLint flat config
  - Aceite: `npm run lint`, `npm run typecheck` e `npm run build` existem e nao mascaram erro TypeScript.
  - Verificacao: `npm run lint`; `npm run typecheck`; `npm run build`
  - Concluido em: 2026-04-28
  - Commit: `7fc9088`

- [x] F0.03 - Remover claim de ML avancado do motor atual.
  - Dono: aios-architect
  - Depende de: `lib/ai/engine.ts`
  - Aceite: metodologia exposta como `Prediction Engine v1 heuristic baseline`.
  - Verificacao: busca por claims de XGBoost/neural network no codigo ativo.
  - Concluido em: 2026-04-28
  - Commit: `7fc9088`

- [x] F0.04 - Criar infraestrutura de predicoes auditaveis.
  - Dono: aios-dev
  - Depende de: contratos de predicao, registry e rotas API
  - Aceite: existem `GET /api/predictions/today`, `GET /api/predictions/[id]`, `GET /api/model-runs`, `GET /api/accuracy`.
  - Verificacao: `npm run build`
  - Concluido em: 2026-04-28
  - Commit: `7fc9088`

- [x] F0.05 - Criar migracao SQL operacional inicial.
  - Dono: aios-data-engineer
  - Depende de: modelo operacional Postgres-first
  - Aceite: `migrations/001_operational_schema.sql` cria `sync_runs`, `provider_runs`, `odds_snapshots`, `predictions`, `prediction_outcomes`, `model_runs`.
  - Verificacao: leitura da migracao; `npm run typecheck`
  - Concluido em: 2026-04-28
  - Commit: `7fc9088`

- [x] F0.06 - Proteger endpoints sensiveis.
  - Dono: aios-architect
  - Depende de: `SYNC_ADMIN_SECRET`, `CRON_REFRESH_SECRET`, `DEBUG_API_SECRET`
  - Aceite: `/api/debug` exige secret em producao; `/api/sync` exige secret em producao; `/api/cron/refresh` usa bearer secret.
  - Verificacao: revisao de rotas e `proxy.ts`
  - Concluido em: 2026-04-28
  - Commit: `7fc9088`

- [x] F0.07 - Corrigir estado de loading do dashboard.
  - Dono: aios-dev
  - Depende de: `app/page.tsx`
  - Aceite: hooks/calculos rodam antes do retorno de loading, evitando mudanca de ordem de hooks.
  - Verificacao: `npm run typecheck`; `npm run lint`
  - Concluido em: 2026-04-28
  - Commit: `750ab33`

- [x] F0.08 - Registrar build info TypeScript atualizado.
  - Dono: aios-devops
  - Depende de: `tsconfig.tsbuildinfo` rastreado no repo
  - Aceite: working tree limpo apos atualizacao do arquivo gerado.
  - Verificacao: `git status --short`
  - Concluido em: 2026-04-28
  - Commit: `6dc8d4a`

## Fase 1: Banco e migracoes reais

- [x] F1.01 - Aplicar migracao operacional em Postgres local.
  - Dono: aios-data-engineer
  - Depende de: `migrations/001_operational_schema.sql`, `DATABASE_URL`
  - Aceite: tabelas operacionais existem no banco local.
  - Verificacao: executar SQL no Postgres local; consultar `information_schema.tables`.
  - Concluido em: 2026-04-28
  - Commit: `525ac05`
  - Nota: aplicado em Postgres Docker local (`postgresql://postgres:postgres@localhost:5432/nba_metricas`) e confirmadas `sync_runs`, `provider_runs`, `odds_snapshots`, `predictions`, `prediction_outcomes`, `model_runs`.

- [ ] F1.02 - Aplicar migracao operacional em Postgres Railway.
  - Dono: aios-devops
  - Depende de: acesso Railway, `DATABASE_URL` de producao/staging
  - Aceite: ambiente Railway possui as mesmas tabelas da migracao local.
  - Verificacao: `GET /api/health` com database configured e sem erro de schema.

- [x] F1.03 - Validar endpoints com banco real.
  - Dono: aios-dev
  - Depende de: F1.01 ou F1.02
  - Aceite: `/api/health`, `/api/model-runs`, `/api/accuracy`, `/api/predictions/today` respondem sem excecao.
  - Verificacao: chamadas HTTP locais ou staging; `npm run typecheck`.
  - Concluido em: 2026-04-28
  - Commit: `525ac05`
  - Nota: validado em `localhost:3000` com sessao de usuario local aprovada; endpoints retornaram 200. `/api/accuracy` retornou warning esperado por ausencia de outcomes liquidados.

- [x] F1.04 - Registrar modelo de versionamento de migracoes.
  - Dono: aios-data-engineer
  - Depende de: migracao inicial aplicada
  - Aceite: documentar como aplicar, reverter e auditar migracoes futuras.
  - Verificacao: atualizar docs operacionais e revisar com aios-devops.
  - Concluido em: 2026-04-28
  - Commit: `c2ea557`
  - Nota: criado `docs/DB_MIGRATIONS.md` com convencao de arquivos, aplicacao local Docker, aplicacao Railway, auditoria e politica de rollback.

## Fase 2: Pipeline de dados NBA

- [x] F2.01 - Registrar execucoes completas em `sync_runs`.
  - Dono: aios-dev
  - Depende de: F1.01, `/api/sync`
  - Aceite: cada sync manual ou cron salva status, output e erro quando houver.
  - Verificacao: `POST /api/sync`; consulta em `sync_runs`.
  - Concluido em: 2026-04-28
  - Commit: `c2ea557`
  - Nota: validado com `POST /api/sync` tipo `maintenance` em standalone local com `SYNC_ADMIN_SECRET`; `sync_runs` gravou `status=success`, `output_jsonb` e sem erro. Cron operacional segue em F2.04.

- [ ] F2.02 - Persistir odds snapshots em Postgres em ambiente real.
  - Dono: aios-data-engineer
  - Depende de: F1.01, `BOLTODDS_API_KEY`
  - Aceite: `odds_snapshots` recebe snapshots; `.cache` fica apenas fallback dev.
  - Verificacao: `POST /api/odds/collect`; consulta por `game_id`.
  - Bloqueado em: 2026-04-28
  - Motivo: `BOLTODDS_API_KEY` nao esta configurado em `.env.local`, `.env` ou `.env.docker`; sem chave nao ha como validar coleta real do upstream.

- [ ] F2.03 - Validar cobertura de players, teams e games.
  - Dono: aios-analyst
  - Depende de: providers configurados
  - Aceite: health/report mostra fonte, cobertura, stale/fresh e warnings relevantes.
  - Verificacao: `GET /api/health`; `GET /api/players`; `GET /api/games/today`.

- [ ] F2.04 - Definir calendario de cron Railway.
  - Dono: aios-devops
  - Depende de: secrets configurados
  - Aceite: cron de games, players, teams, odds e maintenance definido e documentado.
  - Verificacao: logs Railway e `sync_runs`.

## Fase 3: Prediction Engine auditavel

- [x] F3.01 - Garantir ID auditavel para toda pick exibida.
  - Dono: aios-dev
  - Depende de: F1.01, F2.02
  - Aceite: toda entrada de `/api/predictions/today` possui `predictionId` e `auditUrl` funcional.
  - Verificacao: chamar `/api/predictions/today`; abrir `/api/predictions/{id}`.
  - Concluido em: 2026-04-28
  - Commit: `f743e9a`
  - Nota: validado com snapshot manual em Postgres local; toda pick retornada por `/api/predictions/today` inclui `predictionId` e `auditUrl`.

- [x] F3.02 - Adicionar filtros em `/api/predictions/today`.
  - Dono: aios-dev
  - Depende de: F3.01
  - Aceite: filtros `gameId`, `market`, `riskLevel`, `minEdgePct`, `minProbability` funcionam.
  - Verificacao: chamadas HTTP com combinacoes de query params.
  - Concluido em: 2026-04-28
  - Commit: `f743e9a`
  - Nota: rota aceita filtros por query string, retorna `filters` no payload e foi validada com snapshot manual em Postgres local.

- [x] F3.03 - Melhorar fallback quando nao ha odds snapshots.
  - Dono: aios-architect
  - Depende de: F2.02
  - Aceite: endpoint retorna status explicavel sem picks, e opcionalmente sinaliza necessidade de coleta.
  - Verificacao: ambiente sem odds snapshots; resposta com warning claro.
  - Concluido em: 2026-04-28
  - Commit: `17861ae`
  - Nota: `/api/predictions/today` retorna `oddsSnapshotStatus` com `collectionRequired` e `collectEndpoint` quando nao ha snapshots utilizaveis.

- [ ] F3.04 - Revisar fatores e pesos do Prediction Engine v1.
  - Dono: aios-analyst
  - Depende de: dados reais suficientes
  - Aceite: fatores refletem uso analitico: forma recente, linha, media, lesao, fonte, cobertura.
  - Verificacao: amostra manual de 10 picks e revisao de explicabilidade.

## Fase 4: Settlement e acuracia real

- [x] F4.01 - Criar servico de settlement.
  - Dono: aios-dev
  - Depende de: `prediction_outcomes`, boxscore final
  - Aceite: previsoes pendentes sao liquidadas como `won`, `lost`, `push` ou `void`.
  - Verificacao: teste com jogo finalizado e boxscore disponivel.
  - Concluido em: 2026-04-28
  - Commit: `e0b8ac7`
  - Nota: criado servico de settlement com calculo de win/loss/push, ROI, erro absoluto e Brier score; validado com previsao controlada em Postgres local.

- [x] F4.02 - Criar endpoint/job de settlement.
  - Dono: aios-architect
  - Depende de: F4.01
  - Aceite: rota protegida ou cron executa settlement por janela/data.
  - Verificacao: chamada autenticada; registros criados em `prediction_outcomes`.
  - Concluido em: 2026-04-28
  - Commit: `e0b8ac7`
  - Nota: criado `POST /api/predictions/settle`, protegido por `SYNC_ADMIN_SECRET` em producao; smoke autenticado retornou 200.

- [x] F4.03 - Persistir metricas de outcome.
  - Dono: aios-data-engineer
  - Depende de: F4.01
  - Aceite: outcomes gravam `actual_value`, `roi_units`, `error_abs`, `brier_score`, `settled_at`.
  - Verificacao: consulta SQL em `prediction_outcomes`.
  - Concluido em: 2026-04-28
  - Commit: `e0b8ac7`
  - Nota: outcomes sao persistidos via upsert em `prediction_outcomes` e sincronizam `predictions.settlement_status`; consulta SQL confirmou `actual_value`, `roi_units`, `error_abs`, `brier_score` e `settled_at`.

- [x] F4.04 - Validar `/api/accuracy` com outcomes reais.
  - Dono: aios-analyst
  - Depende de: F4.03
  - Aceite: endpoint retorna sample size, win/loss, ROI, erro medio e Brier score sem warning de ausencia de amostra.
  - Verificacao: `GET /api/accuracy`; `GET /api/ai/accuracy`.
  - Concluido em: 2026-04-28
  - Commit: `5fa2d40`
  - Nota: validado com outcome controlado em Postgres local; `/api/accuracy` e `/api/ai/accuracy` retornaram sample size 1, accuracy 100, ROI 90.91, erro medio 3.5 e Brier 0.1225 sem warning.

## Fase 5: Produto do usuario

- [x] F5.01 - Criar tela "Hoje" focada em decisoes.
  - Dono: aios-dev
  - Depende de: F3.01
  - Aceite: usuario ve jogos, props, probabilidade, edge, EV, risco e link de auditoria.
  - Verificacao: browser local; responsividade desktop/mobile.
  - Nota UX 2026-04-28: dashboard atual mostra jogos/projecoes gerais, mas ainda nao consome `/api/predictions/today` como fluxo de decisao com props, edge, EV, risco e auditoria.
  - Concluido em: 2026-04-28
  - Commit: `38537c9`
  - Nota: criada tela `/today` com jogos, picks, probabilidade, edge, EV, risco, razoes e link de auditoria; smoke autenticado retornou 200.

- [x] F5.02 - Adicionar filtros de decisao na UI.
  - Dono: aios-dev
  - Depende de: F5.01, F3.02
  - Aceite: filtros por mercado, jogo, risco, probabilidade e edge.
  - Verificacao: interacao manual e estado preservado na tela.
  - Concluido em: 2026-04-28
  - Commit: `38537c9`
  - Nota: filtros de jogo, mercado, risco, probabilidade minima e edge minimo conectados aos query params de `/api/predictions/today`; build validou a rota.

- [ ] F5.03 - Criar tela de auditoria de predicao.
  - Dono: aios-dev
  - Depende de: `/api/predictions/[id]`
  - Aceite: exibe input snapshot, output, fatores, modelo, status de settlement e outcome.
  - Verificacao: abrir auditoria a partir de uma pick.

- [x] F5.04 - Ajustar linguagem responsavel.
  - Dono: aios-po
  - Depende de: telas de usuario
  - Aceite: copy evita promessa de certeza e deixa claro que sao probabilidades.
  - Verificacao: revisao textual das telas principais.
  - Concluido em: 2026-04-28
  - Commit: `38537c9`
  - Nota: tela `/today` usa linguagem de apoio analitico e evita promessa de resultado certo.

## Fase 6: Testes, DevOps e producao

- [ ] F6.01 - Criar testes unitarios reais.
  - Dono: aios-dev
  - Depende de: framework de teste escolhido
  - Aceite: odds math, risk mapping, registry e contratos cobertos.
  - Verificacao: `npm run test` executa suite real.

- [ ] F6.02 - Criar testes de integracao de API.
  - Dono: aios-dev
  - Depende de: mocks de providers e banco de teste
  - Aceite: `/api/predictions/today`, `/api/predictions/[id]`, `/api/accuracy`, `/api/sync` cobertos.
  - Verificacao: suite de integracao em CI.

- [ ] F6.03 - Criar E2E minimo.
  - Dono: aios-devops
  - Depende de: F5.01
  - Aceite: fluxo login -> tela Hoje -> auditoria passa em CI.
  - Verificacao: `npm run test:e2e` executa Playwright real.

- [ ] F6.04 - Limpar warnings de lint.
  - Dono: aios-dev
  - Depende de: baseline atual
  - Aceite: `npm run lint` sem warnings.
  - Verificacao: `npm run lint`.
  - Nota QA 2026-04-28: `npm run lint` passou sem erros, mas ainda reporta 19 warnings de variaveis/args nao usados.

- [ ] F6.05 - Revisar versionamento de artefatos.
  - Dono: aios-devops
  - Depende de: decisao de repo hygiene
  - Aceite: decidir e documentar se `.cache` e `tsconfig.tsbuildinfo` continuam versionados.
  - Verificacao: `.gitignore`, docs e `git status` apos build/typecheck.

- [ ] F6.06 - Preparar deploy Railway final.
  - Dono: aios-devops
  - Depende de: F1.02, F2.04, F6.01
  - Aceite: ambiente sobe com secrets, banco, health check e rollback documentados.
  - Verificacao: deploy em staging/producao; `GET /api/health`.

## Fase Final: Operacao continua e ML V2

- [ ] FF.01 - Criar dashboard operacional interno.
  - Dono: aios-architect
  - Depende de: health, sync_runs, provider_runs, outcomes
  - Aceite: time consegue ver ultima sync, providers, erros, coverage e sample size.
  - Verificacao: tela ou endpoint interno protegido.

- [ ] FF.02 - Estabelecer rotina de calibracao.
  - Dono: aios-analyst
  - Depende de: amostra suficiente em `prediction_outcomes`
  - Aceite: review periodico de ROI, Brier score, acuracia por mercado e confianca.
  - Verificacao: relatorio semanal/mensal.

- [ ] FF.03 - Preparar dataset de treino ML V2.
  - Dono: aios-data-engineer
  - Depende de: historico confiavel de features e outcomes
  - Aceite: dataset temporal versionado com features, labels e splits.
  - Verificacao: consulta/export reproduzivel.

- [ ] FF.04 - Criar baseline ML V2 candidato.
  - Dono: aios-dev
  - Depende de: FF.03
  - Aceite: modelo candidato comparado contra Prediction Engine v1 antes de qualquer troca.
  - Verificacao: metricas offline e validacao temporal.

- [ ] FF.05 - Ativar processo de release continuo.
  - Dono: aios-devops
  - Depende de: F6.06
  - Aceite: release tem changelog, gates, rollback e monitoramento.
  - Verificacao: release tag e smoke tests pos-deploy.
