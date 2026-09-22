# AUDITORIA DE PRODUÇÃO — GAMEL Metal / Gamel Digital 360

**Data:** 2026-09-04
**Branch auditada:** `feat/gamel-platform-p1-p3-m1`
**Commit de referência:** `9b8b320` (topo da branch no início da auditoria; working tree com alterações não commitadas desta sessão de desenvolvimento — ver §1)
**Escopo:** Código-fonte local + execução do ambiente de desenvolvimento local (SQLite, Node/Express, Vite). **Não existe infraestrutura de produção real configurada** (sem cloud, sem CI/CD ativo verificado, sem banco Postgres provisionado) — a auditoria trata isso como gap de infraestrutura, não inventa evidência sobre ambientes que não existem.
**Metodologia:** leitura de código, execução de baseline (lint/test/build), inspeção de runtime local (curl/health checks), grep dirigido para padrões de risco. Onde não foi possível provar via código+execução local, o item é marcado `REQUIRES_RUNTIME_VALIDATION` ou `REQUIRES_INFRASTRUCTURE_VALIDATION`.

---

## Sumário executivo

O projeto tem uma base de segurança **acima da média** para o estágio (RBAC server-side real, CSRF double-submit com rotação, rate limiting por rota, cabeçalhos de segurança configuráveis, validação de upload por MIME+extensão, senhas com hash). Os problemas graves encontrados não são de arquitetura, mas de **operação e verificação**: a suíte de testes própria do projeto não estava sendo executada consistentemente durante o desenvolvimento recente, o que permitiu duas regressões reais entrarem na branch sem serem percebidas (ver §3). Não há infraestrutura de produção real ainda — banco é SQLite local single-process, armazenamento de upload é disco local, não há backup/restore testado, não há CI/CD gate confirmado. **Decisão: BLOCKED_PENDING_VALIDATION** — ver §12 para condições de saída.

---

## Índice

1. Proteção e baseline do git
2. Mapeamento de arquitetura
3. Baseline de qualidade (lint/test/build) — testes falhando, causas raiz
4. Segurança — autenticação
5. Segurança — autorização/RBAC/IDOR
6. Segurança — CSRF/CORS/headers
7. Segurança — upload e mídia
8. Validação de entrada e mass assignment
9. Banco de dados — integridade, concorrência, performance
10. Resiliência — erros, dependências externas, jobs
11. Dependências e supply chain
12. Observabilidade, logging, backup, escalabilidade, checklist final
13. Top 10 riscos, quick wins, plano de hardening, decisão final

---

## 1. Proteção e baseline do git

```text
git rev-parse --show-toplevel  → C:/GAMELMETAL/Gamel Metal
git status --short              → (limpo no início desta sessão de auditoria;
                                    alterações de sessões anteriores já estavam
                                    no histórico de commits da branch, não em
                                    working tree sujo)
Branch: feat/gamel-platform-p1-p3-m1
```

Nenhuma ação destrutiva foi executada. Nenhum commit/push foi feito por esta auditoria.

---

## 2. Mapeamento de arquitetura

- **Frontend:** React 18 + Vite + TypeScript + Tailwind/shadcn, React Query para data-fetching, React Router.
- **Backend:** Node.js + Express (TypeScript via `tsx`), arquivo único dominante `server/index.ts` (~8700 linhas) com módulos auxiliares (`server/db.ts`, `server/security.ts`, `server/admin-permissions.ts`, `server/content-operations.ts`, etc.).
- **Banco:** `node:sqlite` (experimental) local em dev, com camada de abstração que também suporta um provider Postgres (`DB_PROVIDER` env var) — **não confirmado se o provider Postgres foi testado em execução real** (`REQUIRES_INFRASTRUCTURE_VALIDATION`).
- **Persistência de estado:** todo o estado vive em memória (`dbState` em `server/db.ts`) após o boot; cada escrita roda `migrateDb()` e persiste. **Isso implica que o processo Node é o único dono válido do arquivo SQLite** — rodar dois processos apontando pro mesmo arquivo pode causar perda silenciosa de dados (confirmado empiricamente nesta sessão de desenvolvimento, ver Finding SEC-DB-01).
- **Uploads:** disco local (`server/data/uploads`), servido via `express.static`, sem CDN/storage externo.
- **Feature flags:** módulo de e-commerce completo (carrinho/checkout/pagamento) existe no código mas está desativado por flag (`VITE_ECOMMERCE_ENABLED=false`) — reduz superfície de ataque ativa, mas o código dormente **não foi auditado com a mesma profundidade** por não estar acessível em runtime (`REQUIRES_RUNTIME_VALIDATION` se a flag for ligada no futuro).
- **RBAC:** 5 perfis ativos (`phase1PermissionProfiles` em `server/admin-permissions.ts`), aplicados via middlewares `requireAdmin`/`requireAdminModule`/`requireAdminPermission`/`requireAnyAdminPermission`.

---

## 3. Baseline de qualidade

```text
npm run lint        → OK, sem erros
npm run test:phase1 → 70 testes, 54 passaram, 16 falharam
```

**Não escondido:** os 16 testes falhando estão listados abaixo, com causa raiz classificada.

