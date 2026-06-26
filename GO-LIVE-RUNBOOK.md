# Vitrine360 - Runbook de Validacao Manual

**Desenvolvido por InfiniTI Labs.**

## Objetivo

Executar uma validacao manual curta e objetiva do Vitrine360 no ambiente final antes do Go-Live assistido.

## Pre-condicoes

- `.env.production` preenchido com valores reais
- `npm run go-live:preflight` executado
- `npm run production:check` aprovado
- migrations aplicadas no PostgreSQL oficial
- conteudo do piloto homologado
- build SSR publicado no ambiente oficial

## 1. Validacao publica

### Home `/`

- abre sem erro em carregamento inicial
- recarrega com `F5` sem tela de erro
- banners e campanhas principais aparecem
- CTA de WhatsApp abre corretamente
- QR Code principal renderiza sem ultrapassar o bloco visual

### Catalogo `/catalogo`

- lista produtos e categorias esperadas
- busca retorna itens coerentes
- recomendador de IA aceita texto livre
- atalho de exemplo preenche o campo
- botao de recomendar responde sem travar a tela

### Categoria `/categoria/{slug}`

- slug abre categoria correta
- produtos inativos/arquivados nao aparecem
- titulo e descricao SEO fazem sentido

### Produto `/produto/{slug}`

- abre sem erro
- imagem principal aparece
- CTA de WhatsApp abre com mensagem coerente
- produtos relacionados, se houver, nao quebram layout

### Ofertas `/ofertas`

- campanhas em destaque aparecem
- cards e CTAs funcionam
- nenhuma oferta expirada aparece por engano

### Campanha `/campanha/{slug}`

- banner carrega
- CTA principal funciona
- produtos vinculados aparecem
- metadata/SEO nao ficam vazios

## 2. Validacao Totem

### Totem `/totem`

- abre em tela cheia sem erro
- categorias, campanhas e produtos em destaque aparecem
- toque/click responde bem
- QR Code do footer permanece contido
- reset por inatividade ocorre no tempo esperado
- fluxo categoria > produto > CTA funciona

## 3. Validacao Vitrine TV

### Vitrine `/vitrine`

- abre sem erro
- slides rotacionam automaticamente
- imagens principais ocupam bem a area visual
- textos sao legiveis a distancia
- nao ha excesso de informacao por slide

## 4. Validacao Admin

### Login `/admin`

- login administrativo funciona com credencial real
- `F5` apos login nao quebra sessao imediatamente
- logout funciona

### Dashboard

- KPIs carregam
- relatorios nao aparecem vazios por erro tecnico

### Produtos

- criar e editar produto funciona
- status publicado/inativo/arquivado salva corretamente
- destaque e ordem de exibicao persistem

### Categorias

- criar e editar categoria funciona
- slug e status persistem

### Campanhas

- criar e editar campanha funciona
- flags de home/totem/vitrine persistem

### Midia

- upload simples conclui sem erro
- arquivo aparece listado
- metadados podem ser ajustados

### Loja

- dados comerciais salvos aparecem no storefront

### Totem e Vitrine TV

- configuracoes salvas refletem nas rotas publicas

### Usuarios

- perfis carregam
- permissao basica por papel pode ser validada

## 5. Validacao de seguranca e operacao

- `VITE_ENABLE_DEV_ADMIN_BYPASS=0`
- nenhuma credencial privada exposta no frontend
- erros de API nao vazam segredos
- analytics e leads gravam no banco oficial

## 6. Criterio de aceite

O ambiente pode seguir para Go-Live assistido quando:

- rotas publicas abrirem sem erro
- admin autenticar e salvar dados principais
- totem e vitrine forem aprovados em hardware real
- QR Code e WhatsApp estiverem corretos
- banco, analytics e IA estiverem validados no ambiente oficial
