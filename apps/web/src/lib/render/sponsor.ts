import { isSponsorLogoKey } from '@/lib/clip/fight';

export const SPONSOR_LOGO_TTL_SECONDS = 3600;

export interface SponsorLogoResolver {
  storageConfigured: () => boolean;
  presignDownload: (key: string, expiresSec?: number) => string;
}

export function isOwnedSponsorLogoKey(userId: string, key: string): boolean {
  const owner = userId.trim();
  return Boolean(owner) && isSponsorLogoKey(key) && key.startsWith(`sponsor-logos/${owner}/`);
}

export function resolveSponsorLogoUrl(
  userId: string,
  logoKey: string | undefined,
  deps: SponsorLogoResolver
): string | undefined {
  const key = logoKey?.trim();
  if (!key) return undefined;
  if (!isOwnedSponsorLogoKey(userId, key)) {
    throw new Error('logoKey must be a sponsor-logos asset owned by the current user');
  }
  if (!deps.storageConfigured()) {
    throw new Error('Object storage is required to render sponsor logos');
  }
  return deps.presignDownload(key, SPONSOR_LOGO_TTL_SECONDS);
}