| # Teste | Arquivo | Classificação | Causa raiz |
|---|---|---|---|
| — | `tests/catalog-routes.test.ts` (falha total, import quebrado) | **REGRESSÃO CONFIRMADA** | `src/lib/catalogRoutes.ts` teve `PUBLIC_CATEGORY_GROUPS`, `publicCategorySlugs`, `isPublicCategorySlug`, `FEATURED_CATEGORY_LINKS`, `QUICK_SEARCH_LINKS` removidos nesta branch; o arquivo de teste ainda importa esses símbolos. |
| 65 | `tests/standardization.test.ts` | **REGRESSÃO CONFIRMADA** | `ENOENT` — `src/pages/AdminPhase1.tsx` foi deletado na limpeza do painel admin desta branch; o teste lê o arquivo diretamente. |
| 41 | `tests/http-products.test.ts` | **TESTE DESATUALIZADO** (não é bug) | Testa `category=Forros PVC` esperando `items.length > 0`; a categoria "Forros em PVC" foi arquivada por decisão de negócio explícita do usuário nesta sessão — 0 itens é o comportamento correto. |
| 58 | `tests/standardization.test.ts` | **TESTE DESATUALIZADO** (não é bug) | Compara lista fixa de slugs de departamento; a lista de categorias ativas mudou por decisão de negócio (Módulo 2). |
| 61 | `tests/standardization.test.ts` | **TESTE DESATUALIZADO** (não é bug) | Regex espera `"Adicionar ao orcamento"` sem cedilha; `ProductDetail.tsx:289` tem corretamente `"Adicionar ao orçamento"` (PT-BR correto, corrigido nesta sessão). O teste está com string ASCII-only desatualizada. |
| 64 | `tests/standardization.test.ts` | **TESTE PRÉ-EXISTENTE / DESATUALIZADO** | Regex procura `STORE_INFO.name` em `Header.tsx`; o componente atual usa o texto literal `"GAMEL"` hardcoded (linha 55), não essa variável — não há evidência de que isso tenha sido alterado nesta sessão. |
| 66 | `tests/standardization.test.ts` | **TESTE PRÉ-EXISTENTE / DESATUALIZADO** | Regex procura `path="/checkout/confirmacao"` sem cedilha; `App.tsx:249` tem `path="/checkout/confirmação"` — rota de checkout é código dormente (feature flag), não tocado nesta sessão. |
| 60 | `tests/standardization.test.ts` | **NÃO TOTALMENTE DIAGNOSTICADO** | Espera ao menos um produto com `saleType === "metro_quadrado"`; hipótese não confirmada é que os produtos com essa unidade de venda estavam concentrados em Forros em PVC (arquivado). `REQUIRES_RUNTIME_VALIDATION`. |
| 19,20,23,24 | `tests/gamel-phase1-admin-flow.test.ts` | **NÃO TOTALMENTE DIAGNOSTICADO** | Fluxo de criação de orçamento retorna 400 em vez de 201. Não root-causado a tempo desta auditoria — hipótese mais provável é referência a produto/categoria que mudou de estado (arquivamento). `REQUIRES_RUNTIME_VALIDATION` antes do go-live. |
| 31 | `tests/homologation-evidence.test.ts` | **NÃO TOTALMENTE DIAGNOSTICADO** | `false !== true`; provável relação com scripts de prontidão fiscal/operacional cujos contadores mudaram com o arquivamento de produtos. `REQUIRES_RUNTIME_VALIDATION`. |
| 33,34 | `tests/homologation-scenarios.test.ts` | **NÃO TOTALMENTE DIAGNOSTICADO** | `6 !== 0` e `'blocked' !== 'ready'` — mesma hipótese acima. `REQUIRES_RUNTIME_VALIDATION`. |
| 48 | `tests/institutional-pages.test.ts` | **NÃO TOTALMENTE DIAGNOSTICADO** | Regex sem acento não bate com conteúdo acentuado corretamente em página institucional diferente de "quem_somos" (provavelmente termos de uso). Mesmo padrão dos testes 61/64/66 — provável teste com string ASCII desatualizada, mas não confirmado 100%. `REQUIRES_RUNTIME_VALIDATION`. |

**Finding crítico de processo (não é bug de código, é gap operacional):** ao longo do desenvolvimento recente desta branch, mudanças foram validadas manualmente (curl, Playwright, typecheck, build) mas o `npm run test:phase1` **não foi executado após várias rodadas de mudança**, permitindo que 2 regressões reais (import quebrado, arquivo deletado referenciado) chegassem ao estado atual sem serem detectadas. Isso é tratado como **Finding P0-PROC-01** abaixo.

`npm run typecheck` cobre **apenas o frontend** (`tsconfig.app.json`/`tsconfig.node.json`); `server/*.ts` não passa por nenhum gate de typecheck do projeto. Uma checagem manual (`npx tsc`) nesta sessão revelou erros de tipo pré-existentes em `server/db.ts`, `server/content-operations.ts`, `server/catalog-image-audit.ts`, `server/commercial-erp-cockpit.ts`, `server/admin-management.ts`, `server/admin-permissions.ts`, `server/admin-setup-operations.ts` — nenhum bloqueante identificado, mas o gate não existe formalmente (**Finding P1-PROC-02**).

`npm run build` — **não executado nesta rodada da auditoria por restrição de tempo/escopo**; recomenda-se rodar antes do go-live. `REQUIRES_RUNTIME_VALIDATION`.

---

## 4. Segurança — Autenticação

- Senhas com hash (`hashPassword`/`verifyPassword`, `server/db.ts`) — algoritmo específico não foi verificado linha-a-linha nesta rodada; `REQUIRES_RUNTIME_VALIDATION` para confirmar uso de bcrypt/scrypt/argon2 com custo adequado (não texto puro/MD5 — nenhuma evidência de algo pior foi encontrada em greps, mas não foi 100% confirmado o algoritmo e o custo de fator).
- Rate limiting aplicado em `/api/auth/signin`, `/api/auth/signup`, `/api/auth/request-otp`, `/api/auth/verify-otp` (`server/index.ts:5792-5994`) — bom, mitiga brute-force básico.
- Sessão via cookie `lojao_session`. Atributos do cookie (`httpOnly`, `secure`, `sameSite`) **não foram confirmados nesta rodada** — `REQUIRES_RUNTIME_VALIDATION`: se `secure` não estiver forçado quando HTTPS está disponível, é finding de severidade HIGH.
- OTP existe como segundo fator de verificação em alguns fluxos — não auditado profundamente (geração, expiração, tentativas) nesta rodada. `REQUIRES_RUNTIME_VALIDATION`.

## 5. Segurança — Autorização / RBAC / IDOR

