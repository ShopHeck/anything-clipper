'use client';

import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Link from 'next/link';
import {
  Zap,
  ChevronLeft,
  Download,
  Share2,
  Play,
  Pause,
  Star,
  CheckCircle,
  Globe,
  Sparkles,
  RefreshCw,
  Check,
  Clock,
  Scissors,
  Copy,
  ChevronDown,
  Video,
  X,
  ChevronRight,
  Wand2,
} from 'lucide-react';
import { videoStore } from '@/utils/videoStore';

// ── Types ─────────────────────────────────────────────────────────
interface ClipItem {
  id: string;
  title: string;
  start: number;
  end: number;
  duration: string;
  score: number;
  platforms: string[];
  thumbnail: string;
  hook: string;
  tags: string[];
}

const mockClips: ClipItem[] = [
  {
    id: '1',
    title: 'The #1 Creator Mistake Nobody Talks About',
    start: 12,
    end: 54,
    duration: '0:42',
    score: 97,
    platforms: ['TikTok', 'Reels', 'Shorts'],
    thumbnail: 'from-violet-800 to-purple-900',
    hook: 'Most creators make this mistake for years without realizing it...',
    tags: [],
  },
  {
    id: '2',
    title: "Turn 1 Video Into 50 Viral Clips (Here's How)",
    start: 28,
    end: 66,
    duration: '0:38',
    score: 94,
    platforms: ['Reels', 'Shorts', 'LinkedIn'],
    thumbnail: 'from-pink-800 to-rose-900',
    hook: 'Every long-form video you create can become 50 viral clips...',
    tags: [],
  },
  {
    id: '3',
    title: 'Short Clips Outperform Long Videos by 10x',
    start: 70,
    end: 125,
    duration: '0:55',
    score: 92,
    platforms: ['TikTok', 'Shorts'],
    thumbnail: 'from-blue-800 to-cyan-900',
    hook: "Short clips outperform the original video by 10x. Here's why...",
    tags: [],
  },
  {
    id: '4',
    title: 'The Content Goldmine Most Creators Miss',
    start: 130,
    end: 163,
    duration: '0:33',
    score: 89,
    platforms: ['TikTok', 'Reels'],
    thumbnail: 'from-amber-800 to-orange-900',
    hook: "High-energy moments? That's your content goldmine.",
    tags: [],
  },
  {
    id: '5',
    title: 'How to Build a Viral Content System',
    start: 170,
    end: 232,
    duration: '1:02',
    score: 87,
    platforms: ['LinkedIn', 'Reels', 'Shorts'],
    thumbnail: 'from-emerald-800 to-green-900',
    hook: 'Step-by-step system to create viral content consistently...',
    tags: [],
  },
  {
    id: '6',
    title: 'Stop Scrolling Past Your Best Content',
    start: 240,
    end: 269,
    duration: '0:29',
    score: 85,
    platforms: ['TikTok', 'Reels'],
    thumbnail: 'from-indigo-800 to-violet-900',
    hook: "You already have incredible content — you just don't know it.",
    tags: [],
  },
];

const platformColors: Record<string, string> = {
  TikTok: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  Reels: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
  Shorts: 'bg-red-500/15 text-red-400 border-red-500/25',
  LinkedIn: 'bg-blue-600/15 text-blue-400 border-blue-500/25',
  Facebook: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
};

const scoreColor = (s: number) =>
  s >= 95
    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25'
    : s >= 90
      ? 'text-violet-400 bg-violet-500/15 border-violet-500/25'
      : s >= 85
        ? 'text-amber-400 bg-amber-500/15 border-amber-500/25'
        : 'text-white/50 bg-white/6 border-white/12';

