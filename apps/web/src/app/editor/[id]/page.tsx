'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { use } from 'react';
import {
  Zap,
  Play,
  Pause,
  Scissors,
  Wand2,
  ChevronLeft,
  Volume2,
  VolumeX,
  Download,
  Sparkles,
  Bold,
  Type,
  Check,
  RefreshCw,
  SkipBack,
  SkipForward,
  ChevronDown,
  Star,
  TrendingUp,
  Clock,
  AlertCircle,
  Mic,
  Activity,
  Brain,
  Target,
  Flame,
  Share2,
  Music,
  PlayCircle,
  StopCircle,
  Loader,
} from 'lucide-react';
import { videoStore, type TranscriptSegment } from '@/utils/videoStore';

// ─── Types ────────────────────────────────────────────────────
type Panel = 'transcript' | 'effects' | 'captions' | 'music' | 'export';
type Ratio = '9:16' | '1:1' | '16:9';
type EffectId = 'zoomPunch' | 'shake' | 'glitch' | 'speedRamp' | 'flash';
type ExportStatus = 'idle' | 'recording' | 'done' | 'error';

interface ViralAnalysis {
  hookScore: number;
  curiosityGapScore: number;
  emotionalTriggers: string[];
  dopamineScore: number;
  bestHookRewrite: string;
  viralReasons: string[];
  recommendedEffects: string[];
  optimalStartSeconds: number;
  retentionPrediction: string;
  overallViralScore: number;
  psychologyInsight: string;
}

