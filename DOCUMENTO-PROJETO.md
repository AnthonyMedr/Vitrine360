# Documento do Projeto

## Identificacao

- Produto: `Vitrine360 - Central Comercial Digital`
- Empresa responsavel: `InfiniTI Labs`
- Assinatura oficial: `Desenvolvido por InfiniTI Labs.`
- Cliente piloto atual: `Gamel Distribuidora` (`Garanhuns Metal LTDA`, CNPJ `64.156.323/0001-51`)

## Resumo executivo

O Vitrine360 - Central Comercial Digital e uma plataforma comercial para lojas fisicas e canais digitais. O sistema integra catalogo de produtos, campanhas, ofertas, WhatsApp, QR Code, IA Comercial, simulador de ambientes, modo totem, modo vitrine para TV, SEO, analytics e painel administrativo.

O projeto nasceu para operacao assistida de um cliente piloto, mas esta sendo preparado como produto replicavel da InfiniTI Labs.

## Objetivo da fase atual

Transformar a base existente em uma versao profissional, estavel e assinada pela InfiniTI, pronta para Go-Live assistido.

Prioridades desta etapa:

1. consolidar PostgreSQL como base principal
2. reduzir dependencias residuais de fallback local
3. estabilizar publicacao, SEO e validacao em ambiente oficial
4. concluir o Admin como centro de gestao comercial
5. manter documentacao e escopo oficial alinhados

## Escopo funcional

Modulos contemplados:

- pagina inicial institucional/comercial
- ofertas e campanhas
- catalogo digital
- paginas de categoria
- paginas de produto
- recomendador de produtos com IA
- simulador de ambientes com IA
- modo totem
- modo vitrine em TV/monitor
- analytics e leads
- painel administrativo
- QR Codes persistentes
- auditoria SEO e sitemap

Fora de escopo nesta fase:

- billing
- checkout
- ERP
- CRM completo
- multiempresa avancado
- SaaS completo com autosservico

## Arquitetura

Camada web:

- `React 19`
- `TanStack Start`
- `TanStack Router`
- `TanStack Query`
- `Tailwind CSS 4`

Camada server:

- SSR com TanStack Start
- server functions para regras de negocio
- middlewares para autenticacao e tratamento de erro

Infra e servicos:

- `PostgreSQL` para auth, dados e operacao administrativa
- provedor de IA configuravel por ambiente
- `ambiente SSR padrao da InfiniTI` como alvo de deploy SSR

## Configuracao central

Arquivos-chave:

- `src/config/brand.ts`
- `src/lib/ai-provider.ts`
- `.env.example`
- `.env.production.example`

Esses arquivos concentram:

- nome oficial do produto
- nome da empresa
- assinatura institucional
- URL publica central
- SEO padrao
- configuracao de IA por variavel de ambiente

## Dados e integracoes

Dados locais atuais:

- `src/data/products.ts`
- `src/data/categories.ts`
- `src/data/campaigns.ts`
- `src/data/campaign.ts`

Persistencia principal em PostgreSQL:

- `stores`
- `products`
- `categories`
- `campaigns`
- `media_assets`
- `product_images`
- `users`
- `user_roles`
- `audit_logs`
- `leads`
- `analytics_events`
- `qrcodes`
- `seo_audits`
- `seo_audit_schedules`
- `content_items`

## IA Comercial

A camada de IA foi preparada para operar com variaveis neutras:

- `AI_PROVIDER`
- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`

Comportamento atual:

- usa provedor configuravel por ambiente
- possui fallback controlado para ambiente sem chave
- nao depende de credito real para rodar a suite E2E

## Seguranca

Diretrizes:

- nao expor `credenciais administrativas e acesso ao PostgreSQL`
- nao expor chaves privadas de IA no frontend
- manter credenciais de servidor apenas em server functions e clientes server-side
- usar `VITE_` apenas para valores publicos

## Estado tecnico atual

Criticos ja estabilizados:

- branding institucional aplicado
- build de producao funcionando
- lint sem erros
- testes E2E funcionando
- refresh/F5 estabilizado nas rotas afetadas
- QR Code publico ajustado

Pendencias para Go-Live assistido:

- dominio oficial
- credenciais reais
- revisao de conteudo do piloto
- validacao de analytics
- consolidacao final de totem, vitrine e midia

## Documentos relacionados

- guia tecnico: `README.md`
- checklist operacional: `GO-LIVE-CHECKLIST.md`
- escopo oficial: `PROJECT-SCOPE.md`
- auditoria: `AUDIT-REPORT.md`
- plano de acao: `ACTION-PLAN.md`

## Assinatura

**Desenvolvido por InfiniTI Labs.**
