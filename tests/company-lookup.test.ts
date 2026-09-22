import test from "node:test";
import assert from "node:assert/strict";
import { lookupBrazilianCompanyByCnpj } from "../server/integrations/company.ts";
import { clearPublicApiCache } from "../server/public-api-runtime.ts";

function jsonResponse(ok: boolean, body: Record<string, unknown>) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

test("lookupBrazilianCompanyByCnpj normalizes a BrasilAPI response", async () => {
  clearPublicApiCache();
  const result = await lookupBrazilianCompanyByCnpj("11.222.333/0001-81", {
    fetcher: async (input) => {
      assert.equal(String(input), "https://brasilapi.com.br/api/cnpj/v1/11222333000181");
      return jsonResponse(true, {
        cnpj: "11222333000181",
        razao_social: "Empresa Nacional de Teste LTDA",
        nome_fantasia: "Teste Nacional",
        descricao_situacao_cadastral: "ATIVA",
        data_inicio_atividade: "2020-01-02",
        cnae_fiscal_descricao: "Comercio varejista",
        logradouro: "Rua Brasil",
        numero: "100",
        complemento: "Sala 2",
        bairro: "Centro",
        municipio: "Sao Paulo",
        uf: "SP",
        cep: "01001000",
        ddd_telefone_1: "1130000000",
        email: "CONTATO@EXEMPLO.COM",
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, "brasilapi");
  assert.equal(result.cnpj, "11222333000181");
  assert.equal(result.legalName, "Empresa Nacional de Teste LTDA");
  assert.equal(result.tradeName, "Teste Nacional");
  assert.equal(result.status, "ATIVA");
  assert.equal(result.address.city, "Sao Paulo");
  assert.equal(result.address.state, "SP");
  assert.equal(result.address.zipCode, "01001000");
  assert.equal(result.email, "contato@exemplo.com");
});

test("lookupBrazilianCompanyByCnpj returns an explicit invalid result", async () => {
  clearPublicApiCache();
  const result = await lookupBrazilianCompanyByCnpj("123", {
    fetcher: async () => jsonResponse(true, {}),
  });

  assert.equal(result.ok, false);
  assert.equal(result.provider, "none");
  assert.equal(result.message, "CNPJ invalido.");
});

test("lookupBrazilianCompanyByCnpj returns an explicit not found result", async () => {
  clearPublicApiCache();
  const result = await lookupBrazilianCompanyByCnpj("11222333000181", {
    fetcher: async () => jsonResponse(false, {}),
  });

  assert.equal(result.ok, false);
  assert.equal(result.provider, "none");
  assert.equal(result.message, "CNPJ nao localizado na API publica configurada.");
});

test("lookupBrazilianCompanyByCnpj caches successful lookups", async () => {
  clearPublicApiCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return jsonResponse(true, {
      razao_social: "Empresa Cache LTDA",
      municipio: "Recife",
      uf: "PE",
    });
  };

  const first = await lookupBrazilianCompanyByCnpj("11222333000181", { fetcher });
  const second = await lookupBrazilianCompanyByCnpj("11222333000181", { fetcher });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(calls, 1);
  assert.match(second.message, /cache/);
});
