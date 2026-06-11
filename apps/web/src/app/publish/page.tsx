'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Zap,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Plus,
  ExternalLink,
  Scissors,
  Star,
  RefreshCw,
  Link2,
  X,
  Calendar,
  ShieldCheck,
} from 'lucide-react';

interface PublishJob {
  id: string;
  clip_id: string;
  project_id: string;
  platform: string;
  status: string;
  caption: string | null;
  hashtags: string[] | null;
  scheduled_at: string | null;
  published_at: string | null;
  platform_url: string | null;
  clip_title: string;
  clip_score: number;
  created_at: string;
}

interface Connection {
  id: string;
  platform: string;
  username: string;
  avatar_url: string | null;
  followers_count: number;
  connected_at: string;
}

interface Clip {
  id: string;
  project_id: string;
  title: string;
  hook: string;
  score: number;
  platforms: string[];
  duration_label: string;
  project_title: string;
}

const PLATFORM_META: Record<
  string,
  { emoji: string; color: string; gradient: string; handle: string; oauth?: boolean }
> = {
  TikTok: {
    emoji: '🎵',
    color: '#ff0050',
    gradient: 'from-[#ff005033] to-[#ff005008]',
    handle: '@yourhandle',
    oauth: true,
  },
  Instagram: {
    emoji: '📸',
    color: '#e1306c',
    gradient: 'from-[#e1306c33] to-[#e1306c08]',
    handle: '@yourhandle',
  },
  'YouTube Shorts': {
    emoji: '▶️',
    color: '#ff0000',
    gradient: 'from-[#ff000033] to-[#ff000008]',
    handle: 'Your Channel',
  },
  LinkedIn: {
    emoji: '💼',
    color: '#0077b5',
    gradient: 'from-[#0077b533] to-[#0077b508]',
    handle: 'Your Profile',
  },
};

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; Icon: typeof CheckCircle }
> = {
  queued: {
    label: 'Queued',
    color: 'text-amber-400',
    bg: 'bg-amber-500/15 border-amber-500/25',
    Icon: Clock,
  },
  scheduled: {
    label: 'Scheduled',
    color: 'text-violet-400',
    bg: 'bg-violet-500/15 border-violet-500/25',
    Icon: Calendar,
  },
  processing: {
    label: 'Posting…',
    color: 'text-blue-400',
    bg: 'bg-blue-500/15 border-blue-500/25',
    Icon: RefreshCw,
  },
  published: {
    label: 'Published',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15 border-emerald-500/25',
    Icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    color: 'text-rose-400',
    bg: 'bg-rose-500/15 border-rose-500/25',
    Icon: AlertCircle,
  },
};

