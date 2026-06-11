// Caption templates shared by the editor preview (CSS) and the server
// renderer (ASS subtitles burned by ffmpeg). Template ids match the
// editor's CAPTION_STYLES ids.

export interface CaptionTemplate {
  id: string;
  label: string;
  fontName: string;
  // Font size as a fraction of the output height.
  fontScale: number;
  bold: boolean;
  uppercase: boolean;
  // Colors in #RRGGBB. `highlightColor` is the karaoke fill (the color a
  // word turns when it is spoken); `baseColor` is the unspoken text.
  baseColor: string;
  highlightColor: string;
  outlineColor: string;
  // Outline thickness as a fraction of font size (0 disables).
  outlineScale: number;
  // Opaque box behind the text (MrBeast / TikTok-native look).
  boxColor: string | null;
  shadow: boolean;
}

export const CAPTION_TEMPLATES: CaptionTemplate[] = [
  {
    id: 'mrBeast',
    label: 'MrBeast',
    fontName: 'Arial Black',
    fontScale: 0.052,
    bold: true,
    uppercase: true,
    baseColor: '#000000',
    highlightColor: '#000000',
    outlineColor: '#facc15',
    outlineScale: 0,
    boxColor: '#facc15',
    shadow: false,
  },
  {
    id: 'hormozi',
    label: 'Hormozi',
    fontName: 'Arial Black',
    fontScale: 0.05,
    bold: true,
    uppercase: true,
    baseColor: '#ffffff',
    highlightColor: '#4ade80',
    outlineColor: '#000000',
    outlineScale: 0.1,
    boxColor: null,
    shadow: true,
  },
  {
    id: 'tiktok',
    label: 'TikTok Native',
    fontName: 'Arial',
    fontScale: 0.042,
    bold: true,
    uppercase: false,
    baseColor: '#ffffff',
    highlightColor: '#ffffff',
    outlineColor: '#000000',
    outlineScale: 0,
    boxColor: '#000000',
    shadow: false,
  },
  {
    id: 'gradient',
    label: 'Gradient Fire',
    fontName: 'Arial Black',
    fontScale: 0.05,
    bold: true,
    uppercase: true,
    baseColor: '#fb923c',
    highlightColor: '#f43f5e',
    outlineColor: '#000000',
    outlineScale: 0.08,
    boxColor: null,
    shadow: true,
  },
  {
    id: 'neon',
    label: 'Neon Glow',
    fontName: 'Arial Black',
    fontScale: 0.05,
    bold: true,
    uppercase: false,
    baseColor: '#c4b5fd',
    highlightColor: '#f0abfc',
    outlineColor: '#4c1d95',
    outlineScale: 0.12,
    boxColor: null,
    shadow: true,
  },
];

export function getCaptionTemplate(id: string | null | undefined): CaptionTemplate {
  return CAPTION_TEMPLATES.find((t) => t.id === id) ?? CAPTION_TEMPLATES[0];
}
