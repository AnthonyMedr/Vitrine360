# GO-LIVE Status Report - Vitrine360

Gerado automaticamente em 2026-06-19T17:02:30.689Z.

## 1. Resumo executivo

- Status do diagnostico local: **OK**
- Status do readiness local: **OK**
- Status do readiness oficial: **Falhou**

## 2. Ambiente local

- `.env`: encontrado
- PostgreSQL local esperado em: `postgresql://postgres:postgres@localhost:5433/vitrine360`
- APP local: `http://127.0.0.1:3000`
- Site publico local: `http://127.0.0.1:3000`

## 3. Ambiente oficial

- `.env.production`: encontrado

| Campo | Status | Valor |
| --- | --- | --- |
| `DATABASE_URL` | placeholder | postgresql://usuario:senha@host-producao:5432/vitrine360?sslmode=verify-full |
| `APP_BASE_URL` | definido | https://app.vitrine360.infiniti.com.br |
| `VITE_PUBLIC_SITE_URL` | definido | https://app.vitrine360.infiniti.com.br |
| `ADMIN_BOOTSTRAP_EMAIL` | definido | admin@infinitilabs.com.br |
| `ADMIN_BOOTSTRAP_PASSWORD` | definido | (definido) |
| `ADMIN_BOOTSTRAP_TOKEN` | definido | (definido) |
| `AI_PROVIDER` | definido | mock |
| `AI_API_KEY` | nao aplicavel | (vazio) |
| `AI_BASE_URL` | ausente | (vazio) |
| `AI_MODEL` | ausente | (vazio) |

## 4. Comandos executados

| Comando | Resultado |
| --- | --- |
| `npm run db:status` | OK |
| `npm run production:check:local` | OK |
| `npm run production:check` | Falhou |

## 5. Saida resumida - diagnostico local

```text
== Vitrine360 database status ==
[OK] postgres acessivel (vitrine360)

Resultado: stack local pronta para uso.

[FAIL] docker respondeu com erro: WARNING: Error loading config file: open C:\Users\kelma\.docker\config.json: Acesso negado.
permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine
[WARN] Confirme se o daemon do Docker Desktop esta ativo.
[WARN] Docker indisponivel, mas o PostgreSQL esta acessivel por fora do Docker.
```

## 6. Saida resumida - readiness local

```text
== Vitrine360 production readiness check ==
[OK] DATABASE_URL definido.
[OK] APP_BASE_URL definido para ambiente local (http://127.0.0.1:3000).
[OK] VITE_PUBLIC_SITE_URL definido para ambiente local (http://127.0.0.1:3000).
[OK] VITE_ENABLE_DEV_ADMIN_BYPASS desabilitado.
[OK] AI_PROVIDER definido (mock).
[OK] conectado ao PostgreSQL (vitrine360)
[OK] tabela encontrada: stores
[OK] tabela encontrada: auth_users
[OK] tabela encontrada: products
[OK] tabela encontrada: categories
[OK] tabela encontrada: campaigns
[OK] tabela encontrada: media_assets
[OK] tabela encontrada: leads
[OK] tabela encontrada: analytics_events
[OK] tabela encontrada: audit_logs
[OK] tabela encontrada: store_settings
[OK] tabela encontrada: totem_settings
[OK] tabela encontrada: vitrine_settings
[OK] contagens atuais - stores:1 users:1 products:10 categories:9 campaigns:3 media:14
[OK] storage local disponivel em C:\vitrine360\storage\media

Resultado: ambiente pronto para validacao assistida.
```

## 7. Saida resumida - readiness oficial

```text
== Vitrine360 production readiness check ==
[OK] APP_BASE_URL definido para ambiente nao local.
[OK] VITE_PUBLIC_SITE_URL definido para dominio publico.
[OK] VITE_ENABLE_DEV_ADMIN_BYPASS desabilitado.
[OK] AI_PROVIDER definido (mock).
[OK] storage local disponivel em C:\vitrine360\storage\media

[FAIL] DATABASE_URL ainda contem valor placeholder/template.

Resultado: 1 erro(s) critico(s) encontrados.
```

## 8. Pendencias objetivas

1. Substituir placeholders restantes de `.env.production`.
2. Executar `npm run db:migrate:prod` no PostgreSQL oficial.
3. Reexecutar `npm run production:check`.
4. Validar login administrativo com o bootstrap final.
5. Seguir para `GO-LIVE-RUNBOOK.md` e `GO-LIVE-CHECKLIST.md`.
