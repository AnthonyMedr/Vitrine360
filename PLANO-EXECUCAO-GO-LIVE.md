# Plano de Execucao - Go-Live Assistido

## Objetivo

Concluir a passagem do Vitrine360 para um ambiente oficial de operacao assistida da InfiniTI, com banco PostgreSQL validado, storefront prioritariamente dinamico e checklist de publicacao fechado.

## Bloco 1 - Ambiente oficial

- [ ] definir `VITE_PUBLIC_SITE_URL`
- [ ] validar `DATABASE_URL` de producao
- [ ] validar `ADMIN_BOOTSTRAP_*`
- [ ] validar `AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL` e `AI_MODEL`
- [ ] validar analytics e eventos reais

## Bloco 2 - Conteudo comercial

- [ ] revisar produtos do cliente piloto
- [ ] revisar categorias e campanhas publicadas
- [ ] revisar logomarca, WhatsApp, endereco e horarios
- [ ] revisar banners, imagens e destaques reais
- [ ] confirmar textos institucionais finais

## Bloco 3 - Produto

- [x] build estabilizado
- [x] lint estabilizado
- [x] testes E2E estabilizados
- [x] QR Codes administrativos ligados ao storefront resolvido
- [x] campanhas principais da home/ofertas consumindo storefront resolvido
- [x] refresh/F5 estabilizado nas rotas afetadas
- [x] QR Code publico redimensionado e estabilizado
- [x] concluir banners e destaques dedicados
- [ ] concluir biblioteca de midia completa
- [x] concluir relacoes ricas de imagem na camada principal
- [x] tornar totem 100% controlado pelo Admin em nivel operacional
- [x] tornar vitrine 100% controlada pelo Admin em nivel operacional

## Bloco 4 - Validacao assistida

- [ ] validar `/`
- [ ] validar `/catalogo`
- [ ] validar `/ofertas`
- [ ] validar `/produto/{slug}`
- [ ] validar `/categoria/{slug}`
- [ ] validar `/campanha/{slug}`
- [ ] validar `/totem`
- [ ] validar `/vitrine`
- [ ] validar `/admin`

## Bloco 5 - Hardware e operacao real

- [ ] validar totem touch 32"
- [ ] validar TV/monitor 16:9
- [ ] validar mobile real
- [ ] validar comportamento offline controlado
- [ ] validar QR Code com leitura real

## Criterio de encerramento

Este plano se encerra quando o ambiente oficial estiver publicado, o cliente piloto estiver com conteudo validado, o checklist de Go-Live estiver executado ponta a ponta e o produto puder operar como **solucao comercial digital implantada e assistida pela InfiniTI**.
