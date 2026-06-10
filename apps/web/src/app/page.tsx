'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Play,
  Zap,
  Scissors,
  Mic,
  Wand2,
  Share2,
  ChevronRight,
  CheckCircle,
  Star,
  ArrowRight,
  Menu,
  X,
  Sparkles,
  Clock,
  Upload,
  Layers,
  BarChart2,
  Globe,
} from 'lucide-react';

const features = [
  {
    icon: Mic,
    title: 'AI Transcription',
    desc: 'Upload any video or audio. Get a perfect transcript in minutes with 98%+ accuracy across 40+ languages.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: Scissors,
    title: 'Edit by Text',
    desc: 'Delete words in the transcript to cut video. No timeline scrubbing. No keyframes. Just edit like a doc.',
    color: 'from-pink-500 to-rose-600',
  },
  {
    icon: Zap,
    title: 'Viral Clip Generator',
    desc: 'AI finds the most engaging 30–90 second moments and formats them perfectly for TikTok, Reels & Shorts.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: Wand2,
    title: 'AI Captions & Effects',
    desc: 'Animated captions, word highlights, emojis, and viral-style text overlays — all generated automatically.',
    color: 'from-cyan-500 to-blue-600',
  },
  {
    icon: Layers,
    title: 'B-Roll & Stock Footage',
    desc: 'AI suggests and inserts relevant B-roll from a library of 10M+ clips to make your content more engaging.',
    color: 'from-green-500 to-emerald-600',
  },
  {
    icon: Share2,
    title: 'Multi-Platform Export',
    desc: 'One-click export optimized for TikTok, Instagram Reels, YouTube Shorts, LinkedIn, Facebook & X.',
    color: 'from-indigo-500 to-violet-600',
  },
];

const steps = [
  {
    num: '01',
    title: 'Upload Your Video',
    desc: 'Drop in any podcast, interview, webinar, or YouTube video. We handle any format up to 4K.',
    icon: Upload,
  },
  {
    num: '02',
    title: 'AI Does the Work',
    desc: 'Transcription, clip detection, caption generation, and viral scoring — all automated in minutes.',
    icon: Sparkles,
  },
  {
    num: '03',
    title: 'Edit & Export',
    desc: 'Tweak clips in the editor, pick your platforms, and publish directly or download ready-to-post files.',
    icon: Share2,
  },
];

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Podcast Host · 2.3M followers',
    avatar: 'SC',
    avatarColor: 'from-violet-500 to-pink-500',
    quote:
      'ClipForge AI turned my 3-hour podcast into 47 viral clips in 20 minutes. My Reels engagement is up 340%.',
    stars: 5,
  },
  {
    name: 'Marcus Rivera',
    role: 'YouTube Creator · 890K subscribers',
    avatar: 'MR',
    avatarColor: 'from-cyan-500 to-blue-500',
    quote:
      "I used to spend 8 hours editing a single short. Now it's 15 minutes. The transcript editor is pure genius.",
    stars: 5,
  },
  {
    name: 'Priya Patel',
    role: 'Marketing Director · SaaS Startup',
    avatar: 'PP',
    avatarColor: 'from-amber-500 to-orange-500',
    quote:
      'We repurpose our webinars into 60+ pieces of content a month. Our content team went from 6 to 2 people.',
    stars: 5,
  },
];

const plans = [
  {
    name: 'Starter',
    price: 29,
    desc: 'For individual creators getting started',
    features: [
      '5 hours of transcription/mo',
      '20 AI clips/mo',
      'Basic captions',
      'HD export',
      '3 platforms',
    ],
    cta: 'Start free trial',
    highlight: false,
  },
  {
    name: 'Creator',
    price: 79,
    desc: 'For serious creators & small agencies',
    features: [
      '25 hours of transcription/mo',
      'Unlimited AI clips',
      'Animated captions & effects',
      '4K export',
      'All 6 platforms',
      'B-roll library',
      'Priority processing',
    ],
    cta: 'Start free trial',
    highlight: true,
  },
  {
    name: 'Agency',
    price: 249,
    desc: 'For agencies managing multiple clients',
    features: [
      'Unlimited transcription',
      'Unlimited AI clips',
      'Custom branding',
      '4K export',
      'All platforms + API',
      'White-label exports',
      'Dedicated support',
      'Team collaboration',
    ],
    cta: 'Contact sales',
    highlight: false,
  },
];