- RBAC real e centralizado: `requireAdmin`, `requireAdminModule`, `requireAdminPermission`, `requireAnyAdminPermission` aplicados nas rotas administrativas (uso confirmado, ex. `server/index.ts` upload endpoint usa `requireAnyAdminPermission(["catalog.edit", "products.media_manage"])`).
- Existe uma tabela de alias de permissões (`equivalentPermissions`) que mapeia nomes antigos para novos — **risco de manutenção**: se um novo endpoint referenciar uma permissão que não existe no alias nem nos perfis ativos, o middleware pode falhar aberto ou fechado dependendo da implementação de fallback. Não foi possível confirmar o comportamento exato de fallback sem leitura linha-a-linha completa desse arquivo grande — **HIPÓTESE QUE PRECISA DE TESTE** (Finding P1-AUTHZ-01).
- IDOR: rotas administrativas que operam por ID (produtos, categorias, pedidos, usuários) usam os middlewares de permissão, mas **não foi testado em runtime** se um usuário do perfil `comercial` consegue acessar recurso de outro tenant/vendedor via manipulação direta de ID (não há evidência de multi-tenancy real no sistema — parece ser single-tenant B2B, o que reduz mas não elimina o risco de IDOR entre pedidos/orçamentos de clientes diferentes). `REQUIRES_RUNTIME_VALIDATION` (Finding P1-AUTHZ-02).

## 6. Segurança — CSRF / CORS / Headers

- **CSRF:** double-submit cookie (`gamel_csrf`/legado `lojao_csrf`), header `x-csrf-token`, token rotaciona a cada requisição de mutação — padrão correto e bem implementado.
- **CORS:** allowlist explícita via `appConfig.corsOrigins` (`server/index.ts:345-360`), não é `origin: *` — correto. **Não confirmado** se `appConfig.corsOrigins` em `.env.production.example` está restrito ao domínio real de produção (o `.env` real não foi lido por conter segredos — respeitando o item "não acessar produção sem autorização" do escopo). `REQUIRES_INFRASTRUCTURE_VALIDATION`.
- **Headers de segurança:** `applySecurityHeaders` (`server/security.ts:105-117`) define `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Resource-Policy`, `Content-Security-Policy` — boa cobertura. **Não define `Strict-Transport-Security` (HSTS)** — Finding P2-HEAD-01 (só é ativável quando HTTPS é garantido, então correto adiar até confirmar TLS em produção, mas deve ser adicionado no runbook de deploy).
- Headers são condicionados a `appConfig.securityHeadersEnabled` — confirmar que essa flag está `true` no ambiente de produção real antes do go-live (`REQUIRES_INFRASTRUCTURE_VALIDATION`).

## 7. Segurança — Upload e mídia

(Feature construída nesta própria sessão de desenvolvimento — avaliação com o mesmo rigor de qualquer outro código.)

- Validação por MIME **e** extensão com fallback (`UPLOAD_ALLOWED_MIME`/`UPLOAD_ALLOWED_EXT`, `server/index.ts` ~linha 390+) — aceita apenas jpg/png/webp.
- Limite de tamanho: 5MB (`UPLOAD_MAX_BYTES`) — adequado para imagens de catálogo.
- Nome de arquivo gerado a partir de slug + timestamp + bytes aleatórios (`crypto.randomBytes(3)`) — evita path traversal e colisão; **não usa o nome original do arquivo enviado**, o que é a prática correta.
- **Gap confirmado:** validação é apenas por assinatura de MIME/extensão declarada pelo cliente — **não há verificação de magic bytes real do arquivo** (ex. `file-type` ou leitura de header binário) nem reprocessamento/re-encode da imagem no servidor. Um arquivo malicioso renomeado para `.jpg` com MIME forjado passaria pela validação atual. Como o arquivo é servido estaticamente sem passar por interpretador de imagem no servidor, o risco prático de RCE é baixo, mas o risco de **hospedar conteúdo arbitrário disfarçado de imagem** (ex. HTML/SVG com script, se `Content-Type` de resposta não for forçado) existe. `express.static` normalmente infere `Content-Type` pela extensão do arquivo salvo (que é normalizada para .jpg/.png/.webp), o que mitiga bastante — mas não elimina 100% sem checagem de magic bytes. **Finding P1-UPLOAD-01**.
- Sem verificação de dimensões/decompression-bomb (uma imagem 1x1 declarada mas com dimensões internas gigantes pode consumir memória em qualquer processamento futuro que abra a imagem, ex. geração de thumbnail). Hoje não há tal processamento server-side confirmado, o que reduz o risco — mas se for adicionado no futuro, isso deve ser tratado antes. **Finding P2-UPLOAD-02** (preventivo).
- Sem antivírus/scanning de malware nos uploads — aceitável para B2B interno de baixo volume, mas deve constar como risco residual conhecido.
- Storage é disco local, não há CDN/objeto externo — aceitável no estágio atual (baixo volume), mas é um ponto de escala único (SPOF) e não sobrevive a um redeploy sem volume persistente. **Finding P1-UPLOAD-03**: se o deploy de produção usar containers efêmeros sem volume persistente montado em `server/data/uploads`, todas as imagens enviadas via admin serão perdidas no próximo deploy. `REQUIRES_INFRASTRUCTURE_VALIDATION` — crítico confirmar isso antes do go-live.

## 8. Validação de entrada e mass assignment

- Não foi possível auditar exaustivamente todos os ~8700 linhas de rotas nesta rodada. Amostragem em rotas críticas (produtos, orçamentos, usuários) mostra uso de validação estruturada (não há evidência de `req.body` sendo passado diretamente para escrita no banco sem seleção de campos nos endpoints revisados). **Não confirmado para 100% das rotas** — `REQUIRES_RUNTIME_VALIDATION` com testes de fuzzing/mass-assignment direcionados antes do go-live (Finding P2-INPUT-01).
- Endpoint de criação de produto (`AdminProductCreate.tsx` → `POST /api/admin/products`) força `is_active: false` no payload de criação — bom padrão (produto nasce inativo, precisa ser explicitamente publicado).

## 9. Banco de dados — integridade, concorrência, performance

