# NBA Metricas - Banco e Migracoes

## Objetivo

Este documento define o modo oficial de aplicar, auditar e evoluir migracoes Postgres do NBA Metricas.

O projeto ainda possui criacao defensiva de algumas tabelas em runtime para compatibilidade, mas o caminho operacional correto e:

1. criar migracao SQL versionada em `migrations/`;
2. aplicar a migracao no banco alvo antes do deploy;
3. validar schema, health e endpoints;
4. registrar o resultado em `docs/PROJECT_EXECUTION_CHECKLIST.md`.

## Convencao de arquivos

- Local: `migrations/`
- Padrao de nome: `NNN_descricao_curta.sql`
- Exemplo atual: `001_operational_schema.sql`
- Cada migracao deve ser idempotente quando possivel, usando `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` e `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Mudancas destrutivas exigem migracao separada, plano de backup e janela operacional.

## Aplicar localmente com Docker

Subir infraestrutura:

```bash
docker compose up -d db redis-cache
```

Aplicar a migracao inicial:

```powershell
Get-Content migrations/001_operational_schema.sql | docker compose exec -T db psql -U postgres -d nba_metricas -v ON_ERROR_STOP=1 -f -
```

Validar tabelas operacionais:

```powershell
docker compose exec -T db psql -U postgres -d nba_metricas -t -A -c "select table_name from information_schema.tables where table_schema='public' and table_name in ('sync_runs','provider_runs','odds_snapshots','predictions','prediction_outcomes','model_runs') order by table_name;"
```

Resultado esperado:

```text
model_runs
odds_snapshots
prediction_outcomes
predictions
provider_runs
sync_runs
```

Validar app local contra o banco Docker:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/nba_metricas'
npm run build
npm run start
```

Smoke check publico:

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/health -UseBasicParsing
```

Endpoints protegidos como `/api/predictions/today`, `/api/model-runs` e `/api/accuracy` devem ser testados com sessao autenticada.

## Aplicar no Railway

1. Confirmar que o servico Postgres existe no Railway.
2. Confirmar que `DATABASE_URL` da app aponta para o Postgres Railway, nao para `db:5432`.
3. Abrir um shell seguro com acesso ao banco ou executar o SQL pelo cliente aprovado do Railway.
4. Aplicar `migrations/001_operational_schema.sql` com `ON_ERROR_STOP=1`.
5. Validar `/api/health` no dominio publico.

Validacao esperada em `/api/health`:

- `providers.database` deve estar `configured`;
- `services.database` deve estar `ok`;
- `operations.latestSyncRuns` deve responder sem erro de schema.

## Auditoria

Depois de aplicar uma migracao, registrar no checklist:

- data;
- ambiente (`local`, `staging`, `production`);
- arquivo SQL aplicado;
- commit do schema/documentacao;
- comando de verificacao;
- resultado objetivo.

Para auditoria manual, consultar tabelas criadas e indices:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select indexname, tablename
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

## Rollback

Rollback padrao e restaurar backup/snapshot do Postgres. Nao fazer `DROP TABLE` ou `DELETE` em massa como rollback rapido.

Para mudancas futuras:

- criar migracao forward-only sempre que possivel;
- se houver risco de perda de dados, criar backup antes;
- se precisar reverter, criar uma nova migracao corretiva;
- documentar impacto e validacao no checklist.

## Checklist para novas migracoes

- [ ] Nome sequencial em `migrations/NNN_descricao.sql`.
- [ ] SQL idempotente quando possivel.
- [ ] Indices revisados para rotas/API afetadas.
- [ ] Aplicada em Postgres local Docker.
- [ ] Validada com `npm run typecheck`, `npm run build` e `/api/health`.
- [ ] Aplicada em Railway staging/producao quando aprovado.
- [ ] `docs/PROJECT_EXECUTION_CHECKLIST.md` atualizado.
