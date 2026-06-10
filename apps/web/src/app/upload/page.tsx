'use client';
import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Upload,
  Link2,
  CheckCircle,
  ArrowRight,
  Mic,
  Scissors,
  Wand2,
  ChevronLeft,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { videoStore } from '@/utils/videoStore';

type Stage = 'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'done' | 'error';

const STAGES: { key: Stage; label: string; icon: typeof Upload }[] = [
  { key: 'uploading', label: 'Uploading video', icon: Upload },
  { key: 'transcribing', label: 'Transcribing audio', icon: Mic },
  { key: 'analyzing', label: 'Finding viral moments', icon: Scissors },
  { key: 'done', label: 'Ready to edit', icon: CheckCircle },
];

export default function UploadPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState<'file' | 'url'>('file');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [statusDetail, setStatusDetail] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth progress animation between two values
  const animateTo = useCallback((from: number, to: number, durationMs: number): Promise<void> => {
    return new Promise((resolve) => {
      const startMs = performance.now();
      const tick = () => {
        const pct = Math.min((performance.now() - startMs) / durationMs, 1);
        setProgress(Math.round(from + (to - from) * pct));
        if (pct < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }, []);

  // Poll AssemblyAI status via our backend until completed/error
  const pollTranscript = useCallback(
    (
      transcriptId: string
    ): Promise<{ segments: unknown[]; overallScore: number; totalDuration: number }> => {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 120; // 10 min max (5s interval)

        const check = async () => {
          attempts++;
          if (attempts > maxAttempts) {
            reject(new Error('Transcription timed out — your video may be too long'));
            return;
          }

          try {
            const res = await fetch(`/api/transcribe/${transcriptId}`);
            if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
            const data = await res.json();

            if (data.status === 'completed') {
              resolve(data);
              return;
            }
            if (data.status === 'error') {
              reject(new Error(data.error ?? 'Transcription failed'));
              return;
            }
            // Still processing — wait 5s and try again
            setStatusDetail(
              data.status === 'queued' ? 'In queue — starting shortly…' : 'Transcribing your audio…'
            );
            pollTimerRef.current = setTimeout(check, 5000);
          } catch (err) {
            reject(err);
          }
        };

        // First check after 4s (AssemblyAI needs time to start)
        pollTimerRef.current = setTimeout(check, 4000);
      });
    },
    []
  );

  const runPipeline = useCallback(
    async (file: File | null, urlName: string) => {
      const name = file ? file.name : urlName;
      setFileName(name);

      try {
        // ── Stage 1: Upload ──────────────────────────────────────
        setStage('uploading');
        setStatusDetail('Preparing your video…');
        if (file) {
          // 500 MB limit
          const MAX_SIZE = 500 * 1024 * 1024;
          if (file.size > MAX_SIZE) {
            throw new Error(
              `File too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Maximum size is 500 MB.`
            );
          }
          videoStore.setVideo(file);
        }

        // Read actual video duration from the browser
        let totalDuration = 0;
        if (file && videoRef.current) {
          await new Promise<void>((res) => {
            videoRef.current!.src = videoStore.getObjectUrl()!;
            videoRef.current!.onloadedmetadata = () => {
              const d = videoRef.current!.duration;
              if (isFinite(d) && d > 0) totalDuration = d;
              res();
            };
            videoRef.current!.onerror = () => res();
            setTimeout(res, 3000);
          });
        }

        // Upload the file via XHR for real progress tracking
        let fileUrl = urlName;
        if (file) {
          setStatusDetail('Uploading to transcription service…');
          setProgress(2);

          fileUrl = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload-video', true);
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                const pct = Math.round((evt.loaded / evt.total) * 22); // 0-22%
                setProgress(2 + pct);
                const mb = (evt.loaded / 1024 / 1024).toFixed(1);
                const totalMb = (evt.total / 1024 / 1024).toFixed(1);
                setStatusDetail(`Uploading ${mb} / ${totalMb} MB…`);
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data = JSON.parse(xhr.responseText);
                  if (data.url) resolve(data.url);
                  else reject(new Error(data.error || 'Upload succeeded but returned no URL.'));
                } catch {
                  reject(new Error('Invalid response from upload server.'));
                }
              } else {
                let errMsg = `Upload failed (${xhr.status})`;
                try {
                  const data = JSON.parse(xhr.responseText);
                  if (data.error) errMsg = data.error;
                } catch {
                  /* ignore */
                }
                reject(new Error(errMsg));
              }
            };

            xhr.onerror = () =>
              reject(new Error('Network error during upload. Check your connection.'));
            xhr.ontimeout = () =>
              reject(new Error('Upload timed out. Try a smaller file or faster connection.'));
            xhr.timeout = 300_000; // 5 min
            xhr.send(file);
          });
        }
        setProgress(25);

        // ── Stage 2: Transcribe ──────────────────────────────────
        setStage('transcribing');
        setStatusDetail('Submitting to transcription service…');

        // Submit job to AssemblyAI
        const submitRes = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUrl }),
        });
        if (!submitRes.ok) {
          const err = await submitRes.json().catch(() => ({}));
          throw new Error(err.error ?? `Failed to start transcription (${submitRes.status})`);
        }
        const { transcriptId } = await submitRes.json();

        // Animate progress slowly during transcription (can take minutes)
        animateTo(25, 65, 60_000);
        setStatusDetail('AI is listening to your video…');

        // Poll until done
        const transcribeResult = await pollTranscript(transcriptId);

        // Store real transcript
        videoStore.setTranscript(
          transcribeResult.segments as Parameters<typeof videoStore.setTranscript>[0],
          transcribeResult.totalDuration || totalDuration
        );
        videoStore.setOverallScore(transcribeResult.overallScore || 80);
        setProgress(65);

        // ── Stage 3: Analyze viral clips ────────────────────────
        setStage('analyzing');
        setStatusDetail('AI is scoring viral moments…');
        const analysisProgressPromise = animateTo(65, 95, 6000);

        const transcriptText = (transcribeResult.segments as Array<{ text: string }>)
          .map((s) => s.text)
          .join(' ')
          .slice(0, 1500);

        const clipsRes = await fetch('/api/generate-clips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: transcriptText,
            count: 6,
            segments: transcribeResult.segments,
          }),
        });
        if (!clipsRes.ok) throw new Error('Clip generation failed');
        const clipsData = await clipsRes.json();
        videoStore.setClips(clipsData.clips || []);
        await analysisProgressPromise;

        // ── Stage 4: Save project to database ───────────────
        setStage('done');
        setStatusDetail('Saving project…');

        let projectId = 'new';
        try {
          // Create project record
          const createRes = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: (file ? file.name : urlName).replace(/\.[^/.]+$/, ''),
              file_name: file ? file.name : urlName,
              file_url: fileUrl,
              status: 'ready',
            }),
          });
          if (createRes.ok) {
            const { project } = await createRes.json();
            projectId = project.id;
            videoStore.setProjectId(projectId);

            // Save segments and clips
            const segs = videoStore.getTranscript();
            await fetch(`/api/projects/${projectId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                total_duration: transcribeResult.totalDuration || totalDuration,
                viral_score: transcribeResult.overallScore || 80,
                word_count: (transcribeResult.segments as Array<{ text: string }>).reduce(
                  (a, s) => a + s.text.split(' ').length,
                  0
                ),
                segments: segs.map((s, i) => ({ ...s, sortOrder: i })),
                clips: clipsData.clips || [],
              }),
            });
          }
        } catch (saveErr) {
          console.error('Project save error:', saveErr);
          // non-fatal — still open editor
        }

        setStatusDetail('Opening editor…');
        await animateTo(95, 100, 400);
        setTimeout(() => router.push(`/editor/${projectId}`), 800);
      } catch (err) {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        console.error('Pipeline error:', err);
        setStage('error');
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    },
    [animateTo, pollTranscript, router]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
        setError('Please upload a video or audio file (MP4, MOV, AVI, WebM, MKV, MP3, WAV, M4A)');
        return;
      }
      const MAX_SIZE = 500 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(0);
        setError(`File is ${sizeMB} MB — max is 500 MB. Try compressing or trimming the video.`);
        return;
      }
      setError('');
      runPipeline(file, file.name);
    },
    [runPipeline]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleUrlSubmit = () => {
    if (!youtubeUrl.startsWith('http')) {
      setError('Please enter a valid URL');
      return;
    }
    setError('');
    runPipeline(null, youtubeUrl);
  };

  const currentIdx = STAGES.findIndex((s) => s.key === stage);

  // ── Processing screen ──────────────────────────────────────
  if (stage !== 'idle') {
    const stageTitle =
      stage === 'done' ? '🎉 Ready!' : stage === 'error' ? '⚠️ Error' : 'Processing your video';
    return (
      <div className="min-h-screen bg-[#07070f] text-white flex flex-col items-center justify-center px-6">
        <video ref={videoRef} className="hidden" muted />
        <style jsx global>{`
          @keyframes cfSpin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
          .cf-spin {
            animation: cfSpin 0.85s linear infinite;
          }
        `}</style>

        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-10 justify-center">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold">
              ClipForge <span className="text-violet-400">AI</span>
            </span>
          </div>

          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-8">
            <div className="text-center mb-7">
              <h2 className="text-xl font-bold mb-1.5">{stageTitle}</h2>
              <p className="text-white/38 text-sm truncate max-w-xs mx-auto px-2">
                {fileName.length > 50 ? fileName.slice(0, 50) + '…' : fileName}
              </p>
            </div>

            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-white/38">Overall progress</span>
                <span
                  className="font-bold"
                  style={{ color: stage === 'error' ? '#f87171' : '#a78bfa' }}
                >
                  {progress}%
                </span>
              </div>
              <div className="h-2.5 bg-white/6 rounded-full overflow-hidden">
                <div
                  className="h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    background:
                      stage === 'error' ? '#ef4444' : 'linear-gradient(90deg, #7c3aed, #db2777)',
                  }}
                />
              </div>
            </div>

            {/* Stage list */}
            <div className="space-y-3">
              {STAGES.map((s, i) => {
                const Icon = s.icon;
                const done = stage === 'done' || i < currentIdx;
                const active = s.key === stage && stage !== 'done';
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
                      {active && (
                        <div className="text-xs text-violet-400/65 mt-0.5 truncate">
                          {statusDetail}
                        </div>
                      )}
                    </div>
                    {active && (
                      <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full cf-spin shrink-0" />
                    )}
                    {done && <CheckCircle size={14} className="text-emerald-500/50 shrink-0" />}
                  </div>
                );
              })}
            </div>

            {/* Transcription note */}
            {stage === 'transcribing' && (
              <div className="mt-5 bg-blue-500/8 border border-blue-500/18 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-300/70 leading-relaxed">
                  ⏱ Transcription typically takes{' '}
                  <strong className="text-blue-300">1–5 minutes</strong> depending on video length.
                  Your video is being processed in real time.
                </p>
              </div>
            )}

            {stage === 'done' && (
              <div className="mt-7 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-emerald-400 mb-4">
                  <Sparkles size={14} />
                  {videoStore.getClips().length} viral clips found · Score{' '}
                  {videoStore.getOverallScore()}
                </div>
                <Link
                  href="/editor/new"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold px-7 py-3.5 rounded-xl hover:from-violet-500 hover:to-pink-500 transition-all hover:scale-105"
                >
                  Open Editor <ArrowRight size={16} />
                </Link>
              </div>
            )}

            {stage === 'error' && (
              <div className="mt-5 text-center">
                <p className="text-rose-400 text-sm mb-4 leading-relaxed">{error}</p>
                <button
                  onClick={() => {
                    setStage('idle');
                    setError('');
                    setProgress(0);
                  }}
                  className="px-5 py-2.5 bg-white/8 border border-white/10 text-white/70 rounded-xl text-sm hover:bg-white/12 transition-all"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {stage !== 'done' && stage !== 'error' && (
            <p className="text-center text-white/22 text-xs mt-4 flex items-center justify-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full bg-violet-400 cf-spin"
                style={{ animationDuration: '2s' }}
              />
              {statusDetail}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Upload screen ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#07070f] text-white px-6 py-8">
      <video ref={videoRef} className="hidden" muted />

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

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-black mb-3">Upload your video</h1>
          <p className="text-white/45 text-lg leading-relaxed max-w-lg mx-auto">
            Drop any video or audio file. We'll transcribe every word, find your best viral moments,
            and format clips for TikTok, Reels & Shorts.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/4 border border-white/8 rounded-2xl p-1 mb-6">
          {(
            [
              { key: 'file', label: 'Upload file', icon: Upload },
              { key: 'url', label: 'URL / Link', icon: Link2 },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setError('');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? 'bg-white/8 text-white' : 'text-white/40 hover:text-white/65'}`}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'file' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-violet-500/70 bg-violet-500/8 scale-[1.01]'
                : 'border-white/12 hover:border-violet-500/40 hover:bg-white/3'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="video/*,audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/25 to-pink-600/15 border border-violet-500/25 flex items-center justify-center mx-auto mb-5">
              <Upload size={28} className="text-violet-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Drop your video here</h3>
            <p className="text-white/40 text-sm">or click to browse files</p>
            <p className="text-white/22 text-xs mt-5">MP4, MOV, AVI, WebM, MKV, MP3, WAV, M4A</p>
          </div>
        ) : (
          <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
            <label className="block text-sm font-medium text-white/55 mb-3">
              Direct audio/video URL
            </label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Link2
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                    setError('');
                  }}
                  placeholder="https://example.com/video.mp4"
                  className="w-full bg-white/4 border border-white/8 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 transition-all"
                />
              </div>
              <button
                onClick={handleUrlSubmit}
                disabled={!youtubeUrl}
                className="px-5 py-3 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Import
              </button>
            </div>
            <p className="text-xs text-white/28 mt-3">
              Must be a direct link to an audio or video file (mp4, mp3, wav, m4a, etc.)
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm px-4 py-3 rounded-xl">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Requires ASSEMBLYAI_API_KEY notice */}
        <div className="mt-6 bg-violet-500/8 border border-violet-500/18 rounded-xl px-4 py-3.5 flex gap-3">
          <Mic size={15} className="text-violet-400 shrink-0 mt-0.5" />
          <p className="text-xs text-violet-300/70 leading-relaxed">
            Real speech-to-text transcription powered by{' '}
            <strong className="text-violet-300">AssemblyAI</strong>. Add your{' '}
            <code className="bg-white/8 px-1 py-0.5 rounded text-[10px]">ASSEMBLYAI_API_KEY</code>{' '}
            to enable accurate transcription of your actual video audio.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          {[
            { icon: Mic, label: 'Real Transcription', desc: 'AssemblyAI speech-to-text' },
            { icon: Scissors, label: 'Viral Clip AI', desc: 'GPT-4 scores every segment' },
            { icon: Wand2, label: 'Auto Captions', desc: 'Word-by-word animation' },
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
      </div>
    </div>
  );
}