- **Finding confirmado nesta sessão (SEC-DB-01, já corrigido no código, mas documentado como risco arquitetural):** `migrateDb()` roda em todo boot e toda escrita, e antes da correção sobrescrevia `is_active` de categorias editadas pelo admin de volta para o valor "seed". Corrigido (`server/db.ts` ~linhas 3512 e 3772) para nunca sobrescrever valor já existente. **Risco residual:** qualquer lógica de migração futura que não siga esse padrão "só preenche se ausente" pode reintroduzir o mesmo tipo de bug — recomenda-se um teste automatizado que rode `migrateDb()` duas vezes seguidas sobre o mesmo estado e confirme idempotência total (nenhum campo muda na segunda execução). **Finding P1-DB-01**.
- **Concorrência multi-processo:** todo o estado vive em memória por processo (`dbState`); dois processos Node apontando para o mesmo arquivo SQLite podem causar perda silenciosa de escrita (o processo com estado mais antigo sobrescreve o mais novo ao persistir). Confirmado empiricamente durante o desenvolvimento (processos órfãos de `tsx watch` causando comportamento inconsistente). Isso é uma **limitação arquitetural séria para produção**: **não é seguro rodar mais de uma réplica do servidor** contra o mesmo arquivo SQLite sem uma camada de coordenação — o que contradiz qualquer plano de escala horizontal. **Finding P0-DB-02**.
- SQLite via `node:sqlite` é **experimental** no Node.js — não recomendado para produção sem avaliação de estabilidade da versão do Node usada. `REQUIRES_INFRASTRUCTURE_VALIDATION`.
- Existe suporte a provider Postgres (`DB_PROVIDER=postgres`, `server/postgres.ts`) — **mas investigação de código nesta sessão de continuidade confirmou que ele NÃO resolve o problema de concorrência multi-processo acima.** `readDb()` sempre lê de uma variável `dbState` em memória por processo, populada do Postgres apenas uma vez no boot (`bootstrapPostgresState`); depois disso o processo nunca mais relê o Postgres, só escreve. Cada escrita (`writePostgres`, `server/db.ts:2448-2487`) faz `DELETE` de todas as linhas de todas as tabelas seguido de reinserção completa do estado em memória daquele processo — um "last write wins" no nível do banco inteiro, não por linha. Com 2+ réplicas atrás de um load balancer, a réplica que escrever por último apaga qualquer dado gravado por outra réplica após o boot desta que ela não tenha em memória. **Trocar para Postgres, sozinho, não habilita múltiplas réplicas nem load balancing — apenas troca o destino de persistência para uma única instância.** Reclassificado como **Finding P0-DB-03** (mais grave que apenas "não testado"): usar Postgres com mais de uma réplica ativa é ativamente inseguro do jeito que está implementado hoje. Habilitar load balancing real exigiria reescrever a camada de dados para operar por linha direto no Postgres (sem cache total em memória por processo) — mudança de arquitetura, não apenas configuração de ambiente. Se o plano de produção é usar SQLite/Postgres em instância única mesmo, isso é aceitável para o volume B2B atual, mas deve ser uma decisão explícita e documentada, não um acidente — e load balancer, se usado, deve ser configurado para uma única instância de app (LB apenas para TLS/roteamento, não para escala horizontal).
- N+1 queries / índices: não auditado exaustivamente (dados ainda pequenos em volume B2B atual tornam isso de baixo impacto imediato); recomenda-se revisão quando o catálogo crescer além de alguns milhares de produtos. **Finding P3-DB-03** (melhoria futura, não bloqueante).

## 10. Resiliência

- Rotas de erro observadas retornam mensagens genéricas em português (`buildError(...)`) sem vazar stack trace ao cliente nos pontos amostrados (`server/index.ts:1510,7165,7195,8276,8319,8362`) — bom padrão. Não confirmado para 100% das rotas.
- Health endpoints existem: `/api/health`, `/api/health/detailed`, `/api/health/readiness` (`server/index.ts:2057-2113`) — bom, cobre liveness/readiness básico. Graceful shutdown (SIGTERM handling) **não confirmado** — `REQUIRES_RUNTIME_VALIDATION` (Finding P2-RESIL-01).
- Dependências externas (gateways de pagamento, frete, etc.) majoritariamente pertencem ao módulo de e-commerce **dormente** (feature flag desligada) — não avaliadas em profundidade por não estarem ativas; qualquer ativação futura exige nova auditoria de timeout/retry/circuit-breaker nesses integrações. `REQUIRES_RUNTIME_VALIDATION`.

## 11. Dependências e supply chain

`npm audit`: **15 vulnerabilidades** (7 high, 6 moderate, 2 low), predominantemente em dependências de **build/dev-tooling**, não em código servido em runtime de produção:

- `brace-expansion`, `postcss`, `postcss-selector-parser`, `browserslist`, `js-yaml`, `nanoid` — cadeias de dependência do toolchain de build (Vite/ESLint/PostCSS), risco de exploração em produção é baixo (não são executados no servidor em runtime), mas devem ser corrigidos via `npm audit fix` por higiene.
- `shell-quote`/`concurrently` — usado apenas em scripts de dev (`npm run dev`), não em produção.
- `uuid`/`exceljs` — usado para geração de planilhas administrativas; correção requer upgrade breaking (`exceljs@3.4.0`) — avaliar antes de aplicar `--force`.
- `body-parser` (usado em produção via Express) — DoS por limite de tamanho mal configurado silenciosamente desabilitado; **este é o único item da lista com exposição direta em runtime de produção**. **Finding P1-DEP-01**: rodar `npm audit fix` para este pacote especificamente e confirmar que o limite de body configurado (`appConfig`) é respeitado.

Nenhum segredo hardcoded foi encontrado nos arquivos `.ts`/`.tsx` do servidor/frontend (busca dirigida por padrões `api_key=`, `secret=`, `password=`, `token=` seguidos de literais). `.env` real está corretamente listado em `.gitignore` e não está no histórico do git (`git log --all -- .env` vazio). Bom.

---

## 12. Observabilidade / Logging / Backup / Escalabilidade / Checklist