// ── Canvas thumbnail: seeks a detached video to clip.start, crops 9:16 ──
function ClipThumbnail({
  videoUrl,
  startTime,
  gradient,
}: {
  videoUrl: string | null;
  startTime: number;
  gradient: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [captured, setCaptured] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!videoUrl) return;
    let cancelled = false;
    setLoading(true);

    const vid = document.createElement('video');
    vid.src = videoUrl;
    vid.muted = true;
    vid.preload = 'metadata';

    const draw = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const vw = vid.videoWidth;
      const vh = vid.videoHeight;
      if (!vw || !vh) return;

      // Center-crop video frame to 9:16 portrait
      const targetAspect = 9 / 16;
      const videoAspect = vw / vh;
      let sx = 0,
        sy = 0,
        sw = vw,
        sh = vh;

      if (videoAspect > targetAspect) {
        // Landscape source: crop left/right to get portrait slice
        sw = vh * targetAspect;
        sx = (vw - sw) / 2;
      } else {
        // Portrait/square source: crop top/bottom
        sh = vw / targetAspect;
        sy = (vh - sh) / 2;
      }

      canvas.width = 360;
      canvas.height = 640;
      ctx.drawImage(vid, sx, sy, sw, sh, 0, 0, 360, 640);
      setCaptured(true);
      setLoading(false);
      // Release memory
      vid.src = '';
    };

    vid.addEventListener('seeked', draw, { once: true });
    vid.addEventListener(
      'loadedmetadata',
      () => {
        if (cancelled) return;
        // Clamp to video duration
        vid.currentTime = Math.max(0, startTime);
      },
      { once: true }
    );
    vid.addEventListener('error', () => setLoading(false), { once: true });

    return () => {
      cancelled = true;
      vid.src = '';
    };
  }, [videoUrl, startTime]);

  return (
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'cover', display: captured ? 'block' : 'none' }}
      />
      {!captured && (
        <div className="absolute inset-0 flex items-center justify-center">
          {videoUrl && loading ? (
            <RefreshCw size={16} className="text-white/30 cf-spin" />
          ) : !videoUrl ? (
            <Video size={18} className="text-white/20" />
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Portrait modal player ─────────────────────────────────────────
interface ModalHandle {
  open: (clip: ClipItem, allClips: ClipItem[]) => void;
}

const ModalPlayer = forwardRef<
  ModalHandle,
  { videoUrl: string | null; aiHooks: Record<string, string> }
>(function ModalPlayer({ videoUrl, aiHooks }, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeClip, setActiveClip] = useState<ClipItem | null>(null);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    open(clip, allClips) {
      setActiveClip(clip);
      setClips(allClips);
      setIsOpen(true);
      setPlaying(false);
      setProgress(0);
    },
  }));

  // Seek when clip changes
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !activeClip || !isOpen) return;
    vid.pause();
    setPlaying(false);
    setProgress(0);

    const doSeek = () => {
      vid.currentTime = activeClip.start;
    };
    if (vid.readyState >= 1) {
      doSeek();
    } else {
      vid.addEventListener('loadedmetadata', doSeek, { once: true });
    }
  }, [activeClip, isOpen]);

  // Stop at clip end + track progress
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !activeClip) return;
    const onTime = () => {
      if (vid.currentTime >= activeClip.end) {
        vid.pause();
        vid.currentTime = activeClip.start;
        setPlaying(false);
        setProgress(0);
        return;
      }
      const pct =
        ((vid.currentTime - activeClip.start) / (activeClip.end - activeClip.start)) * 100;
      setProgress(Math.max(0, Math.min(100, pct)));
    };
    vid.addEventListener('timeupdate', onTime);
    return () => vid.removeEventListener('timeupdate', onTime);
  }, [activeClip]);

  const toggle = () => {
    const vid = videoRef.current;
    if (!vid || !activeClip) return;
    if (playing) {
      vid.pause();
      setPlaying(false);
    } else {
      if (vid.currentTime >= activeClip.end || vid.currentTime < activeClip.start) {
        vid.currentTime = activeClip.start;
      }
      vid.play().catch(() => {});
      setPlaying(true);
    }
  };

  const scrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const vid = videoRef.current;
    if (!vid || !activeClip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    vid.currentTime =
      activeClip.start +
      ((e.clientX - rect.left) / rect.width) * (activeClip.end - activeClip.start);
  };

  const navigate = (dir: 1 | -1) => {
    if (!activeClip) return;
    const idx = clips.findIndex((c) => c.id === activeClip.id);
    const next = clips[idx + dir];
    if (next) {
      setActiveClip(next);
      setPlaying(false);
      setProgress(0);
    }
  };

  const close = () => {
    videoRef.current?.pause();
    setIsOpen(false);
    setPlaying(false);
  };

  if (!isOpen || !activeClip) return null;

  const activeIdx = clips.findIndex((c) => c.id === activeClip.id);
  const hook = aiHooks[activeClip.id] || activeClip.hook;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-lg">
      {/* Close */}
      <button
        onClick={close}
        className="absolute top-5 right-5 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
      >
        <X size={16} className="text-white" />
      </button>

      {/* Prev */}
      {activeIdx > 0 && (
        <button
          onClick={() => navigate(-1)}
          className="absolute left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
        >
          <ChevronLeft size={20} className="text-white" />
        </button>
      )}

      {/* Next */}
      {activeIdx < clips.length - 1 && (
        <button
          onClick={() => navigate(1)}
          className="absolute right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
        >
          <ChevronRight size={20} className="text-white" />
        </button>
      )}

      <div className="flex items-center gap-8 p-6 max-h-screen overflow-auto">
        {/* ── 9:16 portrait video ── */}
        <div className="flex-shrink-0" style={{ width: 300, height: 533 }}>
          <div className="relative w-full h-full rounded-3xl overflow-hidden bg-black shadow-2xl shadow-black/60">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center center',
                }}
                playsInline
                muted
                preload="auto"
              />
            ) : (
              <div
                className={`w-full h-full bg-gradient-to-br ${activeClip.thumbnail} flex items-center justify-center`}
              >
                <Video size={40} className="text-white/20" />
              </div>
            )}

            {/* Tap overlay */}
            <button onClick={toggle} className="absolute inset-0" />

            {/* Play button */}
            {!playing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur flex items-center justify-center">
                  <Play size={26} className="text-white ml-1" />
                </div>
              </div>
            )}
            {playing && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur flex items-center justify-center">
                  <Pause size={26} className="text-white" />
                </div>
              </div>
            )}

            {/* Top badges */}
            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded-full font-mono pointer-events-none">
              <Clock size={10} />
              {activeClip.duration}
            </div>
            <div
              className={`absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-black backdrop-blur-sm pointer-events-none ${scoreColor(activeClip.score)}`}
            >
              <Star size={10} className="fill-current" />
              {activeClip.score}
            </div>

            {/* Platform chips at bottom */}
            <div className="absolute bottom-5 left-3 right-3 flex flex-wrap gap-1 pointer-events-none">
              {activeClip.platforms.map((p) => (
                <span
                  key={p}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${platformColors[p] || 'bg-white/10 text-white/60 border-white/20'}`}
                >
                  {p}
                </span>
              ))}
            </div>

            {/* Progress bar */}
            <div
              className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/15 cursor-pointer"
              onClick={scrub}
            >
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-pink-500"
                style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
              />
            </div>
          </div>

          {/* Clip counter + nav dots */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {clips.map((_, i) => {
              const isActive = i === activeIdx;
              const dotStyle = {
                width: isActive ? 16 : 6,
                height: 6,
                background: isActive ? '#a78bfa' : 'rgba(255,255,255,0.2)',
              };
              return (
                <button
                  key={i}
                  onClick={() => {
                    setActiveClip(clips[i]);
                    setPlaying(false);
                    setProgress(0);
                  }}
                  className="rounded-full transition-all"
                  style={dotStyle}
                />
              );
            })}
          </div>
        </div>

        {/* ── Info panel ── */}
        <div className="w-72 text-white flex flex-col gap-4 py-2">
          <div>
            <div className="text-xs text-white/35 mb-1">
              Clip {activeIdx + 1} of {clips.length}
            </div>
            <h2 className="text-xl font-black leading-snug">{activeClip.title}</h2>
          </div>

          <div className="bg-white/5 border border-white/8 rounded-xl p-4">
            <div className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-2">
              Hook
            </div>
            <p className="text-sm text-white/70 leading-relaxed italic">"{hook}"</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/4 border border-white/8 rounded-xl p-3">
              <div className="text-[10px] text-white/35 mb-0.5">Start time</div>
              <div className="text-base font-bold font-mono">{activeClip.start}s</div>
            </div>
            <div className="bg-white/4 border border-white/8 rounded-xl p-3">
              <div className="text-[10px] text-white/35 mb-0.5">End time</div>
              <div className="text-base font-bold font-mono">{activeClip.end}s</div>
            </div>
          </div>

          <div className="bg-white/4 border border-white/8 rounded-xl p-3">
            <div className="text-[10px] text-white/35 mb-2">Platforms</div>
            <div className="flex flex-wrap gap-1.5">
              {activeClip.platforms.map((p) => (
                <span
                  key={p}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${platformColors[p] || 'bg-white/6 text-white/45 border-white/12'}`}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-sm font-bold transition-all">
              <Download size={14} />
              Export this clip
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/9 text-white/60 hover:text-white text-xs font-semibold transition-all">
                <Share2 size={13} />
                Share
              </button>
              <button className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/9 text-white/60 hover:text-white text-xs font-semibold transition-all">
                <Copy size={13} />
                Copy hook
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ── Portrait clip card ────────────────────────────────────────────
function ClipCard({
  clip,
  videoUrl,
  isSelected,
  onSelect,
  onClick,
  isExported,
  onExport,
  hook,
}: {
  clip: ClipItem;
  videoUrl: string | null;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  isExported: boolean;
  onExport: () => void;
  hook: string;
}) {
  return (
    <div
      className={`group bg-white/[0.03] border rounded-2xl overflow-hidden transition-all duration-200 ${isSelected ? 'border-violet-500/50 shadow-lg shadow-violet-500/15' : 'border-white/8 hover:border-violet-500/25'}`}
    >
      {/* 9:16 portrait thumbnail */}
      <div className="relative cursor-pointer" style={{ aspectRatio: '9 / 16' }} onClick={onClick}>
        <ClipThumbnail videoUrl={videoUrl} startTime={clip.start} gradient={clip.thumbnail} />

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />

        {/* Select checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={`absolute top-2.5 left-2.5 z-10 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-violet-600 border-violet-500' : 'border-white/50 bg-black/30 backdrop-blur opacity-0 group-hover:opacity-100'}`}
        >
          {isSelected && <Check size={11} className="text-white" />}
        </button>

        {/* Score badge */}
        <div
          className={`absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-black backdrop-blur-sm ${scoreColor(clip.score)}`}
        >
          <Star size={9} className="fill-current" />
          {clip.score}
        </div>

        {/* Play button on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
            <Play size={18} className="text-white ml-0.5" />
          </div>
        </div>

        {/* Bottom meta */}
        <div className="absolute bottom-2 left-2 right-2 z-10 pointer-events-none">
          <div className="flex items-center gap-1 mb-1.5">
            {clip.platforms.slice(0, 3).map((p) => (
              <span
                key={p}
                className="text-[9px] font-bold bg-black/65 backdrop-blur text-white/85 px-1.5 py-0.5 rounded-full"
              >
                {p}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-white/70 font-mono">
            <Clock size={9} />
            {clip.duration}
          </div>
        </div>
      </div>

      {/* Card info */}
      <div className="p-3">
        <p className="text-[11px] font-bold text-white leading-snug mb-1.5 line-clamp-2">
          {clip.title}
        </p>
        <p className="text-[10px] text-white/40 italic leading-relaxed mb-3 line-clamp-2">
          "{hook}"
        </p>
        <div className="flex gap-1.5 mb-1.5">
          <button
            onClick={onExport}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-all ${isExported ? 'bg-emerald-600/25 border border-emerald-500/30 text-emerald-400' : 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white'}`}
          >
            {isExported ? (
              <>
                <Check size={11} />
                Done
              </>
            ) : (
              <>
                <Download size={11} />
                Export
              </>
            )}
          </button>
          <button
            onClick={onClick}
            className="p-2 rounded-xl bg-white/5 border border-white/8 hover:bg-white/9 transition-all text-white/50 hover:text-white"
          >
            <Play size={12} />
          </button>
          <button className="p-2 rounded-xl bg-white/5 border border-white/8 hover:bg-white/9 transition-all text-white/50 hover:text-white">
            <Copy size={12} />
          </button>
        </div>
        {/* Polish in Studio */}
        <Link
          href={`/studio/${clip.id}`}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-white/4 border border-white/8 hover:border-violet-500/35 hover:bg-violet-600/10 text-white/40 hover:text-violet-300 text-[10px] font-semibold transition-all"
        >
          <Wand2 size={11} />
          Polish in Studio
        </Link>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function ClipsPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [selectedClips, setSelectedClips] = useState<string[]>([]);
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [aiLoading, setAiLoading] = useState(false);
  const [extraClips, setExtraClips] = useState<ClipItem[]>([]);
  const [exportedClips, setExportedClips] = useState<string[]>([]);
  const [aiHooks, _setAiHooks] = useState<Record<string, string>>({});
  const [baseClips, setBaseClips] = useState<ClipItem[]>(mockClips);
  const [pageTitle, setPageTitle] = useState('');
  const modalRef = useRef<ModalHandle>(null);
  const extraCounter = useRef(0);

  useEffect(() => {
    params.then(({ id }) => {
      setProjectId(id);

      // First try videoStore (same session)
      const storeUrl = videoStore.getObjectUrl();
      const stored = videoStore.getClips();
      const name = videoStore.getFileName();
      if (storeUrl) setVideoUrl(storeUrl);
      if (stored.length > 0) {
        setBaseClips(
          stored.map((c) => ({
            id: c.id,
            title: c.title,
            start: c.start,
            end: c.end,
            duration: c.duration,
            score: c.score,
            platforms: c.platforms,
            thumbnail: c.thumbnail || 'from-violet-800 to-purple-900',
            hook: c.hook,
            tags: [],
          }))
        );
      }
      if (name) setPageTitle(name.replace(/\.[^/.]+$/, ''));

      // Also load from DB
      if (id && id !== 'new') {
        fetch(`/api/projects/${id}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.project) {
              if (!name) setPageTitle(data.project.title || '');
              if (!storeUrl && data.project.file_url) setVideoUrl(data.project.file_url);
            }
            if (data.clips && data.clips.length > 0 && stored.length === 0) {
              setBaseClips(
                data.clips.map(
                  (c: {
                    id: string;
                    title: string;
                    hook: string;
                    score: number;
                    platforms: string[];
                    start_time: number;
                    end_time: number;
                    duration_label: string;
                    thumbnail: string;
                    reason: string;
                  }) => ({
                    id: c.id,
                    title: c.title,
                    start: c.start_time,
                    end: c.end_time,
                    duration: c.duration_label,
                    score: c.score,
                    platforms: c.platforms || [],
                    thumbnail: c.thumbnail || 'from-violet-800 to-purple-900',
                    hook: c.hook,
                    tags: [],
                  })
                )
              );
            }
          })
          .catch((err) => console.error('DB load error:', err))
          .finally(() => {});
      } else {
        {
        }
      }
    });
  }, [params]);

  const allClips = [...baseClips, ...extraClips];

  const toggleSelect = (id: string) =>
    setSelectedClips((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleSelectAll = () =>
    setSelectedClips((prev) => (prev.length === allClips.length ? [] : allClips.map((c) => c.id)));

  const filtered = allClips
    .filter((c) => filterPlatform === 'all' || c.platforms.includes(filterPlatform))
    .sort((a, b) => b.score - a.score);

  const generateMoreClips = useCallback(async () => {
    setAiLoading(true);
    try {
      const transcript = videoStore.getTranscript();
      const text =
        transcript.length > 0
          ? transcript
              .map((s) => s.text)
              .join(' ')
              .slice(0, 1500)
          : pageTitle;
      const res = await fetch('/api/generate-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, count: 3 }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.clips) {
        extraCounter.current += 1;
        setExtraClips((prev) => [
          ...prev,
          ...data.clips.map(
            (
              c: {
                title: string;
                hook: string;
                score: number;
                start?: number;
                end?: number;
                duration?: string;
                thumbnail?: string;
              },
              i: number
            ) => ({
              id: `extra-${extraCounter.current}-${i}`,
              title: c.title,
              start: c.start ?? 0,
              end: c.end ?? 60,
              duration: c.duration ?? '0:45',
              score: c.score,
              platforms: ['TikTok', 'Reels'],
              thumbnail: c.thumbnail ?? 'from-fuchsia-800 to-purple-900',
              hook: c.hook,
              tags: ['ai-generated'],
            })
          ),
        ]);
      }
    } catch {
      extraCounter.current += 1;
      setExtraClips((prev) => [
        ...prev,
        {
          id: `extra-${extraCounter.current}`,
          title: 'The Secret Algorithm Creators Ignore',
          start: 30,
          end: 68,
          duration: '0:38',
          score: 88,
          platforms: ['TikTok', 'Reels'],
          thumbnail: 'from-fuchsia-800 to-purple-900',
          hook: 'Most creators ignore the one algorithm signal that actually matters...',
          tags: ['ai'],
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  }, [pageTitle]);

  const handleExport = (id: string) => {
    setExportedClips((prev) => [...prev, id]);
    setTimeout(() => setExportedClips((prev) => prev.filter((x) => x !== id)), 3000);
  };

  const avgScore = allClips.length
    ? Math.round(allClips.reduce((a, c) => a + c.score, 0) / allClips.length)
    : 0;

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <ModalPlayer ref={modalRef} videoUrl={videoUrl} aiHooks={aiHooks} />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#07070f]/90 backdrop-blur-xl border-b border-white/6 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm"
          >
            <ChevronLeft size={15} />
            Dashboard
          </Link>
          <div className="flex items-center gap-2 ml-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Zap size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white/70 truncate max-w-[160px]">
              {pageTitle || 'Untitled video'}
            </span>
            <span className="text-white/25">/</span>
            <span className="text-sm font-bold text-white">AI Clips</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            {selectedClips.length > 0 && (
              <button className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white px-4 py-2 rounded-xl transition-all">
                <Download size={14} />
                Export {selectedClips.length}
              </button>
            )}
            <Link
              href={`/editor/${projectId}`}
              className="flex items-center gap-1.5 text-sm bg-white/6 border border-white/10 text-white/65 hover:text-white px-4 py-2 rounded-xl transition-all"
            >
              <Scissors size={14} />
              Open Editor
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* No video banner */}
        {!videoUrl && (
          <div className="mb-6 flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4">
            <Video size={16} className="text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300/80">
              No video loaded — thumbnails are disabled.{' '}
              <Link
                href="/upload"
                className="underline font-semibold text-amber-300 hover:text-amber-200"
              >
                Upload a video →
              </Link>
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-6 mb-8">
          <div>
            <div className="text-3xl font-black cf-gradient-text">{allClips.length}</div>
            <div className="text-xs text-white/35 mt-0.5">Total clips</div>
          </div>
          <div className="w-px h-10 bg-white/8" />
          <div>
            <div className="text-3xl font-black text-white">{avgScore}</div>
            <div className="text-xs text-white/35 mt-0.5">Avg viral score</div>
          </div>
          <div className="w-px h-10 bg-white/8" />
          <div>
            <div className="text-3xl font-black text-white">
              {[...new Set(allClips.flatMap((c) => c.platforms))].length}
            </div>
            <div className="text-xs text-white/35 mt-0.5">Platforms</div>
          </div>
          <div className="flex-1" />
          <button
            onClick={generateMoreClips}
            disabled={aiLoading}
            className="flex items-center gap-2 bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/25 text-violet-300 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all disabled:opacity-50"
          >
            {aiLoading ? <RefreshCw size={14} className="cf-spin" /> : <Sparkles size={14} />}
            {aiLoading ? 'Generating...' : 'Generate more clips'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs bg-white/4 border border-white/8 text-white/55 hover:text-white px-3 py-2 rounded-xl transition-all"
          >
            {selectedClips.length === allClips.length && allClips.length > 0 ? (
              <CheckCircle size={13} className="text-violet-400" />
            ) : (
              <div className="w-3.5 h-3.5 rounded border border-white/25" />
            )}
            Select all
          </button>

          <div className="flex items-center gap-1 bg-white/4 border border-white/8 rounded-xl p-1">
            {['all', 'TikTok', 'Reels', 'Shorts', 'LinkedIn'].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPlatform(p)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${filterPlatform === p ? 'bg-violet-600/30 text-violet-300' : 'text-white/40 hover:text-white/65'}`}
              >
                {p === 'all' ? 'All' : p}
              </button>
            ))}
          </div>

          <button className="flex items-center gap-1.5 text-xs bg-white/4 border border-white/8 text-white/55 px-3 py-2 rounded-xl hover:text-white transition-all">
            Sort: <span className="font-semibold text-white/70 ml-1">Viral Score</span>
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Portrait 9:16 grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {filtered.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              videoUrl={videoUrl}
              isSelected={selectedClips.includes(clip.id)}
              onSelect={() => toggleSelect(clip.id)}
              onClick={() => modalRef.current?.open(clip, filtered)}
              isExported={exportedClips.includes(clip.id)}
              onExport={() => handleExport(clip.id)}
              hook={aiHooks[clip.id] || clip.hook}
            />
          ))}

          {/* Generate more card */}
          <button
            onClick={generateMoreClips}
            disabled={aiLoading}
            style={{ aspectRatio: '9 / 16' }}
            className="group border-2 border-dashed border-white/10 hover:border-violet-500/30 hover:bg-violet-500/4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="w-11 h-11 rounded-2xl bg-violet-600/12 border border-violet-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              {aiLoading ? (
                <RefreshCw size={18} className="text-violet-400 cf-spin" />
              ) : (
                <Sparkles size={18} className="text-violet-400" />
              )}
            </div>
            <div className="text-center px-2">
              <div className="text-[11px] font-bold text-white/40 group-hover:text-white/65 transition-colors mb-1">
                {aiLoading ? 'Finding...' : 'Find more'}
              </div>
              <div className="text-[9px] text-white/20">AI scans footage</div>
            </div>
          </button>
        </div>
      </div>

      {/* Bulk export bar */}
      {selectedClips.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 bg-[#111125] border border-violet-500/30 rounded-2xl px-6 py-4 shadow-2xl shadow-violet-500/20 backdrop-blur-xl">
          <span className="text-sm font-semibold text-white">{selectedClips.length} selected</span>
          <div className="flex gap-2">
            {['TikTok', 'Reels', 'Shorts'].map((p) => (
              <button
                key={p}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-white/8 hover:bg-white/12 border border-white/10 text-white/70 hover:text-white rounded-xl transition-all"
              >
                <Globe size={11} />
                {p}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold px-4 py-2 rounded-xl">
            <Download size={13} />
            Export all
          </button>
          <button
            onClick={() => setSelectedClips([])}
            className="text-white/35 hover:text-white/60 text-xs transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <style jsx global>{`
        .cf-gradient-text {
          background: linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #fb923c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        @keyframes cf-spin-anim {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .cf-spin {
          animation: cf-spin-anim 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
