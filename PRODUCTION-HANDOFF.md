# Handoff de Producao - Vitrine360

## Objetivo

Concluir o preenchimento do ambiente oficial e validar o Vitrine360 antes da publicacao assistida.

## 1. Arquivo de ambiente oficial

Arquivo base atual:

- `.env.production`

Campos que ainda exigem valor real:

- `DATABASE_URL`
- `APP_BASE_URL`
- `VITE_PUBLIC_SITE_URL`
- `ADMIN_BOOTSTRAP_EMAIL` se o e-mail final mudar do padrao homologado
- `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_BOOTSTRAP_TOKEN`
- `AI_API_KEY` apenas se a IA real for ativada no ambiente oficial
- `AI_BASE_URL` se houver endpoint dedicado
- `AI_MODEL` se houver modelo fixo de producao

Bootstrap homologado nesta fase:

- `ADMIN_BOOTSTRAP_EMAIL=admin@infinitilabs.com.br`

Observacao sobre PostgreSQL/SSL:

- para ambiente oficial, prefira `sslmode=verify-full` na `DATABASE_URL`
- esse padrao reduz ambiguidade com o aviso atual do ecossistema `pg`
- use `require` apenas se a infraestrutura oficial exigir isso conscientemente

## 2. Ordem de execucao recomendada

1. preencher `.env.production`
2. rodar `npm run production:handoff`
3. rodar `npm run production:check`
4. aplicar `npm run db:migrate:prod`
5. aplicar `npm run db:seed:prod` apenas se o banco oficial ainda nao tiver carga homologada
6. publicar a aplicacao no ambiente SSR oficial
7. validar rotas publicas e `/admin`
8. executar `GO-LIVE-CHECKLIST.md`

Validacao manual minima recomendada no navegador:

1. login em `/admin/login`
2. leitura do dashboard em `/admin`
3. edicao simples em produtos, campanhas, categorias e loja
4. revisao visual de `/totem` em 1920x1080 e orientacao vertical
5. revisao visual de `/vitrine` em 1920x1080
6. leitura de QR Code em tela real ou em simulacao com celular

## 3. Criterios para considerar o ambiente pronto

- `production:check` sem erros criticos
- `VITE_ENABLE_DEV_ADMIN_BYPASS=0`
- dominio oficial respondendo em `APP_BASE_URL` e `VITE_PUBLIC_SITE_URL`
- PostgreSQL oficial acessivel com leitura e escrita
- bootstrap admin com senha e token reais
- login administrativo validado com `admin@infinitilabs.com.br` ou o e-mail final definido
- IA configurada ou assumida conscientemente em modo sem chave para fase de piloto

## 4. Homologacao do piloto

Arquivos de apoio:

- `PILOTO-CONTENT-REVIEW.md`
- `PILOTO-CONTENT-SNAPSHOT.md`
- `PILOTO-CONTENT-APPROVED.json`

Fluxo:

1. revisar o snapshot tecnico atual
2. preencher `PILOTO-CONTENT-APPROVED.json` com o conteudo aprovado
3. aplicar localmente com `npm run pilot:content:apply`
4. validar no navegador
5. promover para o ambiente oficial

## 5. Bloqueios que dependem de dado externo

Itens que nao podem ser concluidos automaticamente pelo repositorio:

- dominio oficial e SSL
- credenciais do PostgreSQL oficial
- confirmacao final da senha/token administrativos definidos
- chave real do provedor de IA, apenas se a fase oficial ativar IA real
- midia final aprovada pelo cliente piloto
- validacao fisica de totem, TV e QR Code

## 6. Status validado em 2026-06-18

Resultado objetivo da trilha atual:

- `npm run build` aprovado
- `npm run lint` aprovado
- `npm run db:status` agora existe como diagnostico rapido da stack local
- `npm run production:check` bloqueado apenas por placeholders em `.env.production`
- `npm run production:check:local` bloqueado na estacao atual apenas porque Docker/PostgreSQL local nao estavam ativos

Pendencias confirmadas no arquivo oficial de ambiente:

- `DATABASE_URL` ainda esta como template
- `ADMIN_BOOTSTRAP_PASSWORD` e `ADMIN_BOOTSTRAP_TOKEN` exigem apenas confirmacao final da credencial escolhida
- `AI_API_KEY` nao e obrigatoria quando `AI_PROVIDER=mock`

Pendencias operacionais confirmadas na estacao atual:

- Docker Desktop indisponivel no momento da execucao
- PostgreSQL local indisponivel em `127.0.0.1:5433`

Contagem atual do ambiente local validado:

- lojas: `1`
- usuarios: `1`
- produtos: `10`
- categorias: `9`
- campanhas: `3`
- midias: `13`

Auditoria rapida de exposicao de segredos:

- `VITE_PUBLIC_SITE_URL` permanece apenas como configuracao publica esperada
- `VITE_ENABLE_DEV_ADMIN_BYPASS` e flag operacional e deve seguir `0` em producao
- nao foi encontrado uso de `VITE_` para `DATABASE_URL`, `AI_API_KEY`, senha ou token administrativo
