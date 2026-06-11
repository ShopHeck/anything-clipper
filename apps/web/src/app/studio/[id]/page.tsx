'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Play,
  Pause,
  Sparkles,
  Download,
  Copy,
  Check,
  Star,
  ShoppingBag,
  RefreshCw,
  Video,
  Scissors,
  ChevronRight,
  RotateCcw,
  Layers,
  Film,
  Wand2,
  Package,
  FileText,
  ExternalLink,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { videoStore, type TranscriptSegment } from '@/utils/videoStore';

// ── Types ─────────────────────────────────────────────────────────
interface ProductData {
  name: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  rating: string;
  soldCount: string;
  shopName: string;
  category: string;
  features: string[];
}

interface UGCScript {
  hook: string;
  problem: string;
  solution: string;
  demo: string;
  socialProof: string;
  cta: string;
  overlayText: string;
  hashtags: string[];
}

interface Template {
  id: string;
  name: string;
  category: 'hook' | 'caption' | 'product' | 'effect';
  emoji: string;
  description: string;
  bg: string;
}

// ── Viral template definitions ─────────────────────────────────────
const TEMPLATES: Template[] = [
  {
    id: 'bold-hook',
    name: 'Bold Hook',
    category: 'hook',
    emoji: '💥',
    description: 'Impact text, scroll-stopper energy',
    bg: 'from-violet-700 to-purple-900',
  },
  {
    id: 'pov',
    name: 'POV Style',
    category: 'hook',
    emoji: '👀',
    description: '"POV:" prefix, ultra-relatable',
    bg: 'from-pink-700 to-rose-900',
  },
  {
    id: 'hormozi',
    name: 'Hormozi Captions',
    category: 'caption',
    emoji: '🔥',
    description: 'Word-by-word yellow highlight',
    bg: 'from-amber-600 to-orange-900',
  },
  {
    id: 'product',
    name: 'Product Tag',
    category: 'product',
    emoji: '🛒',
    description: 'Price + rating + shop badge',
    bg: 'from-emerald-700 to-teal-900',
  },
  {
    id: 'storytime',
    name: 'Storytime',
    category: 'hook',
    emoji: '🧵',
    description: 'STORYTIME header + narrative hook',
    bg: 'from-blue-700 to-cyan-900',
  },
  {
    id: 'countdown',
    name: 'Fire Countdown',
    category: 'effect',
    emoji: '🔢',
    description: '3-2-1 intro, then hook text',
    bg: 'from-red-700 to-orange-900',
  },
  {
    id: 'lower-third',
    name: 'Lower Third',
    category: 'caption',
    emoji: '📌',
    description: 'News-style name card bar',
    bg: 'from-slate-700 to-slate-900',
  },
  {
    id: 'trend-text',
    name: 'Trend Text',
    category: 'hook',
    emoji: '✨',
    description: 'Gradient viral text overlay',
    bg: 'from-fuchsia-700 to-pink-900',
  },
  {
    id: 'fact-box',
    name: 'Fact Box',
    category: 'effect',
    emoji: '🟩',
    description: 'Side-panel stat/claim box',
    bg: 'from-green-700 to-emerald-900',
  },
  {
    id: 'none',
    name: 'No Overlay',
    category: 'effect',
    emoji: '🎬',
    description: 'Clean video, no text',
    bg: 'from-gray-700 to-gray-900',
  },
];

const TRANSITIONS = [
  { id: 'cut', label: 'Cut', icon: '⚡', desc: 'Instant' },
  { id: 'fade', label: 'Fade', icon: '🌫️', desc: 'Smooth' },
  { id: 'zoom', label: 'Zoom In', icon: '🔍', desc: 'Punch' },
  { id: 'slide', label: 'Slide Up', icon: '⬆️', desc: 'Fluid' },
  { id: 'glitch', label: 'Glitch', icon: '📺', desc: 'Trendy' },
];

const COLOR_GRADES: Record<string, string> = {
  none: 'none',
  cinematic: 'contrast(1.1) saturate(0.85) sepia(0.15)',
  vibrant: 'saturate(1.4) contrast(1.05)',
  warm: 'sepia(0.3) saturate(1.2) brightness(1.05)',
  cool: 'saturate(0.9) hue-rotate(15deg) brightness(0.97)',
  dark: 'brightness(0.85) contrast(1.2) saturate(1.1)',
  vintage: 'sepia(0.4) contrast(1.1) saturate(0.8)',
};

