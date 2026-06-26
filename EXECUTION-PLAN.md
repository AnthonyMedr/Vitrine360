# Plano de Execucao - Vitrine360

## Objetivo desta fase

Concluir a transicao do Vitrine360 para uma base profissional da InfiniTI, com PostgreSQL real como destino principal, reducao de dependencias locais no frontend e trilha clara para Go-Live assistido.

## Estado consolidado ate aqui

- remocao de referencias publicas da marca anterior concluida
- camada de autenticacao administrativa neutra implantada
- migration PostgreSQL criada e ampliada para cobrir o runtime atual
- build, lint e testes E2E estabilizados
- instabilidade de refresh/F5 da home e do admin de QR Code corrigida
- QR Code publico estabilizado com renderizacao em imagem e tamanho reduzido no footer
- build passou a limpar `dist/` automaticamente antes da compilacao
- camada de acesso ao banco agora opera em modo hibrido:
  - PostgreSQL real quando `DATABASE_URL` estiver funcional
  - fallback em memoria apenas como contingencia

## Execucao em sequencia

### 1. Banco e operacao

- [x] criar migration base PostgreSQL
- [x] ampliar schema com tabelas faltantes do runtime
- [x] criar script `npm run db:migrate`
- [x] aplicar migrations no banco local controlado
- [x] validar conectividade real com `DATABASE_URL`
- [x] executar seed inicial em banco real local
- [x] adicionar preflight operacional `npm run db:status` para diagnostico rapido de Docker/PostgreSQL local
- [ ] aplicar migrations no banco oficial
- [ ] validar leitura/escrita no ambiente oficial

### 2. Frontend publico

- [x] hidratar configuracoes principais a partir do storefront resolvido
- [x] aplicar configuracoes de totem e vitrine no runtime publico
- [x] concluir SEO base por produto, categoria e campanha
- [x] estabilizar refresh/F5 nas rotas afetadas
- [x] reduzir fallback local nas rotas publicas restantes
- [ ] validar dominio oficial em `VITE_PUBLIC_SITE_URL`

### 3. Admin operacional

- [x] manter CRUD operacional de produtos, categorias, campanhas e configuracoes
- [x] ligar upload de midia a storage real local da aplicacao
- [x] validar papeis e permissoes basicas em banco real local
- [x] concluir banner/destaque como modulo dedicado
- [x] concluir relacionamentos ricos de imagem na camada principal e no painel operacional
- [x] consolidar controle pleno de totem e vitrine pelo painel
- [x] melhorar busca, UX guiada e paginacao das listas principais do admin

### 4. Go-Live assistido

- [x] criar template de ambiente `.env.production.example`
- [x] criar bootstrap seguro de `.env.production`
- [x] criar comando `npm run production:check`
- [x] separar verificacao local e verificacao oficial de ambiente
- [x] estabilizar `npm run build`, `npm run lint` e `npm run test:e2e`
- [x] validar ambiente local com `npm run production:check:local`
- [ ] configurar `VITE_PUBLIC_SITE_URL` com dominio oficial
- [ ] validar conteudo final do cliente piloto
- [ ] validar analytics e filas locais em ambiente publicado
- [ ] executar checklist de Go-Live ponta a ponta

### Bloqueios atuais de producao real

Resultado pratico ja confirmado:

- `npm run production:check:local` passou por completo
- `npm run production:check` falhou apenas por valores placeholder em `.env.production`

Pendencias objetivas para destravar producao:

- substituir `DATABASE_URL` placeholder por conexao PostgreSQL oficial real
- definir `ADMIN_BOOTSTRAP_PASSWORD` real ou confirmar usuario inicial ja provisionado
- definir `ADMIN_BOOTSTRAP_TOKEN` real, se o bootstrap inicial ainda for necessario
- definir `AI_API_KEY` real ou ajustar a politica de IA da publicacao inicial

## Execucao em paralelo

### Trilho A - Infraestrutura

- aplicar migrations
- validar credenciais
- testar pool PostgreSQL
- preparar backup e monitoramento

### Trilho B - Conteudo comercial

- revisar logo, endereco, horario e WhatsApp
- revisar produtos e campanhas ativos
- revisar imagens pesadas e nomenclaturas

### Trilho C - Produto e qualidade

- fechar SEO dinamico
- concluir midia real
- revisar performance final
- repetir build/lint/E2E apos cada bloco relevante

## Proximos marcos tecnicos

1. PostgreSQL real operando sem fallback no ambiente oficial
2. storefront publico 100% orientado a banco
3. totem e vitrine controlados pelo admin sem dependencia local
4. midia persistida com relacoes mais completas
5. Go-Live assistido com checklist fechado

## Criterio de conclusao desta fase

Esta fase fica concluida quando o Vitrine360 rodar com PostgreSQL real conectado, configuracoes publicas vindas do banco, documentacao alinhada e checklist tecnico pronto para a validacao final de implantacao.
