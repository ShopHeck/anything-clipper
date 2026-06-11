import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Clock, Share2, Star, TrendingUp, Zap } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BASE = process.env.EXPO_PUBLIC_BASE_URL ?? '';

const SCORE_COLOR = (s: number) => (s >= 90 ? '#10b981' : s >= 75 ? '#f59e0b' : '#a78bfa');

const PLATFORM_META: Record<string, { emoji: string; color: string }> = {
  TikTok: { emoji: '🎵', color: '#ff0050' },
  Reels: { emoji: '📸', color: '#e1306c' },
  Shorts: { emoji: '▶️', color: '#ff0000' },
  LinkedIn: { emoji: '💼', color: '#0077b5' },
  Twitter: { emoji: '🐦', color: '#1da1f2' },
};

interface Clip {
  id: string;
  title: string;
  hook: string;
  score: number;
  platforms: string[];
  start_time: number;
  end_time: number;
  duration_label: string;
  reason: string;
}

export default function ClipDetail() {
  const { projectId, clipId } = useLocalSearchParams<{ projectId: string; clipId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery<{
    clips: Clip[];
    project: { title: string; file_url: string | null };
  }>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!projectId,
  });

  const clip = data?.clips?.find((c) => c.id === clipId);
  const project = data?.project;

  const handleShare = async () => {
    if (!clip) return;
    try {
      await Share.share({
        title: clip.title,
        message: `🔥 Viral clip: ${clip.title}\n\n"${clip.hook}"\n\nViral Score: ${clip.score}/100`,
      });
    } catch {}
  };

  const handleQueuePublish = (platform: string) => {
    Alert.alert(
      '✅ Added to Queue',
      `"${clip?.title}" has been queued for ${platform}. Open the Publish tab to manage your queue.`
    );
    fetch(`${BASE}/api/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clip_id: clipId,
        project_id: projectId,
        platform,
        caption: clip?.hook,
      }),
    }).catch(() => {});
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#07070f',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  if (!clip) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#07070f',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>Clip not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#a78bfa', fontSize: 14 }}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#07070f' }}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: 14,
            backgroundColor: '#0a0a16',
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.07)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeft size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 10,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Clip Detail
              </Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
                {project?.title}
              </Text>
            </View>
            <Pressable
              onPress={handleShare}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(139,92,246,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(139,92,246,0.3)',
              }}
            >
              <Share2 size={16} color="#a78bfa" />
            </Pressable>
          </View>
        </View>

        <View style={{ padding: 16 }}>
          {/* Score hero */}
          <View
            style={{
              backgroundColor: `${SCORE_COLOR(clip.score)}12`,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: `${SCORE_COLOR(clip.score)}25`,
              marginBottom: 16,
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Star size={16} color={SCORE_COLOR(clip.score)} fill={SCORE_COLOR(clip.score)} />
              <Text
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 12,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Viral Score
              </Text>
            </View>
            <Text
              style={{
                color: SCORE_COLOR(clip.score),
                fontWeight: '900',
                fontSize: 52,
                lineHeight: 58,
              }}
            >
              {clip.score}
            </Text>
            <View
              style={{
                width: '100%',
                height: 4,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 2,
                marginTop: 12,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${clip.score}%`,
                  height: 4,
                  backgroundColor: SCORE_COLOR(clip.score),
                  borderRadius: 2,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <Clock size={12} color="rgba(255,255,255,0.4)" />
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 11,
                    fontWeight: '700',
                    marginTop: 3,
                  }}
                >
                  {clip.duration_label}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>Duration</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <TrendingUp size={12} color="rgba(255,255,255,0.4)" />
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 11,
                    fontWeight: '700',
                    marginTop: 3,
                  }}
                >
                  Top {Math.max(1, Math.round((100 - clip.score) / 5))}%
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>Content</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Zap size={12} color="rgba(255,255,255,0.4)" />
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 11,
                    fontWeight: '700',
                    marginTop: 3,
                  }}
                >
                  {clip.platforms?.length || 0}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>Platforms</Text>
              </View>
            </View>
          </View>

          {/* Title & Hook */}
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 10,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Title
            </Text>
            <Text
              style={{
                color: '#fff',
                fontSize: 17,
                fontWeight: '800',
                lineHeight: 24,
                marginBottom: 16,
              }}
            >
              {clip.title}
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 10,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              Hook
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 14,
                lineHeight: 21,
                fontStyle: 'italic',
              }}
            >
              "{clip.hook}"
            </Text>
          </View>

          {/* Why it works */}
          {clip.reason && (
            <View
              style={{
                backgroundColor: 'rgba(139,92,246,0.08)',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: 'rgba(139,92,246,0.2)',
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: '#a78bfa',
                  fontSize: 11,
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 8,
                }}
              >
                ⚡ Why it works
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 20 }}>
                {clip.reason}
              </Text>
            </View>
          )}

          {/* Recommended platforms */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 11,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 10,
              }}
            >
              Recommended Platforms
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(clip.platforms || []).map((p) => {
                const meta = PLATFORM_META[p] ?? { emoji: '🌐', color: '#8b5cf6' };
                return (
                  <Pressable
                    key={p}
                    onPress={() => handleQueuePublish(p)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      backgroundColor: `${meta.color}18`,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: `${meta.color}35`,
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                    <Text style={{ color: meta.color, fontSize: 13, fontWeight: '800' }}>{p}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Timestamp */}
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.07)',
              flexDirection: 'row',
              gap: 20,
              marginBottom: 16,
            }}
          >
            {[
              {
                label: 'Start',
                val: `${Math.floor(clip.start_time / 60)}:${String(Math.floor(clip.start_time % 60)).padStart(2, '0')}`,
              },
              {
                label: 'End',
                val: `${Math.floor(clip.end_time / 60)}:${String(Math.floor(clip.end_time % 60)).padStart(2, '0')}`,
              },
              { label: 'Length', val: clip.duration_label },
            ].map((t) => (
              <View key={t.label} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginBottom: 4 }}>
                  {t.label}
                </Text>
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: '800',
                    fontSize: 16,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {t.val}
                </Text>
              </View>
            ))}
          </View>

          {/* Actions */}
          <Pressable
            onPress={handleShare}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: '#7c3aed',
              borderRadius: 16,
              paddingVertical: 16,
              marginBottom: 10,
            }}
          >
            <Share2 size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Share clip</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (clip.platforms?.length) {
                handleQueuePublish(clip.platforms[0]);
              } else {
                Alert.alert('No platforms', 'This clip has no recommended platforms.');
              }
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <Zap size={16} color="rgba(255,255,255,0.6)" />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 15 }}>
              Quick publish to {clip.platforms?.[0] ?? 'platform'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
