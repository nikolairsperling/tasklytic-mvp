const imageUrlExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"];

export const imageUrlHint = "Logo URL muss direkt auf eine Bilddatei zeigen, z. B. .png, .jpg, .svg oder ein Upload-Pfad.";

export function isDirectImageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;

  if (trimmed.startsWith("/")) {
    return /^\/uploads\/(?:logos|images)\/[^?#]+\.(?:png|jpe?g|webp|svg|ico)(?:[?#].*)?$/i.test(trimmed);
  }

  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return imageUrlExtensions.some((extension) => url.pathname.toLowerCase().endsWith(extension));
  } catch {
    return false;
  }
}
