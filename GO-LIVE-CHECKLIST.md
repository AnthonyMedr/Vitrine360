# Vitrine360 - Central Comercial Digital - Checklist de Go-Live

**Desenvolvido por InfiniTI Labs.**

## 1. Conteudo

- [x] Criar roteiro de revisao comercial em `PILOTO-CONTENT-REVIEW.md`
- [x] Executar seed inicial do catalogo no PostgreSQL local
- [ ] Revisar produtos, categorias e campanhas do cliente piloto
- [ ] Confirmar se o fallback local continuara habilitado na publicacao inicial
- [ ] Validar textos institucionais, WhatsApp, endereco e horario da loja
- [ ] Revisar banners, destaques e imagens reais antes da publicacao
- [ ] Executar `npm run db:migrate` no ambiente oficial antes da carga inicial

## 2. SEO

- [x] `robots.txt` com bloqueio de `/admin` e `/totem`
- [x] Manifest e metadados base com assinatura InfiniTI
- [x] Sitemap publicado em `/sitemap.xml`
- [x] SEO base por produto, categoria e campanha ligado nas rotas principais
- [ ] Definir `VITE_PUBLIC_SITE_URL` com dominio oficial
- [ ] Validar sitemap com dominio oficial
- [ ] Completar JSON-LD por entidade
- [ ] Rodar Lighthouse SEO nas rotas principais
- [ ] Submeter sitemap ao Search Console apos publicar

## 3. Admin

- [x] Dashboard com KPIs e exportacao CSV
- [x] CRUD operacional de produtos, categorias e campanhas
- [x] Biblioteca de midia com upload simples e relacoes operacionais principais
- [x] Configuracoes da loja, totem e vitrine com controles operacionais principais
- [x] Refinar visual e usabilidade dos modulos principais do Admin para operacao assistida
- [x] Aplicar migration comercial no PostgreSQL local
- [ ] Executar seed inicial do banco com dados aprovados do cliente piloto
- [ ] Validar perfis e permissoes com usuarios reais
- [x] Concluir gestao dedicada de banners/destaques
- [x] Concluir relacoes de imagens por produto, campanha e exibicao

## 4. Analytics

- [x] Estrutura de analytics local e rotinas server-side existentes
- [x] Exportacao CSV no painel
- [ ] Definir estrategia de persistencia/flush dos eventos hoje mantidos em fila local no navegador
- [ ] Validar escrita de `leads` e `analytics_events` no ambiente real
- [ ] Validar leitura do dashboard com dados reais
- [ ] Confirmar politica de retencao, backup e monitoramento

## 5. IA Comercial

- [x] Recomendador de produtos
- [x] Simulador de ambientes
- [x] Fallback controlado em ambiente sem credito
- [x] Permitir Go-Live assistido com `AI_PROVIDER=mock` quando a IA comercial real ainda nao estiver homologada
- [ ] Configurar `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL` e `AI_MODEL` para ativacao comercial real
- [ ] Validar provedor real de IA com monitoramento de erro e custo antes da ativacao paga/assistida
- [ ] Definir politica de limite operacional por cliente implantado

## 6. Totem

- [x] Rota `/totem` operacional
- [x] Reset por inatividade ativo
- [x] CTA com WhatsApp e QR Code
- [x] QR Code ajustado para renderizacao estavel e tamanho contido
- [x] Validacao simulada em software com viewport operacional e fluxo E2E dedicado
- [ ] Validar touchscreen em equipamento fisico
- [ ] Validar 1920x1080 e comportamento em tela retrato/paisagem
- [x] Conectar configuracoes especificas do totem ao painel de forma completa
- [ ] Revisar offline controlado em ambiente real

## 7. Vitrine TV

- [x] Rota `/vitrine` operacional
- [x] Rotacao automatica de slides
- [x] Fallback para produtos/campanhas em destaque
- [x] Validacao simulada em software com viewport 16:9 e retrato dedicado
- [ ] Validar TV/monitor real em 16:9
- [x] Conectar configuracoes especificas da vitrine ao painel de forma completa
- [ ] Revisar densidade visual e tempo de transicao com conteudo real

