'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, Star, Trash2, Upload, Check } from 'lucide-react';

interface BrandKit {
  id: string;
  name: string;
  logo_url: string | null;
  logo_position: 'tl' | 'tr' | 'bl' | 'br';
  caption_color: string | null;
  is_default: boolean;
}

const POSITIONS: { id: BrandKit['logo_position']; label: string }[] = [
  { id: 'tl', label: 'Top left' },
  { id: 'tr', label: 'Top right' },
  { id: 'bl', label: 'Bottom left' },
  { id: 'br', label: 'Bottom right' },
];

export default function BrandPage() {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPosition, setLogoPosition] = useState<BrandKit['logo_position']>('br');
  const [captionColor, setCaptionColor] = useState('#4ade80');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/brand-kits');
      if (res.ok) setKits((await res.json()).brandKits || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const uploadLogo = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const presign = await fetch('/api/brand-kits/logo-presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!presign.ok) {
        const d = await presign.json().catch(() => ({}));
        throw new Error(d.error || 'Logo upload is unavailable on this deployment.');
      }
      const { uploadUrl, readUrl } = await presign.json();
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/png' },
        body: file,
      });
      if (!put.ok) throw new Error('Upload failed.');
      setLogoUrl(readUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Logo upload failed');
    } finally {
      setUploading(false);
    }
  };

  const create = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/brand-kits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'My Brand',
          logoUrl: logoUrl || null,
          logoPosition,
          captionColor,
          isDefault: kits.length === 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not save brand kit');
      }
      setName('');
      setLogoUrl('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id: string) => {
    await fetch('/api/brand-kits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isDefault: true }),
    });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this brand kit?')) return;
    await fetch(`/api/brand-kits?id=${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 mb-6"
        >
          <ChevronLeft size={16} />
          Dashboard
        </Link>

        <h1 className="text-2xl font-black mb-1">Brand kits</h1>
        <p className="text-sm text-white/40 mb-8">
          A logo watermark and caption color applied automatically when you export clips.
        </p>

        {/* Create */}
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-4 text-sm font-bold">
            <Plus size={15} className="text-violet-400" />
            New brand kit
          </div>

          <label className="block text-[11px] text-white/45 mb-1.5">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Brand"
            className="w-full bg-white/6 border border-white/10 text-white/85 text-sm px-3 py-2 rounded-lg mb-4 focus:border-violet-500/50 outline-none"
          />

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[11px] text-white/45 mb-1.5">Logo</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/6 border border-white/10 text-white/65 text-[12px] hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {logoUrl ? <Check size={13} className="text-emerald-400" /> : <Upload size={13} />}
                {uploading ? 'Uploading…' : logoUrl ? 'Logo set' : 'Upload logo'}
              </button>
            </div>
            <div>
              <label className="block text-[11px] text-white/45 mb-1.5">Caption color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={captionColor}
                  onChange={(e) => setCaptionColor(e.target.value)}
                  className="w-9 h-9 rounded-lg bg-transparent border border-white/10 cursor-pointer"
                />
                <span className="text-[12px] text-white/55 font-mono">{captionColor}</span>
              </div>
            </div>
          </div>

          <label className="block text-[11px] text-white/45 mb-1.5">Logo position</label>
          <div className="flex gap-2 mb-5">
            {POSITIONS.map((p) => (
              <button
                key={p.id}
                onClick={() => setLogoPosition(p.id)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${logoPosition === p.id ? 'bg-violet-600/25 border-violet-500/40 text-violet-300' : 'bg-white/4 border-white/8 text-white/40 hover:text-white/60'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {error && <p className="text-[12px] text-rose-400 mb-3">{error}</p>}

          <button
            onClick={create}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm transition-all disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save brand kit'}
          </button>
        </div>

        {/* List */}
        <h2 className="text-sm font-bold text-white/70 mb-3">Your brand kits</h2>
        {loading ? (
          <p className="text-sm text-white/35">Loading…</p>
        ) : kits.length === 0 ? (
          <p className="text-sm text-white/35">No brand kits yet.</p>
        ) : (
          <div className="space-y-3">
            {kits.map((kit) => (
              <div
                key={kit.id}
                className="bg-white/[0.03] border border-white/8 rounded-xl p-4 flex items-center gap-4"
              >
                <div
                  className="w-10 h-10 rounded-lg shrink-0 border border-white/10"
                  style={{ backgroundColor: kit.caption_color ?? '#222' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    {kit.name}
                    {kit.is_default && (
                      <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/35">
                    {kit.logo_url ? 'Logo ✓' : 'No logo'} · {kit.caption_color ?? 'no color'}
                  </div>
                </div>
                {!kit.is_default && (
                  <button
                    onClick={() => setDefault(kit.id)}
                    className="text-[11px] text-white/50 hover:text-violet-300 flex items-center gap-1"
                  >
                    <Star size={12} />
                    Default
                  </button>
                )}
                <button
                  onClick={() => remove(kit.id)}
                  className="text-rose-400/60 hover:text-rose-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
