import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Globe,
  Send,
  Share2,
  Trash2,
  TrendingUp,
  Zap,
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

interface PublishJob {
  id: string;
  clip_id: string;
  project_id: string;
  platform: string;
  status: string;
  caption: string | null;
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

const PLATFORM_META: Record<string, { emoji: string; color: string; deep: string }> = {
  TikTok: { emoji: '🎵', color: '#ff0050', deep: 'tiktok://' },
  Instagram: { emoji: '📸', color: '#e1306c', deep: 'instagram://' },
  'YouTube Shorts': { emoji: '▶️', color: '#ff0000', deep: 'youtube://' },
  LinkedIn: { emoji: '💼', color: '#0077b5', deep: 'linkedin://' },
};

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  queued: { label: 'Queued', color: '#f59e0b', icon: Clock },
  scheduled: { label: 'Scheduled', color: '#8b5cf6', icon: Clock },
  published: { label: 'Published', color: '#10b981', icon: CheckCircle },
  failed: { label: 'Failed', color: '#ef4444', icon: AlertCircle },
};

const BASE = process.env.EXPO_PUBLIC_BASE_URL ?? '';

export default function PublishScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'queue' | 'accounts'>('queue');

  const { data: jobsData, isLoading: jobsLoading } = useQuery<{ jobs: PublishJob[] }>({
    queryKey: ['publish-jobs'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/publish`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: connData, isLoading: connLoading } = useQuery<{ connections: Connection[] }>({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/connections`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const deleteJob = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/api/publish/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['publish-jobs'] }),
  });

  const disconnectPlatform = useMutation({
    mutationFn: async (platform: string) => {
      await fetch(`${BASE}/api/connections?platform=${encodeURIComponent(platform)}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });

  const jobs = jobsData?.jobs ?? [];
  const connections = connData?.connections ?? [];

  const handleNativeShare = async (job: PublishJob) => {
    try {
      await Share.share({
        title: job.clip_title,
        message: `Check out this viral clip: ${job.clip_title}${job.platform_url ? `\n${job.platform_url}` : ''}`,
      });
    } catch {}
  };

  const handleOpenPlatform = async (platform: string) => {
    const meta = PLATFORM_META[platform];
    if (!meta) return;
    try {
      const canOpen = await Linking.canOpenURL(meta.deep);
      if (canOpen) {
        await Linking.openURL(meta.deep);
      }
    } catch {}
  };

  const handleConnectAccount = (platform: string) => {
    Alert.alert(
      `Connect ${platform}`,
      `This will open ${platform} so you can authorize ClipForge to publish on your behalf.\n\nNote: Platform OAuth approval is required for auto-publishing. You can still share clips manually.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Open ${platform}`, onPress: () => handleOpenPlatform(platform) },
        {
          text: 'Add manually',
          onPress: () => {
            Alert.prompt?.('Username', `Enter your ${platform} username:`, (username) => {
              if (!username) return;
              fetch(`${BASE}/api/connections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform, username }),
              }).then(() => qc.invalidateQueries({ queryKey: ['connections'] }));
            });
          },
        },
      ]
    );
  };

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
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
            <Send size={16} color="#a78bfa" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Publish Hub</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
              Manage your publishing queue
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {[
            {
              label: 'Published',
              val: String(jobs.filter((j) => j.status === 'published').length),
              color: '#10b981',
            },
            {
              label: 'Queued',
              val: String(jobs.filter((j) => j.status === 'queued').length),
              color: '#f59e0b',
            },
            { label: 'Connected', val: String(connections.length), color: '#a78bfa' },
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
                alignItems: 'center',
              }}
            >
              <Text style={{ color: s.color, fontWeight: '900', fontSize: 20 }}>{s.val}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Tab switcher */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            padding: 3,
          }}
        >
          {(['queue', 'accounts'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 10,
                backgroundColor: tab === t ? '#7c3aed' : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                {t === 'queue' ? '📋 Queue' : '🔗 Accounts'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Queue Tab */}
      {tab === 'queue' &&
        (jobsLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#8b5cf6" />
          </View>
        ) : (
          <FlatList
            data={jobs}
            keyExtractor={(j) => j.id}
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📤</Text>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 15,
                    fontWeight: '700',
                    marginBottom: 6,
                  }}
                >
                  No publish jobs
                </Text>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.28)',
                    fontSize: 13,
                    textAlign: 'center',
                    paddingHorizontal: 40,
                  }}
                >
                  Queue clips for publishing from the Clips tab or web app
                </Text>
              </View>
            }
            renderItem={({ item: job }) => {
              const platformMeta = PLATFORM_META[job.platform] ?? {
                emoji: '🌐',
                color: '#8b5cf6',
                deep: '',
              };
              const statusMeta = STATUS_META[job.status] ?? STATUS_META.queued;
              const StatusIcon = statusMeta.icon;
              return (
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Platform banner */}
                  <View
                    style={{
                      backgroundColor: `${platformMeta.color}22`,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 18 }}>{platformMeta.emoji}</Text>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                        {job.platform}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: `${statusMeta.color}22`,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}
                    >
                      <StatusIcon size={11} color={statusMeta.color} />
                      <Text style={{ color: statusMeta.color, fontSize: 11, fontWeight: '700' }}>
                        {statusMeta.label}
                      </Text>
                    </View>
                  </View>
                  <View style={{ padding: 14 }}>
                    <Text
                      style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 4 }}
                      numberOfLines={2}
                    >
                      {job.clip_title || 'Untitled clip'}
                    </Text>
                    {job.clip_score > 0 && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          marginBottom: 10,
                        }}
                      >
                        <TrendingUp size={11} color="#a78bfa" />
                        <Text style={{ color: '#a78bfa', fontSize: 11, fontWeight: '700' }}>
                          Score: {job.clip_score}
                        </Text>
                      </View>
                    )}
                    {job.caption && (
                      <Text
                        style={{
                          color: 'rgba(255,255,255,0.45)',
                          fontSize: 12,
                          lineHeight: 18,
                          marginBottom: 10,
                        }}
                        numberOfLines={2}
                      >
                        {job.caption}
                      </Text>
                    )}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={() => handleNativeShare(job)}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: 'rgba(139,92,246,0.15)',
                          borderRadius: 10,
                          paddingVertical: 9,
                          borderWidth: 1,
                          borderColor: 'rgba(139,92,246,0.25)',
                        }}
                      >
                        <Share2 size={13} color="#a78bfa" />
                        <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '700' }}>
                          Share
                        </Text>
                      </Pressable>
                      {job.platform_url && (
                        <Pressable
                          onPress={() => Linking.openURL(job.platform_url!)}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            backgroundColor: `${platformMeta.color}22`,
                            borderRadius: 10,
                            paddingVertical: 9,
                            borderWidth: 1,
                            borderColor: `${platformMeta.color}44`,
                          }}
                        >
                          <Globe size={13} color={platformMeta.color} />
                          <Text
                            style={{ color: platformMeta.color, fontSize: 12, fontWeight: '700' }}
                          >
                            View post
                          </Text>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() =>
                          Alert.alert('Delete', 'Remove this job from the queue?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => deleteJob.mutate(job.id),
                            },
                          ])
                        }
                        style={{
                          width: 38,
                          height: 38,
                          backgroundColor: 'rgba(239,68,68,0.12)',
                          borderRadius: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: 'rgba(239,68,68,0.2)',
                        }}
                      >
                        <Trash2 size={14} color="#f87171" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        ))}

      {/* Accounts Tab */}
      {tab === 'accounts' && (
        <FlatList
          data={Object.keys(PLATFORM_META)}
          keyExtractor={(p) => p}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          ListHeaderComponent={
            <View
              style={{
                backgroundColor: 'rgba(139,92,246,0.08)',
                borderRadius: 14,
                padding: 14,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: 'rgba(139,92,246,0.2)',
              }}
            >
              <Text style={{ color: '#a78bfa', fontWeight: '700', fontSize: 13, marginBottom: 4 }}>
                💡 About Social Publishing
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18 }}>
                Connect your accounts to queue clips for publishing. For fully automated posting,
                platform API approval is required. You can also share clips manually using your
                device's share sheet.
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item: platform }) => {
            const meta = PLATFORM_META[platform];
            const conn = connections.find((c) => c.platform === platform);
            return (
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: conn ? `${meta.color}33` : 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      backgroundColor: `${meta.color}22`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                      {platform}
                    </Text>
                    {conn ? (
                      <Text style={{ color: '#10b981', fontSize: 12, marginTop: 2 }}>
                        @{conn.username} ·{' '}
                        {conn.followers_count > 0
                          ? `${(conn.followers_count / 1000).toFixed(1)}k followers`
                          : 'Connected'}
                      </Text>
                    ) : (
                      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>
                        Not connected
                      </Text>
                    )}
                  </View>
                  {conn ? (
                    <Pressable
                      onPress={() =>
                        Alert.alert('Disconnect', `Remove ${platform} connection?`, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Disconnect',
                            style: 'destructive',
                            onPress: () => disconnectPlatform.mutate(platform),
                          },
                        ])
                      }
                      style={{
                        backgroundColor: 'rgba(239,68,68,0.12)',
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderWidth: 1,
                        borderColor: 'rgba(239,68,68,0.2)',
                      }}
                    >
                      <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '700' }}>
                        Remove
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => handleConnectAccount(platform)}
                      style={{
                        backgroundColor: `${meta.color}22`,
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderWidth: 1,
                        borderColor: `${meta.color}44`,
                      }}
                    >
                      <Text style={{ color: meta.color, fontSize: 12, fontWeight: '800' }}>
                        Connect
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
