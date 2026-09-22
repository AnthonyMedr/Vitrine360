import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("cart save flow distinguishes local persistence from authenticated account sync", () => {
  const customerCenter = readFileSync("src/lib/customerCenter.ts", "utf8");
  const cartPage = readFileSync("src/pages/Cart.tsx", "utf8");

  assert.match(customerCenter, /export async function saveCartRecordAsync/);
  assert.match(customerCenter, /updateActiveCartRecord/);
  assert.match(customerCenter, /clearActiveCartRecord/);
  assert.match(customerCenter, /persistProfileToApiStrict/);
  assert.match(customerCenter, /persisted: true/);
  assert.match(customerCenter, /reason: "guest"/);
  assert.match(customerCenter, /reason: "api_error"/);
  assert.doesNotMatch(customerCenter, /saveCustomerProfile\(next, user, email \|\| next\.email\);\s*void persistProfileToApi\(next, user\);/);

  assert.match(cartPage, /await saveCartRecordAsync/);
  assert.match(cartPage, /Carrinho salvo na sua conta/);
  assert.match(cartPage, /Carrinho salvo neste dispositivo/);
  assert.match(cartPage, /disabled=\{savingCart\}/);
});

test("cart context syncs authenticated active cart with customer center profile", () => {
  const cartContext = readFileSync("src/contexts/CartContext.tsx", "utf8");
  const customerDomain = readFileSync("server/customer-domain.ts", "utf8");
  const db = readFileSync("server/db.ts", "utf8");

  assert.match(cartContext, /syncCustomerProfileFromServer/);
  assert.match(cartContext, /updateActiveCartRecord/);
  assert.match(cartContext, /serverHydrated/);
  assert.match(cartContext, /window\.setTimeout/);
  assert.match(cartContext, /window\.clearTimeout/);
  assert.match(customerDomain, /activeCart/);
  assert.match(db, /DbActiveCartRecord/);
});
