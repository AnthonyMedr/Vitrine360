# Revisao de Conteudo do Piloto - Vitrine360

**Projeto:** Vitrine360 - Central Comercial Digital  
**Responsavel:** InfiniTI Labs

## Referencia atual encontrada no projeto

Base atual carregada pelo seed/local store:

- loja: `Gamel Metal`
- WhatsApp atual: `5585988887777`
- endereco atual: `Av. Principal, 1234 - Centro, Fortaleza/CE`
- horario atual: `Seg a Sex: 08h-12h e 13h30-17h30 | Sab: 08h-12h`
- Instagram atual: `https://instagram.com/lojaodopvc`
- produtos atuais no seed: `10`
- categorias atuais no seed: `9`
- campanhas atuais no seed: `3`

Observacao: os itens abaixo devem ser validados comercialmente antes da publicacao oficial. A lista marca o que ja existe tecnicamente no projeto, nao o que ja esta aprovado pelo cliente.

Base pronta para aprovacao:

- `PILOTO-CONTENT-APPROVED.json` agora espelha o snapshot tecnico atual
- a equipe pode editar esse arquivo diretamente com os dados aprovados do cliente
- depois, aplicar localmente com `npm run pilot:content:apply`

Snapshot tecnico de apoio:

- `PILOTO-CONTENT-SNAPSHOT.md`
- `PILOTO-CONTENT-CHECKLIST.md`
- gerar/atualizar com `npm run pilot:content:report`
- gerar checklist comercial com `npm run pilot:content:checklist`
- arquivo de aprovacao editavel: `PILOTO-CONTENT-APPROVED.json`
- inicializar com `npm run pilot:content:init`
- aplicar no banco local com `npm run pilot:content:apply`

## 1. Dados institucionais da loja

- [x] nome comercial carregado tecnicamente no seed atual
- [ ] nome comercial aprovado
- [ ] logomarca final em boa resolucao
- [x] WhatsApp carregado tecnicamente no seed atual
- [x] endereco carregado tecnicamente no seed atual
- [x] horario de funcionamento carregado tecnicamente no seed atual
- [x] Instagram carregado tecnicamente no seed atual
- [ ] WhatsApp oficial comercial aprovado
- [ ] endereco completo aprovado
- [ ] horario de funcionamento aprovado
- [ ] Instagram oficial aprovado
- [ ] texto institucional revisado e aprovado

## 2. Catalogo e categorias

- [x] categorias existentes no seed/banco local
- [x] produtos existentes no seed/banco local
- [ ] categorias aprovadas pelo cliente piloto
- [ ] produtos inativos removidos ou arquivados
- [ ] descricoes curtas revisadas
- [ ] descricoes completas revisadas
- [ ] especificacoes tecnicas validadas
- [ ] slugs revisados
- [ ] tags e mensagens de WhatsApp revisadas

Produtos atualmente encontrados:

1. Forro HD Wood Marfim
2. Chapa UV Nero Markina
3. Chapa UV Calacata Nero
4. Ripado WPC Interno
5. Telha PVC Branca
6. Linha Drywall Completa
7. Policarbonato Alveolar
8. Perfis de Aluminio
9. Box de Banheiro em Aluminio
10. Piso Vinilico Carvalho

## 3. Campanhas e ofertas

- [x] campanhas existentes no seed/banco local
- [ ] campanha principal do periodo definida
- [ ] datas de inicio/fim conferidas
- [ ] CTA comercial aprovado
- [ ] banners finais aprovados
- [ ] ofertas expiradas arquivadas
- [ ] links e QR Codes testados

Campanhas atualmente encontradas:

1. Mes da Construcao
2. Especial Chapas UV
3. Semana do Forro

## 4. Midia

- [x] imagens principais tecnicas carregadas para os itens seeded
- [ ] imagem principal por produto validada
- [ ] ambientacoes e galerias revisadas
- [ ] arquivos pesados otimizados
- [ ] textos ALT preenchidos
- [ ] imagens de totem revisadas
- [ ] imagens de vitrine TV revisadas
- [ ] QR Code principal validado com URL oficial e leitura real

## 5. Canais e operacao

- [x] WhatsApp tecnico funcional em ambiente local
- [x] admin apresenta dados seeded/localmente
- [x] totem e vitrine funcionam tecnicamente no ambiente local
- [x] QR Code publico estabilizado tecnicamente
- [ ] WhatsApp abre com mensagem correta aprovada pelo cliente
- [ ] QR Code principal abre a URL oficial
- [ ] totem exibe apenas conteudo vigente aprovado
- [ ] vitrine TV exibe campanhas corretas aprovadas
- [ ] admin apresenta dados reais homologados do piloto

## 6. Pendencias identificadas na revisao

Preencher abaixo antes da publicacao:

1. Substituir URLs locais por dominio e ambiente oficial.
2. Homologar conteudo comercial real do cliente piloto no lugar do seed tecnico atual.
3. Desabilitar bypass de admin e validar IA/analytics com credenciais reais.
4. Validar fisicamente totem, vitrine e leitura de QR Code no ambiente final.

## 7. Observacao operacional

Em `2026-06-13`, o ambiente local permaneceu aprovado em `npm run production:check:local`.

O bloqueio de publicacao oficial segue concentrado em:

1. credenciais reais de `.env.production`
2. homologacao do conteudo final do cliente
3. validacao fisica de totem, TV e QR Code
