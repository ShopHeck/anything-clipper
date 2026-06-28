'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Zap,
  ChevronLeft,
  Play,
  CheckCircle,
  AlertCircle,
  Download,
  RefreshCw,
  Sparkles,
  Video,
  FileText,
  Mic,
  Image as ImageIcon,
  Layers,
  Film,
} from 'lucide-react';
import { useSession } from '@/lib/auth-client';

type UGCStatus =
  | 'scraping'
  | 'generating_script'
  | 'generating_tts'
  | 'generating_assets'
  | 'planning_scenes'
  | 'composing'
  | 'completed'
  | 'failed';

interface UGCJob {
  id: string;
  status: UGCStatus;
  productUrl: string;
  productData: Record<string, unknown> | null;
  script: {
    hook?: string;
    keyPoints?: string;
    cta?: string;
  } | null;
  ttsAudioUrl: string | null;
  videoAssets: Record<string, unknown> | null;
  videoUrl: string | null;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

type Voice = 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer';
type TemplateStyle = 'pov' | 'storytime' | 'bold-hook' | 'authentic';

const VOICES: { value: Voice; label: string }[] = [
  { value: 'nova', label: 'Nova' },
  { value: 'alloy', label: 'Alloy' },
  { value: 'echo', label: 'Echo' },
  { value: 'fable', label: 'Fable' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'shimmer', label: 'Shimmer' },
];

const TEMPLATES: { value: TemplateStyle; label: string }[] = [
  { value: 'authentic', label: 'Authentic' },
  { value: 'pov', label: 'POV' },
  { value: 'storytime', label: 'Storytime' },
  { value: 'bold-hook', label: 'Bold Hook' },
];

const PIPELINE_STAGES: { key: UGCStatus; label: string; icon: typeof Play }[] = [
  { key: 'scraping', label: 'Scraping product data', icon: FileText },
  { key: 'generating_script', label: 'Generating script', icon: Sparkles },
  { key: 'generating_tts', label: 'Creating voiceover', icon: Mic },
  { key: 'generating_assets', label: 'Generating visuals', icon: ImageIcon },
  { key: 'planning_scenes', label: 'Planning scenes', icon: Layers },
  { key: 'composing', label: 'Composing video', icon: Film },
  { key: 'completed', label: 'Done!', icon: CheckCircle },
];

const SCRIPT_SECTIONS: { key: string; label: string }[] = [
  { key: 'hook', label: 'Hook' },
  { key: 'keyPoints', label: 'Key Points' },
  { key: 'cta', label: 'CTA' },
];

export default function UGCPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();

