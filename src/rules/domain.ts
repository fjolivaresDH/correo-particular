// Casado de remitente por dominio, subdominios incluidos.

/** Dominio de una dirección, en minúsculas; `null` si no tiene forma de dirección. */
export function domainOf(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase().replace(/>$/, "");
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain) ? domain : null;
}

/** `true` si `domain` es `ruleDomain` o un subdominio suyo. */
export function domainMatches(domain: string, ruleDomain: string): boolean {
  const d = domain.toLowerCase();
  const r = ruleDomain.toLowerCase();
  return d === r || d.endsWith("." + r);
}
