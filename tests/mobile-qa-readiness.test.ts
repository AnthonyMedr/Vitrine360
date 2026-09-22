import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getMobileQaReadiness, renderMobileQaReadinessMarkdown } from "../server/mobile-qa-readiness";

function createProjectFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "mobile-qa-"));
  mkdirSync(path.join(root, "src", "pages"), { recursive: true });
  const routes = [
    ["/", "Index"],
    ["/produtos", "Products"],
    ["/produto/:slug", "ProductDetail"],
    ["/aplicacoes", "Applications"],
    ["/orcamento", "Quote"],
    ["/contato", "Contact"],
    ["/sobre", "About"],
    ["/carrinho", "FutureEcommerce"],
    ["/admin", "AdminTeamHome"],
  ];
  writeFileSync(
    path.join(root, "src", "App.tsx"),
    routes.map(([route, component]) => `<Route path="${route}" element={${component}} />`).join("\n"),
    "utf8",
  );
  const responsiveSource = "<main className=\"grid shell-home sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 form\">WhatsApp ProductCard whatsapp orcamento stand by GAMEL Orcamentos Prioridades</main>";
  for (const [, component] of routes) {
    writeFileSync(path.join(root, "src", "pages", `${component}.tsx`), responsiveSource, "utf8");
  }
  return root;
}

test("mobile QA readiness passes when critical routes and responsive evidence exist", () => {
  const report = getMobileQaReadiness(createProjectFixture());

  assert.equal(report.ok, true);
  assert.equal(report.summary.blockers, 0);
  assert.equal(report.results.length > 0, true);
});

test("mobile QA readiness markdown keeps manual screenshot warning explicit", () => {
  const report = getMobileQaReadiness(createProjectFixture());
  const markdown = renderMobileQaReadinessMarkdown(report);

  assert.match(markdown, /nao substitui screenshot real/i);
  assert.match(markdown, /QA visual real ainda obrigatorio: sim/i);
});
