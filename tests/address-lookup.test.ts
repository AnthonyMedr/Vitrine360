import test from "node:test";
import assert from "node:assert/strict";
import { lookupBrazilianAddressByCep } from "../server/integrations/address.ts";
import { clearPublicApiCache } from "../server/public-api-runtime.ts";

function jsonResponse(ok: boolean, body: Record<string, unknown>) {
  return {
    ok,
    json: async () => body,
  } as Response;
}

test("lookupBrazilianAddressByCep normalizes a ViaCEP response", async () => {
  clearPublicApiCache();
  const calls: string[] = [];
  const result = await lookupBrazilianAddressByCep("01001-000", {
    fetcher: async (input) => {
      calls.push(String(input));
      return jsonResponse(true, {
        cep: "01001-000",
        logradouro: "Praca da Se",
        complemento: "lado impar",
        bairro: "Se",
        localidade: "Sao Paulo",
        uf: "SP",
        ibge: "3550308",
        ddd: "11",
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, "viacep");
  assert.equal(result.cep, "01001000");
  assert.equal(result.city, "Sao Paulo");
  assert.equal(result.state, "SP");
  assert.equal(result.ibge, "3550308");
  assert.equal(calls.length, 1);
});

test("lookupBrazilianAddressByCep falls back to BrasilAPI when ViaCEP does not find the CEP", async () => {
  clearPublicApiCache();
  const calls: string[] = [];
  const result = await lookupBrazilianAddressByCep("30140-071", {
    fetcher: async (input) => {
      calls.push(String(input));
      if (String(input).includes("viacep")) {
        return jsonResponse(true, { erro: true });
      }
      return jsonResponse(true, {
        cep: "30140071",
        state: "MG",
        city: "Belo Horizonte",
        neighborhood: "Funcionarios",
        street: "Avenida Afonso Pena",
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.provider, "brasilapi");
  assert.equal(result.city, "Belo Horizonte");
  assert.equal(result.state, "MG");
  assert.equal(calls.length, 2);
});

test("lookupBrazilianAddressByCep returns an explicit not found result", async () => {
  clearPublicApiCache();
  const result = await lookupBrazilianAddressByCep("99999999", {
    fetcher: async () => jsonResponse(false, {}),
  });

  assert.equal(result.ok, false);
  assert.equal(result.provider, "none");
  assert.equal(result.message, "CEP nao localizado nas APIs publicas configuradas.");
});

test("lookupBrazilianAddressByCep caches successful lookups", async () => {
  clearPublicApiCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return jsonResponse(true, {
      localidade: "Sao Paulo",
      uf: "SP",
      logradouro: "Praca da Se",
    });
  };

  const first = await lookupBrazilianAddressByCep("01001000", { fetcher });
  const second = await lookupBrazilianAddressByCep("01001000", { fetcher });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(calls, 1);
  assert.match(second.message, /cache/);
});
