import targets from "../../config/extension-targets.json";

export const SITE_ENVIRONMENTS = ["production", "demo", "development"] as const;
export type SiteEnvironment = (typeof SITE_ENVIRONMENTS)[number];
/**
 * The extension is now shipped as one package. The old environment labels are
 * retained as accepted test/CLI aliases, but no alias changes the approved
 * origin set or produces a second artifact.
 */
export type SiteBuildProfile = "extension" | SiteEnvironment;

export interface SiteContext {
  readonly origin: string;
  readonly environment: SiteEnvironment;
}

interface ExtensionTargets {
  productionOrigin: string;
  demoOrigin: string | null;
  developmentOrigins: readonly string[];
}

/**
 * This is the sole checked-in origin configuration used by the extension.
 * Do not derive an environment from a query parameter, page global, or
 * user-provided flag. The build scripts consume the same JSON file.
 */
export const EXTENSION_TARGETS: ExtensionTargets = Object.freeze({
  productionOrigin: targets.productionOrigin,
  demoOrigin: targets.demoOrigin,
  developmentOrigins: Object.freeze([...targets.developmentOrigins]),
});

export const PRODUCTION_ORIGIN = EXTENSION_TARGETS.productionOrigin;
export const DEMO_ORIGIN = EXTENSION_TARGETS.demoOrigin ?? undefined;
export const DEVELOPMENT_ORIGINS = EXTENSION_TARGETS.developmentOrigins;
export const SYNTHETIC_DEMO_NOTICE = "Synthetic demo data only — not MeineSV or OEGK.";

declare const __GOVBRIDGE_BUILD_PROFILE__: SiteBuildProfile | undefined;

function configuredBuildProfile(): SiteBuildProfile {
  return typeof __GOVBRIDGE_BUILD_PROFILE__ === "string" &&
    (["extension", ...SITE_ENVIRONMENTS] as readonly string[]).includes(__GOVBRIDGE_BUILD_PROFILE__)
    ? __GOVBRIDGE_BUILD_PROFILE__
    : "extension";
}

/** The profile baked into the current extension bundle by scripts/build.mjs. */
export const BUILD_PROFILE = configuredBuildProfile();

function exactOrigin(rawOrigin: string): string | undefined {
  try {
    const parsed = new URL(rawOrigin);
    if (parsed.origin !== rawOrigin || parsed.username || parsed.password ||
        parsed.pathname !== "/" || parsed.search || parsed.hash) return undefined;
    return parsed.origin;
  } catch {
    return undefined;
  }
}

function isLoopbackDevelopmentOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      parsed.port === "4173" &&
      exactOrigin(origin) !== undefined;
  } catch {
    return false;
  }
}

function originContexts(): readonly SiteContext[] {
  const contexts: SiteContext[] = [];
  const production = exactOrigin(PRODUCTION_ORIGIN);
  if (production) contexts.push({ origin: production, environment: "production" });

  const demo = DEMO_ORIGIN && exactOrigin(DEMO_ORIGIN);
  if (demo && demo !== production && demo.startsWith("https://")) {
    contexts.push({ origin: demo, environment: "demo" });
  }

  for (const origin of DEVELOPMENT_ORIGINS) {
    if (isLoopbackDevelopmentOrigin(origin) && !contexts.some((context) => context.origin === origin)) {
      contexts.push({ origin, environment: "development" });
    }
  }
  return contexts;
}

function profileAllowsEnvironment(profile: SiteBuildProfile, environment: SiteEnvironment): boolean {
  // Compatibility aliases intentionally do not narrow this package. Runtime
  // safety comes from the exact checked origin set above, not a page-provided
  // or separately selected environment profile.
  return (["extension", ...SITE_ENVIRONMENTS] as readonly string[]).includes(profile) &&
    SITE_ENVIRONMENTS.includes(environment);
}

/**
 * Resolve an exact approved origin and its provenance. The optional profile is
 * a build-time/test-time selector, never a page-controlled input.
 */
export function resolveSiteContext(
  rawUrl: string | URL | undefined,
  profile: SiteBuildProfile = BUILD_PROFILE,
): SiteContext | undefined {
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    const origin = url.origin;
    const context = originContexts().find((candidate) => candidate.origin === origin);
    return context && profileAllowsEnvironment(profile, context.environment) ? context : undefined;
  } catch {
    return undefined;
  }
}

export function isApprovedOrigin(
  rawOrigin: string | undefined,
  profile: SiteBuildProfile = BUILD_PROFILE,
): boolean {
  if (!rawOrigin || exactOrigin(rawOrigin) !== rawOrigin) return false;
  return resolveSiteContext(rawOrigin, profile) !== undefined;
}

export function siteContextsForProfile(profile: SiteBuildProfile): readonly SiteContext[] {
  return originContexts().filter((context) => profileAllowsEnvironment(profile, context.environment));
}

export function manifestMatchesForProfile(profile: SiteBuildProfile): readonly string[] {
  return siteContextsForProfile(profile).map(({ origin }) => `${origin}/vsInfo/views/KE/*`);
}

export function hasConfiguredDemoOrigin(): boolean {
  return resolveSiteContext(DEMO_ORIGIN, "demo")?.environment === "demo";
}
