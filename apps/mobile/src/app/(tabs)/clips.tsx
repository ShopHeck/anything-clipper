import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Clock, Scissors, TrendingUp, Zap } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: '#ff0050',
  Reels: '#e1306c',
  Shorts: '#ff0000',
  LinkedIn: '#0077b5',
  Twitter: '#1da1f2',
  YouTube: '#ff0000',
};

const SCORE_COLOR = (s: number) => (s >= 90 ? '#10b981' : s >= 75 ? '#f59e0b' : '#8b5cf6');

interface Clip {
  id: string;
  project_id: string;
  title: string;
  hook: string;
  score: number;
  platforms: string[];
  start_time: number;
  end_time: number;
  duration_label: string;
  reason: string;
  thumbnail: string;
  project_title: string;
  created_at: string;
}

const BASE = process.env.EXPO_PUBLIC_BASE_URL ?? '';

const FILTERS = ['All', 'TikTok', 'Reels', 'Shorts', 'LinkedIn'];

export default function ClipsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery<{ clips: Clip[] }>({
    queryKey: ['all-clips'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/clips`);
      if (!res.ok) throw new Error('Failed to load clips');
      return res.json();
    },
  });

  const clips = data?.clips ?? [];
  const filtered = clips.filter((c) => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || c.platforms?.includes(filter);
    return matchSearch && matchFilter;
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#07070f' }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 14,
          backgroundColor: '#0a0a16',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              backgroundColor: 'rgba(139,92,246,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Scissors size={16} color="#a78bfa" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Clips Library</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
              {clips.length} viral clips generated
            </Text>
          </View>
        </View>

        {/* Search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 12,
            paddingHorizontal: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.3)', marginRight: 8 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search clips..."
            placeholderTextColor="rgba(255,255,255,0.28)"
            style={{ flex: 1, color: '#fff', fontSize: 14, paddingVertical: 11 }}
          />
        </View>

        {/* Platform filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: filter === f ? '#7c3aed' : 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: filter === f ? '#7c3aed' : 'rgba(255,255,255,0.1)',
                }}
              >
                <Text
                  style={{
                    color: filter === f ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {f === 'TikTok'
                    ? '🎵 '
                    : f === 'Reels'
                      ? '📸 '
                      : f === 'Shorts'
                        ? '▶️ '
                        : f === 'LinkedIn'
                          ? '💼 '
                          : ''}
                  {f}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 12, fontSize: 14 }}>
            Loading clips…
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.project_id}-${item.id}`}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>✂️</Text>
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
                Upload a video to generate your first viral clips
              </Text>
            </View>
          }
          renderItem={({ item: clip }) => (
            <Pressable
              onPress={() => router.push(`/clip/${clip.project_id}/${clip.id}` as never)}
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
              {/* Top: Score + Duration */}
              <View
                style={{
                  backgroundColor: 'rgba(139,92,246,0.12)',
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
                      backgroundColor: `${SCORE_COLOR(clip.score)}22`,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderWidth: 1,
                      borderColor: `${SCORE_COLOR(clip.score)}44`,
                    }}
                  >
                    <Text
                      style={{ color: SCORE_COLOR(clip.score), fontWeight: '900', fontSize: 15 }}
                    >
                      {clip.score}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={{
                        color: 'rgba(255,255,255,0.35)',
                        fontSize: 9,
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Viral Score
                    </Text>
                    <TrendingUp size={10} color={SCORE_COLOR(clip.score)} />
                  </View>
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
                    lineHeight: 17,
                    marginBottom: 10,
                    fontStyle: 'italic',
                  }}
                >
                  "{clip.hook}"
                </Text>

                {/* Source project */}
                <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginBottom: 10 }}>
                  From: {clip.project_title}
                </Text>

                {/* Platforms */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(clip.platforms || []).slice(0, 3).map((p) => (
                      <View
                        key={p}
                        style={{
                          backgroundColor: `${PLATFORM_COLORS[p] ?? '#7c3aed'}22`,
                          borderRadius: 6,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderWidth: 1,
                          borderColor: `${PLATFORM_COLORS[p] ?? '#7c3aed'}44`,
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
                  <Pressable
                    onPress={() => router.push(`/clip/${clip.project_id}/${clip.id}` as never)}
                    style={{
                      backgroundColor: 'rgba(139,92,246,0.2)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: 'rgba(139,92,246,0.3)',
                    }}
                  >
                    <Text style={{ color: '#a78bfa', fontSize: 11, fontWeight: '700' }}>
                      View →
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