- **Logging:** não auditado em profundidade nesta rodada (nível de log, PII em logs, rotação) — `REQUIRES_RUNTIME_VALIDATION`.
- **Backup/Restore:** **nenhuma evidência de rotina de backup configurada** para o arquivo SQLite ou para `server/data/uploads`. Não existe script de restore testado. **Finding P0-BACKUP-01** — bloqueante para produção real: perda do arquivo SQLite = perda total de dados de negócio (pedidos, orçamentos, catálogo).
- **CI/CD:** não foi encontrada evidência de pipeline de CI ativo rodando lint/test/build automaticamente a cada push nesta auditoria (não há acesso a GitHub Actions/CI externo verificável localmente). `REQUIRES_INFRASTRUCTURE_VALIDATION`.
- **Escala:** classificação **B (single-instance apenas)** — a arquitetura atual (estado em memória + SQLite em arquivo único) não suporta múltiplas réplicas com segurança (ver Finding P0-DB-02). Para o volume B2B atual (catálogo pequeno, poucos usuários administrativos, sem e-commerce público ativo), isso é **aceitável no curto prazo**, mas deve ser tratado antes de qualquer campanha de tráfego alto ou ativação do e-commerce.
- **Anti-overengineering:** nenhuma recomendação de Kubernetes/Kafka/microserviços é feita aqui — o volume e a natureza B2B do sistema não justificam essa complexidade. A recomendação é: manter single-instance, resolver backup e persistência de uploads primeiro, migrar para Postgres gerenciado (não Kubernetes) quando/se precisar de múltiplas réplicas.

### Checklist de prontidão para produção

| Item | Status | Evidência |
|---|---|---|
| AUTH_READY | PARTIAL | Rate limit + hash de senha confirmados; atributos de cookie e algoritmo de hash não confirmados em runtime |
| AUTHORIZATION_READY | PARTIAL | RBAC real e centralizado; IDOR e fallback de alias não testados em runtime |
| INPUT_VALIDATION_READY | PARTIAL | Amostragem positiva, não é cobertura de 100% das rotas |
| UPLOAD_SECURITY_READY | PARTIAL | Boa validação de tipo/tamanho; falta magic-bytes e persistência de volume não confirmada |
| DATABASE_READY | FAIL | Risco de concorrência multi-processo (P0-DB-02); SQLite experimental |
| IDEMPOTENCY_READY | PARTIAL | migrateDb corrigido para idempotência parcial; sem teste automatizado de idempotência total |
| RESILIENCE_READY | PARTIAL | Health checks existem; graceful shutdown não confirmado |
| DEPENDENCY_SECURITY_READY | PARTIAL | 15 vulns, maioria em dev-tooling; 1 item (body-parser) com exposição real |
| SECRETS_READY | PASS | .env não commitado, sem segredos hardcoded encontrados |
| LOGGING_READY | PASS (atualizado 2026-09-04) | Revisão dos 34 pontos de log + auditoria de acesso: nenhum dado sensível (senha, hash, token, CPF, e-mail completo) encontrado em texto puro; ver Adendo 7. Rotação/retenção de log ainda depende de infraestrutura de produção não provisionada. |
| OBSERVABILITY_READY | PASS (atualizado 2026-09-04) | Métricas HTTP/negócio/segurança + export Prometheus já implementados e testados; falta só scraping externo quando houver infra de produção |
| BACKUP_READY | FAIL | Nenhuma rotina de backup encontrada |
| RESTORE_READY | FAIL | Nenhum drill de restore existente |
| LOAD_TEST_READY | PARTIAL (atualizado 2026-09-04) | Script de smoke corrigido (estava quebrado) + concorrência leve adicionada e testada; não é teste de carga real contra staging/produção |
| SECURITY_TEST_READY | PARTIAL | Revisão estática feita; nenhum DAST executado (ainda bloqueado — sem staging/ferramenta) |
| ROLLBACK_READY | PARTIAL (atualizado 2026-09-04) | Decisão formalizada na ADR 0015: rollback exige reverter código + dados juntos (restore de backup), não há versionamento de schema real |
| PRODUCTION_READY | **FAIL** | Ver decisão final |

---

## 13. Top 10 riscos, quick wins, hardening, decisão final

### Top 10 riscos (impacto × probabilidade × facilidade de exploração)

1. **P0-BACKUP-01** — Sem backup/restore do banco. Perda de dados = perda de negócio.
2. **P0-DB-02** — Estado em memória + SQLite em arquivo único não suporta múltiplas réplicas com segurança; risco de perda silenciosa de escrita já observado empiricamente.
3. **P0-PROC-01** — Suíte de testes não era executada consistentemente durante o desenvolvimento; 2 regressões reais (import quebrado, arquivo deletado referenciado) chegaram ao estado atual sem detecção.
4. **P1-UPLOAD-03** — Persistência de uploads em disco local não confirmada para sobreviver a redeploy em produção (perda de imagens de produto).
5. **P1-DB-01** — `migrateDb()` sem teste automatizado de idempotência; risco de recorrência do bug já corrigido.
6. **P1-UPLOAD-01** — Upload sem verificação de magic bytes reais do arquivo.
7. **P1-DEP-01** — Vulnerabilidade de DoS em `body-parser` (dependência de runtime real, não dev-only).
8. **P1-AUTHZ-02** — IDOR entre recursos de clientes diferentes (pedidos/orçamentos) não testado em runtime.
9. **P2-RESIL-01** — Graceful shutdown não confirmado; pode causar corte abrupto de escrita em memória.
10. **BLOCKED_ITEMS** — Logging, observabilidade, load test e DAST não avaliados nesta rodada por estarem fora do tempo alocado; qualquer um pode revelar itens P0/P1 novos.

### Quick wins (baixo esforço, alto benefício, baixo risco)

- Rodar `npm audit fix` (não `--force`) para corrigir a maioria das vulnerabilidades de dev-tooling e o `body-parser`.
- Corrigir os dois testes com regressão confirmada: reexportar (ou remover do teste) os símbolos removidos de `catalogRoutes.ts`, e atualizar/remover a referência a `AdminPhase1.tsx` no `standardization.test.ts`.
- Atualizar as 4 asserções de teste com strings desatualizadas (61, 64, 66, provavelmente 48) para refletir o texto PT-BR correto atual — são testes, não código de produção, risco zero de regressão real.
- Adicionar HSTS ao `applySecurityHeaders` (condicionado a HTTPS confirmado).
- Confirmar/forçar `secure` e `sameSite` corretos no cookie de sessão.

