import test from "node:test";
import assert from "node:assert/strict";
import { INSTITUTIONAL_PAGE_CONTENT, isPlaceholderInstitutionalContent } from "../src/content/institutionalPages";

test("institutional content covers required ecommerce legal pages", () => {
  for (const slug of ["politica_entrega", "politica_troca_devolucao", "politica_privacidade", "termos_uso"] as const) {
    const page = INSTITUTIONAL_PAGE_CONTENT[slug];
    assert.ok(page.title.length > 8, `${slug} sem titulo institucional`);
    assert.ok(page.content.length > 500, `${slug} com conteudo curto demais`);
    assert.equal(isPlaceholderInstitutionalContent(page.content), false, `${slug} ainda usa placeholder`);
  }
});

test("institutional content includes consumer, privacy and operation signals", () => {
  const exchange = INSTITUTIONAL_PAGE_CONTENT.politica_troca_devolucao.content;
  const privacy = INSTITUTIONAL_PAGE_CONTENT.politica_privacidade.content;
  const delivery = INSTITUTIONAL_PAGE_CONTENT.politica_entrega.content;
  const terms = INSTITUTIONAL_PAGE_CONTENT.termos_uso.content;

  assert.match(exchange, /7 dias corridos/);
  assert.match(exchange, /90 dias/);
  assert.match(privacy, /LGPD/);
  assert.match(privacy, /Direitos do titular/);
  assert.match(delivery, /Retirada em loja/);
  assert.match(delivery, /frete/i);
  assert.match(terms, /condições da oferta/);
  assert.match(terms, /CNPJ/);
});