const stats = [
  { value: '10M+', label: 'Clips generated' },
  { value: '98.4%', label: 'Transcription accuracy' },
  { value: '4.8x', label: 'Avg engagement increase' },
  { value: '127K+', label: 'Creators trust us' },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#07070f] text-white overflow-x-hidden">
      <style jsx global>{`
        @keyframes floatUp {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-14px);
          }
        }
        @keyframes glowPulse {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.7;
          }
        }
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(28px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .float-hero {
          animation: floatUp 7s ease-in-out infinite;
        }
        .glow-bg {
          animation: glowPulse 4s ease-in-out infinite;
        }
        .hero-enter {
          animation: fadeSlideUp 0.8s ease-out forwards;
        }
        .gradient-text {
          background: linear-gradient(135deg, #a78bfa 0%, #f472b6 50%, #fb923c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .card-hover {
          transition:
            border-color 0.3s ease,
            box-shadow 0.3s ease;
        }
        .card-hover:hover {
          border-color: rgba(139, 92, 246, 0.35);
          box-shadow: 0 0 28px rgba(139, 92, 246, 0.12);
        }
      `}</style>

      {/* Navbar */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#07070f]/92 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'}`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              ClipForge <span className="text-violet-400">AI</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {['Product', 'Blog', 'Docs'].map((item) => (
              <a
                key={item}
                href="#"
                className="text-sm text-white/55 hover:text-white transition-colors"
              >
                {item}
              </a>
            ))}
            <a href="#pricing" className="text-sm text-white/55 hover:text-white transition-colors">
              Pricing
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-white/55 hover:text-white transition-colors px-4 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/upload"
              className="text-sm font-bold bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30"
            >
              Get started free
            </Link>
          </div>

          <button
            className="md:hidden text-white/60 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-[#0c0c18] border-t border-white/5 px-6 py-4 flex flex-col gap-4">
            {['Product', 'Pricing', 'Blog', 'Docs'].map((item) => (
              <a
                key={item}
                href={item === 'Pricing' ? '#pricing' : '#'}
                className="text-white/70 py-1"
                onClick={() => setMenuOpen(false)}
              >
                {item}
              </a>
            ))}
            <Link
              href="/upload"
              className="text-center bg-gradient-to-r from-violet-600 to-pink-600 text-white px-5 py-3 rounded-xl font-bold mt-2"
              onClick={() => setMenuOpen(false)}
            >
              Get started free
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-28 pb-16 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-700/18 rounded-full blur-3xl glow-bg pointer-events-none" />
        <div
          className="absolute top-1/3 right-1/5 w-[400px] h-[400px] bg-pink-600/12 rounded-full blur-3xl glow-bg pointer-events-none"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-blue-600/8 rounded-full blur-3xl glow-bg pointer-events-none"
          style={{ animationDelay: '4s' }}
        />

        <div className="relative z-10 max-w-5xl mx-auto hero-enter">
          <div className="inline-flex items-center gap-2 bg-violet-500/12 border border-violet-500/25 text-violet-300 text-sm px-4 py-2 rounded-full mb-8">
            <Sparkles size={14} />
            <span>Now with GPT-4o powered clip intelligence</span>
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-[82px] font-black tracking-tight leading-[0.95] mb-7">
            Turn any video into
            <br />
            <span className="gradient-text">viral short-form</span>
            <br />
            content.
          </h1>
          <p className="text-xl md:text-2xl text-white/48 max-w-2xl mx-auto mb-10 leading-relaxed">
            The AI-powered video editor that transcribes, clips, captions, and publishes — all in
            one place. Like Descript + Opus Clip + CapCut, combined.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/upload"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all hover:shadow-2xl hover:shadow-violet-500/30 hover:scale-105"
            >
              Start for free <ArrowRight size={20} />
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/5 hover:bg-white/9 border border-white/10 text-white font-semibold text-lg px-8 py-4 rounded-2xl transition-all"
            >
              <Play size={18} /> View demo
            </Link>
          </div>
          <p className="text-white/28 text-sm mt-5">
            No credit card required · 14-day free trial · Cancel anytime
          </p>
        </div>

        {/* Mock editor */}
        <div className="relative z-10 mt-16 w-full max-w-6xl mx-auto float-hero">
          <div className="bg-[#0d0d1c] border border-white/8 rounded-2xl overflow-hidden shadow-2xl shadow-violet-950/50">
            {/* Toolbar */}
            <div className="bg-[#111125] border-b border-white/6 px-4 py-3 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 flex items-center justify-center gap-6 text-xs text-white/28">
                {['Edit', 'AI Clips', 'B-Roll', 'Captions', 'Export'].map((t, i) => (
                  <span
                    key={t}
                    className={`flex items-center gap-1 ${i === 1 ? 'text-violet-400' : ''}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-white/28">Processing...</span>
              </div>
            </div>

            <div className="flex h-[380px] md:h-[460px]">
              {/* Transcript */}
              <div className="w-64 hidden md:flex flex-col border-r border-white/5 bg-[#0a0a15]">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/45 uppercase tracking-wider">
                    Transcript
                  </span>
                  <div className="flex items-center gap-1 bg-violet-500/20 text-violet-300 text-xs px-2 py-0.5 rounded-full">
                    <Sparkles size={10} />
                    <span>AI</span>
                  </div>
                </div>
                <div className="flex-1 p-3 space-y-2 overflow-hidden">
                  {[
                    {
                      time: '0:00',
                      text: "Welcome to today's podcast. We're going to talk about something that changed my entire...",
                      active: false,
                    },
                    {
                      time: '0:12',
                      text: 'The number one mistake most creators make is not repurposing their content. Think about it...',
                      active: true,
                    },
                    {
                      time: '0:28',
                      text: 'Every long-form video can be turned into 20, 30, even 50 short clips that each go viral...',
                      active: false,
                    },
                    {
                      time: '0:45',
                      text: "And here's the crazy part — those short clips often outperform the original by 10x...",
                      active: false,
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-lg text-xs leading-relaxed cursor-pointer transition-all ${item.active ? 'bg-violet-500/15 border border-violet-500/30 text-white' : 'text-white/38 hover:text-white/55 hover:bg-white/3'}`}
                    >
                      <div className="text-violet-400/55 text-[10px] mb-1 font-mono">
                        {item.time}
                      </div>
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Video preview */}
              <div className="flex-1 flex flex-col items-center justify-center bg-black/40 gap-4">
                <div className="w-44 h-72 md:w-52 md:h-84 bg-gradient-to-b from-violet-900/40 to-black/70 rounded-xl border border-white/10 relative overflow-hidden">
                  <div className="absolute inset-0 flex flex-col items-center justify-end pb-5 p-3">
                    <div className="w-full space-y-1.5 mb-3">
                      {['Most creators make', 'THIS mistake...'].map((line, i) => (
                        <div
                          key={i}
                          className={`text-center text-sm font-black text-white drop-shadow-lg ${i === 1 ? 'text-yellow-400' : ''}`}
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-1">
                      <div className="bg-gradient-to-r from-violet-500 to-pink-500 h-1 rounded-full w-2/5" />
                    </div>
                  </div>
                  <div className="absolute top-3 left-3 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                    🎬 CLIP
                  </div>
                  <div className="absolute top-3 right-3 text-white/50 text-[10px]">0:28</div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/18 transition-colors">
                    <Play size={14} className="text-white ml-0.5" />
                  </button>
                </div>
              </div>

              {/* AI clips panel */}
              <div className="w-60 hidden lg:flex flex-col border-l border-white/5 bg-[#0a0a15]">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/45 uppercase tracking-wider">
                    AI Clips
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    47 found
                  </span>
                </div>
                <div className="flex-1 p-3 space-y-2 overflow-hidden">
                  {[
                    {
                      title: 'Most creators make this mistake',
                      score: 97,
                      duration: '0:42',
                      platform: 'TikTok',
                    },
                    {
                      title: 'Turn content into 50 clips...',
                      score: 94,
                      duration: '0:38',
                      platform: 'Reels',
                    },
                    {
                      title: 'Short clips outperform by 10x',
                      score: 89,
                      duration: '0:55',
                      platform: 'Shorts',
                    },
                  ].map((clip, i) => (
                    <div
                      key={i}
                      className="bg-white/4 border border-white/8 rounded-lg p-2.5 cursor-pointer hover:border-violet-500/30 transition-all"
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <span className="text-[11px] text-white/78 font-medium leading-tight line-clamp-2 mr-2">
                          {clip.title}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${clip.score >= 95 ? 'bg-emerald-500/20 text-emerald-400' : clip.score >= 90 ? 'bg-violet-500/20 text-violet-400' : 'bg-amber-500/20 text-amber-400'}`}
                        >
                          {clip.score}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/28">
                        <span>{clip.duration}</span>
                        <span>·</span>
                        <span className="text-violet-400">{clip.platform}</span>
                      </div>
                    </div>
                  ))}
                  <button className="w-full py-2 rounded-lg bg-gradient-to-r from-violet-600/35 to-pink-600/35 border border-violet-500/25 text-violet-300 text-xs font-semibold hover:from-violet-600/55 hover:to-pink-600/55 transition-all">
                    + Generate 44 more clips
                  </button>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-[#0a0a15] border-t border-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-white/20 font-mono">0:00</span>
                <div className="flex-1 h-7 bg-white/3 rounded-lg relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-violet-600/45 to-pink-600/35 rounded-l-lg" />
                  <div className="absolute inset-y-1 left-[5%] right-[36%] bg-violet-400/18 rounded border border-violet-400/25" />
                  <div className="absolute top-1 bottom-1 left-[40%] w-0.5 bg-white/55" />
                </div>
                <span className="text-[10px] text-white/20 font-mono">1:47:23</span>
              </div>
            </div>
          </div>

          <div className="absolute -top-3 -right-3 hidden md:flex bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-emerald-500/30">
            ✨ 47 clips found
          </div>
          <div className="absolute -bottom-3 -left-3 hidden md:flex items-center gap-2 bg-[#0d0d1c] border border-white/10 text-white/65 text-xs px-3 py-1.5 rounded-full shadow-lg">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Transcribed in 2m 14s
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl md:text-4xl font-black gradient-text mb-1">{s.value}</div>
              <div className="text-white/38 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm px-4 py-2 rounded-full mb-5">
              <Clock size={14} />
              <span>From raw video to viral clips in minutes</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Three steps to <span className="gradient-text">viral content</span>
            </h2>
            <p className="text-white/38 text-lg max-w-xl mx-auto">
              No editing experience required. Our AI handles the heavy lifting.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="relative bg-white/[0.03] border border-white/8 rounded-2xl p-8 card-hover"
                >
                  <div className="text-6xl font-black text-white/[0.04] mb-4 leading-none">
                    {step.num}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center mb-5">
                    <Icon size={22} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-white/48 leading-relaxed">{step.desc}</p>
                  {i < steps.length - 1 && (
                    <ChevronRight
                      size={20}
                      className="absolute top-1/2 -right-3 -translate-y-1/2 text-white/18 hidden md:block"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent to-violet-950/8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Everything you need to <span className="gradient-text">dominate</span> short-form
            </h2>
            <p className="text-white/38 text-lg max-w-xl mx-auto">
              All the tools of Descript, Opus Clip, and CapCut — in one AI-native platform.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="group bg-white/[0.03] border border-white/8 rounded-2xl p-6 card-hover cursor-default"
                >
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-200`}
                  >
                    <Icon size={20} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                  <p className="text-white/44 text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Platforms strip */}
      <section className="py-16 px-6 border-y border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-white/35 text-sm uppercase tracking-widest font-semibold mb-8">
            Export optimized for every platform
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {[
              'TikTok',
              'Instagram Reels',
              'YouTube Shorts',
              'LinkedIn',
              'Facebook',
              'X / Twitter',
            ].map((p) => (
              <div
                key={p}
                className="flex items-center gap-2 text-white/45 hover:text-white/75 transition-colors text-sm font-semibold"
              >
                <Globe size={14} />
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Loved by <span className="gradient-text">127,000+ creators</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-white/[0.03] border border-white/8 rounded-2xl p-7 card-hover"
              >
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} size={14} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-white/68 leading-relaxed mb-6 text-sm">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.avatarColor} flex items-center justify-center text-sm font-bold text-white`}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-white/38">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="py-24 px-6 bg-gradient-to-b from-violet-950/8 to-transparent"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Simple, <span className="gradient-text">transparent</span> pricing
            </h2>
            <p className="text-white/38 text-lg">Start free. Scale as you grow. Cancel anytime.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-8 border transition-all ${plan.highlight ? 'bg-gradient-to-b from-violet-600/20 to-pink-600/10 border-violet-500/40 shadow-2xl shadow-violet-500/18' : 'bg-white/[0.03] border-white/8 card-hover'}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-pink-600 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                    Most Popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                  <p className="text-white/38 text-sm mb-5">{plan.desc}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black">${plan.price}</span>
                    <span className="text-white/38">/mo</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle
                        size={15}
                        className={plan.highlight ? 'text-violet-400' : 'text-emerald-500'}
                      />
                      <span className="text-white/68">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/upload"
                  className={`block text-center font-bold py-3.5 rounded-xl transition-all ${plan.highlight ? 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white hover:shadow-lg hover:shadow-violet-500/30' : 'bg-white/8 hover:bg-white/12 text-white'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-violet-900/38 to-pink-900/28 border border-violet-500/20 rounded-3xl p-12 md:p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/8 to-pink-600/4 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
                Start creating <span className="gradient-text">viral content</span> today
              </h2>
              <p className="text-white/48 text-lg mb-8 max-w-xl mx-auto">
                Join 127,000+ creators already using ClipForge AI. First 14 days free — no credit
                card needed.
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-lg px-10 py-4 rounded-2xl transition-all hover:shadow-2xl hover:shadow-violet-500/30 hover:scale-105"
              >
                Get started for free <ArrowRight size={20} />
              </Link>
              <p className="text-white/22 text-sm mt-4">
                No credit card · No setup · Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                  <Zap size={14} className="text-white" />
                </div>
                <span className="font-bold">
                  ClipForge <span className="text-violet-400">AI</span>
                </span>
              </div>
              <p className="text-white/28 text-sm leading-relaxed max-w-xs">
                The AI-first video editing platform for modern creators. Turn long-form into
                short-form in minutes.
              </p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
              { title: 'Resources', links: ['Documentation', 'Blog', 'Tutorials', 'Status'] },
              { title: 'Company', links: ['About', 'Careers', 'Press', 'Contact'] },
            ].map((col, i) => (
              <div key={i}>
                <div className="text-white/45 text-xs font-semibold uppercase tracking-wider mb-3">
                  {col.title}
                </div>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-white/28 hover:text-white/58 text-sm transition-colors"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/20 text-xs">© 2026 ClipForge AI. All rights reserved.</p>
            <div className="flex gap-5 text-xs text-white/20">
              {['Privacy', 'Terms', 'Cookies'].map((l) => (
                <a key={l} href="#" className="hover:text-white/48">
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
