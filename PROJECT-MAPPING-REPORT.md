# Mapeamento Geral - Vitrine360 - Central Comercial Digital

## 1. Resumo Executivo

O **Vitrine360 - Central Comercial Digital** ja funciona como base operacional para demonstracao, piloto assistido e implantacao comercial acompanhada pela **InfiniTI Labs**.

O produto entrega hoje:

- site publico com catalogo, campanhas, ofertas e CTA por WhatsApp
- QR Codes persistidos no banco
- recomendador IA e simulador com fallback controlado
- rotas de totem e vitrine TV
- painel administrativo com CRUD operacional principal
- analytics, exportacao CSV, SEO base e PWA inicial

Conclusao executiva:

- o Vitrine360 **nao e SaaS**
- o Vitrine360 **nao processa pagamentos**
- o produto deve seguir como **solucao comercial digital implantada e assistida pela InfiniTI**
- o estado atual do `/admin` deve ser classificado como **Admin operacional avancado**

## 2. Estado Atual do Projeto

Estado tecnico validado:

- `npm run format` passa
- `npm run lint` passa
- `npm run build` passa
- `npm run test:e2e` passa
- PostgreSQL local esta operacional com migration e seed
- a aplicacao publica ja usa camada resolvida de storefront em boa parte da superficie
- refresh/F5 e QR Code publico foram corrigidos

Estado de produto:

- pronto para demonstracao e operacao piloto assistida
- ainda nao pronto para ser vendido como plataforma 100% autogerenciavel sem ressalvas
- ainda precisa de consolidacao de producao real, midia em nivel avancado e validacao operacional publicada

## 3. Modulos Funcionais

- Pagina inicial
- Catalogo
- Categorias
- Produtos
- Pagina de produto
- Ofertas
- Campanhas
- WhatsApp
- QR Code
- IA Comercial
- Simulador de ambientes
- Totem
- Vitrine TV
- Dashboard admin
- Analytics base
- Exportacao CSV
- SEO base por rota principal
- Sitemap
- Robots
- OpenGraph base
- Mobile responsivo nas rotas principais
- PWA/service worker base
- Build e preview
- Testes E2E principais

## 4. Modulos Parciais

- Admin como centro completo de gestao
- Gestao dinamica de produtos
- Gestao dinamica de categorias
- Gestao dinamica de campanhas
- Biblioteca de midia
- Upload de imagens
- Vinculacao de imagens a produtos
- Ambientacoes
- Gestao de banners e destaques
- Permissoes operacionais completas
- Logs e trilha de auditoria completa
- SEO dinamico por entidade
- JSON-LD mais rico
- Twitter Card completo
- Offline controlado em ambiente real
- Biblioteca de midia em nivel avancado
- Validacao operacional final de totem e vitrine em ambiente oficial
- Seguranca validada em ambiente real

## 5. Modulos Apenas Documentados

- Biblioteca de midia completa com upload multiplo, drag and drop e organizacao rica
- Fluxo completo de ambientacoes, galeria tecnica, totem e vitrine por imagem
- Modulo dedicado de banners e destaques com UX ainda mais madura
- Operacao 100% orientada a banco em toda a experiencia publica
- Go-Live assistido ponta a ponta em ambiente oficial

## 6. Modulos Fora do Escopo

- SaaS de autoassinatura
- Checkout
- Carrinho
- Gateway de pagamento
- Billing
- Assinatura automatica
- Pagamento interno por Pix
- Pagamento interno por cartao
- Boleto dentro da plataforma
- Marketplace
- ERP
- CRM financeiro
- E-commerce completo

## 7. Situacao do Admin

Respostas objetivas:

1. O Admin e apenas dashboard?  
   Nao. Ha dashboard e CRUD operacional principal.

2. Permite cadastrar produtos?  
   Sim.

3. Permite editar produtos?  
   Sim.

4. Permite publicar, inativar ou arquivar produtos?  
   Sim, via status.

5. Permite criar categorias?  
   Sim.

6. Permite criar campanhas?  
   Sim.

7. Permite subir imagens?  
   Sim, em fluxo simples.

8. Existe Biblioteca de Midia?  
   Sim, em nivel inicial.

