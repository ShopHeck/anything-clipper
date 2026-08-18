import type { TimedWord } from '@/lib/clip/boundaries';
import type { FightAnalysisContext, SponsorPackage } from '@/lib/clip/fight';
import { isSponsorLogoKey } from '@/lib/clip/fight';
import type { RenderRequestOptions } from '@/lib/render/spec';

export class ValidationError extends Error {
  readonly status = 400;
}

interface InputSegment {
  id: string;
  start: number;
  end: number;
  text?: string;
  viralScore?: number;
}

export interface GenerateClipsInput {
  transcript: string;
  count: number;
  segments: InputSegment[];
  words: TimedWord[];
  context: FightAnalysisContext;
}

export interface RenderInput extends RenderRequestOptions {
  projectId: string;
}

const MODES = ['generic', 'fight', 'sponsor'] as const;
const PLACEMENTS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
const RATIOS = ['9:16', '1:1', '16:9'] as const;
const POSITIONS = ['bottom', 'center', 'top'] as const;

export function parseGenerateClipsInput(value: unknown): GenerateClipsInput {
  const body = object(value, 'request body');
  return {
    transcript: optionalString(body.transcript, 'transcript', 20_000) ?? '',
    count: body.count === undefined ? 5 : integer(body.count, 'count', 1, 50),
    segments:
      body.segments === undefined
        ? []
        : array(body.segments, 'segments').flatMap((value, index) => {
            const segment = tryParseSegment(value, index);
            return segment ? [segment] : [];
          }),
    words:
      body.words === undefined
        ? []
        : array(body.words, 'words').flatMap((value, index) => {
            const word = tryParseWord(value, index);
            return word ? [word] : [];
          }),
    context: body.context === undefined ? {} : parseFightContext(body.context),
  };
}

export function parseRenderInput(value: unknown): RenderInput {
  const body = object(value, 'request body');
  const projectId = requiredString(body.projectId, 'projectId', 200);
  const mode = oneOf(body.mode, 'mode', ['clip', 'timeline'] as const);
  const clipId = optionalString(body.clipId, 'clipId', 200);
  if (mode === 'clip' && !clipId) throw new ValidationError('clipId is required for clip renders');

  return {
    projectId,
    mode,
    clipId,
    ratio: body.ratio === undefined ? undefined : oneOf(body.ratio, 'ratio', RATIOS),
    captionTemplateId: nullableString(body.captionTemplateId, 'captionTemplateId', 100),
    captionPosition:
      body.captionPosition === undefined
        ? undefined
        : oneOf(body.captionPosition, 'captionPosition', POSITIONS),
    captionLanguage: nullableString(body.captionLanguage, 'captionLanguage', 80),
    music: body.music == null ? null : parseMusic(body.music),
    zoomKeyframes: parseZoomKeyframes(body.zoomKeyframes),
    cropKeyframes: parseCropKeyframes(body.cropKeyframes),
    sponsor: body.sponsor == null ? null : parseSponsor(body.sponsor),
  };
}

export function validationResponse(error: unknown): Response | null {
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return null;
}

function parseFightContext(value: unknown): FightAnalysisContext {
  const input = object(value, 'context');
  const fighterNames =
    input.fighterNames === undefined
      ? undefined
      : array(input.fighterNames, 'context.fighterNames').map((name, index) =>
          requiredString(name, `context.fighterNames[${index}]`, 120)
        );
  if (fighterNames && fighterNames.length > 4) {
    throw new ValidationError('context.fighterNames cannot contain more than 4 names');
  }
  const roundMarkers =
    input.roundMarkers === undefined
      ? undefined
      : array(input.roundMarkers, 'context.roundMarkers').map((marker, index) => {
          const row = object(marker, `context.roundMarkers[${index}]`);
          const start = finiteNumber(
            row.start,
            `context.roundMarkers[${index}].start`,
            0,
            24 * 3600
          );
          const end = finiteNumber(row.end, `context.roundMarkers[${index}].end`, 0, 24 * 3600);
          if (end <= start)
            throw new ValidationError('context.roundMarkers end must be greater than start');
          return {
            round: integer(row.round, `context.roundMarkers[${index}].round`, 1, 100),
            start,
            end,
          };
        });
  if (roundMarkers && roundMarkers.length > 100) {
    throw new ValidationError('context.roundMarkers cannot contain more than 100 entries');
  }
  return {
    mode: input.mode === undefined ? undefined : oneOf(input.mode, 'context.mode', MODES),
    fighterNames,
    eventName: optionalString(input.eventName, 'context.eventName', 200),
    sourceDurationSec:
      input.sourceDurationSec === undefined
        ? undefined
        : finiteNumber(input.sourceDurationSec, 'context.sourceDurationSec', 0.01, 24 * 3600),
    roundMarkers,
    sponsor: input.sponsor === undefined ? undefined : parseSponsor(input.sponsor),
  };
}

