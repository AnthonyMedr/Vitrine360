# Vitrine360 - Central Comercial Digital

Aplicacao web desenvolvida pela **InfiniTI Labs** para operacao comercial digital assistida, com catalogo interativo, campanhas, WhatsApp, QR Code, IA Comercial, simulador de ambientes, modo totem, vitrine em TV e painel administrativo.

**Desenvolvido por InfiniTI Labs.**

## Posicionamento oficial

O Vitrine360 e uma **solucao comercial digital implantada, configurada, mantida e acompanhada pela InfiniTI Labs**.

Nao e:

- SaaS de autoassinatura
- plataforma de pagamento
- checkout
- gateway financeiro
- e-commerce completo
- ERP
- CRM financeiro

Pagamentos, mensalidades, comodato, seguro, reajustes e cobranca ficam fora da plataforma e devem ser tratados por proposta comercial, contrato e operacao da InfiniTI.

## O que o projeto faz hoje

- pagina inicial comercial
- catalogo com busca, filtros e categorias
- paginas de produto, categoria e campanha
- ofertas e destaques promocionais
- CTA por WhatsApp
- QR Codes
- recomendador de produtos com IA
- simulador de ambientes com IA
- modo totem
- modo vitrine para TV/monitor
- dashboard administrativo
- CRUD operacional de produtos, categorias, campanhas, banners e configuracoes principais
- biblioteca de midia com upload simples e relacoes operacionais principais
- analytics, leads e exportacao CSV
- sitemap, robots, manifest e service worker
- dashboard administrativo guiado com KPIs, filtros, atalhos e orientacao de operacao
- interface administrativa refinada com linguagem visual mais industrial, clara e operacional

## Estado atual

Classificacao atual do produto:

**Solucao Comercial Digital Implantada / Produto Piloto Assistido**

Classificacao atual do `/admin`:

**Admin operacional avancado**

Resumo honesto do estado:

- o produto ja pode ser demonstrado e operado em piloto assistido
- a base de gestao dinamica via PostgreSQL/Admin ja cobre produtos, categorias, campanhas, banners, papeis e configuracoes operacionais principais
- o dashboard administrativo agora funciona como ponto de entrada guiado, com leitura rapida, atencao comercial e proximas acoes
- os modulos principais do Admin ja seguem uma linguagem visual mais consistente, com foco em legibilidade, operacao e facilidade de uso
- homepage, campanhas principais, ofertas, totem, vitrine, QR Codes administrativos e configuracoes-base ja usam a camada resolvida do storefront
- ainda existem dependencias de fallback/local seed como contingencia, especialmente para ambiente sem banco oficial ou sem carga homologada
- o que falta agora esta concentrado em homologacao comercial final, validacao em hardware real e ambiente oficial de producao

## IA Comercial no roadmap

Recursos de IA Comercial estao previstos no roadmap futuro do Vitrine360, incluindo recomendacao de produtos, apoio ao vendedor, simulador consultivo de ambientes e geracao assistida de textos comerciais.

Importante:

- esses recursos ainda nao fazem parte do escopo obrigatorio atual em sua forma completa
- qualquer evolucao futura deve ter controle de uso, seguranca de chaves e integracao ao catalogo real da loja
- a IA deve apoiar a operacao comercial, e nao substituir catalogo, Admin, WhatsApp ou atendimento humano

## Stack

- `React 19`
- `TanStack Start`
- `TanStack Router`
- `TanStack Query`
- `Vite 7`
- `Tailwind CSS 4`
- `PostgreSQL`
- `Playwright`
- `Node.js`

## Estrutura principal

