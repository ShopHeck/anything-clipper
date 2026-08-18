import type { CandidateClip } from './analyze';

export type ClipContentMode = 'generic' | 'fight' | 'sponsor';
export type FightMomentType =
  | 'knockdown'
  | 'finish'
  | 'exchange'
  | 'entrance'
  | 'corner'
  | 'interview'
  | 'crowd'
  | 'story';

export interface FightRoundMarker {
  round: number;
  start: number;
  end: number;
}

export interface SponsorPackage {
  sponsorName: string;
  logoUrl?: string;
  placement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity?: number;
  safeAreaPercent?: number;
  accentColor?: string;
  callToAction?: string;
}

export interface FightAnalysisContext {
  mode?: ClipContentMode;
  fighterNames?: string[];
  eventName?: string;
  roundMarkers?: FightRoundMarker[];
  sponsor?: SponsorPackage;
  sourceDurationSec?: number;
}

export interface FightClipCandidate extends CandidateClip {
  momentType?: FightMomentType;
  round?: number;
  fighterNames?: string[];
  sponsorFriendly?: boolean;
  contentMode?: ClipContentMode;
}

export function buildFightAnalysisBrief(context: FightAnalysisContext = {}): string {
  if (!context.mode || context.mode === 'generic') {
    return 'You are a viral short-form editor. Find coherent 20–90s moments with strong hooks, curiosity gaps, emotional peaks, and quotable lines.';
  }

  const fighters = (context.fighterNames ?? []).map((name) => name.trim()).filter(Boolean);
  const matchup = fighters.length >= 2 ? `${fighters[0]} vs ${fighters[1]}` : fighters[0];
  const rounds = (context.roundMarkers ?? [])
    .filter(isValidRound)
    .map((marker) => `Round ${marker.round}: ${marker.start.toFixed(1)}s–${marker.end.toFixed(1)}s`)
    .join('; ');
  const identity = [context.eventName?.trim(), matchup].filter(Boolean).join(' — ');
  const sponsor = context.sponsor?.sponsorName?.trim();

  return [
    'You are a combat-sports highlight editor creating fight footage and sponsor-ready social clips.',
    identity ? `Footage context: ${identity}.` : '',
    rounds ? `Known round windows: ${rounds}. Never label a different round.` : '',
    'Prioritize decisive action (knockdowns, finishes, momentum swings), clean exchanges, entrances, crowd reactions, corner instruction, and authentic post-fight quotes.',
    'Every action clip must preserve a complete setup → exchange → reaction story arc. Include a short visual handle before first contact and after the reaction when the source allows it.',
    'Do not cut during a strike, combination, referee intervention, knockdown count, corner sentence, or sponsor mention.',
    'Do not invent fighter names, rounds, outcomes, strikes, quotes, or sponsor claims. When evidence is ambiguous, use neutral wording.',
    'Return momentType, round when supported, fighterNames when supported, and sponsorFriendly. Favor clean frames for a logo without covering faces, score graphics, captions, or decisive action.',
    sponsor
      ? `Sponsor package: ${sponsor}. Branding must remain clearly secondary to the fight.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function planFightClip(
  candidate: FightClipCandidate,
  context: FightAnalysisContext = {}
): FightClipCandidate {
  const sourceEnd = finiteOr(context.sourceDurationSec, Number.POSITIVE_INFINITY);
  const rawStart = clamp(finiteOr(candidate.start, 0), 0, sourceEnd);
  const rawEnd = clamp(finiteOr(candidate.end, rawStart), rawStart, sourceEnd);
  const isAction = ['knockdown', 'finish', 'exchange'].includes(candidate.momentType ?? '');
  const before = isAction ? 1.5 : 0;
  const after = isAction ? 2 : 0;
  const matchingRound = (context.roundMarkers ?? [])
    .filter(isValidRound)
    .find((marker) => overlaps(rawStart, rawEnd, marker.start, marker.end));
  const lowerBound = matchingRound ? matchingRound.start : 0;
  const upperBound = matchingRound ? Math.min(matchingRound.end, sourceEnd) : sourceEnd;

  return {
    ...candidate,
    start: clamp(rawStart - before, lowerBound, upperBound),
    end: clamp(rawEnd + after, lowerBound, upperBound),
    round: candidate.round ?? matchingRound?.round,
    fighterNames: candidate.fighterNames?.length
      ? candidate.fighterNames
      : context.fighterNames?.filter(Boolean),
    contentMode: context.mode && context.mode !== 'generic' ? context.mode : 'fight',
  };
}

export function sanitizeSponsorPackage(input: SponsorPackage): Required<SponsorPackage> {
  const errors: string[] = [];
  const sponsorName = input.sponsorName?.trim();
  if (!sponsorName) errors.push('sponsorName is required');
  const logoUrl = input.logoUrl?.trim() ?? '';
  if (logoUrl && !isSafeAssetUrl(logoUrl)) {
    errors.push('logoUrl must use a local / path or a public https host');
  }
  const color = (input.accentColor ?? '#FFFFFF').trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(color)) errors.push('accentColor must be a six-digit hex color');
  if (errors.length) throw new Error(errors.join('; '));

  return {
    sponsorName,
    logoUrl,
    placement: input.placement ?? 'top-right',
    opacity: clamp(finiteOr(input.opacity, 0.9), 0.25, 1),
    safeAreaPercent: clamp(finiteOr(input.safeAreaPercent, 8), 5, 15),
    accentColor: color,
    callToAction: input.callToAction?.trim() ?? '',
  };
}

function isSafeAssetUrl(url: string): boolean {
  if (url.startsWith('/')) return !url.startsWith('//') && !url.includes('..');
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !isPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  ) {
    return true;
  }
  const octets = host.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    octets[0] === 0 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isValidRound(marker: FightRoundMarker): boolean {
  return (
    Number.isInteger(marker.round) &&
    marker.round > 0 &&
    marker.start >= 0 &&
    marker.end > marker.start
  );
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.min(aEnd, bEnd) > Math.max(aStart, bStart);
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
