# ROADMAP - Vitrine360 - Central Comercial Digital

## Fase 1 - Hardening e Go-Live Assistido

Objetivo:

consolidar a base atual para operacao comercial assistida com cliente piloto.

Prioridades:

- concluir auditoria e alinhamento documental
- aplicar migration comercial no PostgreSQL oficial
- validar seed inicial do catalogo homologado
- revisar SEO real por rota
- validar mobile, totem e vitrine TV em telas reais
- validar analytics, leads, IA e seguranca em ambiente publicado
- fechar checklist de Go-Live ponta a ponta

## Fase 2 - Admin Completo

Objetivo:

transformar o `/admin` no centro de gestao comercial do produto.

Prioridades:

- amadurecer os CRUDs de produtos, categorias e campanhas com UX mais rica
- tornar o admin mais autoexplicativo para operacao por usuario nao tecnico
- ampliar o modulo dedicado de banners e destaques
- concluir biblioteca de midia em nivel avancado
- adicionar upload multiplo, organizacao, relacoes e ALT
- aprofundar a UX de `media_assets`, `product_images` e relacoes de campanha
- substituir entradas tecnicas em JSON por interfaces guiadas onde fizer sentido
- validar `/totem` e `/vitrine` em operacao real apos controle administrativo concluido
- consolidar logs e trilha de auditoria
- reduzir dependencia operacional de `src/data/*`

## Fase 3 - Produto Replicavel por Implantacao

Objetivo:

padronizar o Vitrine360 como produto implantado pela InfiniTI para novos clientes.

Prioridades:

- padrao de onboarding tecnico por cliente
- parametrizacao de marca, dominio e configuracoes
- checklist de implantacao
- manual do Admin
- templates de conteudo por segmento
- governanca de IA, relatorios, backup e monitoramento
- politica de suporte e operacao assistida

## Fase 4 - Expansoes Futuras

Objetivo:

abrir trilhas de crescimento sem desviar o escopo atual.

Possibilidades:

- integracao com ERP
- consulta de estoque
- CRM operacional
- automacao de campanhas
- geracao assistida de criativos
- integracao com trafego pago
- app mobile
- recursos multiunidade mais avancados

## Fase futura - IA Comercial Vitrine360

Objetivo:

evoluir a IA como acelerador comercial do produto, sem transformar o Vitrine360 em plataforma dependente de IA.

Itens planejados:

- assistente comercial no totem
- recomendador de produtos baseado no catalogo real
- simulador inteligente de ambientes em modo consultivo
- apoio ao vendedor com sugestoes de atendimento e textos para WhatsApp
- geracao assistida de descricoes, CTAs e textos comerciais no Admin
- sugestoes de campanhas e destaques com base em metricas
- controle de limites de uso e custo
- fallback obrigatorio quando a IA estiver indisponivel
- integracao segura via backend/server functions

Regras obrigatorias dessa fase:

- responder apenas com base no catalogo, categorias, campanhas e dados reais da loja
- nao inventar produtos
- nao expor chaves privadas no frontend
- permitir revisao humana antes de publicar conteudo gerado
- manter a IA como apoio, nao como ponto unico de falha do produto

## Fora do roadmap atual

Nao planejar como escopo oficial do produto nesta fase:

- SaaS de autoassinatura
- billing
- checkout
- pagamentos online
- gateway financeiro
- marketplace
- ERP completo
- CRM financeiro

## Direcao

O roadmap deve seguir a consolidacao do Vitrine360 como **solucao comercial digital implantada e assistida pela InfiniTI**, nao como plataforma SaaS de autosservico.