```text
.
|-- public/
|-- src/
|   |-- components/
|   |-- config/
|   |-- context/
|   |-- data/
|   |-- hooks/
|   |-- integrations/
|   |   `-- postgres/
|   |-- lib/
|   `-- routes/
|-- database/
|   `-- migrations/
|-- scripts/
|-- storage/
|   `-- media/
|-- tests/e2e/
|-- DOCUMENTO-PROJETO.md
|-- GO-LIVE-CHECKLIST.md
|-- PROJECT-SCOPE.md
|-- ROADMAP.md
|-- AUDIT-REPORT.md
|-- EXECUTION-PLAN.md
|-- ACTION-PLAN.md
|-- package.json
|-- playwright.config.ts
|-- vite.config.ts
`-- .env.example
```

## Modulos e rotas

Rotas publicas:

- `/`
- `/catalogo`
- `/categoria/$slug`
- `/produto/$slug`
- `/ofertas`
- `/campanha/$slug`
- `/totem`
- `/vitrine`
- `/sitemap.xml`

Rotas administrativas:

- `/admin`
- `/admin/login`
- `/admin/produtos`
- `/admin/categorias`
- `/admin/campanhas`
- `/admin/conteudo`
- `/admin/midia`
- `/admin/loja`
- `/admin/totem`
- `/admin/vitrine-tv`
- `/admin/usuarios`
- `/admin/relatorios`
- `/admin/qrcodes`
- `/admin/seo`
- `/admin/seo-agendamentos`
- `/admin/configuracoes-tecnicas`

## Configuracao

Branding central:

- `src/config/brand.ts`

Camada de IA:

- `src/lib/ai-provider.ts`
- `src/lib/ai.functions.ts`

Observacao:

- a base atual ja possui recursos de IA em modo operacional controlado para piloto assistido
- esta etapa documental nao adiciona nenhuma nova integracao, dependencia ou custo automatico de IA

Dados locais legados usados como seed/fallback:

- `src/data/products.ts`
- `src/data/categories.ts`
- `src/data/campaigns.ts`

Migracao/estrutura comercial no PostgreSQL:

- `database/migrations/20260611130000_commercial_admin_foundation.sql`
- `database/migrations/20260612110000_admin_commercial_expansion.sql`
- `prisma/schema.prisma`
- `prisma/migrations/`

## Variaveis de ambiente

Consulte `.env.example`.

Para publicacao, use `.env.production.example` como referencia. O arquivo `.env.production` nao deve ser versionado.

Padrao esperado:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vitrine360
APP_BASE_URL=
ADMIN_BOOTSTRAP_EMAIL=
ADMIN_BOOTSTRAP_PASSWORD=
ADMIN_BOOTSTRAP_TOKEN=
VITE_ENABLE_DEV_ADMIN_BYPASS=0
VITE_PUBLIC_SITE_URL=https://definir-dominio-oficial.exemplo.com

AI_PROVIDER=openai-compatible
AI_API_KEY=
AI_BASE_URL=
AI_MODEL=
```

Importante:

- nunca exponha `credenciais administrativas` e `DATABASE_URL` no frontend
- nao exponha chaves privadas de IA via `VITE_`
- mantenha segredos apenas em server functions e ambiente servidor

## Como instalar e rodar

Fluxo principal suportado:

```bash
npm install
npm run db:up
npm run db:status
npm run db:migrate
npm run db:seed
npm run dev
```

Comandos oficiais:

```bash
npm run db:up
npm run db:status
npm run db:migrate
npm run db:migrate:prod
npm run db:seed
npm run db:seed:prod
npm run db:reset
npm run prisma:generate
npm run prisma:pull
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
npm run prisma:studio
npm run pilot:content:init
npm run pilot:content:apply
npm run pilot:content:report
npm run pilot:content:checklist
npm run production:env:init
npm run go-live:preflight
npm run go-live:report
npm run production:next
npm run production:handoff
npm run production:check
npm run production:check:local
npm run format
npm run lint
npm run build
npm run preview
npm run test:e2e:desktop
npm run test:e2e:mobile
npm run test:e2e
```

Observacoes:

- existe historico de uso com Bun, mas o fluxo padrao documentado desta base e `npm`
- a execucao agora prioriza PostgreSQL real via `DATABASE_URL`
- Prisma esta configurado como ORM progressivo: o schema e as migrations Prisma existem, mas as rotas atuais ainda usam majoritariamente a camada `pg` existente
- use `npm run prisma:migrate:deploy` para aplicar migrations Prisma em ambientes ja configurados
- use `npm run prisma:migrate:dev` apenas em desenvolvimento, quando quiser criar uma nova migration a partir de alteracoes no `prisma/schema.prisma`
- quando o banco ainda nao estiver disponivel, a aplicacao entra em fallback controlado para manter desenvolvimento e testes locais
- o ambiente local padrao sobe PostgreSQL em `localhost:5433` via `docker compose`
- para `npm run db:up` funcionar no Windows, o Docker Desktop precisa estar em execucao
- `npm run db:status` faz um preflight rapido do Docker e da conexao PostgreSQL local antes de migrar, subir app ou rodar checks
- `npm run go-live:preflight` consolida diagnostico local, readiness local e readiness oficial em uma unica execucao
- `npm run go-live:report` gera `GO-LIVE-STATUS.md` com um resumo compartilhavel do estado atual da publicacao
- `npm run production:next` gera `PRODUCTION-NEXT-STEPS.md` com a sequencia priorizada e acionavel para fechar producao
- `npm run production:handoff` executa preflight, relatorio e plano de proximos passos em uma passada so
- uploads de midia persistem em `storage/media/` e sao servidos por `/api/public/media`
- `npm run pilot:content:init` cria o arquivo base para homologacao comercial do piloto
- `npm run pilot:content:apply` aplica no banco local os ajustes aprovados em `PILOTO-CONTENT-APPROVED.json`
- o build possui limpeza automatica de `dist/` antes da compilacao para evitar preview quebrado por artefatos antigos
- `npm run pilot:content:report` gera um snapshot markdown do conteudo atual do piloto a partir do banco local
- `npm run pilot:content:checklist` gera `PILOTO-CONTENT-CHECKLIST.md` com a trilha de aprovacao comercial a partir do snapshot e do arquivo aprovado