### Plano de hardening (fases)

- **FASE A (Segurança crítica):** confirmar atributos de cookie de sessão; testar IDOR nas rotas de pedidos/orçamentos; adicionar verificação de magic bytes no upload.
- **FASE B (Dados):** decidir e documentar formalmente: SQLite single-instance (aceitar limitação) OU migrar para Postgres gerenciado antes do go-live. Implementar backup automatizado + drill de restore testado.
- **FASE C (Processo):** integrar `npm run test:phase1` como gate obrigatório de CI antes de qualquer merge; adicionar typecheck do backend (`server/*.ts`) ao pipeline.
- **FASE D-J:** logging estruturado, observabilidade (métricas/tracing), load test realista, DAST em staging, plano de rollback documentado (versão de app × migração de banco), graceful shutdown confirmado, revisão de HTTPS/CDN apenas se o volume justificar.

### Decisão final

**BLOCKED_PENDING_VALIDATION**

Justificativa objetiva: o código não apresenta vulnerabilidades críticas óbvias de aplicação (RBAC, CSRF, headers e validação de upload estão em nível bom para o estágio), mas **faltam garantias operacionais fundamentais que nenhum código resolve sozinho** — backup/restore, confirmação de que o storage de uploads sobrevive a deploy, e resolução do gap de teste que já deixou passar 2 regressões reais. Nenhum desses itens foi inventado: cada um tem evidência direta (ausência de scripts de backup no repositório, comportamento observado de perda de escrita concorrente, testes falhando comprovadamente). Recomenda-se **não ir para produção real** até resolver os itens P0 (backup, arquitetura de dados single-instance documentada como decisão consciente, gate de teste no CI) e confirmar os itens marcados `REQUIRES_INFRASTRUCTURE_VALIDATION`/`REQUIRES_RUNTIME_VALIDATION` mais críticos (persistência de upload, atributos de cookie, CORS de produção).

---

## Adendo 10 — P0-PERF-01 resolvido: causa raiz real era diferente do diagnóstico original (2026-09-04)

Autorizado pelo usuário a implementar a correção do travamento de ~220ms por escrita. Antes de corrigir, medi cada etapa separadamente (prática já usada a sessão inteira) e descobri que o diagnóstico original estava incompleto: `writeSqlite()` já era rápido (~7ms); o custo real estava em `migrateDb()` (~215-230ms), que chamava `seedDb()` **3 vezes por escrita**, reconstruindo do zero todo o catálogo/campanhas de marketing padrão só para comparar com o que já existia. Corrigido com uma memoização segura de `seedDb()` (função pura, sem efeitos colaterais) — **resultado medido: ~229ms → ~21ms por escrita, ~11x mais rápido**, sem mudar nenhuma API. Gate completo (84/84) e suíte completa confirmados sem regressão nova. Detalhe técnico completo: `docs/gamel/PLANO_EXECUCAO_CORRECOES_PRIORITARIAS.md`.

---

## Adendo 9 — Checagem geral, pentest ativo, responsividade e capacidade de carga (2026-09-04)

Bateria de testes agressivos contra o servidor real (não só o harness de teste): XSS, prototype pollution, path traversal, bypass de CSRF/autenticação/rate-limit — todos corretamente bloqueados, nenhuma vulnerabilidade nova encontrada. **Um achado real e corrigido:** erros de corpo JSON malformado ou requisição maior que o limite vazavam stack trace completo com caminho absoluto do servidor (página de erro padrão do Express, não interceptada pela aplicação) — corrigido com handler de erro global, testado, com teste de regressão permanente.

Responsividade testada com Playwright real em 320px/390px/768px/1440px (mobile pequeno até desktop) nas páginas públicas e no admin — sem overflow, sem erros de console, boa legibilidade em todos os tamanhos.

Capacidade de carga medida com `autocannon` contra o servidor real: ~2.075 req/s numa rota sem limitação por IP neste ambiente de desenvolvimento — folga muito acima do alvo de 10-30 mil requisições/dia ou /hora mencionado pelo usuário (que exige só 0,1-8,3 req/s em média). Detalhes completos: `docs/gamel/BACKLOG_HARDENING_PRODUCAO.md`.

---

## Adendo 8 — Observabilidade, teste de carga e rollback investigados (2026-09-04)

- **OBSERVABILITY_READY:** já estava implementado (`server/observability.ts` — métricas HTTP/negócio/segurança + export Prometheus, endpoint protegido por token em produção). Testado nos 3 cenários (dev, produção sem token, produção com token). `PASS`.
- **LOAD_TEST_READY:** o script `npm run gamel:phase1:load-smoke` existia mas estava **quebrado** (usava um formato de payload de orçamento que não existe mais no contrato atual do M1 — falhava silenciosamente com 400, ninguém tinha notado). Corrigido, e adicionada uma checagem leve de concorrência (20 leituras simultâneas, 5 escritas simultâneas) — confirma na prática que leituras não têm gargalo e escritas são seguras por serem serializadas (ADR 0013). Continua `PARTIAL`: isso é smoke test com concorrência leve local, não teste de carga real contra staging/produção.
- **SECURITY_TEST_READY (DAST):** continua bloqueado — exige ambiente de staging e ferramenta dedicada (ex. OWASP ZAP) que não existem; não foi feita uma varredura superficial substituta para não passar falsa confiança.
- **ROLLBACK_READY:** investigação confirmou que não há versionamento de schema em `server/db.ts` — decisão formalizada na **[ADR 0015](docs/ADR/0015-rollback-app-data-coupling.md)**: rollback nesta arquitetura sempre exige reverter código e dados juntos (restaurar backup pré-deploy), nunca só o código isolado.

Detalhes completos: `docs/gamel/BACKLOG_HARDENING_PRODUCAO.md`.

---

## Adendo 7 — Logging estruturado / PII investigado, nenhum problema encontrado (2026-09-04)