// ── Canvas text helpers ────────────────────────────────────────────
function getTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Template draw functions ────────────────────────────────────────
function drawBoldHook(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  text: string,
  elapsed: number
) {
  ctx.font = `900 ${W * 0.165}px Impact, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = getTextLines(ctx, text.toUpperCase(), W * 0.88);
  const lh = W * 0.19;
  const totalH = lines.length * lh;
  const startY = H * 0.62 - totalH / 2;
  const pulse = 1 + 0.015 * Math.sin(elapsed * 2.5);
  ctx.save();
  ctx.translate(W / 2, startY + totalH / 2);
  ctx.scale(pulse, pulse);
  ctx.translate(-W / 2, -(startY + totalH / 2));
  lines.forEach((l, i) => {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';
    ctx.strokeText(l, W / 2, startY + i * lh);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(l, W / 2, startY + i * lh);
  });
  ctx.restore();
}

function drawPOV(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  text: string,
  _elapsed: number
) {
  const padX = W * 0.06;
  const labelH = H * 0.08;
  // Background strip
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(
    0,
    H * 0.06,
    W,
    labelH * 1.8 + (getTextLines(ctx, text, W - padX * 2).length > 1 ? H * 0.07 : 0)
  );
  // "POV:" label
  ctx.font = `900 ${W * 0.12}px 'Arial Black', Impact, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFE500';
  ctx.fillText('POV:', padX, H * 0.1 + labelH * 0.5);
  // Hook text
  ctx.font = `bold ${W * 0.075}px 'Arial', sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  const lines = getTextLines(ctx, text, W - padX * 2);
  lines.forEach((l, i) => ctx.fillText(l, padX, H * 0.1 + labelH * 1.4 + i * W * 0.085));
}

function drawHormozi(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  segments: TranscriptSegment[],
  videoTime: number
) {
  const seg = segments.find((s) => videoTime >= s.start && videoTime <= s.end);
  if (!seg) return;
  const words = seg.text.trim().split(/\s+/);
  if (!words.length) return;
  const elapsed = videoTime - seg.start;
  const segDur = seg.end - seg.start;
  const wordIdx = Math.floor((elapsed / segDur) * words.length);
  const fs = W * 0.1;
  ctx.font = `900 ${fs}px 'Arial Black', Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Shadow backdrop
  const lineH = fs * 1.25;
  const lines = getTextLines(ctx, words.join(' '), W * 0.88);
  const totalH = lines.length * lineH;
  const startY = H - totalH - H * 0.07;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, startY - lineH * 0.4, W, totalH + lineH * 0.5);
  // Draw words, highlight current
  let wordCount = 0;
  lines.forEach((line, li) => {
    const lineWords = line.split(' ');
    const lineY = startY + li * lineH;
    const lineWidth = ctx.measureText(line).width;
    let wordX = W / 2 - lineWidth / 2;
    lineWords.forEach((w) => {
      const wWidth = ctx.measureText(w + ' ').width;
      const isCurrent = wordCount === wordIdx;
      if (isCurrent) {
        // Yellow highlight background
        ctx.fillStyle = '#FFE500';
        drawRoundRect(ctx, wordX - 3, lineY - fs * 0.6, wWidth + 2, fs * 1.1, 4);
        ctx.fill();
        ctx.fillStyle = '#000000';
      } else {
        ctx.fillStyle = '#FFFFFF';
      }
      ctx.textAlign = 'left';
      ctx.fillText(w, wordX, lineY);
      wordX += wWidth;
      wordCount++;
    });
  });
  ctx.textAlign = 'center';
}

function drawProductOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  product: ProductData,
  _elapsed: number
) {
  const cardX = W * 0.04;
  const cardY = H * 0.62;
  const cardW = W * 0.92;
  const cardH = H * 0.32;
  // Card bg
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  drawRoundRect(ctx, cardX, cardY, cardW, cardH, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Product icon block
  const iconSize = cardH * 0.55;
  const iconX = cardX + 10;
  const iconY = cardY + (cardH - iconSize) / 2;
  ctx.fillStyle = '#1d1f2e';
  drawRoundRect(ctx, iconX, iconY, iconSize, iconSize, 10);
  ctx.fill();
  ctx.font = `${iconSize * 0.5}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🛍️', iconX + iconSize / 2, iconY + iconSize / 2);
  // Name
  const txtX = iconX + iconSize + 10;
  const txtMaxW = cardW - iconSize - 28;
  ctx.font = `bold ${W * 0.058}px Arial, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const nameLines = getTextLines(ctx, product.name, txtMaxW);
  nameLines.slice(0, 2).forEach((l, i) => ctx.fillText(l, txtX, cardY + 12 + i * W * 0.065));
  // Price
  const priceY = cardY + cardH * 0.46;
  ctx.font = `900 ${W * 0.1}px 'Arial Black', Impact, sans-serif`;
  ctx.fillStyle = '#4ADE80';
  ctx.fillText(product.price, txtX, priceY);
  if (product.originalPrice) {
    ctx.font = `${W * 0.055}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    const priceW = ctx.measureText(product.price).width;
    ctx.fillText(product.originalPrice, txtX + priceW + 6, priceY + W * 0.02);
    // Strikethrough
    const opW = ctx.measureText(product.originalPrice).width;
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(txtX + priceW + 6, priceY + W * 0.052);
    ctx.lineTo(txtX + priceW + 6 + opW, priceY + W * 0.052);
    ctx.stroke();
  }
  // Stars
  const starY = cardY + cardH * 0.73;
  ctx.font = `${W * 0.055}px serif`;
  const rating = parseFloat(product.rating) || 4.5;
  let starStr = '';
  for (let i = 0; i < 5; i++) starStr += i < Math.round(rating) ? '⭐' : '☆';
  ctx.fillText(`${starStr} ${product.rating} • ${product.soldCount} sold`, txtX, starY);
  // Shop Now badge
  const badgeY = cardY + cardH - 30;
  ctx.fillStyle = '#22c55e';
  drawRoundRect(ctx, cardX + 10, badgeY, cardW - 20, 24, 8);
  ctx.fill();
  ctx.font = `bold ${W * 0.06}px Arial, sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🛒  Shop on TikTok →', W / 2, badgeY + 12);
}

function drawStorytime(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  text: string,
  elapsed: number
) {
  const headerY = H * 0.08;
  ctx.font = `900 ${W * 0.12}px Impact, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, headerY - H * 0.055, W, H * 0.13);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('STORYTIME 🧵', W / 2, headerY);
  // Underline
  const tW = ctx.measureText('STORYTIME 🧵').width;
  ctx.strokeStyle = '#FFE500';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - tW / 2, headerY + H * 0.04);
  ctx.lineTo(W / 2 + tW / 2, headerY + H * 0.04);
  ctx.stroke();
  // Hook text fades in after 1s
  if (elapsed > 0.8) {
    const alpha = Math.min(1, (elapsed - 0.8) * 1.5);
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${W * 0.078}px Arial, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = getTextLines(ctx, text, W * 0.88);
    const lh = W * 0.088;
    const startY = H * 0.28;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, startY - lh, W, lines.length * lh + lh);
    ctx.fillStyle = '#FFFFFF';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lh));
    ctx.globalAlpha = 1;
  }
}

function drawCountdown(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  text: string,
  elapsed: number
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (elapsed < 1) {
    ctx.font = `900 ${W * 0.45}px Impact, 'Arial Black', sans-serif`;
    const scale = 1.3 - elapsed * 0.3;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#FF4500';
    ctx.lineWidth = 18;
    ctx.lineJoin = 'round';
    ctx.strokeText('3', 0, 0);
    ctx.fillStyle = '#FF6B35';
    ctx.fillText('3', 0, 0);
    ctx.restore();
  } else if (elapsed < 2) {
    const scale = 1.3 - (elapsed - 1) * 0.3;
    ctx.font = `900 ${W * 0.45}px Impact, 'Arial Black', sans-serif`;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#FF4500';
    ctx.lineWidth = 18;
    ctx.lineJoin = 'round';
    ctx.strokeText('2', 0, 0);
    ctx.fillStyle = '#FFA500';
    ctx.fillText('2', 0, 0);
    ctx.restore();
  } else if (elapsed < 3) {
    const scale = 1.3 - (elapsed - 2) * 0.3;
    ctx.font = `900 ${W * 0.45}px Impact, 'Arial Black', sans-serif`;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#FF4500';
    ctx.lineWidth = 18;
    ctx.lineJoin = 'round';
    ctx.strokeText('1', 0, 0);
    ctx.fillStyle = '#FFE500';
    ctx.fillText('1', 0, 0);
    ctx.restore();
  } else {
    drawBoldHook(ctx, W, H, text, elapsed - 3);
  }
}

function drawLowerThird(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  text: string,
  _elapsed: number
) {
  const stripH = H * 0.18;
  const stripY = H - stripH - H * 0.04;
  // Gradient bar
  const grad = ctx.createLinearGradient(0, stripY, 0, stripY + stripH);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.3, 'rgba(0,0,0,0.85)');
  grad.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, stripY, W, stripH);
  // Accent line
  ctx.fillStyle = '#7C3AED';
  ctx.fillRect(W * 0.05, stripY + stripH * 0.28, W * 0.005, stripH * 0.55);
  // Name text
  ctx.font = `bold ${W * 0.08}px Arial, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.split(' ').slice(0, 4).join(' '), W * 0.075, stripY + stripH * 0.42);
  // Subtitle
  ctx.font = `${W * 0.055}px Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('Creator • TikTok Shop Affiliate', W * 0.075, stripY + stripH * 0.68);
}

function drawTrendText(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  text: string,
  elapsed: number
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fs = W * 0.13;
  ctx.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`;
  const lines = getTextLines(ctx, text.toUpperCase(), W * 0.88);
  const lh = fs * 1.2;
  const totalH = lines.length * lh;
  const startY = H * 0.5 - totalH / 2;
  const shimmer = (Math.sin(elapsed * 2) + 1) / 2;
  lines.forEach((l, i) => {
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, `hsl(${280 + shimmer * 30}, 100%, 70%)`);
    grad.addColorStop(0.5, `hsl(${320 + shimmer * 20}, 100%, 75%)`);
    grad.addColorStop(1, `hsl(${360 + shimmer * 10}, 100%, 70%)`);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.strokeText(l, W / 2, startY + i * lh);
    ctx.fillStyle = grad;
    ctx.fillText(l, W / 2, startY + i * lh);
  });
}

