# TECHNICAL-AUDIT - Vitrine360 - Central Comercial Digital

## 1. Arquitetura atual

O Vitrine360 roda hoje com:

- `React 19`
- `TanStack Start`
- `TanStack Router`
- `Vite 7`
- `Tailwind CSS 4`
- `PostgreSQL`
- `Playwright`

A aplicacao segue uma arquitetura full-stack leve com:

- rotas publicas SSR/hibridas
- server functions para operacoes administrativas e IA
- camada resolvida de storefront em `src/lib/commercial-data.server.ts`
- persistencia principal em PostgreSQL
- fallback em memoria e seed local para desenvolvimento e contingencia

## 2. Rotas e modulos

Rotas publicas principais:

- `/`
- `/catalogo`
- `/categoria/$slug`
- `/produto/$slug`
- `/ofertas`
- `/campanha/$slug`
- `/totem`
- `/vitrine`

Rotas administrativas principais:

- `/admin`
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

## 3. Banco de dados

Direcao atual:

- PostgreSQL como fonte principal
- `src/data/*` apenas como seed/fallback

Estrutura relevante ja presente em migration:

- `stores`
- `store_settings`
- `categories`
- `products`
- `product_images`
- `campaigns`
- `campaign_products`
- `banners`
- `media_assets`
- `totem_settings`
- `vitrine_settings`
- `user_roles`
- `audit_logs`
- `analytics_events`
- `leads`

Observacao importante:

- o ambiente local cai para fallback em memoria quando `DATABASE_URL` nao responde
- isso ajuda desenvolvimento e automacao, mas nao substitui homologacao com banco oficial

## 4. Storage e midia

Estado atual:

- uploads administrativos simples funcionando
- arquivos persistidos em `storage/media`
- entrega publica via `/api/public/media`
- metadados basicos salvos em `media_assets`

Limitacoes atuais:

- sem upload multiplo
- sem drag and drop
- UX ainda sem fluxo rico completo para galeria/ambientacao/tecnica
- sem pipeline automatico de otimizacao e variantes

## 5. IA Comercial

Camada atual:

- `src/lib/ai-provider.ts`
- `src/lib/ai.functions.ts`

Configuracao neutra:

- `AI_PROVIDER`
- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`

Comportamento:

- fallback local controlado quando a chave falta ou o provedor falha
- testes nao dependem de credito real
- pronto para piloto assistido, ainda pedindo monitoramento de custo e erro em producao

## 6. SEO e descoberta

Ja existe:

- `robots.txt`
- `manifest.webmanifest`
- `sitemap.xml`
- canonical base
- OpenGraph base
- SEO base nas rotas de produto, categoria e campanha

Ainda precisa:

- JSON-LD mais rico por entidade
- validacao final com dominio oficial
- auditoria Lighthouse em ambiente publicado

## 7. Performance

Estado atual:

- code splitting por rotas e vendors
- build client aprovado
- bundle principal client em torno de `391 kB`
- chunks SSR ainda com vendors relativamente pesados

Gargalos observados:

- imagens reais ainda podem pesar no piloto
- a camada de fallback amplia complexidade de runtime
- preview/E2E ainda emitem warnings do ecossistema TanStack e `pg`

## 8. Seguranca

Ja protegido:

- `/admin` exige autenticacao
- tokens administrativos ficam server-side
- perfis e capacidades basicas existem
- a base de `audit_logs` foi criada

Riscos residuais:

- confirmar `VITE_ENABLE_DEV_ADMIN_BYPASS=0` em producao
- validar permissoes com usuarios reais e banco oficial
- revisar operacoes destrutivas apenas para perfil master

## 9. Testes e scripts

Scripts validados:

- `npm run format`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

Resultado atual:

- desktop: `9/9` passando
- mobile: `6/6` passando e `3` skips controlados para cenarios de tela grande/simulador

## 10. Pendencias tecnicas prioritarias

1. homologar `DATABASE_URL` oficial e aplicar migrations no ambiente real
2. reduzir dependencia operacional de fallback em fluxos publicos
3. ampliar biblioteca de midia e relacoes por contexto
4. concluir refinamento de SEO estruturado
5. validar analytics, IA e totem/vitrine em ambiente final

## 11. Diagnostico tecnico

Classificacao atual:

**Base tecnica consistente para produto piloto assistido**

O projeto nao esta mais em estado de prototipo fragil. A base tecnica e boa, os testes estao estaveis e a arquitetura suporta evolucao. O principal trabalho agora e de consolidacao operacional e de fechamento da ultima milha de producao.
