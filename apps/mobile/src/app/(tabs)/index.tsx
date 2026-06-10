import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Clock, Play, Plus, RefreshCw, Scissors, Star, TrendingUp, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48) / 2;

const THUMB_COLORS = [
  ['#4c1d95', '#831843'],
  ['#881337', '#4a044e'],
  ['#1e3a5f', '#0e7490'],
  ['#78350f', '#92400e'],
  ['#064e3b', '#065f46'],
  ['#1e1b4b', '#312e81'],
];

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  ready: { label: 'Ready', color: '#10b981', dot: '#10b981' },
  processing: { label: 'Processing', color: '#8b5cf6', dot: '#8b5cf6' },
  transcribing: { label: 'Transcribing', color: '#f59e0b', dot: '#f59e0b' },
  uploading: { label: 'Uploading', color: '#3b82f6', dot: '#3b82f6' },
};

function fmt(seconds: number) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
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

const BASE = process.env.EXPO_PUBLIC_BASE_URL ?? '';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery<{ projects: Project[] }>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects`);
      if (!res.ok) throw new Error('Failed to load projects');
      return res.json();
    },
    refetchInterval: 15000,
  });

  const projects = data?.projects ?? [];
  const filtered = projects.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  const totalClips = projects.reduce((a, p) => a + (p.clip_count || 0), 0);
  const avgScore = projects.filter((p) => p.viral_score).length
    ? Math.round(
        projects.filter((p) => p.viral_score).reduce((a, p) => a + p.viral_score, 0) /
          projects.filter((p) => p.viral_score).length
      )
    : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#07070f' }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: '#0a0a16',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: '#7c3aed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={16} color="#fff" />
            </View>
            <View>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>ClipForge</Text>
              <Text style={{ color: '#a78bfa', fontSize: 11, fontWeight: '600' }}>AI Studio</Text>
            </View>
          </View>
          <Pressable
            onPress={refetch}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            {isRefetching ? (
              <ActivityIndicator size="small" color="#a78bfa" />
            ) : (
              <RefreshCw size={16} color="rgba(255,255,255,0.5)" />
            )}
          </Pressable>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Projects', val: String(projects.length), icon: '📁' },
            { label: 'Clips', val: String(totalClips), icon: '✂️' },
            { label: 'Avg Score', val: avgScore ? String(avgScore) : '—', icon: '⭐' },
          ].map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: 12,
                padding: 10,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.07)',
              }}
            >
              <Text style={{ fontSize: 16 }}>{s.icon}</Text>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, marginTop: 2 }}>
                {s.val}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 12,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.3)', marginRight: 8 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search projects..."
            placeholderTextColor="rgba(255,255,255,0.28)"
            style={{ flex: 1, color: '#fff', fontSize: 14, paddingVertical: 12 }}
          />
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 12, fontSize: 14 }}>
            Loading projects…
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
          ListHeaderComponent={
            <Pressable
              onPress={() => {
                // Open web upload page via linking
              }}
              style={{
                width: CARD_W,
                backgroundColor: 'rgba(124,58,237,0.08)',
                borderRadius: 16,
                borderWidth: 2,
                borderColor: 'rgba(124,58,237,0.2)',
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                aspectRatio: 1,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: 'rgba(124,58,237,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <Plus size={22} color="#a78bfa" />
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700' }}>
                New Project
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 2 }}>
                Upload on web →
              </Text>
            </Pressable>
          }
          ListEmptyComponent={
            <View
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}
            >
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🎬</Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 15,
                  fontWeight: '700',
                  marginBottom: 6,
                }}
              >
                No projects yet
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.28)',
                  fontSize: 13,
                  textAlign: 'center',
                  paddingHorizontal: 40,
                }}
              >
                Upload a video on the web to generate your first viral clips
              </Text>
            </View>
          }
          renderItem={({ item: project, index }) => {
            const colors = THUMB_COLORS[index % THUMB_COLORS.length];
            const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.uploading;
            return (
              <Pressable
                onPress={() => router.push(`/project/${project.id}` as never)}
                style={({ pressed }) => [
                  {
                    width: CARD_W,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderRadius: 16,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: pressed ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.08)',
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                {/* Thumbnail */}
                <View
                  style={{
                    height: 100,
                    backgroundColor: colors[0],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: colors[1],
                      opacity: 0.6,
                    }}
                  />
                  <Play size={28} color="rgba(255,255,255,0.6)" />
                  {project.clip_count > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        left: 8,
                        backgroundColor: 'rgba(139,92,246,0.8)',
                        borderRadius: 8,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                        {project.clip_count} clips
                      </Text>
                    </View>
                  )}
                  {project.viral_score > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        borderRadius: 8,
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Star size={9} color="#fbbf24" fill="#fbbf24" />
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                        {project.viral_score}
                      </Text>
                    </View>
                  )}
                </View>
                {/* Info */}
                <View style={{ padding: 10 }}>
                  <Text
                    style={{ color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 17 }}
                    numberOfLines={2}
                  >
                    {project.title}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 8,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        backgroundColor: `${statusCfg.color}22`,
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: statusCfg.color,
                        }}
                      />
                      <Text style={{ color: statusCfg.color, fontSize: 9, fontWeight: '700' }}>
                        {statusCfg.label}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Clock size={9} color="rgba(255,255,255,0.3)" />
                      <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
                        {fmt(project.total_duration)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
