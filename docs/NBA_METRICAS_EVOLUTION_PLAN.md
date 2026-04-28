# NBA Metricas Evolution Plan

## Resumo Executivo

O produto deve evoluir para uma plataforma de metricas e predicoes auditaveis para NBA, com foco inicial em um usuario analista/bettor. A promessa do sistema deve ser probabilistica: probabilidade, confianca, fatores explicaveis, historico de acerto, risco e rastreabilidade. O sistema nao deve prometer certeza nem declarar ML avancado enquanto o motor atual for heuristico.

O estado atual ja inclui Next.js App Router, API routes, autenticacao propria, providers NBA Stats/BallDontLie/BoltOdds, snapshots em Postgres, cache local e telas de predicao. As principais lacunas sao: documentacao maior que a implementacao real, CI apontando para scripts ausentes, lint sem configuracao flat, build ignorando TypeScript, endpoint de debug exposto, cache `.cache` usado como armazenamento operacional, banco sem migracoes versionadas e acuracia baseada em proxy fraco.

## Arquitetura Alvo

- **Frontend:** Next.js com telas de decisao: Hoje, Jogos, Props, Auditoria de Predicao e Confiabilidade.
- **API:** rotas REST com contrato padronizado: `success`, `data`, `source`, `sourceHealth`, `cacheStatus`, `warning`, `errorCode`, `generatedAt`.
- **Dados:** Postgres como fonte persistente principal para snapshots, sync runs, provider runs, odds snapshots, predictions, outcomes e model runs.
- **Providers:** NBA Stats como primaria, BallDontLie como fallback de catalogo/stats e BoltOdds como odds/markets.
- **Prediction Engine v1:** heuristico, versionado e auditavel; todo output deve salvar input snapshot, fatores, confianca e status de settlement.
- **Observabilidade:** health com provider status, coverage, circuit breaker, ultima sync e metricas de cache.

## Construir, Atualizar, Melhorar, Destruir

### Destruir ou Remover

- Remover claims de "XGBoost + Neural Network Ensemble" ate existir pipeline validado.
- Remover `typescript.ignoreBuildErrors`.
- Proteger `/api/debug` com secret ou indisponibilizar em producao.
- Encerrar dependencia de `.cache/*.json` como persistencia primaria em producao.
- Corrigir docs que prometem Redis, Prisma, Vitest, Playwright e NextAuth como se estivessem ativos.

### Atualizar

- Manter README, API, arquitetura, data providers e deploy alinhados ao codigo real.
- Adicionar lint/test scripts minimos que o CI consiga executar.
- Exigir `SYNC_ADMIN_SECRET` em producao para sync manual.
- Registrar execucoes de sync e preparar provider run observability.

### Melhorar

- Tipar contratos centrais de predicao, odds, model run e sync run.
- Persistir odds em Postgres quando disponivel, usando `.cache` apenas como fallback local.
- Calcular acuracia com previsoes liquidadas, nao por comparacao de projecao contra media da temporada.
- Expor auditoria de cada predicao por ID.

### Construir

- `GET /api/predictions/today`: jogos e props candidatas com probabilidade, confianca, edge, EV, risco e razoes.
- `GET /api/predictions/[id]`: auditoria da predicao, input snapshot, output, status e outcome.
- `GET /api/model-runs`: versoes de engine/modelo e metricas conhecidas.
- `GET /api/accuracy`: metricas reais de predicoes liquidadas.
- Migracao SQL versionada para tabelas operacionais.

## Roadmap Por Sprints

### Sprint 0: Fundacao e Verdade do Sistema

- Criar este documento mestre.
- Corrigir lint/build/test baseline.
- Remover build com TypeScript mascarado.
- Proteger debug e sync em producao.
- Aceite: `npm run lint`, `npm run typecheck` e `npm run build` devem falhar quando houver erro real.

### Sprint 1: Banco, Migracoes e Contratos

- Criar migracoes SQL versionadas.
- Adicionar tabelas `sync_runs`, `provider_runs`, `odds_snapshots`, `predictions`, `prediction_outcomes`, `model_runs`.
- Definir tipos centrais em codigo.
- Aceite: banco limpo pode ser preparado por migracao e runtime continua compativel.

### Sprint 2: Pipeline de Dados NBA

- Registrar sync runs e provider health.
- Persistir odds snapshots em Postgres quando `DATABASE_URL` existir.
- Manter fallback local somente para desenvolvimento.
- Aceite: `/api/health` mostra cobertura, cache e estado operacional suficiente.

### Sprint 3: Prediction Engine Auditavel V1

- Reposicionar engine atual como heuristica versionada.
- Persistir predicoes geradas.
- Gerar input snapshot e output auditavel.
- Aceite: toda pick exibida por `/api/predictions/today` possui ID consultavel.

### Sprint 4: Settlement e Betting Analytics

- Liquidar previsoes com boxscore final.
- Calcular win/loss/push, MAE, Brier score, ROI, CLV e sample size.
- Aceite: `/api/accuracy` usa outcomes persistidos.

### Sprint 5: Produto do Usuario

- Dashboard "Hoje" orientado a decisoes.
- Filtros por risco, confianca, mercado, time e edge.
- Linguagem probabilistica e responsavel.
- Aceite: fluxo completo de jogo -> props -> auditoria -> historico.

### Sprint 6: Operacao, Observabilidade e Escala

- Logs estruturados, alertas de sync/provider e budgets de latencia.
- Indices e paginacao para endpoints principais.
- Preparar dataset e baseline ML V2 somente apos dados confiaveis.
- Aceite: deploy Railway reproduzivel e rollback claro.

## Passo A Passo de Execucao

1. Corrigir fundacao de qualidade e seguranca.
2. Aplicar migracao operacional.
3. Persistir syncs, odds e predicoes.
4. Expor endpoints auditaveis.
5. Trocar acuracia proxy por outcomes.
6. Melhorar UI do usuario.
7. Adicionar settlement.
8. Iniciar ML V2 somente com historico validado.

## Criterios de Teste

- Unitarios: odds math, risk mapping, probability output, contracts.
- Integracao: sync runs, persistence fallback, predictions today, prediction audit.
- API contract: respostas padronizadas sem quebrar UI quando providers degradarem.
- Seguranca: sync/debug protegidos em producao.
- Performance: `/api/predictions/today` deve mirar menos de 800ms com cache quente.

## Assumptions

- Usuario inicial: analista/bettor.
- Politica: probabilidades auditaveis, nao picks infaliveis.
- Infra: Railway + Postgres.
- Redis: opcional em sprint posterior.
- ML avancado: somente apos registry, features e outcomes confiaveis.
