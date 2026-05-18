const DEFAULT_COMPANY_NAME = 'WarehouseCore';

function normalizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function getInitialCompanyName(): string {
  return normalizeString((window as any).__APP_CONFIG__?.companyName) || DEFAULT_COMPANY_NAME;
}

export async function fetchPublicCompanyName(): Promise<string | null> {
  try {
    const res = await fetch('/api/v1/config', { credentials: 'include' });
    if (!res.ok) {
      return null;
    }
    const publicCfg = await res.json();
    const name = normalizeString(publicCfg?.companyName) || normalizeString(publicCfg?.company_name);
    return name || null;
  } catch {
    return null;
  }
}
