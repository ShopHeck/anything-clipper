'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Zap,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Play,
  Clock,
  Scissors,
  Share2,
  TrendingUp,
  Star,
  Trash2,
  ChevronDown,
  Bell,
  Video,
  Sparkles,
  BarChart2,
  Users,
  Grid,
  List,
  RefreshCw,
  Upload,
} from 'lucide-react';

interface Project {
  id: string;
  title: string;
  file_name: string | null;
  file_url: string | null;
  total_duration: number;
  viral_score: number;
  clip_count: number;
  status: string;
  created_at: string;
}

const THUMBNAILS = [
  'from-violet-800 to-purple-900',
  'from-pink-800 to-rose-900',
  'from-blue-800 to-cyan-900',
  'from-amber-800 to-orange-900',
  'from-emerald-800 to-green-900',
  'from-indigo-800 to-violet-900',
];

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  ready: { label: 'Ready', color: 'bg-emerald-500/15 text-emerald-400', dot: 'bg-emerald-400' },
  processing: {
    label: 'Processing',
    color: 'bg-violet-500/15 text-violet-400',
    dot: 'bg-violet-400',
  },
  transcribing: {
    label: 'Transcribing',
    color: 'bg-amber-500/15 text-amber-400',
    dot: 'bg-amber-400',
  },
  uploading: { label: 'Uploading', color: 'bg-blue-500/15 text-blue-400', dot: 'bg-blue-400' },
};