function parseSponsor(value: unknown): SponsorPackage {
  const input = object(value, 'sponsor');
  if (input.logoUrl !== undefined) {
    throw new ValidationError('sponsor.logoUrl is not accepted; upload a logo and use logoKey');
  }
  const logoKey = optionalString(input.logoKey, 'sponsor.logoKey', 400);
  if (logoKey && !isSponsorLogoKey(logoKey)) {
    throw new ValidationError('sponsor.logoKey must be a controlled sponsor-logos asset key');
  }
  return {
    sponsorName: requiredString(input.sponsorName, 'sponsor.sponsorName', 160),
    logoKey,
    placement:
      input.placement === undefined
        ? undefined
        : oneOf(input.placement, 'sponsor.placement', PLACEMENTS),
    opacity:
      input.opacity === undefined
        ? undefined
        : finiteNumber(input.opacity, 'sponsor.opacity', 0.25, 1),
    safeAreaPercent:
      input.safeAreaPercent === undefined
        ? undefined
        : finiteNumber(input.safeAreaPercent, 'sponsor.safeAreaPercent', 5, 15),
    accentColor: parseAccent(input.accentColor),
    callToAction: optionalString(input.callToAction, 'sponsor.callToAction', 180),
  };
}

function parseAccent(value: unknown): string | undefined {
  const accentColor = optionalString(value, 'sponsor.accentColor', 7);
  if (accentColor && !/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
    throw new ValidationError('sponsor.accentColor must be a six-digit hex color');
  }
  return accentColor;
}

function parseMusic(value: unknown): { url: string; volume: number } {
  const input = object(value, 'music');
  const url = requiredString(input.url, 'music.url', 2_000);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError('music.url must be a valid HTTPS URL');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new ValidationError('music.url must be a credential-free HTTPS URL');
  }
  if (isPrivateHostname(parsed.hostname)) {
    throw new ValidationError('music.url must use a public HTTPS host');
  }
  return { url, volume: finiteNumber(input.volume, 'music.volume', 0, 1) };
}

function tryParseSegment(value: unknown, index: number): InputSegment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.start !== 'number' || typeof input.end !== 'number') return null;
  if (!Number.isFinite(input.start) || !Number.isFinite(input.end) || input.end <= input.start) {
    return null;
  }
  if (input.start < 0 || input.end > 24 * 3600) return null;
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (!id) return null;
  const text = typeof input.text === 'string' ? input.text.trim() : undefined;
  return {
    id: id.slice(0, 200),
    start: input.start,
    end: input.end,
    text: text ? text.slice(0, 20_000) : undefined,
    viralScore:
      typeof input.viralScore === 'number' && Number.isFinite(input.viralScore)
        ? Math.min(100, Math.max(0, input.viralScore))
        : undefined,
  };
}

function tryParseWord(value: unknown, index: number): TimedWord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.text !== 'string' || !input.text.trim()) return null;
  if (typeof input.start !== 'number' || typeof input.end !== 'number') return null;
  if (!Number.isFinite(input.start) || !Number.isFinite(input.end) || input.end <= input.start) {
    return null;
  }
  if (input.start < 0 || input.end > 24 * 3600) return null;
  return { text: input.text.trim().slice(0, 500), start: input.start, end: input.end };
}

function parseZoomKeyframes(value: unknown): Array<{ t: number; scale: number }> | undefined {
  if (value === undefined) return undefined;
  return keyedFrames(value, 'zoomKeyframes', 'scale', 0.25, 4).map((row) => ({
    t: row.t,
    scale: row.value,
  }));
}

function parseCropKeyframes(value: unknown): Array<{ t: number; x: number }> | undefined {
  if (value === undefined) return undefined;
  return keyedFrames(value, 'cropKeyframes', 'x', 0, 1).map((row) => ({ t: row.t, x: row.value }));
}

function keyedFrames(
  value: unknown,
  field: string,
  property: string,
  min: number,
  max: number
): Array<{ t: number; value: number }> {
  const rows = array(value, field);
  if (rows.length > 500) throw new ValidationError(`${field} cannot contain more than 500 entries`);
  return rows.map((entry, index) => {
    const input = object(entry, `${field}[${index}]`);
    return {
      t: finiteNumber(input.t, `${field}[${index}].t`, 0, 24 * 3600),
      value: finiteNumber(input[property], `${field}[${index}].${property}`, min, max),
    };
  });
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
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

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array`);
  if (value.length > 50_000) throw new ValidationError(`${field} is too large`);
  return value;
}

function requiredString(value: unknown, field: string, max: number): string {
  const result = optionalString(value, field, max);
  if (!result) throw new ValidationError(`${field} is required`);
  return result;
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`);
  const result = value.trim();
  if (result.length > max) throw new ValidationError(`${field} is too long`);
  return result || undefined;
}

function nullableString(value: unknown, field: string, max: number): string | null | undefined {
  if (value === null) return null;
  return optionalString(value, field, max);
}

function oneOf<T extends readonly string[]>(value: unknown, field: string, choices: T): T[number] {
  if (typeof value !== 'string' || !choices.includes(value)) {
    throw new ValidationError(`${field} must be one of: ${choices.join(', ')}`);
  }
  return value as T[number];
}

function finiteNumber(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ValidationError(`${field} must be a finite number between ${min} and ${max}`);
  }
  return value;
}

function integer(value: unknown, field: string, min: number, max: number): number {
  const number = finiteNumber(value, field, min, max);
  if (!Number.isInteger(number)) throw new ValidationError(`${field} must be an integer`);
  return number;
}
