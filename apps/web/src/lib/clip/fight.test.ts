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

  it('prefers known round markers over a hallucinated model round', () => {
    const planned = planFightClip(
      { ...candidate, round: 5 },
      {
        roundMarkers: [{ round: 2, start: 200, end: 215 }],
        sourceDurationSec: 500,
      }
    );
    expect(planned.round).toBe(2);
  });

  it('prefers supplied fighter names over model names', () => {
    const planned = planFightClip(
      { ...candidate, fighterNames: ['Invented', 'Names'] },
      {
        fighterNames: ['Mike Heckert', 'Opponent'],
        sourceDurationSec: 500,
      }
    );
    expect(planned.fighterNames).toEqual(['Mike Heckert', 'Opponent']);
  });
});

describe('sanitizeSponsorPackage', () => {
  it('normalizes safe sponsor branding and clamps opacity', () => {
    const sponsor = sanitizeSponsorPackage({
      sponsorName: '  ACME Fight Gear  ',
      logoKey: 'sponsor-logos/user-1/logo.png',
      placement: 'top-right',
      opacity: 4,
      safeAreaPercent: 2,
      accentColor: '#ffcc00',
      callToAction: ' Shop ACME ',
    });

    expect(sponsor).toEqual({
      sponsorName: 'ACME Fight Gear',
      logoKey: 'sponsor-logos/user-1/logo.png',
      placement: 'top-right',
      opacity: 1,
      safeAreaPercent: 5,
      accentColor: '#FFCC00',
      callToAction: 'Shop ACME',
    });
  });

  it('rejects client-supplied logo URLs, local paths, and invalid colors', () => {
    expect(() =>
      sanitizeSponsorPackage({
        sponsorName: 'ACME',
        logoUrl: 'https://cdn.example.com/logo.png',
        accentColor: 'red; movie=bad',
      } as never)
    ).toThrow(/logoUrl|accentColor|logoKey/);
    expect(() =>
      sanitizeSponsorPackage({
        sponsorName: 'ACME',
        logoUrl: '/etc/passwd',
      } as never)
    ).toThrow(/logoUrl/);
    expect(() =>
      sanitizeSponsorPackage({
        sponsorName: 'ACME',
        logoUrl: 'file:///etc/passwd',
      } as never)
    ).toThrow(/logoUrl/);
  });

  it('rejects traversal, foreign prefixes, and invalid placement', () => {
    expect(() =>
      sanitizeSponsorPackage({
        sponsorName: 'ACME',
        logoKey: 'sponsor-logos/user-1/../secret.png',
      })
    ).toThrow(/logoKey/);
    expect(() =>
      sanitizeSponsorPackage({
        sponsorName: 'ACME',
        logoKey: 'uploads/user-1/logo.png',
      })
    ).toThrow(/logoKey/);
    expect(() =>
      sanitizeSponsorPackage({
        sponsorName: 'ACME',
        placement: 'middle' as never,
      })
    ).toThrow(/placement/);
  });
});