## 8. Performance e Mobile

- [x] Build de producao funcional
- [x] Code splitting inicial por rotas e vendors
- [x] Limpeza automatica de `dist/` antes do build para evitar preview instavel
- [ ] Revisar bundle principal e vendors SSR pesados
- [ ] Validar 360px, 768px, desktop amplo, totem e TV
- [ ] Otimizar imagens reais antes do Go-Live

## 9. Seguranca

- [x] Segredos sensiveis fora do frontend documentados
- [x] Rotas administrativas protegidas por autenticacao
- [x] Base de audit logs e papeis criada
- [ ] Desabilitar `VITE_ENABLE_DEV_ADMIN_BYPASS` no ambiente publicado
- [ ] Validar regras finais de acesso no ambiente real
- [ ] Confirmar que nenhuma credencial privada esta em `VITE_`
- [ ] Revisar exclusao definitiva restrita ao perfil master

## 10. Publicacao

- [x] Criar template `.env.production.example`
- [x] Criar bootstrap `npm run production:env:init` para gerar `.env.production`
- [x] Criar preflight consolidado `npm run go-live:preflight`
- [x] Criar relatorio consolidado `npm run go-live:report`
- [x] Criar verificador `npm run production:check`
- [x] Separar a validacao local (`production:check:local`) da validacao oficial (`production:check`)
- [x] Validar ambiente local com `npm run production:check:local`
- [x] Corrigir instabilidade de refresh/F5 da home e do admin QR em ambiente local
- [ ] Definir dominio oficial e SSL
- [ ] Configurar variaveis de ambiente de producao
- [ ] Aplicar migrations no banco real
- [ ] Validar `DATABASE_URL` e conectividade de leitura/escrita
- [ ] Publicar build SSR no ambiente oficial
- [ ] Validar:
- [ ] `/`
- [ ] `/catalogo`
- [ ] `/categoria/{slug}`
- [ ] `/produto/{slug}`
- [ ] `/ofertas`
- [ ] `/campanha/{slug}`
- [ ] `/totem`
- [ ] `/vitrine`
- [ ] `/admin`

## 11. Pos-Go-Live

- [ ] Acompanhar primeira semana com validacao diaria do painel
- [ ] Monitorar leads, QR Codes, IA e uso do totem
- [ ] Coletar feedback do cliente piloto
- [ ] Priorizar fechamento do Admin completo como segunda etapa

## 12. Validacao tecnica atual

- [x] `npm run format`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] Testes E2E dedicados para `/totem` e `/vitrine` em viewport operacional simulado

**Observacao de escopo**

O Go-Live do Vitrine360 refere-se a uma **solucao comercial digital implantada e assistida pela InfiniTI**, nao a um SaaS de autoassinatura e nao a uma plataforma de pagamento.

**Apoio operacional**

Para a validacao manual no ambiente oficial, usar tambem:

- `GO-LIVE-RUNBOOK.md`

**Bloqueio atual de producao**

No momento, o bloqueio objetivo para fechar a validacao oficial esta em `.env.production`, que ainda usa placeholders para:

- `DATABASE_URL`

Itens adicionais que ainda exigem confirmacao operacional:

- senha/token administrativos finais
- dominio oficial publicado
- homologacao do banco oficial

**Bloqueio atual do ambiente local**

Na estacao atual, a verificacao local tambem depende de o PostgreSQL em `127.0.0.1:5433` estar ativo.

Validacao mais recente mostrou:

- `ECONNREFUSED` em `127.0.0.1:5433` e `::1:5433`
- Docker Desktop indisponivel no momento da execucao
- storage local validado normalmente

Acao pratica para retomar a trilha local:

1. executar `npm run db:status`
2. iniciar Docker Desktop ou o servico PostgreSQL local equivalente, se necessario
3. executar `npm run db:up`
4. executar `npm run production:check:local`

Validacao mais recente:

- `npm run production:check:local` aprovado em `2026-06-13`
- `npm run production:check:local` falhando em `2026-06-18` apenas por indisponibilidade do PostgreSQL local
- `npm run production:check` falhando apenas pelos placeholders acima