function drawFactBox(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  text: string,
  _elapsed: number
) {
  const boxW = W * 0.48;
  const boxX = W - boxW - W * 0.03;
  const boxY = H * 0.22;
  const boxH = H * 0.42;
  ctx.fillStyle = 'rgba(16,185,129,0.92)';
  drawRoundRect(ctx, boxX, boxY, boxW, boxH, 14);
  ctx.fill();
  ctx.font = `900 ${W * 0.065}px 'Arial Black', sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('DID YOU', boxX + boxW / 2, boxY + 14);
  ctx.fillText('KNOW? 🤯', boxX + boxW / 2, boxY + 14 + W * 0.075);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(boxX + 12, boxY + 14 + W * 0.16);
  ctx.lineTo(boxX + boxW - 12, boxY + 14 + W * 0.16);
  ctx.stroke();
  ctx.font = `bold ${W * 0.055}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  const factLines = getTextLines(ctx, text, boxW - 20);
  factLines.slice(0, 5).forEach((l, i) => {
    ctx.fillText(l, boxX + boxW / 2, boxY + 14 + W * 0.19 + i * W * 0.065);
  });
}

// ── Main canvas render dispatcher ─────────────────────────────────
function renderCanvas(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  templateId: string,
  videoTime: number,
  clipStart: number,
  hookText: string,
  segments: TranscriptSegment[],
  product: ProductData | null
) {
  ctx.clearRect(0, 0, W, H);
  const elapsed = Math.max(0, videoTime - clipStart);
  switch (templateId) {
    case 'bold-hook':
      drawBoldHook(ctx, W, H, hookText, elapsed);
      break;
    case 'pov':
      drawPOV(ctx, W, H, hookText, elapsed);
      break;
    case 'hormozi':
      drawHormozi(ctx, W, H, segments, videoTime);
      break;
    case 'product':
      if (product) drawProductOverlay(ctx, W, H, product, elapsed);
      break;
    case 'storytime':
      drawStorytime(ctx, W, H, hookText, elapsed);
      break;
    case 'countdown':
      drawCountdown(ctx, W, H, hookText, elapsed);
      break;
    case 'lower-third':
      drawLowerThird(ctx, W, H, hookText, elapsed);
      break;
    case 'trend-text':
      drawTrendText(ctx, W, H, hookText, elapsed);
      break;
    case 'fact-box':
      drawFactBox(ctx, W, H, hookText, elapsed);
      break;
    default:
      break;
  }
}

// ── Score colors ──────────────────────────────────────────────────
const scoreColor = (s: number) =>
  s >= 95
    ? 'text-emerald-400'
    : s >= 90
      ? 'text-violet-400'
      : s >= 80
        ? 'text-amber-400'
        : 'text-white/50';

// ── Copy button ───────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-white/40 hover:text-white/80"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

// ── Script section ────────────────────────────────────────────────
function ScriptSection({
  label,
  value,
  emoji,
  onApply,
}: {
  label: string;
  value: string;
  emoji: string;
  onApply?: () => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
          {emoji} {label}
        </span>
        <div className="flex items-center gap-1">
          {onApply && (
            <button
              onClick={onApply}
              className="text-[9px] font-semibold bg-violet-600/20 text-violet-300 hover:bg-violet-600/35 px-2 py-0.5 rounded-full transition-all"
            >
              Apply
            </button>
          )}
          <CopyBtn text={text} />
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="w-full bg-transparent text-[11px] text-white/75 leading-relaxed resize-none outline-none placeholder-white/20"
      />
    </div>
  );
}

