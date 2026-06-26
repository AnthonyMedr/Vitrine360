# Plano de Acao - Pendencias do Vitrine360

## Objetivo

Fechar as pendencias restantes do projeto em ordem de impacto, reduzindo risco de publicacao e preparando o Vitrine360 para Go-Live assistido.

## Prioridade P0 - Publicacao oficial

1. [x] Definir trilha tecnica de producao com `production:env:init`, `db:migrate:prod`, `db:seed:prod` e `production:check`.
2. [ ] Definir `VITE_PUBLIC_SITE_URL` com dominio oficial.
3. [ ] Preencher variaveis finais a partir de `.env.production.example`.
4. [x] Criar handoff de preenchimento e validacao em `PRODUCTION-HANDOFF.md`.
5. [ ] Aplicar `npm run db:migrate:prod` no banco PostgreSQL oficial.
6. [ ] Executar `npm run production:check` no servidor final.
7. [ ] Confirmar `VITE_ENABLE_DEV_ADMIN_BYPASS=0` no ambiente publicado.

Status atual do P0:

- [x] `npm run production:check:local` aprovado no ambiente local
- [ ] `npm run production:check` oficial ainda bloqueado por `DATABASE_URL` placeholder em `.env.production`
- [ ] credenciais finais de bootstrap/IA de producao ainda precisam substituir os templates

## Prioridade P1 - Homologacao do piloto

1. [x] Criar trilha de snapshot tecnico com `npm run pilot:content:report`.
2. [x] Criar trilha de aprovacao editavel com `pilot:content:init` e `pilot:content:apply`.
3. [x] Criar checklist comercial derivada em `npm run pilot:content:checklist`.
4. [ ] Revisar `PILOTO-CONTENT-REVIEW.md` com o conteudo real do cliente.
5. [ ] Validar produtos, categorias, campanhas, WhatsApp, endereco e horarios.
6. [ ] Substituir imagens provisoria/seed por midia aprovada.
7. [ ] Testar QR Code com URL oficial e leitura real.
8. [ ] Confirmar o conteudo que deve aparecer em `/`, `/ofertas`, `/totem` e `/vitrine`.

## Prioridade P2 - Fechamento tecnico do produto

1. [x] Reduzir fallback/local seed restante nas rotas publicas.
2. [x] Adicionar protecao CSRF no runtime customizado do TanStack Start.
3. [x] Validar e conectar escrita real de `leads` e `analytics_events` ao PostgreSQL com fallback local.
4. [x] Completar SEO dinamico com JSON-LD mais rico.
5. [x] Revisar bundle principal e aplicar code splitting leve nas rotas publicas.
6. [ ] Validar totem e vitrine em hardware real (validacao simulada em software concluida).

## Prioridade P3 - Evolucao do Admin

1. [x] Criar modulo dedicado de banners e destaques.
2. [x] Ampliar biblioteca de midia com relacoes ricas por contexto na camada principal.
3. [x] Consolidar controle administrativo de totem e vitrine.
4. [x] Refinar permissoes e fluxos operacionais por perfil.
5. [~] Reduzir dependencia de edicao manual em codigo.

## Prioridade P4 - Go-Live assistido ponta a ponta

1. Executar `GO-LIVE-CHECKLIST.md` completo.
2. Validar manualmente as rotas publicas e `/admin` no ambiente oficial.
3. Acompanhar a primeira semana de operacao com monitoramento diario.
4. Registrar ajustes do piloto e alimentar a Fase 2 do roadmap.

## Sequencia recomendada

1. Ambiente oficial
2. Conteudo do piloto
3. Hardening tecnico e observabilidade
4. Validacao tecnica real
5. Admin completo
6. Go-Live assistido

## Execucao P0 / P1 / P2

### P0 - Go-Live agora

- preencher `.env.production` com valores reais
- executar `npm run production:check`
- aplicar `npm run db:migrate:prod`
- publicar o build SSR
- homologar conteudo final do piloto
- executar `GO-LIVE-RUNBOOK.md` e `GO-LIVE-CHECKLIST.md`

### P1 - Admin facil de operar

- tornar o painel mais autoexplicativo em todas as telas principais
- reduzir campos tecnicos expostos sem contexto
- adicionar orientacoes, hints, estados vazios e confirmacoes mais claras
- priorizar fluxo simples para produtos, categorias, campanhas, midia e loja
- validar a operacao com usuario nao tecnico do cliente piloto

### P2 - Admin maduro e escalavel

- substituir entradas tecnicas em JSON por UI guiada
- ampliar biblioteca de midia com upload multiplo, filtros e organizacao
- ampliar filtros no admin e evoluir estados vazios e confirmacoes
- consolidar governanca por perfil e auditoria operacional
- evoluir personalizacao e help contextual por modulo

## Criterio de encerramento

O plano se encerra quando o ambiente oficial estiver publicado com dominio e banco validados, o conteudo do piloto estiver homologado, o checklist de Go-Live estiver executado e as pendencias remanescentes estiverem limitadas a evolucao de produto, nao a risco de implantacao.