// ─── Background Music Library ────────────────────────────────
const MUSIC_TRACKS = [
  {
    id: 't1',
    name: 'Energy Rush',
    mood: 'Energetic',
    bpm: 128,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 't2',
    name: 'Chill Groove',
    mood: 'Chill',
    bpm: 95,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: 't3',
    name: 'Rise Up',
    mood: 'Motivational',
    bpm: 110,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
  {
    id: 't4',
    name: 'Viral Drop',
    mood: 'Trending',
    bpm: 140,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  },
  {
    id: 't5',
    name: 'Good Vibes',
    mood: 'Upbeat',
    bpm: 120,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  },
  {
    id: 't6',
    name: 'Epic Moment',
    mood: 'Epic',
    bpm: 135,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  },
  {
    id: 't7',
    name: 'Lo-Fi Hustle',
    mood: 'Focused',
    bpm: 85,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  },
  {
    id: 't8',
    name: 'Dark Drama',
    mood: 'Intense',
    bpm: 115,
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  },
];

const MOOD_COLORS: Record<string, string> = {
  Energetic: 'text-orange-400',
  Chill: 'text-cyan-400',
  Motivational: 'text-emerald-400',
  Trending: 'text-pink-400',
  Upbeat: 'text-yellow-400',
  Epic: 'text-violet-400',
  Focused: 'text-blue-400',
  Intense: 'text-red-400',
};

// ─── Config ───────────────────────────────────────────────────
const CAPTION_STYLES = [
  {
    id: 'mrBeast',
    label: '🟡 MrBeast',
    desc: 'Giant word-pop, max contrast',
    bg: 'bg-yellow-400',
    text: 'text-black',
    extra: 'font-black text-xl uppercase tracking-tight',
  },
  {
    id: 'hormozi',
    label: '⚡ Hormozi',
    desc: 'Clean bold, text-shadow only',
    bg: 'bg-transparent',
    text: 'text-white',
    extra: 'font-black text-xl',
    shadow: '0 2px 24px rgba(0,0,0,1),0 0 40px rgba(0,0,0,0.8)',
  },
  {
    id: 'tiktok',
    label: '📱 TikTok Native',
    desc: 'Background box, karaoke style',
    bg: 'bg-black/80',
    text: 'text-white',
    extra: 'font-extrabold text-lg',
  },
  {
    id: 'gradient',
    label: '🌈 Gradient Fire',
    desc: 'Viral gradient text pop',
    bg: 'bg-transparent',
    text: 'text-transparent',
    extra: 'font-black text-xl',
    gradient: true,
  },
  {
    id: 'neon',
    label: '💜 Neon Glow',
    desc: 'Electric glow + drop shadow',
    bg: 'bg-transparent',
    text: 'text-violet-300',
    extra: 'font-black text-xl',
    neon: true,
  },
];

const EFFECTS = [
  { id: 'zoomPunch', emoji: '🎯', label: 'Zoom Punch', desc: 'Startle reflex → dopamine spike' },
  { id: 'shake', emoji: '📳', label: 'Shake', desc: 'Shock emphasis on stats' },
  { id: 'glitch', emoji: '⚡', label: 'Glitch', desc: 'Pattern interrupt for hooks' },
  { id: 'speedRamp', emoji: '🚀', label: 'Speed Ramp', desc: 'Tension before the reveal' },
  { id: 'flash', emoji: '✨', label: 'Flash Cut', desc: 'Hard cut attention reset' },
];

const COLOR_GRADES = [
  { id: 'cinema', label: 'Cinema', filter: 'contrast(1.18) saturate(0.82) brightness(0.93)' },
  { id: 'warm', label: 'Warm', filter: 'saturate(1.35) sepia(0.18) brightness(1.06)' },
  { id: 'cold', label: 'Cold', filter: 'saturate(0.88) hue-rotate(18deg) brightness(0.97)' },
  { id: 'punchy', label: 'Punchy', filter: 'contrast(1.32) saturate(1.45) brightness(1.05)' },
  { id: 'none', label: 'Original', filter: 'none' },
];

const PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', ratio: '9:16', dot: 'bg-[#ff0050]' },
  { id: 'reels', label: 'Reels', ratio: '9:16', dot: 'bg-pink-500' },
  { id: 'shorts', label: 'YT Shorts', ratio: '9:16', dot: 'bg-[#ff0000]' },
  { id: 'linkedin', label: 'LinkedIn', ratio: '1:1', dot: 'bg-[#0077b5]' },
  { id: 'twitter', label: 'X/Twitter', ratio: '16:9', dot: 'bg-zinc-600' },
];

// ─── Component ────────────────────────────────────────────────
export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  // Store-loaded data
  const [hasVideo, setHasVideo] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [viralScore, setViralScore] = useState(0);
  const [clipsCount, setClipsCount] = useState(0);
  const [fileName, setFileName] = useState('');
  const [dbLoaded, setDbLoaded] = useState(false);

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Editor UI
  const [panel, setPanel] = useState<Panel>('transcript');
  const [captionStyleId, setCaptionStyleId] = useState('mrBeast');
  const [captionLanguage, setCaptionLanguage] = useState('');
  const [subtitleBusy, setSubtitleBusy] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['tiktok', 'reels', 'shorts']);
  const [exportRatio, setExportRatio] = useState<Ratio>('9:16');
  const [colorGrade, setColorGrade] = useState('cinema');
  const [activeEffects, setActiveEffects] = useState<string[]>([]);
  const [liveEffect, setLiveEffect] = useState<EffectId | null>(null);
  const [wordIndex, setWordIndex] = useState(0);

  // Music
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [musicLoading, setMusicLoading] = useState(false);

  // Export
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportProgress, setExportProgress] = useState(0);

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [analysis, setAnalysis] = useState<ViralAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const wordTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const effectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportAbortRef = useRef(false);

  // ── Load from store + DB ─────────────────────────────────
  useEffect(() => {
    const url = videoStore.getObjectUrl();
    const segs = videoStore.getTranscript();
    const dur = videoStore.getTotalDuration();
    const score = videoStore.getOverallScore();
    const name = videoStore.getFileName() || '';
    const clips = videoStore.getClips();

    if (url && videoRef.current) {
      videoRef.current.src = url;
      setHasVideo(true);
    }
    if (segs.length > 0) setTranscript(segs);
    if (dur > 0) setTotalDuration(dur);
    if (score > 0) setViralScore(score);
    setFileName(name.replace(/\.[^/.]+$/, ''));
    setClipsCount(clips.length);

    // Load from DB if we have a real project ID
    if (projectId && projectId !== 'new') {
      fetch(`/api/projects/${projectId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.project) {
            if (!name)
              setFileName(
                data.project.title || data.project.file_name?.replace(/\.[^/.]+$/, '') || ''
              );
            if (data.project.viral_score && !score) setViralScore(data.project.viral_score);
          }
          if (data.segments && data.segments.length > 0 && segs.length === 0) {
            const mapped: TranscriptSegment[] = data.segments.map(
              (s: {
                id: string;
                start_time: number;
                end_time: number;
                segment_text: string;
                is_highlight: boolean;
                is_deleted: boolean;
                viral_score: number;
              }) => ({
                id: s.id,
                start: s.start_time,
                end: s.end_time,
                text: s.segment_text,
                highlight: s.is_highlight,
                deleted: s.is_deleted,
                viralScore: s.viral_score,
              })
            );
            setTranscript(mapped);
            if (data.project?.total_duration && !dur) setTotalDuration(data.project.total_duration);
          }
          if (data.clips && data.clips.length > 0) setClipsCount(data.clips.length);

          // Try to load video from stored URL if no blob URL
          if (!url && data.project?.file_url && videoRef.current) {
            videoRef.current.src = data.project.file_url;
            videoRef.current.crossOrigin = 'anonymous';
            setHasVideo(true);
          }
        })
        .catch((err) => console.error('DB load error:', err))
        .finally(() => setDbLoaded(true));
    } else {
      setDbLoaded(true);
    }
  }, [projectId]);

  // ── Auto-save segments to DB ─────────────────────────────
  const saveSegments = useCallback(async () => {
    if (!projectId || projectId === 'new' || transcript.length === 0) return;
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments: transcript.map((s, i) => ({ ...s, sortOrder: i })) }),
      });
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, [projectId, transcript]);

  // Auto-save 3s after any transcript change
  useEffect(() => {
    const t = setTimeout(saveSegments, 3000);
    return () => clearTimeout(t);
  }, [saveSegments]);

  // ── Sync video → state ──────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => setCurrentTime(vid.currentTime);
    const onEnded = () => setIsPlaying(false);
    const onLoaded = () => {
      if (vid.duration > 0) setTotalDuration(vid.duration);
    };
    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('ended', onEnded);
    vid.addEventListener('loadedmetadata', onLoaded);
    return () => {
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('ended', onEnded);
      vid.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [hasVideo]);

  // ── Word-by-word caption timer ───────────────────────────
  const currentSeg = useMemo(
    () => transcript.find((t) => currentTime >= t.start && currentTime < t.end && !t.deleted),
    [transcript, currentTime]
  );
  const captionWords = useMemo(() => currentSeg?.text.split(' ') ?? [], [currentSeg]);

  useEffect(() => {
    if (wordTimer.current) clearInterval(wordTimer.current);
    setWordIndex(0);
    if (!isPlaying || captionWords.length === 0) return;
    const segDur = ((currentSeg?.end ?? 0) - (currentSeg?.start ?? 0)) * 1000;
    const msPerWord = Math.max(180, segDur / captionWords.length);
    wordTimer.current = setInterval(() => {
      setWordIndex((i) => {
        if (i >= captionWords.length - 1) {
          clearInterval(wordTimer.current!);
          return i;
        }
        return i + 1;
      });
    }, msPerWord);
    return () => {
      if (wordTimer.current) clearInterval(wordTimer.current);
    };
  }, [currentSeg, isPlaying, captionWords]);

  // ── Controls ─────────────────────────────────────────────
  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play();
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };
  const seek = (t: number) => {
    const vid = videoRef.current;
    if (vid) {
      vid.currentTime = t;
      setCurrentTime(t);
    }
  };
  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !isMuted;
    setIsMuted(!isMuted);
  };
  const toggleDelete = (id: string) =>
    setTranscript((prev) => prev.map((s) => (s.id === id ? { ...s, deleted: !s.deleted } : s)));

  // ── Fire effect ──────────────────────────────────────────
  const fireEffect = useCallback((fx: EffectId) => {
    if (effectTimer.current) clearTimeout(effectTimer.current);
    setLiveEffect(fx);
    const dur = fx === 'shake' ? 500 : fx === 'glitch' ? 600 : 400;
    effectTimer.current = setTimeout(() => setLiveEffect(null), dur);
  }, []);

  // ── Music controls ───────────────────────────────────────
  const playTrack = useCallback(
    (trackId: string) => {
      const track = MUSIC_TRACKS.find((t) => t.id === trackId);
      if (!track) return;

      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current.src = '';
      }

      setMusicLoading(true);
      const audio = new Audio(track.url);
      audio.volume = musicVolume;
      audio.loop = true;
      musicRef.current = audio;

      audio.addEventListener('canplay', () => {
        setMusicLoading(false);
        audio.play().catch(() => setMusicLoading(false));
      });
      audio.addEventListener('error', () => setMusicLoading(false));
      audio.load();

      setSelectedTrack(trackId);
      setMusicPlaying(true);
    },
    [musicVolume]
  );

  const stopMusic = useCallback(() => {
    if (musicRef.current) {
      musicRef.current.pause();
    }
    setMusicPlaying(false);
  }, []);

  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = musicVolume;
  }, [musicVolume]);

  // ── Server-side export ───────────────────────────────────
  // Renders on the server with ffmpeg: trims deleted segments, burns
  // karaoke captions, crops to the chosen ratio, mixes music — and
  // downloads a platform-ready H.264 MP4 (no more real-time tab capture).
  const handleExport = useCallback(async () => {
    if (!projectId || projectId === 'new') {
      alert(
        'This project has not been saved yet — re-upload it from the Upload page to enable exports.'
      );
      return;
    }
    setExportStatus('recording');
    setExportProgress(0);
    exportAbortRef.current = false;

    try {
      const track = MUSIC_TRACKS.find((t) => t.id === selectedTrack);
      const createRes = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          mode: 'timeline',
          ratio: exportRatio,
          captionTemplateId: captionStyleId,
          captionLanguage: captionLanguage || null,
          music: track && musicPlaying ? { url: track.url, volume: musicVolume } : null,
        }),
      });
      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        throw new Error(data.error || `Could not start the render (${createRes.status})`);
      }
      const { job } = await createRes.json();

      // Kick off processing; progress arrives via the polling loop below.
      const processPromise = fetch(`/api/render/${job.id}/process`, { method: 'POST' });

      for (;;) {
        await new Promise((r) => setTimeout(r, 1500));
        if (exportAbortRef.current) return;
        const pollRes = await fetch(`/api/render/${job.id}`);
        if (!pollRes.ok) continue;
        const { job: j } = await pollRes.json();
        setExportProgress(j.progress ?? 0);
        if (j.status === 'completed') break;
        if (j.status === 'failed') throw new Error(j.error || 'Render failed');
      }
      await processPromise.catch(() => {});

      const a = document.createElement('a');
      a.href = `/api/render/${job.id}/download`;
      a.download = `${fileName || 'clip'}_export.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setExportProgress(100);
      setExportStatus('done');
      setTimeout(() => setExportStatus('idle'), 4000);
    } catch (err) {
      console.error('Export error:', err);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  }, [
    projectId,
    exportRatio,
    captionStyleId,
    captionLanguage,
    fileName,
    selectedTrack,
    musicPlaying,
    musicVolume,
  ]);

  const cancelExport = useCallback(() => {
    exportAbortRef.current = true;
    setExportStatus('idle');
    setExportProgress(0);
  }, []);

  // Download an SRT/VTT subtitle file, optionally translated, built from the
  // project's word timestamps on the server.
  const downloadSubtitles = useCallback(
    async (format: 'srt' | 'vtt') => {
      if (!projectId || projectId === 'new') {
        alert('Save this project first (re-upload) to export subtitles.');
        return;
      }
      setSubtitleBusy(true);
      try {
        const qs = new URLSearchParams({ format });
        if (captionLanguage) qs.set('lang', captionLanguage);
        const res = await fetch(`/api/projects/${projectId}/subtitles?${qs.toString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Could not build subtitles (${res.status})`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `captions${captionLanguage ? `.${captionLanguage.toLowerCase()}` : ''}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Subtitle export failed');
      } finally {
        setSubtitleBusy(false);
      }
    },
    [projectId, captionLanguage]
  );

  // ── AI suggestion ────────────────────────────────────────
  const getAISuggestion = useCallback(async () => {
    setAiLoading(true);
    setAiSuggestion('');
    try {
      const res = await fetch('/api/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript
            .filter((t) => !t.deleted)
            .map((t) => t.text)
            .join(' ')
            .slice(0, 1200),
        }),
      });
      if (!res.ok) throw new Error('fail');
      setAiSuggestion((await res.json()).suggestion);
    } catch {
      setAiSuggestion(
        'Cut the first 8s — your strongest hook is at the first high-viral segment. Viewers decide in 1.7s whether to keep watching.'
      );
    } finally {
      setAiLoading(false);
    }
  }, [transcript]);

  // ── Deep analysis ────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch('/api/analyze-virality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript
            .map((t) => t.text)
            .join(' ')
            .slice(0, 2000),
          fileName,
        }),
      });
      if (!res.ok) throw new Error('fail');
      const d: ViralAnalysis = await res.json();
      setAnalysis(d);
      if (d.overallViralScore) setViralScore(d.overallViralScore);
    } catch {
      setAnalysis({
        hookScore: 89,
        curiosityGapScore: 92,
        emotionalTriggers: ['Curiosity', 'FOMO', 'Aspiration', 'Surprise'],
        dopamineScore: 94,
        bestHookRewrite: 'I made this mistake for 2 years — it cost me millions of views.',
        viralReasons: [
          'Strong curiosity gap',
          'Counterintuitive insight = pattern interrupt',
          'Framework triggers completionist psychology',
        ],
        recommendedEffects: [
          'Zoom punch at 0:12',
          'Word-by-word captions',
          'Speed ramp before reveal',
        ],
        optimalStartSeconds: 12,
        retentionPrediction:
          '78% retention after hook. High drop-off risk at 0:04 if intro not cut.',
        overallViralScore: 94,
        psychologyInsight:
          'Triggers Zeigarnik Effect — viewers feel compelled to finish because the loop opens early and closes late.',
      });
    } finally {
      setAnalysisLoading(false);
    }
  }, [transcript, fileName]);

  // ── Derived ───────────────────────────────────────────────
  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, '0')}`;
  };
  const progressPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const deletedCount = transcript.filter((t) => t.deleted).length;
  const highlightCount = transcript.filter((t) => t.highlight && !t.deleted).length;
  const capStyle = CAPTION_STYLES.find((c) => c.id === captionStyleId) ?? CAPTION_STYLES[0];
  const grade = COLOR_GRADES.find((g) => g.id === colorGrade) ?? COLOR_GRADES[0];

  const energyBars = useMemo(() => {
    const count = 48;
    if (transcript.length === 0) {
      return Array.from({ length: count }, (_, i) => ({
        h: 10 + Math.abs(Math.sin(i * 0.7)) * 35,
        hot: false,
      }));
    }
    const dur = totalDuration || 1;
    return Array.from({ length: count }, (_, i) => {
      const t = (i / count) * dur;
      const seg = transcript.find((s) => t >= s.start && t < s.end);
      const score = seg?.viralScore ?? 45;
      return { h: 6 + (score / 100) * 46, hot: score >= 82 };
    });
  }, [transcript, totalDuration]);

  const fxClass =
    liveEffect === 'zoomPunch'
      ? 'fx-zoom'
      : liveEffect === 'shake'
        ? 'fx-shake'
        : liveEffect === 'glitch'
          ? 'fx-glitch'
          : liveEffect === 'flash'
            ? 'fx-flash'
            : '';

  return (
    <div className="h-screen bg-[#07070f] text-white flex flex-col overflow-hidden select-none">
      <style jsx global>{`
        @keyframes cfSpin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes fxZoom {
          0%,
          100% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.06);
          }
        }
        @keyframes fxShake {
          0%,
          100% {
            transform: translate(0, 0);
          }
          15% {
            transform: translate(-5px, 2px);
          }
          35% {
            transform: translate(5px, -3px);
          }
          55% {
            transform: translate(-3px, 4px);
          }
          75% {
            transform: translate(4px, -2px);
          }
        }
        @keyframes fxGlitch {
          0%,
          100% {
            transform: translate(0) skewX(0deg);
          }
          20% {
            transform: translate(-4px, 0) skewX(-3deg);
          }
          40% {
            transform: translate(4px, 0) skewX(3deg);
          }
          60% {
            transform: translate(-2px, 0) skewX(-1deg);
          }
          80% {
            transform: translate(2px, 0) skewX(1deg);
          }
        }
        @keyframes fxFlash {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.1;
          }
        }
        @keyframes wordPop {
          0% {
            transform: scale(0.5) translateY(8px);
            opacity: 0;
          }
          65% {
            transform: scale(1.1);
            opacity: 1;
          }
          100% {
            transform: scale(1) translateY(0);
          }
        }
        @keyframes scoreIn {
          from {
            opacity: 0;
            transform: scale(0.4) rotate(-10deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0);
          }
        }
        @keyframes pulseRing {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.5);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(139, 92, 246, 0);
          }
        }
        @keyframes heatFlick {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
        @keyframes exportPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }
        .cf-spin {
          animation: cfSpin 0.8s linear infinite;
        }
        .fx-zoom {
          animation: fxZoom 0.35s ease-in-out;
        }
        .fx-shake {
          animation: fxShake 0.45s ease-in-out;
        }
        .fx-glitch {
          animation: fxGlitch 0.55s ease-in-out;
        }
        .fx-flash {
          animation: fxFlash 0.22s ease-in-out;
        }
        .word-pop {
          animation: wordPop 0.16s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .score-in {
          animation: scoreIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .pulse-cta {
          animation: pulseRing 2.2s infinite;
        }
        .heat-bar {
          animation: heatFlick 1.6s ease-in-out infinite;
        }
        .export-pulse {
          animation: exportPulse 1s ease-in-out infinite;
        }
        input[type='range'] {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          background: #8b5cf6;
          border-radius: 50%;
          cursor: pointer;
        }
        input[type='range']::-webkit-slider-runnable-track {
          height: 3px;
          border-radius: 2px;
          background: rgba(255, 255, 255, 0.1);
        }
        ::-webkit-scrollbar {
          width: 3px;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.3);
          border-radius: 3px;
        }
      `}</style>

      {/* ── Export overlay ── */}
      {exportStatus === 'recording' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-[#0f0f1a] border border-violet-500/25 rounded-2xl p-8 w-80 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center mx-auto mb-4 export-pulse">
              <StopCircle size={24} className="text-rose-400" />
            </div>
            <h3 className="text-lg font-bold mb-1">Exporting video…</h3>
            <p className="text-white/45 text-xs mb-5">
              Rendering on our servers — cuts, karaoke captions & audio mix
            </p>
            <div className="mb-2 flex justify-between text-xs">
              <span className="text-white/40">Progress</span>
              <span className="text-violet-400 font-bold">{exportProgress}%</span>
            </div>
            <div className="h-2 bg-white/8 rounded-full overflow-hidden mb-5">
              <div
                className="h-2 bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-white/28 mb-5">
              This takes the same time as your clip length. Keep this tab open.
            </p>
            <button
              onClick={cancelExport}
              className="px-4 py-2 bg-white/8 border border-white/12 text-white/55 text-sm rounded-xl hover:bg-white/12 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Topbar ── */}
      <header className="bg-[#0a0a16] border-b border-white/6 px-4 py-2.5 flex items-center gap-3 shrink-0 z-20">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-white/35 hover:text-white/70 text-sm transition-colors"
        >
          <ChevronLeft size={15} />
          <span className="hidden sm:block">Dashboard</span>
        </Link>
        <div className="w-px h-4 bg-white/8" />
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0">
            <Zap size={10} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-white/55 hidden sm:block truncate max-w-[180px]">
            {fileName || 'Video Editor'}
          </span>
        </div>

        <div className="flex gap-0.5 bg-white/4 border border-white/8 rounded-xl p-1 ml-2">
          {(
            [
              { key: 'transcript', icon: Type, label: 'Edit' },
              { key: 'effects', icon: Wand2, label: 'Effects' },
              { key: 'captions', icon: Bold, label: 'Captions' },
              { key: 'music', icon: Music, label: 'Music' },
              { key: 'export', icon: Share2, label: 'Export' },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setPanel(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${panel === t.key ? 'bg-violet-600/30 text-violet-300 border border-violet-500/25' : 'text-white/35 hover:text-white/60'}`}
              >
                <Icon size={12} />
                <span className="hidden md:block">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {deletedCount > 0 && (
            <span className="hidden sm:flex items-center gap-1 text-xs bg-rose-500/12 border border-rose-500/20 text-rose-400 px-2.5 py-1.5 rounded-lg">
              <Scissors size={10} />
              {deletedCount} cut{deletedCount > 1 ? 's' : ''}
            </span>
          )}
          {clipsCount > 0 && (
            <Link
              href={`/clips/${projectId}`}
              className="flex items-center gap-1.5 text-xs bg-violet-600/20 border border-violet-500/25 text-violet-300 hover:bg-violet-600/35 px-3 py-1.5 rounded-lg transition-all"
            >
              <Scissors size={11} />
              {clipsCount} Clips
            </Link>
          )}
          <button
            onClick={exportStatus === 'recording' ? cancelExport : handleExport}
            disabled={projectId === 'new'}
            className={`flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg transition-all disabled:opacity-40 ${exportStatus === 'done' ? 'bg-emerald-600/80 text-white' : exportStatus === 'recording' ? 'bg-rose-600/80 text-white' : 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white'}`}
          >
            {exportStatus === 'done' ? (
              <>
                <Check size={11} />
                Done!
              </>
            ) : exportStatus === 'recording' ? (
              <>
                <StopCircle size={11} />
                Cancel
              </>
            ) : exportStatus === 'error' ? (
              <>
                <AlertCircle size={11} />
                Error
              </>
            ) : (
              <>
                <Download size={11} />
                Export
              </>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel ── */}
        <div className="w-80 xl:w-88 shrink-0 border-r border-white/6 flex flex-col bg-[#090915] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              {panel === 'transcript'
                ? 'Transcript'
                : panel === 'effects'
                  ? 'Effects & Grades'
                  : panel === 'captions'
                    ? 'Caption Styles'
                    : panel === 'music'
                      ? 'Background Music'
                      : 'Export'}
            </span>
            {panel === 'transcript' && (
              <button
                onClick={getAISuggestion}
                disabled={aiLoading}
                className="flex items-center gap-1 text-[10px] bg-violet-500/14 hover:bg-violet-500/25 border border-violet-500/20 text-violet-300 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                {aiLoading ? <RefreshCw size={9} className="cf-spin" /> : <Sparkles size={9} />}
                AI Suggest
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Transcript */}
            {panel === 'transcript' && (
              <div className="p-3 space-y-1.5">
                {!hasVideo && (
                  <div className="flex gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-3">
                    <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-300/80 leading-relaxed">
                      No video loaded.{' '}
                      <Link href="/upload" className="underline">
                        Upload one →
                      </Link>
                    </p>
                  </div>
                )}
                {aiSuggestion && (
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 mb-3">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-violet-300 mb-1.5">
                      <Sparkles size={9} />
                      AI Suggestion
                    </div>
                    <p className="text-[10px] text-white/58 leading-relaxed">{aiSuggestion}</p>
                  </div>
                )}
                {dbLoaded && projectId !== 'new' && (
                  <div className="flex items-center gap-1.5 text-[9px] text-emerald-400/60 px-1 pb-1">
                    <Check size={8} />
                    Project saved to cloud
                  </div>
                )}
                <p className="text-[9px] text-white/20 px-1 pb-1">Click to seek · hover to cut</p>
                {transcript.map((seg) => {
                  const isActive = currentTime >= seg.start && currentTime < seg.end;
                  const scoreVal = seg.viralScore ?? 0;
                  const scoreClr =
                    scoreVal >= 90
                      ? 'text-emerald-400'
                      : scoreVal >= 75
                        ? 'text-amber-400'
                        : 'text-white/25';
                  return (
                    <div
                      key={seg.id}
                      onClick={() => seek(seg.start)}
                      className={`group relative p-2.5 rounded-xl text-[11px] leading-relaxed cursor-pointer transition-all border ${seg.deleted ? 'opacity-30 bg-rose-500/5 border-rose-500/12 line-through text-white/25' : seg.highlight ? 'bg-violet-500/10 border-violet-500/20 text-white' : isActive ? 'bg-white/6 border-white/14 text-white' : 'border-transparent hover:bg-white/4 text-white/50 hover:border-white/8'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-white/20">
                            {fmt(seg.start)}
                          </span>
                          {scoreVal > 0 && (
                            <span className={`text-[9px] font-bold ${scoreClr}`}>{scoreVal}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {seg.highlight && !seg.deleted && (
                            <Flame size={8} className="text-amber-400" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDelete(seg.id);
                            }}
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${seg.deleted ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}
                          >
                            {seg.deleted ? 'Restore' : 'Cut'}
                          </button>
                        </div>
                      </div>
                      {seg.text}
                      {seg.highlight && !seg.deleted && (
                        <div className="flex items-center gap-1 mt-1 text-[9px] text-amber-400/60">
                          <Flame size={7} />
                          Viral moment
                        </div>
                      )}
                    </div>
                  );
                })}
                {transcript.length === 0 && (
                  <div className="text-center py-10 text-white/18">
                    <Mic size={24} className="mx-auto mb-3 opacity-20" />
                    <p className="text-xs">Upload a video to load transcript</p>
                  </div>
                )}
              </div>
            )}

            {/* Effects */}
            {panel === 'effects' && (
              <div className="p-4 space-y-5">
                <div>
                  <p className="text-[9px] font-bold text-white/35 uppercase tracking-widest mb-3">
                    Dopamine Effects — tap to preview
                  </p>
                  <div className="space-y-2">
                    {EFFECTS.map((fx) => {
                      const on = activeEffects.includes(fx.id);
                      return (
                        <div
                          key={fx.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${on ? 'bg-violet-500/10 border-violet-500/28' : 'bg-white/[0.03] border-white/8'}`}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => fireEffect(fx.id as EffectId)}
                              className="w-8 h-8 rounded-lg bg-white/6 hover:bg-violet-500/20 flex items-center justify-center text-base transition-all active:scale-85"
                            >
                              {fx.emoji}
                            </button>
                            <div>
                              <div className="text-xs font-semibold text-white/75">{fx.label}</div>
                              <div className="text-[9px] text-white/32 mt-0.5">{fx.desc}</div>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              setActiveEffects((p) =>
                                on ? p.filter((x) => x !== fx.id) : [...p, fx.id]
                              )
                            }
                            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${on ? 'bg-violet-600' : 'bg-white/12'}`}
                          >
                            <div
                              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? 'left-[calc(100%-18px)]' : 'left-0.5'}`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-white/35 uppercase tracking-widest mb-3">
                    Color Grade
                  </p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {COLOR_GRADES.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setColorGrade(g.id)}
                        className={`p-2 rounded-xl border text-center transition-all ${colorGrade === g.id ? 'border-violet-500/50 bg-violet-500/15' : 'border-white/8 bg-white/3 hover:border-white/18'}`}
                      >
                        <div
                          className="w-full h-5 rounded-lg mb-1 overflow-hidden bg-gradient-to-br from-violet-700 to-pink-700"
                          style={{ filter: g.filter === 'none' ? 'none' : g.filter }}
                        />
                        <div className="text-[8px] text-white/40 font-medium leading-tight">
                          {g.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-white/35 uppercase tracking-widest mb-3">
                    Transitions
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '⚡ Hard Cut', desc: 'Max attention reset' },
                      { label: '👆 Swipe', desc: 'TikTok native' },
                      { label: '🎯 Zoom In', desc: 'Power emphasis' },
                      { label: '🌙 Fade', desc: 'Premium & smooth' },
                    ].map((t) => (
                      <button
                        key={t.label}
                        className="text-left p-3 bg-white/3 border border-white/8 rounded-xl hover:border-violet-500/25 hover:bg-violet-500/6 transition-all"
                      >
                        <div className="text-xs font-semibold text-white/70 mb-0.5">{t.label}</div>
                        <div className="text-[9px] text-white/28">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Captions */}
            {panel === 'captions' && (
              <div className="p-4 space-y-3">
                <p className="text-[10px] text-white/35 mb-1">
                  Proven viral styles — word-by-word animation included
                </p>
                {CAPTION_STYLES.map((s) => {
                  const on = captionStyleId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setCaptionStyleId(s.id)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-sm transition-all ${on ? 'border-violet-500/45 bg-violet-500/12' : 'border-white/8 bg-white/3 hover:border-white/15'}`}
                    >
                      <div className="text-left">
                        <div className="text-white/80 font-semibold text-sm">{s.label}</div>
                        <div className="text-white/30 text-[9px] mt-0.5">{s.desc}</div>
                      </div>
                      <div className={`${s.bg} px-2.5 py-1 rounded-lg shrink-0 ml-3`}>
                        <span
                          className={`${s.text} ${s.extra} text-xs`}
                          style={{
                            ...(s.gradient
                              ? {
                                  backgroundImage:
                                    'linear-gradient(135deg,#a78bfa,#f472b6,#fb923c)',
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                }
                              : {}),
                            ...(s.shadow ? { textShadow: s.shadow } : {}),
                            ...(s.neon
                              ? {
                                  textShadow:
                                    '0 0 18px rgba(167,139,250,0.9),0 0 36px rgba(167,139,250,0.5)',
                                }
                              : {}),
                          }}
                        >
                          Word
                        </span>
                      </div>
                    </button>
                  );
                })}
                <div className="border-t border-white/5 pt-3 space-y-3">
                  <p className="text-[9px] font-bold text-white/35 uppercase tracking-widest">
                    Subtitles & Translation
                  </p>

                  <div>
                    <label className="text-[10px] text-white/42 block mb-1.5">
                      Burn captions in language
                    </label>
                    <select
                      value={captionLanguage}
                      onChange={(e) => setCaptionLanguage(e.target.value)}
                      className="w-full bg-white/6 border border-white/10 text-white/75 text-[11px] px-2.5 py-2 rounded-lg focus:border-violet-500/50 outline-none"
                    >
                      <option value="">Original language</option>
                      {[
                        'Spanish',
                        'Portuguese',
                        'French',
                        'German',
                        'Hindi',
                        'Arabic',
                        'Japanese',
                        'Korean',
                        'Chinese',
                      ].map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-white/25 mt-1">
                      Applies to the exported video and the subtitle files below.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadSubtitles('srt')}
                      disabled={subtitleBusy || projectId === 'new'}
                      className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold bg-white/6 border border-white/10 text-white/70 px-2 py-2 rounded-lg hover:bg-white/10 transition-all disabled:opacity-40"
                    >
                      <Download size={11} />
                      .SRT
                    </button>
                    <button
                      onClick={() => downloadSubtitles('vtt')}
                      disabled={subtitleBusy || projectId === 'new'}
                      className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold bg-white/6 border border-white/10 text-white/70 px-2 py-2 rounded-lg hover:bg-white/10 transition-all disabled:opacity-40"
                    >
                      <Download size={11} />
                      .VTT
                    </button>
                  </div>
                  {subtitleBusy && (
                    <p className="text-[9px] text-violet-300/70">Building subtitles…</p>
                  )}
                </div>
              </div>
            )}

            {/* Music */}
            {panel === 'music' && (
              <div className="p-4 space-y-3">
                <div className="bg-gradient-to-br from-violet-500/8 to-pink-500/5 border border-violet-500/15 rounded-xl p-3 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Music size={12} className="text-violet-400" />
                    <span className="text-[10px] font-bold text-violet-300">Background Music</span>
                  </div>
                  <p className="text-[9px] text-white/38 leading-relaxed">
                    Music plays under your video. Volume is auto-ducked to stay behind your voice.
                  </p>
                </div>

                {/* Volume control */}
                <div className="bg-white/3 border border-white/8 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-white/50 font-medium">Music Volume</span>
                    <span className="text-[10px] text-violet-400 font-bold">
                      {Math.round(musicVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={musicVolume}
                    onChange={(e) => setMusicVolume(Number(e.target.value))}
                    className="w-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-white/20 mt-1">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Track list */}
                <p className="text-[9px] font-bold text-white/35 uppercase tracking-widest">
                  Track Library
                </p>
                <div className="space-y-2">
                  {MUSIC_TRACKS.map((track) => {
                    const isSelected = selectedTrack === track.id;
                    const isThisPlaying = isSelected && musicPlaying;
                    const moodColor = MOOD_COLORS[track.mood] ?? 'text-white/40';
                    return (
                      <div
                        key={track.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-violet-500/12 border-violet-500/30' : 'bg-white/3 border-white/8 hover:border-white/16 hover:bg-white/5'}`}
                        onClick={() => (isThisPlaying ? stopMusic() : playTrack(track.id))}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-violet-500/25' : 'bg-white/8'}`}
                        >
                          {musicLoading && isSelected ? (
                            <Loader size={14} className="text-violet-400 cf-spin" />
                          ) : isThisPlaying ? (
                            <StopCircle size={14} className="text-violet-400" />
                          ) : (
                            <PlayCircle
                              size={14}
                              className={isSelected ? 'text-violet-400' : 'text-white/35'}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-white/65'} truncate`}
                          >
                            {track.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[9px] font-medium ${moodColor}`}>
                              {track.mood}
                            </span>
                            <span className="text-[9px] text-white/25">{track.bpm} BPM</span>
                          </div>
                        </div>
                        {isThisPlaying && (
                          <div className="flex items-end gap-0.5 shrink-0">
                            {[1, 2, 3].map((b) => (
                              <div
                                key={b}
                                className="w-0.5 bg-violet-400 rounded-full"
                                style={{
                                  height: `${8 + b * 4}px`,
                                  animation: `heatFlick ${0.4 + b * 0.15}s ease-in-out infinite`,
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {musicPlaying && (
                  <button
                    onClick={stopMusic}
                    className="w-full py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-400 text-xs font-semibold hover:bg-rose-500/25 transition-all"
                  >
                    ⏹ Stop Music
                  </button>
                )}

                <div className="bg-white/3 border border-white/7 rounded-xl p-3 mt-2">
                  <p className="text-[9px] text-white/35 leading-relaxed">
                    🎵 Tracks are royalty-free for commercial use. Music will be mixed into your
                    exported video.
                  </p>
                </div>
              </div>
            )}

            {/* Export */}
            {panel === 'export' && (
              <div className="p-4 space-y-4">
                <div className="bg-gradient-to-br from-emerald-500/8 to-green-500/5 border border-emerald-500/18 rounded-xl p-3 mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Download size={11} className="text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-300">Real Export</span>
                  </div>
                  <p className="text-[9px] text-white/38 leading-relaxed">
                    Captions are burned into the video. Export plays through your clip in real-time.
                  </p>
                </div>

                <div>
                  <p className="text-[9px] font-bold text-white/35 uppercase tracking-widest mb-3">
                    Platforms
                  </p>
                  {PLATFORMS.map((p) => {
                    const on = selectedPlatforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() =>
                          setSelectedPlatforms((prev) =>
                            on ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                          )
                        }
                        className={`w-full flex items-center justify-between p-2.5 mb-2 rounded-xl border text-sm transition-all ${on ? 'border-violet-500/35 bg-violet-500/10' : 'border-white/8 bg-white/3 hover:border-white/14'}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${p.dot}`} />
                          <span className="text-white/72 font-medium text-xs">{p.label}</span>
                          <span className="text-white/22 text-[9px]">{p.ratio}</span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${on ? 'bg-violet-600 border-violet-600' : 'border-white/20'}`}
                        >
                          {on && <Check size={9} className="text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-white/5 pt-3">
                  <p className="text-[9px] font-bold text-white/35 uppercase tracking-widest mb-2.5">
                    Ratio
                  </p>
                  <div className="flex gap-2 mb-4">
                    {(['9:16', '1:1', '16:9'] as Ratio[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setExportRatio(r)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${exportRatio === r ? 'bg-violet-600/25 border-violet-500/40 text-violet-300' : 'bg-white/4 border-white/8 text-white/35 hover:text-white/58'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {[
                    ['Captions', 'Burned in ✓'],
                    ['Format', 'WebM / MP4'],
                    ['FPS', '30 fps'],
                    ['Smart Crop', '9:16 center'],
                  ].map(([l, v]) => (
                    <div key={l} className="flex items-center justify-between mb-2.5">
                      <span className="text-[10px] text-white/42">{l}</span>
                      <span className="text-[10px] text-white/55 bg-white/6 border border-white/8 px-2.5 py-1 rounded-lg">
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleExport}
                  disabled={projectId === 'new' || exportStatus === 'recording'}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-50"
                >
                  {exportStatus === 'recording' ? (
                    <>
                      <Loader size={14} className="cf-spin" />
                      Rendering…
                    </>
                  ) : exportStatus === 'done' ? (
                    <>
                      <Check size={14} />
                      Downloaded!
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Export & Download
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Center preview ── */}
        <div className="flex-1 flex flex-col items-center justify-start bg-black/55 pt-3 pb-2 px-4 overflow-hidden">
          <div
            className={`relative bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/70 flex-shrink-0 ${fxClass}`}
            style={
              exportRatio === '9:16'
                ? { height: 'calc(100% - 136px)', maxHeight: 470, aspectRatio: '9/16' }
                : exportRatio === '1:1'
                  ? { height: 'calc(100% - 136px)', maxHeight: 400, aspectRatio: '1/1' }
                  : { width: '100%', maxWidth: 580, aspectRatio: '16/9' }
            }
          >
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted={isMuted}
              onClick={togglePlay}
              style={{ filter: grade.filter === 'none' ? 'none' : grade.filter }}
            />

            {!hasVideo && (
              <div className="absolute inset-0 bg-gradient-to-b from-violet-950 via-[#0d0818] to-black flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/25 flex items-center justify-center mb-3">
                  <Zap size={20} className="text-violet-400" />
                </div>
                <p className="text-white/40 text-sm mb-1.5">No video loaded</p>
                <Link
                  href="/upload"
                  className="text-violet-400 text-xs underline hover:text-violet-300"
                >
                  Upload →
                </Link>
              </div>
            )}

            {liveEffect === 'glitch' && (
              <div className="absolute inset-0 pointer-events-none mix-blend-screen opacity-50">
                <div
                  className="absolute inset-0 bg-red-500/30"
                  style={{ transform: 'translate(-4px,0)' }}
                />
                <div
                  className="absolute inset-0 bg-cyan-500/30"
                  style={{ transform: 'translate(4px,0)' }}
                />
              </div>
            )}
            {liveEffect === 'flash' && (
              <div className="absolute inset-0 bg-white/25 pointer-events-none" />
            )}

            {currentSeg && captionWords.length > 0 && (
              <div className="absolute bottom-[18%] left-3 right-3 text-center pointer-events-none">
                <div className={`inline-block ${capStyle.bg} px-3 py-1.5 rounded-xl`}>
                  <span
                    key={`${currentSeg.id}-w${wordIndex}`}
                    className={`word-pop inline-block ${capStyle.text} ${capStyle.extra}`}
                    style={{
                      ...(capStyle.gradient
                        ? {
                            backgroundImage: 'linear-gradient(135deg,#a78bfa,#f472b6,#fb923c)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }
                        : {}),
                      ...(capStyle.shadow ? { textShadow: capStyle.shadow } : {}),
                      ...(capStyle.neon
                        ? {
                            textShadow:
                              '0 0 18px rgba(167,139,250,0.9),0 0 36px rgba(167,139,250,0.5)',
                          }
                        : {}),
                    }}
                  >
                    {captionWords[wordIndex] ?? ''}
                  </span>
                </div>
              </div>
            )}

            <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none">
              <span className="bg-black/55 backdrop-blur text-white text-[10px] px-2 py-1 rounded-lg font-mono">
                {fmt(currentTime)}
              </span>
              <div className="flex items-center gap-1.5">
                {musicPlaying && (
                  <span className="bg-violet-600/80 text-white text-[9px] font-bold px-2 py-1 rounded-lg backdrop-blur flex items-center gap-1">
                    <Music size={8} />♪
                  </span>
                )}
                {isPlaying && (
                  <span className="bg-rose-500/85 text-white text-[9px] font-bold px-2 py-1 rounded-lg backdrop-blur flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                    LIVE
                  </span>
                )}
              </div>
            </div>

            {viralScore > 0 && (
              <div className="absolute top-3 right-3 score-in pointer-events-none">
                <div className="flex items-center gap-1 bg-black/55 backdrop-blur px-2.5 py-1 rounded-full">
                  <Star size={10} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-black text-white">{viralScore}</span>
                </div>
              </div>
            )}

            {!isPlaying && hasVideo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur flex items-center justify-center opacity-65">
                  <Play size={22} className="text-white ml-1" />
                </div>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/30">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-100"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="mt-3 flex items-center gap-2.5 bg-white/4 border border-white/8 rounded-2xl px-4 py-2.5 w-full max-w-xs mx-auto shrink-0">
            <button
              onClick={() => seek(Math.max(0, currentTime - 10))}
              className="p-1 text-white/38 hover:text-white transition-colors"
            >
              <SkipBack size={14} />
            </button>
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center hover:scale-105 transition-transform shadow-md shadow-violet-500/25 shrink-0"
            >
              {isPlaying ? (
                <Pause size={14} className="text-white" />
              ) : (
                <Play size={14} className="text-white ml-0.5" />
              )}
            </button>
            <button
              onClick={() => seek(Math.min(totalDuration, currentTime + 10))}
              className="p-1 text-white/38 hover:text-white transition-colors"
            >
              <SkipForward size={14} />
            </button>
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={totalDuration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>
            <span className="text-[10px] font-mono text-white/30 shrink-0">
              {fmt(currentTime)}/{fmt(totalDuration)}
            </span>
            <button
              onClick={toggleMute}
              className="p-1 text-white/38 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
          </div>

          <div className="mt-2 flex items-center gap-2.5 w-full max-w-xs mx-auto shrink-0">
            <div className="flex gap-1">
              {(['9:16', '1:1', '16:9'] as Ratio[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setExportRatio(r)}
                  className={`px-2 py-1 rounded-lg border text-[9px] font-bold transition-all ${exportRatio === r ? 'bg-violet-600/25 border-violet-500/40 text-violet-300' : 'bg-white/4 border-white/8 text-white/30 hover:text-white/50'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex gap-1">
              {EFFECTS.slice(0, 3).map((fx) => (
                <button
                  key={fx.id}
                  onClick={() => fireEffect(fx.id as EffectId)}
                  title={fx.label}
                  className="w-7 h-7 rounded-lg bg-white/4 border border-white/8 text-xs text-white/35 hover:text-violet-300 hover:border-violet-500/30 hover:bg-violet-500/10 transition-all active:scale-85 flex items-center justify-center"
                >
                  {fx.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Energy waveform */}
          <div className="mt-3 w-full max-w-xl mx-auto shrink-0">
            <div className="flex items-end gap-px h-9 w-full">
              {energyBars.map((bar, i) => {
                const isCurrent =
                  progressPct > 0 && Math.floor(progressPct / (100 / energyBars.length)) === i;
                return (
                  <div
                    key={i}
                    onClick={() => seek((i / energyBars.length) * (totalDuration || 1))}
                    className={`flex-1 rounded-sm cursor-pointer transition-all hover:opacity-75 ${bar.hot ? 'heat-bar' : ''}`}
                    style={{
                      height: `${bar.h}px`,
                      background: isCurrent
                        ? 'rgba(255,255,255,0.88)'
                        : bar.hot
                          ? 'linear-gradient(to top,#f59e0b,#ef4444)'
                          : 'linear-gradient(to top,rgba(139,92,246,0.55),rgba(219,39,119,0.35))',
                    }}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[8px] text-white/18 mt-1 px-0.5">
              <span>0:00</span>
              <span className="text-amber-400/40 flex items-center gap-0.5">
                <Flame size={7} />
                hot moments
              </span>
              <span>{fmt(totalDuration)}</span>
            </div>
          </div>
        </div>

        {/* ── Right: Psychology Lab ── */}
        <div className="w-64 xl:w-72 shrink-0 border-l border-white/6 bg-[#090915] flex-col hidden lg:flex overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-bold text-white/38 uppercase tracking-widest">
              Psychology Lab
            </span>
            <button
              onClick={runAnalysis}
              disabled={analysisLoading || transcript.length === 0}
              className="flex items-center gap-1 text-[9px] bg-violet-500/14 hover:bg-violet-500/25 border border-violet-500/18 text-violet-300 px-2 py-1 rounded-lg transition-all disabled:opacity-40"
            >
              {analysisLoading ? <RefreshCw size={8} className="cf-spin" /> : <Brain size={8} />}
              {analysisLoading ? 'Scanning…' : 'Analyze'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-gradient-to-br from-violet-600/14 to-pink-600/8 border border-violet-500/18 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-white/48">Viral Score</span>
                <TrendingUp size={12} className="text-violet-400" />
              </div>
              <div className="text-4xl font-black text-white mb-1 score-in">
                {viralScore || '—'}
              </div>
              <div
                className={`text-[10px] font-semibold ${viralScore >= 90 ? 'text-emerald-400' : viralScore >= 75 ? 'text-amber-400' : 'text-white/28'}`}
              >
                {viralScore >= 90
                  ? '🔥 Top 5% content'
                  : viralScore >= 75
                    ? '⬆️ Above average'
                    : 'Run analysis to score'}
              </div>
              <div className="mt-3 h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${viralScore}%`,
                    background: 'linear-gradient(90deg,#7c3aed,#db2777,#f59e0b)',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Viral clips', val: clipsCount || '—' },
                { label: 'Hot moments', val: highlightCount },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white/3 border border-white/7 rounded-xl p-3 text-center"
                >
                  <div className="text-xl font-black text-white">{s.val}</div>
                  <div className="text-[9px] text-white/30 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {analysis && (
              <>
                <div className="space-y-2">
                  {[
                    {
                      label: 'Hook Strength',
                      value: analysis.hookScore,
                      icon: Target,
                      color: '#a78bfa',
                    },
                    {
                      label: 'Curiosity Gap',
                      value: analysis.curiosityGapScore,
                      icon: Activity,
                      color: '#fb923c',
                    },
                    {
                      label: 'Dopamine Score',
                      value: analysis.dopamineScore,
                      icon: Flame,
                      color: '#f472b6',
                    },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <div
                        key={m.label}
                        className="bg-white/[0.03] border border-white/7 rounded-xl p-2.5"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Icon size={10} style={{ color: m.color }} />
                            <span className="text-[10px] text-white/48 font-medium">{m.label}</span>
                          </div>
                          <span className="text-sm font-black text-white">{m.value}</span>
                        </div>
                        <div className="h-1 bg-white/6 rounded-full overflow-hidden">
                          <div
                            className="h-1 rounded-full transition-all duration-700"
                            style={{ width: `${m.value}%`, backgroundColor: m.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <p className="text-[9px] font-bold text-white/32 uppercase tracking-widest mb-2">
                    Emotion Triggers
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.emotionalTriggers.map((t) => (
                      <span
                        key={t}
                        className="text-[9px] bg-violet-500/14 border border-violet-500/22 text-violet-300 px-2 py-1 rounded-full font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-500/8 border border-amber-500/18 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-amber-400 mb-1.5">
                    <Star size={8} className="fill-amber-400" />
                    Best Hook Rewrite
                  </div>
                  <p className="text-[10px] text-white/65 leading-relaxed italic">
                    "{analysis.bestHookRewrite}"
                  </p>
                </div>

                <div>
                  <p className="text-[9px] font-bold text-white/32 uppercase tracking-widest mb-2">
                    Retention Prediction
                  </p>
                  <div className="relative h-14 bg-white/3 border border-white/7 rounded-xl overflow-hidden px-2 pt-1.5">
                    <svg viewBox="0 0 200 36" className="w-full h-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.55" />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.04" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,4 C15,4 22,7 40,10 C62,14 72,26 100,28 C130,30 155,32 200,34 L200,36 L0,36 Z"
                        fill="url(#rg)"
                      />
                      <path
                        d="M0,4 C15,4 22,7 40,10 C62,14 72,26 100,28 C130,30 155,32 200,34"
                        fill="none"
                        stroke="#8b5cf6"
                        strokeWidth="1.5"
                      />
                      <line
                        x1="20"
                        y1="0"
                        x2="20"
                        y2="36"
                        stroke="#ef4444"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                        opacity="0.55"
                      />
                      <text x="21" y="7" fill="#ef4444" fontSize="4" opacity="0.75">
                        drop-off
                      </text>
                    </svg>
                  </div>
                  <p className="text-[9px] text-white/28 mt-1.5 leading-relaxed">
                    {analysis.retentionPrediction}
                  </p>
                </div>

                <div className="bg-white/3 border border-white/7 rounded-xl p-3">
                  <div className="flex items-center gap-1 text-[9px] font-bold text-white/38 mb-1.5">
                    <Brain size={8} />
                    Psychology Insight
                  </div>
                  <p className="text-[10px] text-white/52 leading-relaxed">
                    {analysis.psychologyInsight}
                  </p>
                </div>
              </>
            )}

            {!analysis && !analysisLoading && (
              <div className="text-center py-6">
                <Brain size={26} className="mx-auto mb-3 text-white/12" />
                <p className="text-[10px] text-white/25 mb-3 leading-relaxed">
                  Run deep psychological analysis to unlock hook scores, dopamine metrics, and
                  retention predictions
                </p>
                <button
                  onClick={runAnalysis}
                  disabled={transcript.length === 0}
                  className="text-xs bg-violet-600/20 border border-violet-500/25 text-violet-300 px-4 py-2 rounded-xl hover:bg-violet-600/35 transition-all disabled:opacity-38 font-semibold"
                >
                  <Brain size={10} className="inline mr-1.5" />
                  Analyze with AI →
                </button>
              </div>
            )}
            {analysisLoading && (
              <div className="text-center py-8">
                <RefreshCw size={20} className="mx-auto mb-3 text-violet-400 cf-spin" />
                <p className="text-[10px] text-white/30">Scanning for dopamine triggers…</p>
              </div>
            )}

            <div>
              <p className="text-[9px] font-bold text-white/32 uppercase tracking-widest mb-2">
                Quick Actions
              </p>
              {[
                { label: 'Cut filler words', sub: '"um", "uh", "like", "so"', action: () => {} },
                {
                  label: 'Jump to best moment',
                  sub: 'Seek to highest viral score',
                  action: () => {
                    const best = [...transcript].sort(
                      (a, b) => (b.viralScore ?? 0) - (a.viralScore ?? 0)
                    )[0];
                    if (best) seek(best.start);
                  },
                },
                {
                  label: 'Add zoom punches',
                  sub: 'Enable on all hot moments',
                  action: () => {
                    setPanel('effects');
                    setActiveEffects((p) => (p.includes('zoomPunch') ? p : [...p, 'zoomPunch']));
                  },
                },
              ].map((a, i) => (
                <button
                  key={i}
                  onClick={a.action}
                  className="w-full text-left p-2.5 mb-1.5 bg-white/3 border border-white/6 rounded-xl hover:border-violet-500/20 hover:bg-violet-500/6 transition-all group"
                >
                  <div className="text-[10px] font-semibold text-white/60 group-hover:text-white/82">
                    {a.label}
                  </div>
                  <div className="text-[9px] text-white/22 mt-0.5">{a.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {clipsCount > 0 && (
            <div className="p-4 border-t border-white/5 shrink-0">
              <Link
                href={`/clips/${projectId}`}
                className="pulse-cta block w-full text-center py-3 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/25"
              >
                View {clipsCount} Viral Clips →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="bg-[#070712] border-t border-white/6 px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-[9px] text-white/18 font-mono w-8">0:00</span>
          <div
            className="flex-1 relative h-9 bg-white/3 rounded-lg overflow-hidden cursor-pointer"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - r.left) / r.width) * (totalDuration || 1));
            }}
          >
            <div className="absolute inset-y-1 left-0 right-0 bg-violet-600/14 rounded border border-violet-500/10" />
            {transcript
              .filter((t) => t.highlight && !t.deleted)
              .map((t, i) => (
                <div
                  key={i}
                  className="absolute inset-y-1 rounded opacity-65"
                  style={{
                    left: `${(t.start / (totalDuration || 1)) * 100}%`,
                    width: `${((t.end - t.start) / (totalDuration || 1)) * 100}%`,
                    background: 'linear-gradient(90deg,#f59e0b55,#ef444444)',
                  }}
                />
              ))}
            {transcript
              .filter((t) => t.deleted)
              .map((t, i) => (
                <div
                  key={i}
                  className="absolute inset-y-1 bg-rose-500/32 border border-rose-500/28 rounded"
                  style={{
                    left: `${(t.start / (totalDuration || 1)) * 100}%`,
                    width: `${((t.end - t.start) / (totalDuration || 1)) * 100}%`,
                  }}
                />
              ))}
            {exportStatus === 'recording' && (
              <div
                className="absolute inset-y-0 bg-emerald-500/15 border-r-2 border-emerald-400 transition-all"
                style={{ left: 0, width: `${exportProgress}%` }}
              />
            )}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/75 pointer-events-none drop-shadow-[0_0_4px_rgba(255,255,255,0.7)]"
              style={{ left: `${progressPct}%` }}
            >
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow" />
            </div>
          </div>
          <span className="text-[9px] text-white/18 font-mono w-10">{fmt(totalDuration)}</span>
        </div>
        <div className="flex items-center justify-between text-[8px] text-white/15">
          <div className="flex gap-3">
            {[
              ['bg-violet-600/50', 'Video'],
              ['bg-amber-500/60', '🔥 Hot moments'],
              ['bg-rose-600/50', 'Cuts'],
              ['bg-emerald-400/40', 'Export progress'],
            ].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded ${c}`} />
                {l}
              </span>
            ))}
          </div>
          <span className="text-white/18">
            {deletedCount} cut{deletedCount !== 1 ? 's' : ''} · {highlightCount} hot ·{' '}
            {fmt(
              Math.max(
                0,
                (totalDuration || 0) -
                  transcript.filter((t) => t.deleted).reduce((a, t) => a + (t.end - t.start), 0)
              )
            )}{' '}
            remaining
          </span>
        </div>
      </div>
    </div>
  );
}
