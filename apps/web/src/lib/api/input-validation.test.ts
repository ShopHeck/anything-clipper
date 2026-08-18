import { describe, expect, it } from 'vitest';
import { parseGenerateClipsInput, parseRenderInput, ValidationError } from './input-validation';

describe('parseGenerateClipsInput', () => {
  it('normalizes a complete fight-analysis request', () => {
    expect(
      parseGenerateClipsInput({
        transcript: 'Round two action',
        count: 4,
        words: [{ text: 'action', start: 2, end: 3 }],
        segments: [{ id: 's1', start: 0, end: 5, text: 'Round two action' }],
        context: {
          mode: 'sponsor',
          fighterNames: [' Mike ', 'Opponent'],
          eventName: ' Main Event ',
          sourceDurationSec: 120,
          roundMarkers: [{ round: 2, start: 60, end: 120 }],
          sponsor: { sponsorName: ' ACME ' },
        },
      })
    ).toMatchObject({
      count: 4,
      context: {
        mode: 'sponsor',
        fighterNames: ['Mike', 'Opponent'],
        eventName: 'Main Event',
        sourceDurationSec: 120,
        roundMarkers: [{ round: 2, start: 60, end: 120 }],
        sponsor: { sponsorName: 'ACME' },
      },
    });
  });

  it.each([
    [{ count: 0 }, 'count'],
    [{ count: 51 }, 'count'],
    [{ words: 'wrong' }, 'words'],
    [{ context: { mode: 'combat' } }, 'mode'],
    [{ context: { fighterNames: [123] } }, 'fighterNames'],
    [{ context: { sourceDurationSec: -1 } }, 'sourceDurationSec'],
    [{ context: { roundMarkers: [{ round: 1, start: 10, end: 5 }] } }, 'roundMarkers'],
    [{ context: { sponsor: { sponsorName: '', placement: 'middle' } } }, 'sponsor'],
  ])('rejects malformed input with a field-specific validation error', (input, field) => {
    expect(() => parseGenerateClipsInput(input)).toThrow(new RegExp(field));
  });

  it('skips zero-duration or empty transcript tokens instead of failing the request', () => {
    const parsed = parseGenerateClipsInput({
      words: [
        { text: 'action', start: 2, end: 3 },
        { text: 'x', start: 2, end: 1 },
        { text: '   ', start: 3, end: 4 },
      ],
      segments: [
        { id: 's1', start: 0, end: 5, text: 'action' },
        { id: 's', start: -1, end: 2 },
      ],
    });
    expect(parsed.words).toEqual([{ text: 'action', start: 2, end: 3 }]);
    expect(parsed.segments).toEqual([{ id: 's1', start: 0, end: 5, text: 'action' }]);
  });
});

describe('parseRenderInput', () => {
  it('accepts controlled sponsor asset keys', () => {
    expect(
      parseRenderInput({
        projectId: 'project-1',
        mode: 'timeline',
        ratio: '9:16',
        sponsor: {
          sponsorName: 'ACME',
          logoKey: 'sponsor-logos/user-1/logo.png',
          placement: 'bottom-left',
          opacity: 0.8,
          safeAreaPercent: 10,
        },
      })
    ).toMatchObject({
      projectId: 'project-1',
      mode: 'timeline',
      sponsor: { logoKey: 'sponsor-logos/user-1/logo.png', placement: 'bottom-left' },
    });
  });

  it.each([
    [{ projectId: '', mode: 'timeline' }, 'projectId'],
    [{ projectId: 'p', mode: 'other' }, 'mode'],
    [{ projectId: 'p', mode: 'clip' }, 'clipId'],
    [{ projectId: 'p', mode: 'timeline', ratio: '4:3' }, 'ratio'],
    [{ projectId: 'p', mode: 'timeline', music: { url: 'file:///tmp/a', volume: 1 } }, 'music'],
    [
      {
        projectId: 'p',
        mode: 'timeline',
        music: { url: 'https://169.254.169.254/a.mp3', volume: 0.2 },
      },
      'music',
    ],
    [
      { projectId: 'p', mode: 'timeline', music: { url: 'https://localhost/a.mp3', volume: 0.2 } },
      'music',
    ],
    [{ projectId: 'p', mode: 'timeline', music: { url: 'https://x', volume: 2 } }, 'volume'],
    [
      { projectId: 'p', mode: 'timeline', sponsor: { sponsorName: 'x', logoUrl: '/etc/passwd' } },
      'logoUrl',
    ],
    [
      { projectId: 'p', mode: 'timeline', sponsor: { sponsorName: 'x', logoKey: '../bad' } },
      'logoKey',
    ],
    [
      { projectId: 'p', mode: 'timeline', sponsor: { sponsorName: 'x', placement: 4 } },
      'placement',
    ],
    [
      { projectId: 'p', mode: 'timeline', sponsor: { sponsorName: 'x', opacity: Number.NaN } },
      'opacity',
    ],
    [{ projectId: 'p', mode: 'timeline', zoomKeyframes: [{ t: -1, scale: 1 }] }, 'zoomKeyframes'],
  ])('rejects malformed render input', (input, field) => {
    expect(() => parseRenderInput(input)).toThrow(new RegExp(field));
  });

  it('distinguishes invalid JSON/input from internal errors', () => {
    expect(new ValidationError('bad').status).toBe(400);
  });
});
