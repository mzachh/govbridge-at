const SUPPORTED_PATHS = new Set([
  "/vsInfo/views/KE/einreichungTyp.xhtml",
  "/vsInfo/views/KE/einreichungListe.xhtml",
  "/vsInfo/views/KE/einreichungDetailOA.xhtml",
  "/vsInfo/views/KE/einreichungDetail.xhtml",
]);

export function isSupportedMeineSvUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    return url.origin === "https://www.meinesv.at" && SUPPORTED_PATHS.has(url.pathname);
  } catch {
    return false;
  }
}
