import { readFile } from "node:fs/promises";

const configUrl = new URL("../config/extension-targets.json", import.meta.url);

// There is one installable extension package. The historical profile names
// remain accepted by the low-level helpers so existing local commands fail
// closed (and can continue to require a configured demo), but they all resolve
// to the same `dist/` origin set.
export const PROFILES = new Set(["extension", "production", "demo", "development"]);

export async function readExtensionTargets() {
  const value = JSON.parse(await readFile(configUrl, "utf8"));
  validateTargets(value);
  return value;
}

function canonicalOrigin(value, label) {
  if (typeof value !== "string" || !value) throw new Error(`${label} must be a non-empty origin`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid origin`);
  }
  if (url.origin !== value || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error(`${label} must be an exact origin without path, query, hash, or credentials`);
  }
  return url;
}

function validateTargets(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Extension target config must be an object");
  const production = canonicalOrigin(value.productionOrigin, "productionOrigin");
  if (production.protocol !== "https:" || production.origin !== "https://www.meinesv.at") {
    throw new Error("productionOrigin must be exactly https://www.meinesv.at");
  }
  if (value.demoOrigin !== null) {
    const demo = canonicalOrigin(value.demoOrigin, "demoOrigin");
    if (demo.protocol !== "https:" || demo.origin === production.origin) {
      throw new Error("demoOrigin must be a distinct HTTPS origin");
    }
  }
  if (!Array.isArray(value.developmentOrigins) || value.developmentOrigins.length === 0) {
    throw new Error("developmentOrigins must be a non-empty array");
  }
  const seen = new Set();
  for (const candidate of value.developmentOrigins) {
    const development = canonicalOrigin(candidate, "developmentOrigins entry");
    if (development.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(development.hostname) || development.port !== "4173") {
      throw new Error("developmentOrigins may contain only http loopback origins on port 4173");
    }
    if (seen.has(development.origin)) throw new Error("developmentOrigins contains a duplicate origin");
    seen.add(development.origin);
  }
}

export function assertProfile(profile) {
  if (!PROFILES.has(profile)) throw new Error(`Unknown extension build profile: ${profile}`);
}

export function configuredOrigins(targets, profile = "extension") {
  assertProfile(profile);
  const origins = [targets.productionOrigin];
  if (targets.demoOrigin) origins.push(targets.demoOrigin);
  origins.push(...targets.developmentOrigins);
  return origins;
}

export function manifestMatches(targets, profile = "extension") {
  return configuredOrigins(targets, profile).map((origin) => `${origin}/vsInfo/views/KE/*`);
}

export function requiresDemo(profile) {
  return profile === "demo";
}
