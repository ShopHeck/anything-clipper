import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Plus,
  Scissors,
  Send,
  Star,
  TrendingUp,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BASE = process.env.EXPO_PUBLIC_BASE_URL ?? '';

const SCORE_COLOR = (s: number) => (s >= 90 ? '#10b981' : s >= 75 ? '#f59e0b' : '#a78bfa');

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: '#ff0050',
  Reels: '#e1306c',
  Shorts: '#ff0000',
  LinkedIn: '#0077b5',
  Twitter: '#1da1f2',
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
  thumbnail: string;
}

interface Project {
  id: string;
  title: string;
  file_url: string | null;
  total_duration: number;
  viral_score: number;
  clip_count: number;
  status: string;
  created_at: string;
}

const PLATFORMS = [
  { id: 'TikTok', emoji: '🎵', color: '#ff0050' },
  { id: 'Instagram', emoji: '📸', color: '#e1306c' },
  { id: 'YouTube Shorts', emoji: '▶️', color: '#ff0000' },
  { id: 'LinkedIn', emoji: '💼', color: '#0077b5' },
];

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [queuedClip, setQueuedClip] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ project: Project; clips: Clip[] }>({
    queryKey: ['project', id],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to load project');
      return res.json();
    },
    enabled: !!id,
  });

  const queuePublish = useMutation({
    mutationFn: async ({
      clipId,
      platform,
      caption,
    }: {
      clipId: string;
      platform: string;
      caption: string;
    }) => {
      const res = await fetch(`${BASE}/api/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clip_id: clipId, project_id: id, platform, caption }),
      });
      if (!res.ok) throw new Error('Failed to queue');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['publish-jobs'] });
      Alert.alert('✅ Queued!', 'Clip added to your publishing queue.');
      setQueuedClip(null);
    },
    onError: () => Alert.alert('Error', 'Failed to queue clip for publishing.'),
  });

  const project = data?.project;
  const clips = data?.clips ?? [];

  const handlePublish = (clipId: string, clipTitle: string) => {
    Alert.alert(
      '📤 Publish Clip',
      `Where would you like to publish "${clipTitle}"?`,
      PLATFORMS.map((p) => ({
        text: `${p.emoji} ${p.id}`,
        onPress: () => {
          Alert.prompt?.(
            'Caption (optional)',
            'Add a caption for this post:',
            (caption) => {
              queuePublish.mutate({ clipId, platform: p.id, caption: caption || '' });
            },
            'plain-text',
            ''
          );
          if (!Alert.prompt) {
            queuePublish.mutate({ clipId, platform: p.id, caption: '' });
          }
        },
      })).concat([{ text: 'Cancel', style: 'cancel', onPress: () => {} } as never])
    );
  };

  const handleShare = async (clip: Clip) => {
    try {
      await Share.share({
        title: clip.title,
        message: `${clip.title}\n\n"${clip.hook}"\n\nViral Score: ${clip.score}`,
      });
    } catch {}
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

  return (
    <View style={{ flex: 1, backgroundColor: '#07070f' }}>
      <StatusBar barStyle="light-content" />

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
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
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
              {project?.title || 'Project'}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 }}>
              {clips.length} viral clips generated
            </Text>
          </View>
        </View>

        {/* Project stats */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[
            { icon: Scissors, val: String(clips.length), label: 'Clips', color: '#a78bfa' },
            {
              icon: Star,
              val: project?.viral_score ? String(project.viral_score) : '—',
              label: 'Score',
              color: '#f59e0b',
            },
            {
              icon: CheckCircle,
              val: project?.status === 'ready' ? 'Ready' : 'Processing',
              label: 'Status',
              color: project?.status === 'ready' ? '#10b981' : '#f59e0b',
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <View
                key={s.label}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 12,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.07)',
                  alignItems: 'center',
                }}
              >
                <Icon size={15} color={s.color} />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15, marginTop: 5 }}>
                  {s.val}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop: 1 }}>
                  {s.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {clips.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>⏳</Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 15,
              fontWeight: '700',
              marginBottom: 6,
            }}
          >
            No clips yet
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.28)',
              fontSize: 13,
              textAlign: 'center',
              paddingHorizontal: 40,
            }}
          >
            Clips are being generated. Check back in a moment.
          </Text>
        </View>
      ) : (
        <FlatList
          data={clips}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={
            <View
              style={{
                backgroundColor: 'rgba(139,92,246,0.08)',
                borderRadius: 14,
                padding: 14,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: 'rgba(139,92,246,0.2)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <TrendingUp size={16} color="#a78bfa" />
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, flex: 1 }}>
                Tap a clip to view · Tap{' '}
                <Text style={{ color: '#a78bfa', fontWeight: '700' }}>Publish</Text> to add to your
                queue
              </Text>
            </View>
          }
          renderItem={({ item: clip }) => (
            <Pressable
              onPress={() => router.push(`/clip/${id}/${clip.id}` as never)}
              style={({ pressed }) => [
                {
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: pressed ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              {/* Score bar */}
              <View
                style={{
                  backgroundColor: `${SCORE_COLOR(clip.score)}15`,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      backgroundColor: `${SCORE_COLOR(clip.score)}25`,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <Text
                      style={{ color: SCORE_COLOR(clip.score), fontWeight: '900', fontSize: 16 }}
                    >
                      {clip.score}
                    </Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>viral score</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} color="rgba(255,255,255,0.3)" />
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' }}>
                    {clip.duration_label}
                  </Text>
                </View>
              </View>

              <View style={{ padding: 14 }}>
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: '700',
                    lineHeight: 20,
                    marginBottom: 6,
                  }}
                >
                  {clip.title}
                </Text>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 12,
                    fontStyle: 'italic',
                    lineHeight: 17,
                    marginBottom: 10,
                  }}
                >
                  "{clip.hook}"
                </Text>

                {/* Platforms */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {(clip.platforms || []).slice(0, 4).map((p) => (
                    <View
                      key={p}
                      style={{
                        backgroundColor: `${PLATFORM_COLORS[p] ?? '#7c3aed'}22`,
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Text
                        style={{
                          color: PLATFORM_COLORS[p] ?? '#a78bfa',
                          fontSize: 10,
                          fontWeight: '700',
                        }}
                      >
                        {p}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => handleShare(clip)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderRadius: 10,
                      paddingVertical: 9,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <Send size={13} color="rgba(255,255,255,0.6)" />
                    <Text
                      style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' }}
                    >
                      Share
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handlePublish(clip.id, clip.title)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: 'rgba(139,92,246,0.2)',
                      borderRadius: 10,
                      paddingVertical: 9,
                      borderWidth: 1,
                      borderColor: 'rgba(139,92,246,0.3)',
                    }}
                  >
                    <Plus size={13} color="#a78bfa" />
                    <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '700' }}>
                      Publish
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
