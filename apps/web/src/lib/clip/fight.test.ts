import { describe, expect, it } from 'vitest';
import {
  buildFightAnalysisBrief,
  planFightClip,
  sanitizeSponsorPackage,
  type FightClipCandidate,
} from './fight';

describe('buildFightAnalysisBrief', () => {
  it('asks for complete story arcs and protects decisive action', () => {
    const brief = buildFightAnalysisBrief({
      mode: 'fight',
      fighterNames: ['Mike Heckert', 'Opponent'],
      eventName: 'Main Event',
      roundMarkers: [{ round: 2, start: 180, end: 360 }],
    });

    expect(brief).toContain('Mike Heckert vs Opponent');
    expect(brief).toContain('Round 2: 180.0s–360.0s');
    expect(brief).toContain('setup → exchange → reaction');
    expect(brief).toContain('Do not cut during a strike');
  });

  it('uses the generic contract without inventing fighter metadata', () => {
    const brief = buildFightAnalysisBrief();
    expect(brief).toContain('viral short-form editor');
    expect(brief).not.toContain('undefined');
  });
});

describe('planFightClip', () => {
  const candidate: FightClipCandidate = {
    start: 201.4,
    end: 213.1,
    score: 88,
    title: 'Knockdown sequence',
    hook: 'He never saw it coming',
    reason: 'Clean knockdown and crowd reaction',
    platforms: ['TikTok'],
    keywords: ['knockdown'],
    momentType: 'knockdown',
  };

  it('adds bounded handles while staying inside the detected round', () => {
    const planned = planFightClip(candidate, {
      roundMarkers: [{ round: 2, start: 200, end: 215 }],
      sourceDurationSec: 500,
    });

    expect(planned.start).toBe(200);
    expect(planned.end).toBe(215);
    expect(planned.round).toBe(2);
    expect(planned.contentMode).toBe('fight');
  });

  it('never produces a negative start or extends beyond the source', () => {
    const planned = planFightClip(
      { ...candidate, start: 0.2, end: 9.5 },
      { sourceDurationSec: 10 }
    );
    expect(planned.start).toBe(0);
    expect(planned.end).toBe(10);
  });

  it('does not add handles for interviews or corner quotes', () => {
    const planned = planFightClip(
      { ...candidate, momentType: 'corner', start: 12, end: 30 },
      { sourceDurationSec: 60 }
    );
    expect(planned.start).toBe(12);
    expect(planned.end).toBe(30);
  });
});

describe('sanitizeSponsorPackage', () => {
  it('normalizes safe sponsor branding and clamps opacity', () => {
    const sponsor = sanitizeSponsorPackage({
      sponsorName: '  ACME Fight Gear  ',
      logoUrl: 'https://cdn.example.com/logo.png',
      placement: 'top-right',
      opacity: 4,
      safeAreaPercent: 2,
      accentColor: '#ffcc00',
      callToAction: ' Shop ACME ',
    });

    expect(sponsor).toEqual({
      sponsorName: 'ACME Fight Gear',
      logoUrl: 'https://cdn.example.com/logo.png',
      placement: 'top-right',
      opacity: 1,
      safeAreaPercent: 5,
      accentColor: '#FFCC00',
      callToAction: 'Shop ACME',
    });
  });

  it('rejects unsafe logo protocols and invalid colors', () => {
    expect(() =>
      sanitizeSponsorPackage({
        sponsorName: 'ACME',
        logoUrl: 'file:///etc/passwd',
        accentColor: 'red; movie=bad',
      })
    ).toThrow(/logoUrl|accentColor/);
  });

  it('rejects loopback and private-network logo hosts', () => {
    for (const logoUrl of [
      'https://localhost/logo.png',
      'https://127.0.0.1/logo.png',
      'https://10.0.0.8/logo.png',
      'https://172.16.0.8/logo.png',
      'https://192.168.1.8/logo.png',
      'https://169.254.169.254/latest/meta-data',
    ]) {
      expect(() => sanitizeSponsorPackage({ sponsorName: 'ACME', logoUrl })).toThrow(
        /public https host/
      );
    }
  });
});
