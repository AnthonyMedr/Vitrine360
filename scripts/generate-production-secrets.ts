import crypto from "node:crypto";

function makeSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

const csrfSecret = makeSecret(48);
const metricsToken = makeSecret(32);
const appSecret = makeSecret(48);

console.log("# Production security bootstrap");
console.log(`APP_SECRET=${appSecret}`);
console.log(`AUTH_CSRF_SECRET=${csrfSecret}`);
console.log("SECURE_COOKIES=true");
console.log("TRUST_PROXY=true");
console.log(`METRICS_TOKEN=${metricsToken}`);