function PublishPageInner() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'queue' | 'accounts' | 'library'>('queue');
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [caption, setCaption] = useState('');
  const [queueing, setQueueing] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState('');
  const [connectUsername, setConnectUsername] = useState('');
  const [connectFollowers, setConnectFollowers] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [publishingJobId, setPublishingJobId] = useState<string | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    // Handle redirect back from TikTok OAuth
    const connected = searchParams.get('tiktok_connected');
    const tiktokError = searchParams.get('tiktok_error');
    if (connected === '1') {
      setActiveTab('accounts');
      showToast('✅ TikTok connected successfully!', 'success');
    } else if (tiktokError) {
      setActiveTab('accounts');
      const errMap: Record<string, string> = {
        state_mismatch: 'Security check failed. Please try again.',
        token_exchange_failed: 'TikTok rejected the login. Check your app credentials.',
        server_misconfigured: 'TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET not set.',
        missing_code: 'TikTok did not return an auth code.',
        db_save_failed: 'Connection established but failed to save. Try again.',
        access_denied: 'You cancelled the TikTok login.',
      };
      showToast(`❌ ${errMap[tiktokError] ?? tiktokError}`, 'error');
    }

    // Handle redirect back from YouTube OAuth
    if (searchParams.get('youtube_connected') === '1') {
      setActiveTab('accounts');
      showToast('✅ YouTube connected successfully!', 'success');
    } else if (searchParams.get('youtube_error')) {
      setActiveTab('accounts');
      showToast(`❌ YouTube: ${searchParams.get('youtube_error')}`, 'error');
    }
  }, [searchParams, showToast]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [jobsRes, connRes, clipsRes] = await Promise.all([
        fetch('/api/publish'),
        fetch('/api/connections'),
        fetch('/api/clips'),
      ]);
      const [jobsData, connData, clipsData] = await Promise.all([
        jobsRes.json(),
        connRes.json(),
        clipsRes.json(),
      ]);
      setJobs(jobsData.jobs || []);
      setConnections(connData.connections || []);
      setClips(clipsData.clips || []);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteJob = async (id: string) => {
    if (!confirm('Remove from queue?')) return;
    await fetch(`/api/publish/${id}`, { method: 'DELETE' });
    setJobs((j) => j.filter((x) => x.id !== id));
  };

  // Publish a queued job to its platform. Routes to the platform's endpoint
  // (TikTok / YouTube) and requires that platform to be connected.
  const publishJob = async (job: PublishJob) => {
    const endpoints: Record<string, string> = {
      TikTok: '/api/publish/tiktok',
      YouTube: '/api/publish/youtube',
    };
    const endpoint = endpoints[job.platform];
    if (!endpoint) {
      showToast(`❌ Publishing to ${job.platform} isn't available yet`, 'error');
      return;
    }
    if (!connections.find((c) => c.platform === job.platform)) {
      showToast(`❌ Connect ${job.platform} first in the Accounts tab`, 'error');
      setActiveTab('accounts');
      return;
    }
    setPublishingJobId(job.id);
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'processing' } : j)));
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: 'published', platform_url: data.platform_url } : j
          )
        );
        showToast(`🎉 Posted to ${job.platform} successfully!`, 'success');
      } else {
        const errMsg = data.error ?? 'Publishing failed';
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'failed' } : j)));
        showToast(`❌ ${errMsg}`, 'error');
      }
    } catch (err) {
      console.error('Publish error:', err);
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'failed' } : j)));
      showToast('❌ Network error while publishing', 'error');
    } finally {
      setPublishingJobId(null);
    }
  };

  const queueClip = async () => {
    if (!selectedClip || !selectedPlatform) return;
    setQueueing(true);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip_id: selectedClip.id,
          project_id: selectedClip.project_id,
          platform: selectedPlatform,
          caption: caption || selectedClip.hook,
          hashtags: [],
        }),
      });
      const data = await res.json();
      if (data.job) {
        setJobs((j) => [
          { ...data.job, clip_title: selectedClip.title, clip_score: selectedClip.score },
          ...j,
        ]);
        setShowQueueModal(false);
        setSelectedClip(null);
        setSelectedPlatform('');
        setCaption('');
      }
    } catch (err) {
      console.error('Queue error:', err);
    } finally {
      setQueueing(false);
    }
  };

  const connectAccount = async () => {
    if (!connectingPlatform || !connectUsername) return;
    try {
      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: connectingPlatform,
          username: connectUsername,
          followers_count: parseInt(connectFollowers) || 0,
        }),
      });
      const data = await res.json();
      if (data.connection) {
        setConnections((c) => {
          const filtered = c.filter((x) => x.platform !== connectingPlatform);
          return [...filtered, data.connection];
        });
        setConnectingPlatform('');
        setConnectUsername('');
        setConnectFollowers('');
        showToast(`✅ ${connectingPlatform} connected!`, 'success');
      }
    } catch (err) {
      console.error('Connect error:', err);
    }
  };

  const disconnectAccount = async (platform: string) => {
    if (!confirm(`Disconnect ${platform}?`)) return;
    await fetch(`/api/connections?platform=${encodeURIComponent(platform)}`, { method: 'DELETE' });
    setConnections((c) => c.filter((x) => x.platform !== platform));
    showToast(`Disconnected ${platform}`, 'success');
  };

  const markPublished = async (id: string) => {
    const url = prompt('Enter the published URL (optional):') ?? '';
    await fetch(`/api/publish/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published', platform_url: url || null }),
    });
    setJobs((j) =>
      j.map((x) => (x.id === id ? { ...x, status: 'published', platform_url: url || null } : x))
    );
  };

  const published = jobs.filter((j) => j.status === 'published').length;
  const queued = jobs.filter((j) => j.status === 'queued').length;

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex flex-col">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-emerald-950 border-emerald-500/30 text-emerald-300' : 'bg-rose-950 border-rose-500/30 text-rose-300'}`}
        >
          {toast.msg}
          <button onClick={() => setToast(null)} className="text-white/40 hover:text-white ml-1">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-[#0a0a16] border-b border-white/5 px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          <Zap size={14} className="text-violet-400" />
          <span className="hidden sm:block">Dashboard</span>
        </Link>
        <div className="w-px h-4 bg-white/8" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <Send size={13} className="text-white" />
          </div>
          <span className="font-bold text-sm">Publishing Hub</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={loadAll}
          className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/8 rounded-xl text-sm text-white/55 hover:text-white hover:bg-white/8 transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:block">Refresh</span>
        </button>
        <button
          onClick={() => setShowQueueModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm px-4 py-2 rounded-xl transition-all"
        >
          <Plus size={14} /> Queue a clip
        </button>
      </header>

      {/* Stats */}
      <div className="px-6 py-5 border-b border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Published',
            val: String(published),
            color: 'text-emerald-400',
            icon: CheckCircle,
          },
          { label: 'Queued', val: String(queued), color: 'text-amber-400', icon: Clock },
          {
            label: 'Total clips',
            val: String(clips.length),
            color: 'text-violet-400',
            icon: Scissors,
          },
          {
            label: 'Connected',
            val: String(connections.length),
            color: 'text-pink-400',
            icon: Link2,
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white/3 border border-white/7 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Icon size={16} className={s.color} />
              </div>
              <div>
                <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
                <div className="text-xs text-white/38">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="px-6 pt-5 border-b border-white/5 flex gap-0.5">
        {(
          [
            { key: 'queue', label: '📋 Queue', count: jobs.length },
            { key: 'accounts', label: '🔗 Accounts', count: connections.length },
            { key: 'library', label: '✂️ Clip Library', count: clips.length },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 pb-3.5 text-sm font-semibold border-b-2 transition-all ${activeTab === t.key ? 'border-violet-500 text-violet-300' : 'border-transparent text-white/40 hover:text-white/65'}`}
          >
            {t.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-violet-500/25 text-violet-300' : 'bg-white/8 text-white/35'}`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {/* Queue tab */}
        {activeTab === 'queue' && (
          <div className="max-w-3xl mx-auto space-y-3">
            {loading && (
              <div className="text-center py-16">
                <RefreshCw size={28} className="mx-auto mb-3 text-violet-400 animate-spin" />
                <p className="text-white/40 text-sm">Loading queue…</p>
              </div>
            )}
            {!loading && jobs.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-2xl">
                <p className="text-3xl mb-3">📤</p>
                <p className="text-white/55 font-bold text-lg mb-2">Queue is empty</p>
                <p className="text-white/30 text-sm mb-5">
                  Queue clips from the library below to schedule publishing
                </p>
                <button
                  onClick={() => setActiveTab('library')}
                  className="px-5 py-2.5 bg-violet-600/20 border border-violet-500/25 text-violet-300 text-sm rounded-xl hover:bg-violet-600/35 transition-all font-semibold"
                >
                  Browse Clip Library →
                </button>
              </div>
            )}
            {jobs.map((job) => {
              const pm = PLATFORM_META[job.platform] ?? {
                emoji: '🌐',
                color: '#8b5cf6',
                gradient: 'from-violet-900/30 to-violet-900/10',
                handle: '',
              };
              const sm = STATUS_META[job.status] ?? STATUS_META.queued;
              const StatusIcon = sm.Icon;
              return (
                <div
                  key={job.id}
                  className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden hover:border-white/14 transition-all"
                >
                  <div
                    className={`bg-gradient-to-r ${pm.gradient} px-5 py-3.5 flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{pm.emoji}</span>
                      <span className="text-sm font-bold text-white">{job.platform}</span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${sm.bg} ${sm.color}`}
                    >
                      <StatusIcon size={10} />
                      {sm.label}
                    </div>
                  </div>
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white mb-1">
                          {job.clip_title || 'Untitled clip'}
                        </p>
                        {job.caption && (
                          <p className="text-xs text-white/45 line-clamp-2 leading-relaxed">
                            {job.caption}
                          </p>
                        )}
                      </div>
                      {job.clip_score > 0 && (
                        <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/25 rounded-xl px-2.5 py-1 shrink-0">
                          <Star size={10} className="text-amber-400 fill-amber-400" />
                          <span className="text-xs font-black text-amber-400">
                            {job.clip_score}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {job.status === 'queued' &&
                        (job.platform === 'TikTok' || job.platform === 'YouTube') && (
                          <button
                            onClick={() => publishJob(job)}
                            disabled={publishingJobId !== null}
                            className="flex items-center gap-1.5 text-xs bg-[#ff005022] border border-[#ff005040] text-[#ff6680] hover:bg-[#ff005035] px-3 py-1.5 rounded-lg transition-all font-semibold disabled:opacity-50"
                          >
                            <Send size={11} />
                            Post to {job.platform}
                          </button>
                        )}
                      {job.status === 'processing' && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-400 px-3 py-1.5">
                          <RefreshCw size={11} className="animate-spin" />
                          Uploading to TikTok…
                        </div>
                      )}
                      {job.status === 'queued' && (
                        <button
                          onClick={() => markPublished(job.id)}
                          className="flex items-center gap-1.5 text-xs bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 px-3 py-1.5 rounded-lg transition-all font-semibold"
                        >
                          <CheckCircle size={11} />
                          Mark published
                        </button>
                      )}
                      {job.platform_url && (
                        <a
                          href={job.platform_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs bg-white/6 border border-white/10 text-white/55 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <ExternalLink size={11} />
                          View post
                        </a>
                      )}
                      <button
                        onClick={() => deleteJob(job.id)}
                        className="ml-auto flex items-center gap-1 text-xs text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        <Trash2 size={11} />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Accounts tab */}
        {activeTab === 'accounts' && (
          <div className="max-w-2xl mx-auto">
            {/* TikTok OAuth card — special treatment */}
            <div className="bg-gradient-to-br from-[#ff005012] to-transparent border border-[#ff005030] rounded-2xl p-5 mb-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">🎵</span>
                <div>
                  <div className="text-sm font-bold text-white">TikTok</div>
                  <div className="text-xs text-white/45">Authenticated via TikTok OAuth 2.0</div>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/12 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                  <ShieldCheck size={11} />
                  <span className="font-semibold">Secure OAuth</span>
                </div>
              </div>

              {(() => {
                const conn = connections.find((c) => c.platform === 'TikTok');
                if (conn) {
                  return (
                    <div className="flex items-center gap-3">
                      {conn.avatar_url ? (
                        <img
                          src={conn.avatar_url}
                          alt={conn.username}
                          className="w-10 h-10 rounded-full border border-white/15 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#ff005025] flex items-center justify-center text-lg">
                          🎵
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-bold text-white">{conn.username}</div>
                        {conn.followers_count > 0 && (
                          <div className="text-xs text-white/45">
                            {conn.followers_count.toLocaleString()} followers
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5">
                          <CheckCircle size={9} />
                          Connected
                        </div>
                      </div>
                      <button
                        onClick={() => disconnectAccount('TikTok')}
                        className="text-xs text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/12 px-3 py-1.5 rounded-lg transition-all border border-rose-500/20 hover:border-rose-500/30"
                      >
                        Disconnect
                      </button>
                    </div>
                  );
                }
                return (
                  <a
                    href="/api/auth/tiktok"
                    className="w-full flex items-center justify-center gap-2.5 py-3 bg-[#ff0050] hover:bg-[#e0003e] text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-[#ff005035]"
                  >
                    <span className="text-base">🎵</span>
                    Connect with TikTok
                  </a>
                );
              })()}
            </div>

            {/* YouTube — OAuth publish */}
            <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-8">
              {(() => {
                const ytConn = connections.find((c) => c.platform === 'YouTube');
                if (ytConn) {
                  return (
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 bg-[#ff000018]">
                        ▶️
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white">YouTube</div>
                        <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5">
                          <CheckCircle size={9} />
                          {ytConn.username || 'Connected'}
                        </div>
                      </div>
                      <button
                        onClick={() => disconnectAccount('YouTube')}
                        className="text-xs text-rose-400/70 hover:text-rose-400 hover:bg-rose-500/12 px-3 py-1.5 rounded-lg transition-all border border-rose-500/20 hover:border-rose-500/30"
                      >
                        Disconnect
                      </button>
                    </div>
                  );
                }
                return (
                  <a
                    href="/api/auth/youtube"
                    className="w-full flex items-center justify-center gap-2.5 py-3 bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-[#ff000035]"
                  >
                    <span className="text-base">▶️</span>
                    Connect YouTube (Shorts)
                  </a>
                );
              })()}
            </div>

            {/* Other platforms (manual connect) */}
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">
              Other platforms — manual tracking
            </p>
            <div className="space-y-4 mb-8">
              {Object.entries(PLATFORM_META)
                .filter(([p]) => p !== 'TikTok')
                .map(([platform, meta]) => {
                  const conn = connections.find((c) => c.platform === platform);
                  return (
                    <div
                      key={platform}
                      className={`bg-white/[0.03] border rounded-2xl p-5 flex items-center gap-4 transition-all ${conn ? 'border-white/14' : 'border-white/8'}`}
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                        style={{ backgroundColor: `${meta.color}18` }}
                      >
                        {meta.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white mb-0.5">{platform}</div>
                        {conn ? (
                          <div className="text-xs text-emerald-400 flex items-center gap-1">
                            <CheckCircle size={10} />@{conn.username}
                            {conn.followers_count > 0 && (
                              <span className="text-white/35 ml-1">
                                · {(conn.followers_count / 1000).toFixed(0)}k followers
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-white/35">{meta.handle}</div>
                        )}
                      </div>
                      {conn ? (
                        <button
                          onClick={() => disconnectAccount(platform)}
                          className="text-xs text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-all border border-rose-500/15 hover:border-rose-500/25"
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          onClick={() => setConnectingPlatform(platform)}
                          className="text-xs text-white font-semibold px-3 py-1.5 rounded-lg transition-all border border-white/15 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>

            {connectingPlatform && (
              <div className="bg-white/[0.03] border border-violet-500/25 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-bold text-white">Connect {connectingPlatform}</p>
                  <button
                    onClick={() => setConnectingPlatform('')}
                    className="text-white/35 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-3 mb-4">
                  <input
                    value={connectUsername}
                    onChange={(e) => setConnectUsername(e.target.value)}
                    placeholder="Your username (e.g. @yourbrand)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
                  />
                  <input
                    value={connectFollowers}
                    onChange={(e) => setConnectFollowers(e.target.value)}
                    placeholder="Follower count (optional)"
                    type="number"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
                  />
                </div>
                <button
                  onClick={connectAccount}
                  disabled={!connectUsername}
                  className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-40"
                >
                  Save Connection
                </button>
              </div>
            )}
          </div>
        )}

        {/* Library tab */}
        {activeTab === 'library' && (
          <div className="max-w-3xl mx-auto space-y-3">
            {loading && (
              <div className="text-center py-16">
                <RefreshCw size={28} className="mx-auto mb-3 text-violet-400 animate-spin" />
              </div>
            )}
            {!loading && clips.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-2xl">
                <p className="text-3xl mb-3">✂️</p>
                <p className="text-white/55 font-bold text-lg mb-2">No clips yet</p>
                <Link
                  href="/upload"
                  className="inline-block px-5 py-2.5 bg-violet-600/20 border border-violet-500/25 text-violet-300 text-sm rounded-xl hover:bg-violet-600/35 transition-all font-semibold mt-3"
                >
                  Upload a video →
                </Link>
              </div>
            )}
            {clips.map((clip) => (
              <div
                key={`${clip.project_id}-${clip.id}`}
                className="bg-white/[0.03] border border-white/8 rounded-2xl p-4 flex items-center gap-4 hover:border-white/14 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white truncate">{clip.title}</span>
                    <span className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/20 rounded-lg px-2 py-0.5 shrink-0">
                      <Star size={9} className="text-amber-400 fill-amber-400" />
                      <span className="text-[10px] font-black text-amber-400">{clip.score}</span>
                    </span>
                  </div>
                  <p className="text-xs text-white/40 truncate mb-1.5">
                    From: {clip.project_title}
                  </p>
                  <div className="flex gap-1.5">
                    {(clip.platforms || []).slice(0, 3).map((p) => (
                      <span
                        key={p}
                        className="text-[10px] bg-white/7 border border-white/10 text-white/50 px-2 py-0.5 rounded-full"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedClip(clip);
                    setShowQueueModal(true);
                    setCaption(clip.hook || '');
                  }}
                  className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-violet-600/30 to-pink-600/25 border border-violet-500/30 text-violet-300 hover:from-violet-600/50 hover:to-pink-600/45 px-3 py-2 rounded-xl transition-all font-bold shrink-0"
                >
                  <Send size={11} />
                  Queue
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Queue clip modal */}
      {showQueueModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f0f1a] border border-white/12 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Send size={15} className="text-violet-400" />
                <span className="font-bold text-sm">Queue for Publishing</span>
              </div>
              <button
                onClick={() => {
                  setShowQueueModal(false);
                  setSelectedClip(null);
                  setSelectedPlatform('');
                }}
                className="text-white/35 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!selectedClip ? (
                <div>
                  <p className="text-xs text-white/45 mb-3 font-semibold uppercase tracking-wider">
                    Select a clip
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {clips.slice(0, 20).map((c) => (
                      <button
                        key={`${c.project_id}-${c.id}`}
                        onClick={() => {
                          setSelectedClip(c);
                          setCaption(c.hook || '');
                        }}
                        className="w-full flex items-center gap-3 p-3 bg-white/4 hover:bg-white/8 border border-white/8 hover:border-violet-500/25 rounded-xl transition-all text-left"
                      >
                        <Star size={12} className="text-amber-400 shrink-0 fill-amber-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{c.title}</p>
                          <p className="text-[10px] text-white/35 truncate">{c.project_title}</p>
                        </div>
                        <span className="text-xs font-black text-amber-400 shrink-0">
                          {c.score}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                    <Scissors size={14} className="text-violet-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{selectedClip.title}</p>
                      <p className="text-[10px] text-white/40">{selectedClip.project_title}</p>
                    </div>
                    <button
                      onClick={() => setSelectedClip(null)}
                      className="text-white/30 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div>
                    <p className="text-xs text-white/45 mb-2 font-semibold uppercase tracking-wider">
                      Platform
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(PLATFORM_META).map(([p, meta]) => (
                        <button
                          key={p}
                          onClick={() => setSelectedPlatform(p)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${selectedPlatform === p ? 'border-violet-500/40 bg-violet-500/12 text-violet-300' : 'border-white/8 bg-white/3 text-white/55 hover:border-white/15'}`}
                        >
                          <span className="text-base">{meta.emoji}</span>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/45 mb-2 font-semibold uppercase tracking-wider">
                      Caption
                    </p>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={3}
                      placeholder="Write your caption…"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/28 focus:outline-none focus:border-violet-500/40 resize-none"
                    />
                  </div>
                  <button
                    onClick={queueClip}
                    disabled={!selectedPlatform || queueing}
                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {queueing ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    {queueing ? 'Adding…' : 'Add to Queue'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublishPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07070f]" />}>
      <PublishPageInner />
    </Suspense>
  );
}
