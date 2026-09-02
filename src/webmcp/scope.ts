import { isSearchPageUrl } from "./catalog.js";
import { resolveSiteContext, type SiteBuildProfile } from "../environment/site-context.js";

const SUPPORTED_PATHS = new Set([
  "/vsInfo/views/KE/einreichungTyp.xhtml",
  "/vsInfo/views/KE/einreichungListe.xhtml",
  "/vsInfo/views/KE/einreichungDetailOA.xhtml",
  "/vsInfo/views/KE/einreichungDetail.xhtml",
]);

export function isSupportedMeineSvUrl(rawUrl: string | undefined, profile?: SiteBuildProfile): boolean {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    return resolveSiteContext(url, profile) !== undefined &&
      (SUPPORTED_PATHS.has(url.pathname) || isSearchPageUrl(url.toString(), profile));
  } catch {
    return false;
  }
}