function fmtDuration(seconds: number) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtRelative(dateStr: string, now: number) {
  if (!now) return '…';
  const diff = now - Date.parse(dateStr);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(0, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DashboardPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientNow, setClientNow] = useState(0);
  const [usage, setUsage] = useState<{
    plan: { label: string };
    quotas: Array<{ key: string; used: number; limit: number; unlimited: boolean }>;
  } | null>(null);

  useEffect(() => {
    setClientNow(Date.now());
    loadProjects();
    fetch('/api/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setUsage(d))
      .catch(() => {});
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Delete this project and all its clips?')) return;
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
    setActiveMenu(null);
  };

  const filtered = projects.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  const totalClips = projects.reduce((a, p) => a + (p.clip_count || 0), 0);
  const totalHours = projects.reduce((a, p) => a + (p.total_duration || 0), 0) / 3600;
  const scoredProjects = projects.filter((p) => p.viral_score > 0);
  const avgScore = scoredProjects.length
    ? Math.round(scoredProjects.reduce((a, p) => a + p.viral_score, 0) / scoredProjects.length)
    : 0;

  const stats = [
    {
      label: 'Total clips generated',
      value: String(totalClips),
      icon: Scissors,
      change: `${projects.length} project${projects.length !== 1 ? 's' : ''}`,
    },
    { label: 'Hours processed', value: totalHours.toFixed(1), icon: Clock, change: 'All time' },
    { label: 'Avg viral score', value: avgScore || '—', icon: TrendingUp, change: 'AI scored' },
    { label: 'Videos uploaded', value: String(projects.length), icon: Video, change: 'Total' },
  ];

  return (
    <div className="min-h-screen bg-[#07070f] text-white flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-[#0a0a16] border-r border-white/5 flex-col hidden md:flex">
        <div className="p-5 border-b border-white/5">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm">
              ClipForge <span className="text-violet-400">AI</span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { icon: Grid, label: 'Projects', active: true, href: '/dashboard' },
            { icon: Scissors, label: 'My Clips', active: false, href: '/publish?tab=library' },
            { icon: Sparkles, label: 'AI Studio', active: false, href: '#' },
            { icon: BarChart2, label: 'Analytics', active: false, href: '#' },
            { icon: Share2, label: 'Publishing', active: false, href: '/publish' },
            { icon: Users, label: 'Team', active: false, href: '#' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${item.active ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20' : 'text-white/45 hover:text-white/75 hover:bg-white/4'}`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/6">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-xs font-bold shrink-0">
              CF
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">ClipForge User</div>
              <div className="text-xs text-white/35 truncate">
                {usage ? `${usage.plan.label} Plan` : 'Creator Plan'}
              </div>
            </div>
            <ChevronDown size={14} className="text-white/30 shrink-0" />
          </div>
          {(() => {
            // Show the clip-generation quota from the live usage summary,
            // falling back to the local project clip count before it loads.
            const clipQuota = usage?.quotas.find((q) => q.key === 'clipGenerationsPerMonth');
            const used = clipQuota ? clipQuota.used : totalClips;
            const limit = clipQuota && !clipQuota.unlimited ? clipQuota.limit : null;
            const pct = limit ? Math.min(100, (used / limit) * 100) : 100;
            return (
              <div className="mt-3 bg-gradient-to-r from-violet-600/20 to-pink-600/15 border border-violet-500/20 rounded-xl p-3">
                <div className="text-xs font-semibold text-violet-300 mb-1">
                  Clip generations this month
                </div>
                <div className="h-1.5 bg-white/10 rounded-full mb-1.5">
                  <div
                    className="h-1.5 bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-white/35">
                  {limit ? `${used} of ${limit} used` : `${used} used · unlimited`}
                </div>
              </div>
            );
          })()}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-[#07070f]/80 backdrop-blur-sm border-b border-white/5 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Projects</h1>
            <p className="text-xs text-white/35 mt-0.5">
              Manage your video projects and AI-generated clips
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadProjects}
              className="p-2 rounded-xl bg-white/4 border border-white/8 text-white/50 hover:text-white hover:bg-white/8 transition-all"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button className="relative p-2 rounded-xl bg-white/4 border border-white/8 text-white/50 hover:text-white hover:bg-white/8 transition-all">
              <Bell size={16} />
            </button>
            <Link
              href="/ugc"
              className="flex items-center gap-2 bg-white/4 border border-white/8 hover:bg-white/8 text-white/70 hover:text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all"
            >
              <Sparkles size={15} /> Create UGC
            </Link>
            <Link
              href="/upload"
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/25"
            >
              <Plus size={15} /> New project
            </Link>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="bg-white/[0.03] border border-white/7 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
                      <Icon size={16} className="text-violet-400" />
                    </div>
                    <span className="text-xs text-white/35 font-medium">{stat.change}</span>
                  </div>
                  <div className="text-2xl font-black text-white mb-0.5">{stat.value}</div>
                  <div className="text-xs text-white/38">{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 relative">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/4 border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/28 focus:outline-none focus:border-violet-500/40 focus:bg-white/6 transition-all"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2.5 bg-white/4 border border-white/8 rounded-xl text-sm text-white/55 hover:text-white hover:bg-white/6 transition-all">
              <Filter size={14} /> Filter
            </button>
            <div className="flex rounded-xl bg-white/4 border border-white/8 overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={`p-2.5 transition-all ${view === 'grid' ? 'bg-violet-600/30 text-violet-300' : 'text-white/38 hover:text-white'}`}
              >
                <Grid size={15} />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2.5 transition-all ${view === 'list' ? 'bg-violet-600/30 text-violet-300' : 'text-white/38 hover:text-white'}`}
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <RefreshCw size={28} className="mx-auto mb-3 text-violet-400 animate-spin" />
                <p className="text-white/40 text-sm">Loading projects…</p>
              </div>
            </div>
          )}

          {!loading && view === 'grid' && (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              <Link
                href="/upload"
                className="group bg-white/[0.02] border-2 border-dashed border-white/10 hover:border-violet-500/35 hover:bg-violet-500/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-4 transition-all cursor-pointer min-h-[240px]"
              >
                <div className="w-14 h-14 rounded-2xl bg-violet-600/15 border border-violet-500/25 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus size={24} className="text-violet-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white/55 group-hover:text-white/80 transition-colors">
                    New Project
                  </div>
                  <div className="text-xs text-white/28 mt-1">Upload a video to get started</div>
                </div>
              </Link>

              {filtered.map((project, idx) => {
                const status = statusConfig[project.status] ?? statusConfig.uploading;
                const thumb = THUMBNAILS[idx % THUMBNAILS.length];
                return (
                  <div
                    key={project.id}
                    className="group bg-white/[0.03] border border-white/8 hover:border-violet-500/25 rounded-2xl overflow-hidden transition-all hover:shadow-lg hover:shadow-violet-500/8"
                  >
                    <div className={`h-36 bg-gradient-to-br ${thumb} relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-black/20" />
                      {project.status === 'ready' && (
                        <Link
                          href={`/editor/${project.id}`}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
                        >
                          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors">
                            <Play size={18} className="text-white ml-0.5" />
                          </div>
                        </Link>
                      )}
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <span className="text-white/75 text-xs font-mono bg-black/40 px-2 py-0.5 rounded-full">
                          {fmtDuration(project.total_duration)}
                        </span>
                        {project.clip_count > 0 && (
                          <span className="text-violet-300 text-xs font-semibold bg-violet-500/25 px-2 py-0.5 rounded-full">
                            {project.clip_count} clips
                          </span>
                        )}
                      </div>
                      {project.viral_score > 0 && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 backdrop-blur px-2 py-1 rounded-full">
                          <Star size={10} className="text-amber-400 fill-amber-400" />
                          <span className="text-xs font-bold text-white">
                            {project.viral_score}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug flex-1">
                          {project.title}
                        </h3>
                        <div className="relative shrink-0">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setActiveMenu(activeMenu === project.id ? null : project.id);
                            }}
                            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal size={15} />
                          </button>
                          {activeMenu === project.id && (
                            <div className="absolute right-0 top-8 z-20 bg-[#111125] border border-white/10 rounded-xl shadow-2xl overflow-hidden w-44">
                              <Link
                                href={`/editor/${project.id}`}
                                className="flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors text-white/70"
                                onClick={() => setActiveMenu(null)}
                              >
                                <Play size={13} />
                                Open editor
                              </Link>
                              <Link
                                href={`/clips/${project.id}`}
                                className="flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors text-white/70"
                                onClick={() => setActiveMenu(null)}
                              >
                                <Scissors size={13} />
                                View clips
                              </Link>
                              <button
                                onClick={() => deleteProject(project.id)}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:bg-white/5 transition-colors text-rose-400"
                              >
                                <Trash2 size={13} />
                                Delete project
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${status.dot} ${project.status !== 'ready' ? 'animate-pulse' : ''}`}
                          />
                          {status.label}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-white/28">
                          <Clock size={11} />
                          {fmtRelative(project.created_at, clientNow)}
                        </div>
                      </div>
                      {project.status === 'ready' && (
                        <div className="flex gap-2 mt-4">
                          <Link
                            href={`/editor/${project.id}`}
                            className="flex-1 text-center text-xs font-semibold py-2 bg-white/6 hover:bg-white/10 rounded-lg transition-colors text-white/70"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/clips/${project.id}`}
                            className="flex-1 text-center text-xs font-bold py-2 bg-gradient-to-r from-violet-600/40 to-pink-600/35 hover:from-violet-600/60 hover:to-pink-600/55 border border-violet-500/25 rounded-lg transition-all text-violet-300"
                          >
                            {project.clip_count} Clips →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="col-span-full text-center py-16 text-white/25">
                  <Upload size={36} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-semibold mb-1">No projects yet</p>
                  <p className="text-xs">Upload your first video to get started</p>
                </div>
              )}
            </div>
          )}

          {!loading && view === 'list' && (
            <div className="bg-white/[0.02] border border-white/7 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-white/5 text-xs text-white/35 font-semibold uppercase tracking-wider">
                <span>Project</span>
                <span>Duration</span>
                <span>Clips</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              {filtered.map((project, idx) => {
                const status = statusConfig[project.status] ?? statusConfig.uploading;
                const thumb = THUMBNAILS[idx % THUMBNAILS.length];
                return (
                  <div
                    key={project.id}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 border-b border-white/4 last:border-0 hover:bg-white/3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${thumb} shrink-0`} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {project.title}
                        </div>
                        <div className="text-xs text-white/30">
                          {fmtRelative(project.created_at, clientNow)}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-white/45">
                      {fmtDuration(project.total_duration)}
                    </span>
                    <span className="text-xs text-violet-400 font-semibold">
                      {project.clip_count}
                    </span>
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${status.color} w-28 justify-center`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/editor/${project.id}`}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/45 hover:text-white transition-all"
                      >
                        <Play size={13} />
                      </Link>
                      <Link
                        href={`/clips/${project.id}`}
                        className="p-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/35 text-violet-400 transition-all"
                      >
                        <Scissors size={13} />
                      </Link>
                      <button
                        onClick={() => deleteProject(project.id)}
                        className="p-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600/30 text-rose-400 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center py-10 text-white/25 text-sm">No projects yet</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
