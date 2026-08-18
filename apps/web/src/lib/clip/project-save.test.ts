import { describe, expect, it } from 'vitest';
import { projectSaveError } from './project-save';

describe('projectSaveError', () => {
  it('returns null for successful saves', () => {
    expect(projectSaveError({ ok: true, status: 200 })).toBeNull();
  });

  it('returns a useful error when persistence fails', () => {
    expect(projectSaveError({ ok: false, status: 500 })).toMatch(/500/);
    expect(projectSaveError({ ok: false, status: 404 }, 'missing')).toBe('missing');
  });
});