// ── Main Studio Page ──────────────────────────────────────────────
export default function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const [_id, _setId] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [clipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(60);
  const [clipTitle, setClipTitle] = useState('Untitled Clip');
  const [clipScore, setClipScore] = useState(91);

  const [activeTemplate, setActiveTemplate] = useState('bold-hook');
  const [activeTransition, setActiveTransition] = useState('cut');
  const [colorGrade, setColorGrade] = useState('none');
  const [hookText, setHookText] = useState("You won't believe what happened next...");
  const [leftTab, setLeftTab] = useState<'templates' | 'transitions'>('templates');
  const [rightTab, setRightTab] = useState<'product' | 'script'>('product');

  const [isPlaying, setIsPlaying] = useState(false);
  const [videoTime, setVideoTime] = useState(0);

  const [productUrl, setProductUrl] = useState('');
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [productError, setProductError] = useState('');

  const [script, setScript] = useState<UGCScript | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  // Load data from store
  useEffect(() => {
    params.then((p) => _setId(p.id));
    setVideoUrl(videoStore.getObjectUrl());
    setSegments(videoStore.getTranscript());

    const clips = videoStore.getClips();
    if (clips.length > 0) {
      const c = clips[0];
      setClipTitle(c.title);
      setClipScore(c.score);
      setClipEnd(c.end);
      setHookText(c.hook || "You won't believe what happened next...");
    } else {
      const name = videoStore.getFileName();
      if (name) setClipTitle(name.replace(/\.[^/.]+$/, ''));
    }
  }, [params]);

  // Seek video to clip start
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoUrl) return;
    const doSeek = () => {
      vid.currentTime = clipStart;
    };
    if (vid.readyState >= 1) doSeek();
    else vid.addEventListener('loadedmetadata', doSeek, { once: true });
  }, [videoUrl, clipStart]);

  // Track video time + stop at clip end
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => {
      if (vid.currentTime >= clipEnd) {
        vid.pause();
        vid.currentTime = clipStart;
        setIsPlaying(false);
      }
      setVideoTime(vid.currentTime);
    };
    vid.addEventListener('timeupdate', onTime);
    return () => vid.removeEventListener('timeupdate', onTime);
  }, [clipStart, clipEnd]);

  // RAF canvas loop
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const vid = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = vid?.currentTime ?? videoTime;
    renderCanvas(ctx, 360, 640, activeTemplate, t, clipStart, hookText, segments, product);
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [activeTemplate, hookText, segments, product, clipStart, videoTime]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawFrame]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlaying) {
      vid.pause();
      setIsPlaying(false);
    } else {
      if (vid.currentTime >= clipEnd || vid.currentTime < clipStart) vid.currentTime = clipStart;
      vid.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const restart = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.pause();
    vid.currentTime = clipStart;
    setIsPlaying(false);
  };

  const progress =
    clipEnd > clipStart
      ? Math.max(0, Math.min(100, ((videoTime - clipStart) / (clipEnd - clipStart)) * 100))
      : 0;

  // Fetch product details
  const fetchProduct = useCallback(async () => {
    if (!productUrl.trim()) return;
    setLoadingProduct(true);
    setProductError('');
    try {
      const res = await fetch('/api/product-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setProduct(data.product);
      setActiveTemplate('product');
    } catch {
      setProductError('Could not fetch product. Check the URL and try again.');
    } finally {
      setLoadingProduct(false);
    }
  }, [productUrl]);

  // Generate UGC script
  const generateScript = useCallback(async () => {
    if (!product) return;
    setLoadingScript(true);
    try {
      const transcript = segments
        .map((s) => s.text)
        .join(' ')
        .slice(0, 600);
      const res = await fetch('/api/generate-ugc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, transcript, templateStyle: activeTemplate }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setScript(data.script);
      if (data.script.overlayText) setHookText(data.script.overlayText);
      setRightTab('script');
    } catch {
      setScript(null);
    } finally {
      setLoadingScript(false);
    }
  }, [product, segments, activeTemplate]);

  const clipDuration = `${Math.floor((clipEnd - clipStart) / 60)}:${String(Math.round((clipEnd - clipStart) % 60)).padStart(2, '0')}`;

  return (
    <div className="h-screen bg-[#07070f] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-white/6 px-5 py-3 flex items-center gap-4 z-10 bg-[#07070f]">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          <ChevronLeft size={15} />
          Back
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <Wand2 size={12} className="text-white" />
          </div>
          <span className="text-sm font-bold text-white truncate max-w-[200px]">{clipTitle}</span>
          <span
            className={`text-xs font-black ${scoreColor(clipScore)} bg-white/5 px-2 py-0.5 rounded-full`}
          >
            <Star size={9} className="inline fill-current mr-0.5" />
            {clipScore}
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Link
            href="/clips/1"
            className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/8 text-white/60 hover:text-white px-3 py-2 rounded-xl transition-all"
          >
            <Layers size={12} />
            All Clips
          </Link>
          <Link
            href="/editor/1"
            className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/8 text-white/60 hover:text-white px-3 py-2 rounded-xl transition-all"
          >
            <Scissors size={12} />
            Editor
          </Link>
          <button className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold px-4 py-2 rounded-xl transition-all">
            <Download size={12} />
            Export
          </button>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel: Templates ── */}
        <div className="w-64 shrink-0 border-r border-white/6 flex flex-col overflow-hidden bg-[#0c0c18]">
          {/* Tabs */}
          <div className="flex border-b border-white/6">
            {(['templates', 'transitions'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setLeftTab(t)}
                className={`flex-1 py-3 text-xs font-semibold capitalize transition-all ${leftTab === t ? 'text-white border-b-2 border-violet-500' : 'text-white/35 hover:text-white/55'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {leftTab === 'templates' && (
              <>
                {(['hook', 'caption', 'product', 'effect'] as const).map((cat) => {
                  const catTemplates = TEMPLATES.filter((t) => t.category === cat);
                  if (!catTemplates.length) return null;
                  return (
                    <div key={cat}>
                      <div className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-2 px-1">
                        {cat}
                      </div>
                      <div className="space-y-1.5">
                        {catTemplates.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setActiveTemplate(t.id)}
                            className={`w-full text-left rounded-xl border transition-all p-2.5 ${activeTemplate === t.id ? 'border-violet-500/60 bg-violet-600/15 shadow-sm shadow-violet-500/20' : 'border-white/6 bg-white/[0.02] hover:border-white/15 hover:bg-white/4'}`}
                          >
                            <div className="flex items-center gap-2.5">
                              {/* Mini preview */}
                              <div
                                className={`w-10 h-16 rounded-lg bg-gradient-to-b ${t.bg} shrink-0 flex items-end justify-center pb-1.5 overflow-hidden relative`}
                              >
                                <div
                                  className="absolute inset-x-1 bottom-2 h-3 bg-white/80 rounded-sm"
                                  style={{ opacity: 0.9 }}
                                />
                                <div className="absolute inset-x-2 bottom-4 h-2 bg-white/40 rounded-sm" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm">{t.emoji}</span>
                                  <span className="text-[11px] font-bold text-white truncate">
                                    {t.name}
                                  </span>
                                </div>
                                <p className="text-[9px] text-white/35 leading-snug mt-0.5">
                                  {t.description}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {leftTab === 'transitions' && (
              <>
                <div className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-3 px-1">
                  Clip Transitions
                </div>
                <div className="space-y-1.5">
                  {TRANSITIONS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTransition(t.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${activeTransition === t.id ? 'border-violet-500/60 bg-violet-600/15' : 'border-white/6 hover:border-white/15'}`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <div className="text-left">
                        <div className="text-[11px] font-bold text-white">{t.label}</div>
                        <div className="text-[9px] text-white/35">{t.desc}</div>
                      </div>
                      {activeTransition === t.id && (
                        <Check size={12} className="ml-auto text-violet-400" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="text-[9px] font-bold text-white/25 uppercase tracking-widest mb-3 px-1">
                    Color Grade
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.keys(COLOR_GRADES).map((grade) => (
                      <button
                        key={grade}
                        onClick={() => setColorGrade(grade)}
                        className={`py-2 rounded-lg border text-[10px] font-semibold capitalize transition-all ${colorGrade === grade ? 'border-violet-500/60 bg-violet-600/20 text-violet-300' : 'border-white/8 text-white/40 hover:text-white/65 hover:border-white/20'}`}
                      >
                        {grade === 'none' ? 'Original' : grade}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Center panel: Canvas preview ── */}
        <div className="flex-1 flex flex-col items-center justify-center bg-[#050509] p-6 gap-4 overflow-hidden">
          {/* Hook text editor */}
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2">
              <Film size={13} className="text-violet-400 shrink-0" />
              <input
                value={hookText}
                onChange={(e) => setHookText(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder-white/25"
                placeholder="Overlay text..."
              />
            </div>
          </div>

          {/* 9:16 Portrait canvas */}
          <div
            className="relative overflow-hidden rounded-2xl bg-black shadow-2xl shadow-black/70"
            style={{ aspectRatio: '9/16', maxHeight: 'calc(100vh - 260px)', width: 'auto' }}
          >
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                className="absolute inset-0 w-full h-full"
                style={{
                  objectFit: 'cover',
                  filter:
                    COLOR_GRADES[colorGrade] !== 'none' ? COLOR_GRADES[colorGrade] : undefined,
                }}
                playsInline
                muted
                preload="auto"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-violet-900/50 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                  <Video size={32} className="text-white/20 mx-auto mb-2" />
                  <p className="text-xs text-white/25">No video loaded</p>
                </div>
              </div>
            )}
            <canvas
              ref={canvasRef}
              width={360}
              height={640}
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: 'none' }}
            />
            {/* Template label */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur text-[9px] font-bold text-white/60 px-2 py-1 rounded-full">
              {TEMPLATES.find((t) => t.id === activeTemplate)?.emoji}{' '}
              {TEMPLATES.find((t) => t.id === activeTemplate)?.name}
            </div>
            {/* Duration */}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur text-[9px] font-mono text-white/60 px-2 py-1 rounded-full flex items-center gap-1">
              <Clock size={9} />
              {clipDuration}
            </div>
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-pink-500"
                style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
              />
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={restart}
              className="w-9 h-9 rounded-full bg-white/6 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/60 hover:text-white"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/30 transition-all"
            >
              {isPlaying ? (
                <Pause size={20} className="text-white" />
              ) : (
                <Play size={20} className="text-white ml-0.5" />
              )}
            </button>
            <Link
              href="/editor/1"
              className="w-9 h-9 rounded-full bg-white/6 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/60 hover:text-white"
            >
              <Scissors size={14} />
            </Link>
          </div>

          {/* Template quick-select strip */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-sm">
            {TEMPLATES.slice(0, 7).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTemplate(t.id)}
                title={t.name}
                className={`text-lg p-2 rounded-xl border transition-all ${activeTemplate === t.id ? 'border-violet-500/60 bg-violet-600/20' : 'border-white/8 hover:border-white/20 bg-white/3'}`}
              >
                {t.emoji}
              </button>
            ))}
            <button
              onClick={() => setLeftTab('templates')}
              className="text-xs px-2.5 py-2 rounded-xl border border-white/8 text-white/35 hover:text-white/60 hover:border-white/20 transition-all"
            >
              More
            </button>
          </div>
        </div>

        {/* ── Right panel: Product & Script ── */}
        <div className="w-80 shrink-0 border-l border-white/6 flex flex-col overflow-hidden bg-[#0c0c18]">
          {/* Tabs */}
          <div className="flex border-b border-white/6">
            <button
              onClick={() => setRightTab('product')}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${rightTab === 'product' ? 'text-white border-b-2 border-violet-500' : 'text-white/35 hover:text-white/55'}`}
            >
              <ShoppingBag size={12} />
              TikTok Shop
            </button>
            <button
              onClick={() => setRightTab('script')}
              className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${rightTab === 'script' ? 'text-white border-b-2 border-violet-500' : 'text-white/35 hover:text-white/55'}`}
            >
              <FileText size={12} />
              UGC Script
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* PRODUCT TAB */}
            {rightTab === 'product' && (
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs text-white/45 mb-3 leading-relaxed">
                    Paste a TikTok Shop product link to auto-generate an overlay and viral UGC
                    script.
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2">
                      <ExternalLink size={12} className="text-white/25 shrink-0" />
                      <input
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchProduct()}
                        placeholder="tiktok.com/shop/..."
                        className="flex-1 bg-transparent text-xs text-white outline-none placeholder-white/20"
                      />
                    </div>
                    <button
                      onClick={fetchProduct}
                      disabled={loadingProduct || !productUrl.trim()}
                      className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {loadingProduct ? <RefreshCw size={13} className="st-spin" /> : 'Fetch'}
                    </button>
                  </div>
                  {productError && (
                    <div className="flex items-center gap-2 mt-2 text-red-400/80 text-[10px]">
                      <AlertCircle size={11} />
                      {productError}
                    </div>
                  )}
                </div>

                {product ? (
                  <>
                    {/* Product card */}
                    <div className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
                      <div className="h-28 bg-gradient-to-br from-violet-900/60 to-slate-900 flex items-center justify-center">
                        <Package size={36} className="text-white/20" />
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-bold text-white leading-snug mb-2">
                          {product.name}
                        </p>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-xl font-black text-emerald-400">
                            {product.price}
                          </span>
                          {product.originalPrice && (
                            <span className="text-xs text-white/30 line-through">
                              {product.originalPrice}
                            </span>
                          )}
                          {product.discount && (
                            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full">
                              -{product.discount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                size={10}
                                className={
                                  i <= Math.round(parseFloat(product.rating))
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-white/15'
                                }
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-white/40">
                            {product.rating} · {product.soldCount} sold
                          </span>
                        </div>
                        <div className="text-[9px] text-white/30 mb-2">Key selling points</div>
                        <ul className="space-y-1">
                          {product.features.slice(0, 4).map((f, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-1.5 text-[10px] text-white/55 leading-snug"
                            >
                              <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setActiveTemplate('product')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-600/35 text-xs font-semibold transition-all"
                      >
                        <ShoppingBag size={13} />
                        Apply product overlay
                      </button>
                      <button
                        onClick={generateScript}
                        disabled={loadingScript}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                      >
                        {loadingScript ? (
                          <RefreshCw size={13} className="st-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        {loadingScript ? 'Writing script...' : 'Generate UGC Script'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2.5">
                    <div className="text-[10px] font-bold text-white/25 uppercase tracking-wider">
                      Or pick a product category
                    </div>
                    {[
                      'Beauty & Skincare 💄',
                      'Fitness & Wellness 💪',
                      'Home & Kitchen 🏠',
                      'Fashion & Accessories 👗',
                      'Tech & Gadgets 📱',
                    ].map((cat) => (
                      <button
                        key={cat}
                        className="w-full text-left text-xs text-white/45 hover:text-white/70 bg-white/3 hover:bg-white/6 border border-white/6 hover:border-white/15 px-3 py-2.5 rounded-xl transition-all"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SCRIPT TAB */}
            {rightTab === 'script' && (
              <div className="p-4 space-y-3">
                {script ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white">AI UGC Script</span>
                      <button
                        onClick={generateScript}
                        disabled={loadingScript}
                        className="flex items-center gap-1 text-[10px] text-violet-300 hover:text-violet-200 transition-colors"
                      >
                        <RefreshCw size={10} className={loadingScript ? 'st-spin' : ''} />
                        Regenerate
                      </button>
                    </div>

                    <ScriptSection
                      label="Hook (0-3s)"
                      emoji="🎣"
                      value={script.hook}
                      onApply={() => {
                        setHookText(script.hook);
                        setActiveTemplate('bold-hook');
                      }}
                    />
                    <ScriptSection label="Problem" emoji="😤" value={script.problem} />
                    <ScriptSection
                      label="Solution"
                      emoji="✅"
                      value={script.solution}
                      onApply={() => {
                        setHookText(script.solution.slice(0, 60));
                        setActiveTemplate('pov');
                      }}
                    />
                    <ScriptSection label="Demo (on camera)" emoji="📸" value={script.demo} />
                    <ScriptSection label="Social Proof" emoji="⭐" value={script.socialProof} />
                    <ScriptSection label="CTA" emoji="🛒" value={script.cta} />

                    {/* Overlay text */}
                    <div className="bg-violet-600/10 border border-violet-500/20 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                          ✨ Viral overlay text
                        </span>
                        <button
                          onClick={() => setHookText(script.overlayText)}
                          className="text-[9px] font-semibold bg-violet-600/30 text-violet-300 px-2 py-0.5 rounded-full"
                        >
                          Apply
                        </button>
                      </div>
                      <p className="text-xs text-white/80 font-bold italic">
                        "{script.overlayText}"
                      </p>
                    </div>

                    {/* Hashtags */}
                    <div className="bg-white/[0.03] border border-white/8 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                          # Hashtags
                        </span>
                        <CopyBtn text={script.hashtags.join(' ')} />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {script.hashtags.map((tag, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-white/6 text-white/55 px-2 py-0.5 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white text-xs font-bold">
                      <Download size={13} />
                      Copy full script
                    </button>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <FileText size={32} className="text-white/12 mx-auto mb-3" />
                    {product ? (
                      <>
                        <p className="text-sm text-white/40 mb-4">
                          Ready to write your viral UGC script
                        </p>
                        <button
                          onClick={generateScript}
                          disabled={loadingScript}
                          className="flex items-center gap-2 mx-auto bg-gradient-to-r from-violet-600 to-pink-600 text-white text-xs font-bold px-5 py-3 rounded-xl"
                        >
                          {loadingScript ? (
                            <RefreshCw size={13} className="st-spin" />
                          ) : (
                            <Sparkles size={13} />
                          )}
                          Generate UGC Script
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-white/30 mb-2">Fetch a product first</p>
                        <button
                          onClick={() => setRightTab('product')}
                          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 mx-auto"
                        >
                          <ChevronRight size={12} />
                          Go to TikTok Shop
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes st-spin-anim {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .st-spin {
          animation: st-spin-anim 0.9s linear infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}
