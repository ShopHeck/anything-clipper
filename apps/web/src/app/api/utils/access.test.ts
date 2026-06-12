import { describe, expect, it } from 'vitest';
import { canEdit, roleFrom } from './access';

describe('roleFrom', () => {
  it('owner outranks any share role', () => {
    expect(roleFrom(true, null)).toBe('owner');
    expect(roleFrom(true, 'viewer')).toBe('owner');
  });

  it('maps share roles when not the owner', () => {
    expect(roleFrom(false, 'editor')).toBe('editor');
    expect(roleFrom(false, 'viewer')).toBe('viewer');
  });

  it('returns null with no ownership or share', () => {
    expect(roleFrom(false, null)).toBeNull();
    expect(roleFrom(false, 'bogus')).toBeNull();
  });
});

describe('canEdit', () => {
  it('allows owners and editors only', () => {
    expect(canEdit('owner')).toBe(true);
    expect(canEdit('editor')).toBe(true);
    expect(canEdit('viewer')).toBe(false);
    expect(canEdit(null)).toBe(false);
  });
});