9. Permite vincular imagens a produtos?  
   Sim, em nivel operacional principal.

10. Permite ambientacoes?  
    Parcialmente, a estrutura existe mas a UX ainda nao esta completa.

11. Permite configurar o que aparece no totem?  
    Sim, em nivel operacional.

12. Permite configurar o que aparece na vitrine TV?  
    Sim, em nivel operacional.

13. Existem perfis de usuario?  
    Sim.

14. Existem permissoes?  
    Sim, em base inicial.

15. Existem logs de alteracao?  
    Sim, em base inicial via `audit_logs`.

16. O cliente consegue gerenciar a operacao sem mexer em codigo?  
    Sim, para o fluxo comercial principal, com pendencia de homologacao final em ambiente oficial.

Classificacao final:

**Admin operacional avancado**

## 8. Situacao dos Produtos e Categorias

Situacao atual:

- produtos e categorias possuem CRUD operacional principal
- estados basicos e slugs existem
- persistencia principal foi preparada para PostgreSQL
- storefront publico ja consome dados resolvidos do banco em boa parte das rotas

Pendencias:

- dependencia residual de `src/data/*` como seed/fallback ainda existe
- homepage e alguns fluxos auxiliares ainda precisam ficar 100% orientados a banco
- experiencia de imagem e preview ainda precisa amadurecer

## 9. Situacao das Campanhas

Situacao atual:

- campanhas possuem CRUD operacional principal
- relacionamento campanha-produto existe
- campanhas publicas ja sao renderizadas nas rotas principais
- admin de QR Code ja monta atalhos a partir do storefront real

Pendencias:

- modulo dedicado de banners e destaques
- refinamento de SEO por campanha
- consolidacao total do consumo dinamico em homepage/totem/vitrine

## 10. Situacao da Biblioteca de Midia

Existe hoje:

- tabela `media_assets`
- tabela `product_images`
- upload simples pelo Admin com metadados e relacoes operacionais principais
- persistencia em storage local da aplicacao
- endpoint publico para servir midia

Ainda falta:

- upload multiplo
- drag and drop
- relacoes ricas por contexto
- ALT e descricao em fluxo completo
- rastreamento de uso da imagem
- politica completa de arquivamento/exclusao por perfil

Classificacao:

**Parcial**

## 11. Situacao do Totem

Validado:

- rota carrega
- navegacao principal funciona
- reset por inatividade funciona
- QR Code e CTA WhatsApp existem
- experiencia base esta boa para demonstracao
- QR Code do footer foi estabilizado visualmente

Ainda falta:

- leitura completa das configuracoes do modulo administrativo
- validacao em equipamento fisico touch 32"
- validacao real em 1920x1080, retrato e paisagem
- fechamento do comportamento offline em ambiente publicado

Classificacao:

**Parcial / precisa de gestao dinamica**

## 12. Situacao da Vitrine TV

Validado:

- rota carrega
- rotacao automatica funciona
- campanhas e produtos em destaque aparecem
- fallback de conteudo existe

Ainda falta:

- controle integral pelo Admin
- validacao em TV/monitor real
- ajuste fino de duracao e composicao visual com conteudo real

Classificacao:

**Parcial**

## 13. Situacao da IA Comercial

Situacao atual:

- recomendador de produtos funciona
- simulador de ambientes funciona
- camada usa variaveis neutras:
  - `AI_PROVIDER`
  - `AI_API_KEY`
  - `AI_BASE_URL`
  - `AI_MODEL`
- fallback controlado evita dependencia de credito real em teste
- testes E2E cobrem os fluxos principais

Riscos pendentes:

- falta validar custo, monitoramento e limite operacional em ambiente real
- ainda existe dependencia de heuristica local quando nao ha resposta de IA

Classificacao:

**Funcional, com fallback controlado**

## 14. Situacao do SEO

Implementado:

- metadados base por rota principal
- canonical
- OpenGraph base
- `robots.txt`
- `sitemap.xml`
- manifest/PWA base

Parcial:

- JSON-LD ainda pode evoluir
- Twitter Card nao esta consolidado como camada dedicada
- dominio oficial ainda nao foi aplicado em `VITE_PUBLIC_SITE_URL`
- ainda precisa rodar validacao final com Lighthouse e Search Console no ambiente oficial