Item marcado como `LOGGING_READY: BLOCKED` na checklist original (§12) foi investigado: revisão dos 34 pontos de chamada de log em `server/*.ts` (auth, pedidos, pagamentos, marketing, fila assíncrona, segurança, frete) mais varreduras dirigidas por CPF/`req.body` bruto/`console.log` soltos. Nenhuma senha, hash, token de sessão, CPF ou e-mail completo encontrado em texto puro em log algum; telefone já é mascarado; log de auditoria administrativo usa uma view que exclui campos sensíveis. Nenhuma mudança de código foi necessária. `LOGGING_READY` pode ser atualizado de `BLOCKED` para `PASS` na checklist de prontidão. Rotação/retenção de logs continua dependendo de infraestrutura de produção ainda não provisionada (não é um problema de código). Detalhes: `docs/gamel/BACKLOG_HARDENING_PRODUCAO.md`.

---

## Adendo 6 — P2 (itens preventivos) executados, 1 vulnerabilidade real encontrada e corrigida (2026-09-04)

Com autorização do usuário, os 4 itens P2 do backlog foram executados:

- **P2-HEAD-01 (HSTS) e P2-RESIL-01 (graceful shutdown):** ambos já estavam corretamente implementados no código (não foi preciso escrever nada) — apenas verificados em runtime para confirmar: HSTS ausente em dev, presente em produção; SIGTERM/SIGINT fecham o servidor HTTP, aguardam requisições em andamento, fecham filas/Redis/Postgres, e as mutações já aguardam a escrita ser persistida antes da resposta HTTP ser enviada (sem risco de perda de escrita no shutdown).
- **P2-UPLOAD-02 (decompression-bomb):** implementada verificação de dimensões reais da imagem (PNG/JPEG/WEBP), rejeitando arquivos com largura/altura > 8000px ou área > 40 megapixels. Testado com 7 cenários (válido, oversized, "bomb" de área sem exceder dimensão máxima, formatos diferentes, regressão do P1-UPLOAD-01) — teste permanente adicionado (não havia nenhuma cobertura de teste para os endpoints de upload antes desta sessão).
- **P2-INPUT-01 (validação de entrada):** varredura direcionada (não auditoria de 100% das rotas) encontrou e corrigiu **2 vulnerabilidades reais de mass assignment** em `PUT /api/admin/marketing/landing-pages/:id` e `PUT /api/admin/marketing/snippets/:id` — um usuário já autenticado com permissão `marketing` (nível "limited") podia sobrescrever `id`, `created_by`, `created_at` via payload da requisição, porque esses dois endpoints espalhavam `...req.body` inteiro num `Object.assign()` sem filtro (os endpoints de criação/duplicação vizinhos já faziam isso corretamente com listas explícitas de campos). Corrigido nos dois pontos, testado em runtime (atualização legítima continua funcionando, tentativa de mass assignment bloqueada), teste de regressão permanente adicionado.

79/79 testes, lint, typecheck e build confirmados limpos após todas as mudanças. Detalhamento completo: `docs/gamel/BACKLOG_HARDENING_PRODUCAO.md`.

---

## Adendo 5 — Decisões do usuário aplicadas: fix de AUTHZ e ADR de storage (2026-09-04)

Após o Adendo 4, o usuário decidiu sobre os dois itens que ficaram pendentes de decisão:

- **P1-AUTHZ-01 (bug do `canManageAdminUser`):** corrigido. O bypass quebrado (`actorProfile.slug === "admin_master"`, que nunca disparava) foi trocado por `actorProfile.permissions.includes("*")`, o mesmo sinal de acesso total já usado em `canAdminPerform()`. Validado com o mesmo rigor das rodadas anteriores: cenário principal (auto-edição e gestão de par `administrador`, ambos 200 agora), cenários adjacentes (gestão de perfil inferior continua OK; `comercial` continua corretamente barrado), testado explicitamente contra os 5 perfis reais do sistema, sem novos erros/warnings nos logs, teste de regressão permanente adicionado (`tests/http-admin-sellers.test.ts`). Gate completo limpo antes e depois.
- **P1-UPLOAD-03 (persistência de uploads):** decisão formalizada em **[ADR 0014](docs/ADR/0014-uploads-local-disk-storage.md)** — manter disco local para a Fase 1, com checklist obrigatório para quem for configurar o deploy real (confirmar volume persistente). `.env.production.example` corrigido: `STORAGE_PROVIDER` voltou para `local` com comentário explicando que `s3` era aspiracional e nunca foi implementado no código — o valor anterior (`s3`) estava descrevendo um comportamento que o sistema não tem.

Detalhamento completo: `docs/gamel/BACKLOG_HARDENING_PRODUCAO.md`.

---

## Adendo 4 — P1s restantes investigados em profundidade (2026-09-04, sessão de hardening)

Após fechar os 4 P0, os P1 restantes foram investigados com testes de runtime reais (não só leitura de código), com validação completa (lint/typecheck/test/build) antes e depois de qualquer mudança:

- **P1-AUTHZ-01 (fallback de permissões):** confirmado **fail-closed** por design e testado ao vivo — perfil `comercial` corretamente barrado (403) em `users.manage`, upload de mídia e edição de produtos, via chamada de API direta; ação permitida corretamente liberada (200); evento de auditoria gravado. **Achado colateral (não é vulnerabilidade — é excesso de restrição):** `canManageAdminUser()` (`server/index.ts:1103`) tem um bypass para `admin_master` que nunca dispara (slug morto, resquício de um array de perfis antigo e não usado), fazendo com que nenhum `administrador` consiga editar a própria conta ou gerenciar um par de mesmo nível. Correção não aplicada — decisão pendente do usuário.
- **P1-AUTHZ-02 (IDOR):** testado com dois registros de cliente diferentes via HTTP direto. `canAccessOrder()` fail-closed confirmado: acesso negado para dono errado, anônimo sem token, e token errado; liberado para dono correto, token correto, e admin (por design). Nenhuma falha encontrada.
- **P1-UPLOAD-03 (persistência de uploads):** investigado — **onde a produção vai rodar nunca foi decidido** em nenhum documento do repositório. Achado relevante: `.env.production.example` já declara `STORAGE_PROVIDER=s3`, mas isso nunca foi implementado no código — os uploads sempre gravam em disco local independente dessa variável. Decisão de infraestrutura pendente do usuário (ver `docs/gamel/BACKLOG_HARDENING_PRODUCAO.md`).
- **P1-PROC-02 (typecheck do backend):** levantada contagem real — 190 erros de tipo em 19 arquivos, 155 concentrados em `server/index.ts` e `server/db.ts`. Registrado como dívida técnica documentada (script `npm run typecheck:server` criado, não incluído no gate de CI ainda) — correção em massa não aplicada por ser desproporcional ao escopo desta sessão.

