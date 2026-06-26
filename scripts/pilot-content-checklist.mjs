import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function readJson(relativePath) {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!existsSync(fullPath)) return null;
  return JSON.parse(readFileSync(fullPath, "utf8"));
}

function readText(relativePath) {
  const fullPath = path.join(process.cwd(), relativePath);
  if (!existsSync(fullPath)) return "";
  return readFileSync(fullPath, "utf8");
}

const approved = readJson("PILOTO-CONTENT-APPROVED.json");
const snapshot = readText("PILOTO-CONTENT-SNAPSHOT.md");

const store = approved?.store ?? {};
const categories = approved?.categories ?? [];
const products = approved?.products ?? [];
const campaigns = approved?.campaigns ?? [];

const featuredProducts = products.filter((product) => product.isFeatured);
const featuredCampaigns = campaigns.filter((campaign) => campaign.isFeatured);

const report = `# Checklist de Homologacao do Piloto - Vitrine360

Gerado automaticamente em ${new Date().toISOString()}.

## 1. Resumo atual do piloto

- Loja atual: \`${store.storeName || "nao definida"}\`
- WhatsApp atual: \`${store.whatsappNumber || "nao definido"}\`
- Endereco atual: \`${store.address || "nao definido"}\`
- Horario atual: \`${store.openingHours || "nao definido"}\`
- Instagram atual: \`${store.instagramUrl || "nao definido"}\`
- Website atual: \`${store.websiteUrl || "nao definido"}\`
- Texto institucional preenchido: ${store.institutionalText ? "sim" : "nao"}
- Categorias mapeadas: \`${categories.length}\`
- Produtos mapeados: \`${products.length}\`
- Produtos em destaque: \`${featuredProducts.length}\`
- Campanhas mapeadas: \`${campaigns.length}\`
- Campanhas em destaque: \`${featuredCampaigns.length}\`

## 2. Itens para aprovacao comercial

### Dados da loja

- [ ] Confirmar nome comercial final
- [ ] Confirmar WhatsApp oficial
- [ ] Confirmar endereco completo
- [ ] Confirmar horario de funcionamento
- [ ] Confirmar Instagram
- [ ] Confirmar website, se houver
- [ ] Confirmar texto institucional final

### Catalogo

- [ ] Confirmar categorias ativas
- [ ] Confirmar produtos ativos
- [ ] Confirmar produtos em destaque
- [ ] Confirmar precos/rotulos comerciais
- [ ] Confirmar mensagens de WhatsApp por produto
- [ ] Confirmar slugs finais

### Campanhas

- [ ] Confirmar campanha principal da home
- [ ] Confirmar campanhas do totem
- [ ] Confirmar campanhas da vitrine TV
- [ ] Confirmar datas e CTAs
- [ ] Confirmar QR Codes e links

### Midia

- [ ] Confirmar logo final
- [ ] Confirmar banners finais
- [ ] Confirmar imagens principais dos produtos
- [ ] Confirmar imagens de totem
- [ ] Confirmar imagens de vitrine TV
- [ ] Confirmar textos ALT
- [ ] Confirmar arquivos otimizados

## 3. Itens ja identificados como destaque

### Produtos em destaque

${featuredProducts.length > 0 ? featuredProducts.map((product, index) => `${index + 1}. \`${product.slug}\` - status: \`${product.status}\``).join("\n") : "- nenhum produto marcado como destaque"}

### Campanhas em destaque

${featuredCampaigns.length > 0 ? featuredCampaigns.map((campaign, index) => `${index + 1}. \`${campaign.slug}\` - home: \`${campaign.showOnHome}\`, totem: \`${campaign.showOnTotem}\`, vitrine: \`${campaign.showOnVitrine}\``).join("\n") : "- nenhuma campanha marcada como destaque"}

## 4. Pendencias objetivas antes da publicacao

1. Revisar o conteudo com o cliente piloto e atualizar \`PILOTO-CONTENT-APPROVED.json\`.
2. Aplicar localmente com \`npm run pilot:content:apply\`.
3. Validar no navegador as rotas \`/\`, \`/ofertas\`, \`/totem\` e \`/vitrine\`.
4. Validar QR Code com URL oficial.
5. Substituir placeholders do ambiente oficial antes da promocao.

## 5. Referencias de apoio

- \`PILOTO-CONTENT-REVIEW.md\`
- \`PILOTO-CONTENT-SNAPSHOT.md\`
- \`PILOTO-CONTENT-APPROVED.json\`

## 6. Snapshot tecnico atual

\`\`\`md
${snapshot.trim() || "snapshot indisponivel"}
\`\`\`
`;

const outputPath = path.join(process.cwd(), "PILOTO-CONTENT-CHECKLIST.md");
writeFileSync(outputPath, report, "utf8");
console.log(`[OK] Checklist gerada: ${outputPath}`);
