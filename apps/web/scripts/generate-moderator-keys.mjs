import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "keys");
mkdirSync(dir, { recursive: true });

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 3072,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
  },
});

writeFileSync(join(dir, "moderator-public.pem"), publicKey);
writeFileSync(join(dir, "moderator-private.pem"), privateKey, {
  mode: 0o600,
});

chmodSync(join(dir, "moderator-private.pem"), 0o600);

console.log("Moderator keys generated.");
console.log("Public key: keys/moderator-public.pem");
console.log("Private key: keys/moderator-private.pem");
console.log("Keep the private key secret and out of Git.");