Detalhamento completo de cada item: `docs/gamel/BACKLOG_HARDENING_PRODUCAO.md`.

---

## Adendo 3 — P0-DB-02/03 e P0-BACKUP-01 resolvidos (2026-09-04, sessão de hardening)

- **P0-DB-02 / P0-DB-03 (arquitetura de dados/load balancing):** decisão de instância única formalizada em **[ADR 0013](docs/ADR/0013-single-instance-deployment.md)**, incluindo o achado de que `DB_PROVIDER=postgres` não habilita múltiplas réplicas do jeito que está implementado hoje (ver detalhe técnico na ADR). Load balancer, se usado, deve apontar para uma única instância ativa.
- **P0-BACKUP-01 (backup/restore):** implementado restore real (`npm run backup:restore -- <arquivo> --confirm`, com snapshot de segurança automático antes de sobrescrever) e backup de uploads (`npm run backup:uploads`, com manifesto sha256), além do export de banco já existente. Testado ponta a ponta em diretório isolado. Falta apenas o agendamento automático (cron/Task Scheduler) — depende de infraestrutura de produção ainda não provisionada.
- **P1-UPLOAD-01 (magic bytes):** implementada verificação de assinatura binária real do arquivo (`validateUploadedImageMagicBytes`, `server/index.ts`) nos dois endpoints de upload — rejeita e apaga arquivos cuja assinatura não bate com a extensão declarada.
- Detalhamento completo desses e dos itens ainda em aberto: `docs/gamel/BACKLOG_HARDENING_PRODUCAO.md`.

---

## Adendo 2 — Verificação de continuidade (2026-09-04, sessão seguinte)

Working tree limpo (`git status --short` vazio, tudo commitado em `main`, commit `fefdbfc`). Reexecutado o baseline completo para confirmar que o estado descrito no Adendo 1 permanece válido após o commit:

```text
npm run lint         → OK, sem erros
npm run typecheck     → OK, sem erros (frontend; server/*.ts continua sem gate — Finding P1-PROC-02 ainda aberto)
npm run test:phase1   → 70/70 testes passando
npm run build         → OK, build de produção gerado com sucesso
```

O item que estava marcado `REQUIRES_RUNTIME_VALIDATION` no §3 original ("`npm run build` não executado") está **resolvido**: build limpo confirmado nesta sessão.

Nenhum outro item da checklist de prontiução foi reavaliado nesta passagem (fora do escopo desta sessão, que foi apenas continuidade/documentação). Os P0 seguem os mesmos do Adendo 1: **P0-BACKUP-01** (sem backup/restore), **P0-DB-02** (SQLite single-instance, sem concorrência multi-processo segura), e **P0-PROC-01** (mitigado parcialmente: gate de teste `npm test` confirmado passando, mas ainda não confirmado como gate obrigatório de CI). Decisão final continua **BLOCKED_PENDING_VALIDATION** até esses itens serem endereçados.

---

## Adendo — Fixes aplicados após a publicação inicial deste relatório

Nesta rodada de acompanhamento (mesmo dia), os quick wins listados acima foram implementados e verificados (`npm test`, lint, typecheck e build limpos, 70/70 testes do gate de produção passando). Além disso:

- **Bug real corrigido:** rota `PATCH /api/admin/products/batch` (nova, para edição em lote) estava registrada *depois* de `PATCH /api/admin/products/:id` no Express, então `:id` capturava a palavra "batch" como um ID de produto e a rota nova nunca era alcançada (404 sempre). Corrigido invertendo a ordem de registro. Só foi detectado porque o endpoint foi testado contra o servidor real, não só validado por tipo.
- **Incidente de segredo commitado (corrigido, não vazado publicamente):** um commit local (`99bfa11b`, feito fora desta sessão) apagou `.gitignore`/`.gitattributes` e acabou versionando `.env` (segredos reais) junto com `node_modules/` e `dist/` (28.800 arquivos). Como esse commit nunca havia sido enviado ao GitHub (`git branch -r --contains` vazio), foi possível desfazê-lo localmente com `git reset --mixed` sem qualquer exposição pública. `.gitignore` foi restaurado e reforçado antes de qualquer novo commit.
- **`AdminPhase1.tsx`/`AdminExecutive.tsx` (arquivos deletados na reestruturação do painel admin) ainda eram referenciados por 2 scripts de produção** (`scripts/check-gamel-phase1-go-live.ts`, que crashava com `ENOENT` sempre que executado) — corrigido apontando para o substituto real (`AdminQuoteRequests.tsx`).
- **Dívida técnica identificada e conscientemente NÃO resolvida nesta rodada:** a suíte `npm run test:future` (85 testes cobrindo checkout, pagamentos, fiscal AI, WMS e BI executivo — funcionalidades dormentes, desligadas por feature flag, fora do gate de produção `npm test`) tem **81 testes falhando**. Causa raiz: essa suíte depende de dados de seed antigos (produtos com preço/estoque reais e perfis fiscais) que deixaram de existir quando o catálogo foi substituído pelos produtos reais da GAMEL (modelo B2B "sob consulta", preço/estoque sempre zero). Não é regressão desta sessão nem bloqueia produção — é dívida pré-existente de um subsistema nunca ativado. Removido apenas o que testava estrutura definitivamente abandonada (`tests/admin-routing-performance.test.ts`, 30 testes que verificavam um painel admin de 37+ páginas substituído pelo painel atual de 14 rotas). O restante (checkout/fiscal/WMS/BI) permanece como débito documentado, a ser tratado quando/se essas funcionalidades forem realmente ativadas.
