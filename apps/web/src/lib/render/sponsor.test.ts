import { describe, expect, it } from 'vitest';
import {
  hydrateSponsorForProcess,
  isOwnedSponsorLogoKey,
  resolveSponsorLogoUrl,
  SPONSOR_LOGO_TTL_SECONDS,
} from './sponsor';

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
    expect(SPONSOR_LOGO_TTL_SECONDS).toBe(3600);
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

describe('hydrateSponsorForProcess', () => {
  it('replaces a stale queued logo URL with a fresh presign from logoKey', () => {
    const spec = hydrateSponsorForProcess(
      'user-1',
      {
        sourceUrl: 'https://example.com/video.mp4',
        startSec: 0,
        endSec: 10,
        aspect: '9:16',
        sponsor: {
          sponsorName: 'ACME',
          logoKey: 'sponsor-logos/user-1/logo.png',
          logoUrl: 'https://storage.example/expired',
          placement: 'top-right',
        },
      },
      {
        storageConfigured: () => true,
        presignDownload: (key, expiresSec) => `https://storage.example/${key}?fresh=${expiresSec}`,
      }
    );
    expect(spec.sponsor?.logoUrl).toBe(
      'https://storage.example/sponsor-logos/user-1/logo.png?fresh=3600'
    );
    expect(spec.sponsor?.logoKey).toBe('sponsor-logos/user-1/logo.png');
  });

  it('leaves sponsor-free specs unchanged', () => {
    const spec = {
      sourceUrl: 'https://example.com/video.mp4',
      startSec: 0,
      endSec: 10,
      aspect: '9:16' as const,
    };
    expect(
      hydrateSponsorForProcess('user-1', spec, {
        storageConfigured: () => true,
        presignDownload: () => 'nope',
      })
    ).toBe(spec);
  });
});
