import { describe, expect, it } from 'vitest';
import { isOwnedSponsorLogoKey, resolveSponsorLogoUrl } from './sponsor';

describe('isOwnedSponsorLogoKey', () => {
  it('accepts only keys under the caller sponsor-logos prefix', () => {
    expect(isOwnedSponsorLogoKey('user-1', 'sponsor-logos/user-1/logo.png')).toBe(true);
    expect(isOwnedSponsorLogoKey('user-1', 'sponsor-logos/user-2/logo.png')).toBe(false);
    expect(isOwnedSponsorLogoKey('user-1', 'uploads/user-1/logo.png')).toBe(false);
    expect(isOwnedSponsorLogoKey('user-1', 'sponsor-logos/user-1/../x.png')).toBe(false);
  });
});

describe('resolveSponsorLogoUrl', () => {
  it('presigns an owned key when storage is configured', () => {
    const url = resolveSponsorLogoUrl('user-1', 'sponsor-logos/user-1/logo.png', {
      storageConfigured: () => true,
      presignDownload: (key, expiresSec) => `https://storage.example/${key}?exp=${expiresSec}`,
    });
    expect(url).toBe('https://storage.example/sponsor-logos/user-1/logo.png?exp=3600');
  });

  it('returns undefined when no logo key is provided', () => {
    expect(
      resolveSponsorLogoUrl('user-1', '', {
        storageConfigured: () => true,
        presignDownload: () => 'nope',
      })
    ).toBeUndefined();
  });

  it('rejects foreign keys and missing storage', () => {
    expect(() =>
      resolveSponsorLogoUrl('user-1', 'sponsor-logos/user-2/logo.png', {
        storageConfigured: () => true,
        presignDownload: (key) => key,
      })
    ).toThrow(/owned/i);
    expect(() =>
      resolveSponsorLogoUrl('user-1', 'sponsor-logos/user-1/logo.png', {
        storageConfigured: () => false,
        presignDownload: (key) => key,
      })
    ).toThrow(/storage/i);
  });
});