## Validacao de producao

Antes do Go-Live assistido:

```bash
npm run production:env:init
npm run go-live:preflight
npm run production:check
```

Para validar apenas o ambiente local atual:

```bash
npm run production:check:local
```

Esse comando valida:

- presenca de `DATABASE_URL`, `APP_BASE_URL` e `VITE_PUBLIC_SITE_URL`
- status do `VITE_ENABLE_DEV_ADMIN_BYPASS`
- conectividade com PostgreSQL
- existencia das tabelas principais
- contagem basica de loja, usuarios, produtos, categorias, campanhas e midia
- disponibilidade do storage local em `storage/media`

Observacao:

- `npm run production:env:init` cria `.env.production` a partir do template, se ele ainda nao existir
- `npm run production:check` agora espera um arquivo `.env.production`
- `npm run production:check:local` usa o `.env` do ambiente local
- a validacao local aceita URLs localhost e nao trata o bootstrap administrativo local como pendencia de publicacao
- se o PostgreSQL local nao estiver ativo, o checker agora informa `ECONNREFUSED` com a porta tentada e orienta revisar Docker/PostgreSQL

## Testes

Suites E2E atuais:

- `tests/e2e/smoke.spec.ts`
- `tests/e2e/ai-recommender.spec.ts`
- `tests/e2e/room-simulator.spec.ts`
- `tests/e2e/display-modes.spec.ts`

Resultado mais recente validado:

- `npm run lint` -> OK
- `npm run build` -> OK
- `npm run test:e2e` -> OK, `15` testes executados com `3` skips controlados no mobile

Observacoes:

- `npm run test:e2e` executa desktop e mobile em sequencia para maior estabilidade local no Windows
- os skips atuais no mobile sao intencionais para cenarios operacionais de tela grande e para o fluxo completo do simulador, ja cobertos por desktop e smoke responsivo
- os testes rodam com fallback controlado da camada de IA, sem depender de credito real em automacao

## Pendencias conhecidas

- homepage e configuracoes globais ainda nao estao 100% hidratadas pelo banco em todos os fluxos de personalizacao visual
- sitemap ja usa a camada resolvida do storefront, mas ainda precisa de validacao final com dominio oficial
- SEO dinamico por produto/categoria/campanha foi ligado nas rotas principais e ainda precisa de refinamento com JSON-LD mais completo
- biblioteca de midia ainda nao cobre upload multiplo, drag and drop, galeria, ambientacoes e relacoes completas por contexto
- banners e destaques ja contam com preview da midia selecionada, geracao assistida de slug e leitura mais clara do destino comercial
- `/totem` e `/vitrine` ja consomem configuracoes operacionais principais do painel, mas ainda precisam de homologacao em hardware real e validacao com conteudo final
- analytics e leads ainda precisam de validacao final em ambiente publicado, especialmente a fila local de eventos
- PostgreSQL local ja esta operacional com migration e seed, mas a publicacao oficial ainda depende de `DATABASE_URL` de producao, dominio oficial e reducao gradual dos fallbacks locais
- a camada de temas existe por tokens e configuracoes operacionais, mas ainda nao ha design system formal nem personalizacao visual robusta por cliente

## Documentos oficiais

- `README.md`
- `GO-LIVE-CHECKLIST.md`
- `GO-LIVE-RUNBOOK.md`
- `PROJECT-SCOPE.md`
- `TECHNICAL-AUDIT.md`
- `UI-UX-AUDIT.md`
- `PROJECT-STATUS-REPORT.md`
- `ROADMAP.md`
- `AUDIT-REPORT.md`
- `EXECUTION-PLAN.md`
- `ACTION-PLAN.md`

## Direcao recomendada

1. configurar dominio e ambiente oficial
2. homologar conteudo real do cliente piloto
3. validar banco, analytics, IA e seguranca em producao
4. concluir o Admin como centro de gestao comercial
5. fechar o Go-Live assistido ponta a ponta

**Desenvolvido por InfiniTI Labs.**
