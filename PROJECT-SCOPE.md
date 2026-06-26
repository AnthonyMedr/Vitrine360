# PROJECT-SCOPE - Vitrine360 - Central Comercial Digital

## 1. Definicao oficial

O **Vitrine360 - Central Comercial Digital** e um produto proprio da **InfiniTI Labs**, oferecido como **solucao comercial digital implantada, configurada, mantida e acompanhada pela InfiniTI**.

**Desenvolvido por InfiniTI Labs.**

## 2. O que o produto e hoje

O Vitrine360 e uma central comercial digital para lojas fisicas e canais digitais, com foco em:

- catalogo de produtos
- categorias
- campanhas e ofertas
- WhatsApp e QR Code
- IA Comercial
- simulador de ambientes
- modo totem
- vitrine para TV/monitor
- analytics e relatorios
- painel administrativo
- biblioteca de midia
- SEO

## 3. Modelo comercial correto

O Vitrine360:

- nao e SaaS de autoassinatura
- nao processa pagamentos dentro da plataforma
- nao deve ser vendido como marketplace
- nao deve ser vendido como e-commerce completo

A relacao comercial deve ocorrer fora da plataforma por meio de:

- proposta comercial
- contrato de prestacao de servicos
- termo de comodato
- termo de vistoria
- cobranca externa da InfiniTI

## 4. Escopo atual incluso

- site publico comercial
- catalogo e paginas de produto
- categorias e campanhas
- modo ofertas
- CTA por WhatsApp
- QR Codes
- IA Comercial e simulador
- modo totem
- modo vitrine TV
- painel administrativo operacional avancado
- gestao dinamica de produtos, categorias, campanhas, banners e configuracoes operacionais
- biblioteca de midia com upload simples e relacoes operacionais principais
- analytics e exportacao CSV
- base para auth, papeis e auditoria

## 5. Escopo atual nao incluso

- checkout
- carrinho
- pagamento online
- Pix dentro do sistema
- cartao dentro do sistema
- boleto dentro do sistema
- billing
- assinatura automatica
- area financeira para o cliente pagar mensalidade
- e-commerce completo
- ERP
- CRM financeiro
- marketplace

## 6. Estado atual do painel

O `/admin` deve ser tratado hoje como:

**Admin operacional avancado**

Ja existe:

- dashboard
- gestao operacional de produtos
- gestao operacional de categorias
- gestao dinamica de campanhas
- modulo dedicado de banners e destaques
- upload simples de midia com metadados e relacoes operacionais principais
- configuracoes da loja
- usuarios e papeis em base inicial
- configuracoes operacionais completas de totem e vitrine
- configuracoes tecnicas

Ainda precisa evoluir:

- upload multiplo e UX mais madura de biblioteca de midia
- uso total do banco como fonte principal no ambiente oficial, com retirada gradual de comportamentos locais residuais
- validacao de hardware real e publicacao final
- governanca operacional de producao mais madura

## 7. Fonte de dados

Direcao oficial:

- banco de dados + Admin como fonte principal
- `src/data/*` apenas como seed, fallback ou desenvolvimento

## 8. Estado tecnico atual

- PostgreSQL local com migration e seed operacional
- build, lint e E2E estabilizados
- refresh/F5 e QR Code publico corrigidos
- storefront dinamico em boa parte da superficie publica
- pendencia de homologacao final em ambiente oficial

## 9. Direcao recomendada

Foco da etapa atual:

1. profissionalizar a base existente
2. corrigir divergencias entre documentacao e codigo
3. consolidar a assinatura da InfiniTI
4. endurecer Go-Live assistido
5. concluir o Admin como centro de gestao comercial

## 10. IA Comercial - Evolucao Futura

A IA Comercial deve ser tratada como evolucao futura controlada do Vitrine360.

Diretrizes:

- IA nao faz parte do escopo obrigatorio atual em sua forma completa
- IA nao substitui catalogo, Admin ou atendimento humano
- IA deve respeitar apenas produtos, categorias, campanhas, tags e regras reais da loja
- IA nao deve inventar produtos, disponibilidade, preco ou condicoes comerciais
- IA nao deve processar pagamentos
- IA nao altera o fato de que o Vitrine360 nao e SaaS

Aplicacoes futuras recomendadas:

- assistente comercial no totem
- recomendador de produtos baseado no catalogo real
- simulador consultivo de ambientes
- apoio ao vendedor
- geracao assistida de textos comerciais no Admin
- sugestoes de campanhas e destaques com base em metricas

Pre-requisitos antes de ampliar IA:

- Admin mais maduro
- produtos, categorias e campanhas consolidados no banco
- biblioteca de midia mais completa
- tags, descricoes e especificacoes mais estruturadas
- permissoes, logs e analytics validados
- totem e vitrine homologados
- variaveis e ambiente seguros

Variaveis neutras recomendadas para evolucao futura:

- `AI_PROVIDER`
- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`
- `AI_MONTHLY_LIMIT`
- `AI_ENABLED`

## 11. Classificacao comercial atual

O produto pode ser apresentado como:

**Solucao Comercial Digital Implantada / Produto Piloto Assistido**

Nao deve ser apresentado como:

- SaaS completo
- plataforma white-label de autosservico
- sistema de pagamento
- plataforma financeira

## 12. Assinatura

**Vitrine360 - Central Comercial Digital**  
**Desenvolvido por InfiniTI Labs.**