  const [url, setUrl] = useState('');
  const [voice, setVoice] = useState<Voice>('nova');
  const [templateStyle, setTemplateStyle] = useState<TemplateStyle>('authentic');
  const [jobId, setJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [lastStatusChange, setLastStatusChange] = useState<number | null>(null);
  const [lastSeenStatus, setLastSeenStatus] = useState<UGCStatus | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!sessionPending && !session?.user) {
      router.push('/account/signin');
    }
  }, [session, sessionPending, router]);

  // Poll the UGC job status
  const {
    data: job,
    error: pollError,
  } = useQuery<UGCJob>({
    queryKey: ['ugc-job', jobId],
    queryFn: async () => {
      const res = await fetch(`/api/ugc/${jobId}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch job status (${res.status})`);
      }
      return res.json();
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 2500;
    },
  });

  // Staleness detection: if status hasn't changed in 30+ seconds, show a message
  useEffect(() => {
    if (!job) return;
    const currentStatus = job.status;
    if (currentStatus === 'completed' || currentStatus === 'failed') {
      setIsStale(false);
      return;
    }
    if (currentStatus !== lastSeenStatus) {
      setLastSeenStatus(currentStatus);
      setLastStatusChange(Date.now());
      setIsStale(false);
    }
  }, [job, lastSeenStatus]);

  useEffect(() => {
    if (!lastStatusChange || !jobId) return;
    if (job?.status === 'completed' || job?.status === 'failed') return;

    const timer = setInterval(() => {
      const elapsed = Date.now() - lastStatusChange;
      if (elapsed >= 30_000) {
        setIsStale(true);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [lastStatusChange, jobId, job?.status]);

  const handleGenerate = useCallback(async () => {
    if (!url.trim()) {
      setSubmitError('Please enter a product URL');
      return;
    }

    try {
      new URL(url);
    } catch {
      setSubmitError('Please enter a valid URL');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);
    setJobId(null);

    try {
      // Step 1: Create the UGC project
      const createRes = await fetch('/api/ugc/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url, voice, templateStyle }),
      });

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create UGC project (${createRes.status})`);
      }

      const { jobId: newJobId } = await createRes.json();
      setJobId(newJobId);
      setLastStatusChange(Date.now());
      setLastSeenStatus(null);
      setIsStale(false);

      // Step 2: Kick off processing
      const processRes = await fetch(`/api/ugc/${newJobId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ voice, templateStyle }),
      });

      if (!processRes.ok) {
        const processData = await processRes.json().catch(() => ({}));
        const processError =
          processData.error || `Failed to start processing (${processRes.status})`;
        setSubmitError(processError);
        toast.error(processError);
        setJobId(null);
        return;
      }

      toast.success('UGC generation started!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [url, voice, templateStyle]);

  const handleRetry = useCallback(() => {
    setJobId(null);
    setSubmitError('');
    setLastStatusChange(null);
    setLastSeenStatus(null);
    setIsStale(false);
  }, []);

  // Determine current stage index for progress display
  const currentStageIdx = job
    ? PIPELINE_STAGES.findIndex((s) => s.key === job.status)
    : -1;

  // Don't render until we know auth state
  if (sessionPending) {
    return (
      <div className="min-h-screen bg-[#07070f] text-white flex items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-violet-400" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#07070f] text-white px-6 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
          >
            <ChevronLeft size={16} /> Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm">
              ClipForge <span className="text-violet-400">AI</span>
            </span>
          </div>
          <div className="w-20" />
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-black mb-3">Create UGC Video</h1>
          <p className="text-white/45 text-lg leading-relaxed max-w-lg mx-auto">
            Paste a product URL and our AI will generate a complete UGC-style video with script,
            voiceover, and visuals.
          </p>
        </div>

        {/* Input form - only show when no active job */}
        {!jobId && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 mb-6">
            {/* Product URL */}
            <label className="block text-sm font-medium text-white/55 mb-2">Product URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setSubmitError('');
              }}
              placeholder="https://www.tiktokshop.com/product/..."
              className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 transition-all mb-5"
            />

            {/* Voice and Template selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-white/55 mb-2">Voice</label>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value as Voice)}
                  className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40 transition-all appearance-none cursor-pointer"
                >
                  {VOICES.map((v) => (
                    <option key={v.value} value={v.value} className="bg-[#0a0a16] text-white">
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/55 mb-2">
                  Template Style
                </label>
                <select
                  value={templateStyle}
                  onChange={(e) => setTemplateStyle(e.target.value as TemplateStyle)}
                  className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/40 transition-all appearance-none cursor-pointer"
                >
                  {TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value} className="bg-[#0a0a16] text-white">
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={isSubmitting || !url.trim()}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/25"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Video size={16} /> Generate UGC Video
                </>
              )}
            </button>

            {/* Submit error */}
            {submitError && (
              <div className="mt-4 flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-3 rounded-xl">
                <AlertCircle size={15} className="shrink-0" />
                {submitError}
              </div>
            )}
          </div>
        )}

        {/* Progress display - when job is active */}
        {jobId && job && job.status !== 'completed' && job.status !== 'failed' && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8 mb-6">
            <div className="text-center mb-7">
              <h2 className="text-xl font-bold mb-1.5">Generating your UGC video</h2>
              <p className="text-white/38 text-sm">This may take a few minutes</p>
            </div>

            {/* Stage list */}
            <div className="space-y-3">
              {PIPELINE_STAGES.filter((s) => s.key !== 'completed').map((s, i) => {
                const Icon = s.icon;
                const done = i < currentStageIdx;
                const active = s.key === job.status;
                return (
                  <div
                    key={s.key}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                      active
                        ? 'bg-violet-500/10 border-violet-500/22'
                        : done
                          ? 'bg-white/2 border-white/5'
                          : 'border-transparent opacity-25'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500/20' : active ? 'bg-violet-500/20' : 'bg-white/5'}`}
                    >
                      {done ? (
                        <CheckCircle size={16} className="text-emerald-400" />
                      ) : (
                        <Icon size={16} className={active ? 'text-violet-400' : 'text-white/25'} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-semibold ${active ? 'text-white' : done ? 'text-white/55' : 'text-white/25'}`}
                      >
                        {s.label}
                      </div>
                    </div>
                    {active && (
                      <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    )}
                    {done && <CheckCircle size={14} className="text-emerald-500/50 shrink-0" />}
                  </div>
                );
              })}
            </div>

            {/* Staleness warning */}
            {isStale && (
              <div className="mt-5 flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm px-4 py-3 rounded-xl">
                <AlertCircle size={15} className="shrink-0" />
                <span className="flex-1">Processing seems stuck - try again?</span>
                <button
                  onClick={handleRetry}
                  className="text-amber-300 hover:text-amber-200 font-semibold transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {/* Poll error */}
        {jobId && pollError && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8 mb-6">
            <div className="text-center">
              <AlertCircle size={32} className="mx-auto mb-3 text-rose-400" />
              <h2 className="text-lg font-bold mb-2">Connection Error</h2>
              <p className="text-rose-400 text-sm mb-4">
                {pollError instanceof Error ? pollError.message : 'Failed to check job status'}
              </p>
              <button
                onClick={handleRetry}
                className="px-5 py-2.5 bg-white/8 border border-white/10 text-white/70 rounded-xl text-sm hover:bg-white/12 transition-all"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Error state from job */}
        {job && job.status === 'failed' && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8 mb-6">
            <div className="text-center">
              <AlertCircle size={32} className="mx-auto mb-3 text-rose-400" />
              <h2 className="text-lg font-bold mb-2">Generation Failed</h2>
              <p className="text-rose-400 text-sm mb-4 leading-relaxed">
                {job.error || 'Something went wrong during video generation.'}
              </p>
              <button
                onClick={handleRetry}
                className="px-5 py-2.5 bg-white/8 border border-white/10 text-white/70 rounded-xl text-sm hover:bg-white/12 transition-all"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Completed state */}
        {job && job.status === 'completed' && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8 mb-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold mb-1.5">Video Ready!</h2>
              <p className="text-white/38 text-sm">Your UGC video has been generated</p>
            </div>

            {/* Video link */}
            {job.videoUrl && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
                <a
                  href={job.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/25"
                >
                  <Play size={16} /> Watch Video
                </a>
                <a
                  href={job.videoUrl}
                  download
                  className="flex items-center gap-2 bg-white/6 hover:bg-white/10 border border-white/10 text-white/70 font-semibold text-sm px-6 py-3 rounded-xl transition-all"
                >
                  <Download size={16} /> Download
                </a>
              </div>
            )}

            {/* Generate another */}
            <div className="text-center">
              <button
                onClick={handleRetry}
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Generate another video
              </button>
            </div>
          </div>
        )}

        {/* Script preview */}
        {job && job.script && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileText size={18} className="text-violet-400" />
              Generated Script
            </h3>
            <div className="space-y-4">
              {SCRIPT_SECTIONS.map((section) => {
                const content =
                  job.script?.[section.key as keyof NonNullable<UGCJob['script']>];
                if (!content) return null;
                return (
                  <div key={section.key}>
                    <div className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1">
                      {section.label}
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed">{content}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Product data preview */}
        {job && job.productData && (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Sparkles size={18} className="text-pink-400" />
              Product Info
            </h3>
            <div className="text-sm text-white/60 space-y-1">
              {!!job.productData.name && (
                <p>
                  <span className="text-white/40">Name:</span>{' '}
                  <span className="text-white/80">{String(job.productData.name)}</span>
                </p>
              )}
              {!!job.productData.price && (
                <p>
                  <span className="text-white/40">Price:</span>{' '}
                  <span className="text-white/80">{String(job.productData.price)}</span>
                </p>
              )}
              {!!job.productData.features && Array.isArray(job.productData.features) && (
                <div>
                  <span className="text-white/40">Features:</span>
                  <ul className="list-disc list-inside mt-1 text-white/70">
                    {(job.productData.features as string[]).slice(0, 5).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info section */}
        {!jobId && (
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { icon: FileText, label: 'AI Script', desc: 'GPT-powered copywriting' },
              { icon: Mic, label: 'TTS Voice', desc: 'Natural OpenAI voices' },
              { icon: Film, label: 'Video Compose', desc: 'Auto scene assembly' },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="text-center p-4 bg-white/[0.02] border border-white/6 rounded-xl"
                >
                  <Icon size={20} className="text-violet-400 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-white/70 mb-0.5">{f.label}</div>
                  <div className="text-xs text-white/30">{f.desc}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