Classificacao:

**Parcial**

## 15. Situacao de Seguranca

Implementado:

- autenticacao administrativa
- server functions para operacoes sensiveis
- segredos fora do frontend por direcao de arquitetura
- base de papeis e logs

Pendencias:

- validar ambiente oficial com credenciais reais
- revisar endurecimento de operacao multi-cliente por implantacao
- revisar politicas finais de acesso e exclusao

Classificacao:

**Parcial, com base boa**

## 16. Situacao de Build, Lint e Testes

Comandos validados:

- `npm run format` -> OK
- `npm run lint` -> OK
- `npm run build` -> OK
- `npm run test:e2e` -> OK

Resultado atual:

- build funcional
- lint limpo
- `14` testes E2E passando

## 17. Divergencias Encontradas

- ainda existem documentos citando etapa de transicao ja concluida
- `README.md` descreve corretamente o Admin como parcial e precisa continuar sendo mantido sincronizado com cada avanco
- o nome do cliente piloto ainda aparece em alguns documentos e pode ser mantido como contexto comercial, mas nao deve dominar a identidade do produto

## 18. Riscos Antes do Go-Live

- dominio oficial ainda nao configurado
- credenciais de producao ainda nao validadas
- conteudo final do cliente piloto ainda precisa de revisao comercial
- biblioteca de midia ainda nao cobre todos os cenarios operacionais
- totem e vitrine ainda precisam de prova em hardware real
- a dependencia residual de fallback deve ser reduzida antes de um Go-Live mais agressivo

## 19. Escopo Oficial Atual

Escopo atual incluso:

- catalogo digital
- categorias
- produtos
- campanhas e ofertas
- WhatsApp
- QR Code
- IA Comercial
- simulador de ambientes
- totem
- vitrine TV
- painel administrativo em evolucao
- analytics e relatorios
- SEO base
- biblioteca de midia funcional, ainda inicial em UX

Escopo atual parcial:

- gestao comercial completa pelo Admin
- biblioteca de midia completa
- banners e destaques
- configuracao operacional principal de totem e vitrine
- operacao totalmente orientada a banco

## 20. O que Esta Fora do Escopo

- SaaS
- Checkout
- Gateway
- Billing
- Pagamento interno
- Marketplace
- ERP
- CRM financeiro
- E-commerce completo

## 21. Proximos Passos Prioritarios

1. definir `VITE_PUBLIC_SITE_URL` com dominio oficial
2. validar `DATABASE_URL`, analytics e credenciais de producao
3. revisar conteudo comercial real do cliente piloto
4. concluir banners/destaques e biblioteca de midia
5. consolidar totem e vitrine controlados pelo Admin
6. reduzir ainda mais a dependencia de fallback/local seed
7. executar checklist de Go-Live assistido ponta a ponta

## 22. Roadmap Recomendado

### Fase 1 - Auditoria e estabilizacao

- consolidar mapeamento
- manter documentacao alinhada
- repetir validacoes de build/lint/testes

### Fase 2 - Go-Live assistido

- validar dominio, credenciais e publicacao
- testar rotas publicas e admin no ambiente oficial
- validar totem, vitrine, IA e analytics

### Fase 3 - Admin completo

- banners e destaques
- biblioteca de midia madura
- relacionamentos ricos de imagem
- controle total de totem e vitrine
- permissoes e logs refinados

### Fase 4 - Produto replicavel por implantacao

- padronizar onboarding tecnico
- padronizar checklist por cliente
- criar manual operacional
- reforcar monitoramento, backup e governanca

## 23. Conclusao

O **Vitrine360 - Central Comercial Digital** ja tem uma base tecnicamente consistente e comercialmente apresentavel para piloto assistido.

Hoje, a direcao correta nao e adicionar escopo de SaaS ou pagamento, e sim:

1. endurecer a operacao assistida
2. consolidar o Admin
3. concluir midia e exibicao dinamica
4. validar o Go-Live real
5. transformar a base em produto replicavel por implantacao da InfiniTI

**Vitrine360 - Central Comercial Digital**  
**Desenvolvido por InfiniTI Labs.**
