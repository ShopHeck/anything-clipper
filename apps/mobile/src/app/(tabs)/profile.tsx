import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import {
  BarChart2,
  Bell,
  ChevronRight,
  HelpCircle,
  Moon,
  Scissors,
  Share2,
  Shield,
  Star,
  User,
  Zap,
} from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BASE = process.env.EXPO_PUBLIC_BASE_URL ?? '';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  const { data } = useQuery<{
    projects: Array<{
      id: string;
      clip_count: number;
      viral_score: number;
      total_duration: number;
    }>;
  }>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/projects`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const projects = data?.projects ?? [];
  const totalClips = projects.reduce((a, p) => a + (p.clip_count || 0), 0);
  const totalHours = (projects.reduce((a, p) => a + (p.total_duration || 0), 0) / 3600).toFixed(1);
  const avgScore = projects.filter((p) => p.viral_score).length
    ? Math.round(
        projects.filter((p) => p.viral_score).reduce((a, p) => a + p.viral_score, 0) /
          projects.filter((p) => p.viral_score).length
      )
    : 0;

  const menuSections = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Edit Profile', sub: 'Name, email, avatar', onPress: () => {} },
        { icon: Bell, label: 'Notifications', sub: 'Push alerts for new clips', onPress: () => {} },
        { icon: Shield, label: 'Privacy & Security', sub: 'Data settings', onPress: () => {} },
      ],
    },
    {
      title: 'Publishing',
      items: [
        {
          icon: Share2,
          label: 'Connected Accounts',
          sub: 'TikTok, Instagram, YouTube',
          onPress: () => {},
        },
        {
          icon: Star,
          label: 'Upgrade to Pro',
          sub: 'Unlimited clips & scheduling',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'App',
      items: [
        {
          icon: HelpCircle,
          label: 'Help & Support',
          sub: 'Docs, FAQs, contact us',
          onPress: () => Linking.openURL('https://www.anything.com/docs'),
        },
        {
          icon: Star,
          label: 'Rate ClipForge',
          sub: 'Love the app? Leave a review!',
          onPress: () => {},
        },
      ],
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#07070f' }}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View
          style={{
            paddingTop: insets.top + 20,
            paddingHorizontal: 20,
            paddingBottom: 24,
            backgroundColor: '#0a0a16',
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 24,
                backgroundColor: '#7c3aed',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
                borderWidth: 3,
                borderColor: 'rgba(139,92,246,0.4)',
              }}
            >
              <Zap size={34} color="#fff" />
            </View>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20, marginBottom: 3 }}>
              ClipForge User
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(139,92,246,0.15)',
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: 'rgba(139,92,246,0.3)',
              }}
            >
              <Star size={12} color="#a78bfa" fill="#a78bfa" />
              <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '700' }}>
                Creator Plan
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { icon: Scissors, val: String(totalClips), label: 'Clips', color: '#a78bfa' },
              {
                icon: BarChart2,
                val: String(avgScore || '—'),
                label: 'Avg Score',
                color: '#f59e0b',
              },
              { icon: Zap, val: `${totalHours}h`, label: 'Processed', color: '#10b981' },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <View
                  key={s.label}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.07)',
                  }}
                >
                  <Icon size={18} color={s.color} />
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, marginTop: 6 }}>
                    {s.val}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>
                    {s.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Menu sections */}
        <View style={{ padding: 16 }}>
          {menuSections.map((section) => (
            <View key={section.title} style={{ marginBottom: 20 }}>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: 11,
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 8,
                  paddingHorizontal: 4,
                }}
              >
                {section.title}
              </Text>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                {section.items.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <Pressable
                      key={item.label}
                      onPress={item.onPress}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 14,
                          gap: 12,
                          borderBottomWidth: i < section.items.length - 1 ? 1 : 0,
                          borderBottomColor: 'rgba(255,255,255,0.06)',
                          backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : 'transparent',
                        },
                      ]}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          backgroundColor: 'rgba(139,92,246,0.15)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={17} color="#a78bfa" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                          {item.label}
                        </Text>
                        <Text
                          style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 }}
                        >
                          {item.sub}
                        </Text>
                      </View>
                      <ChevronRight size={16} color="rgba(255,255,255,0.25)" />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Upgrade card */}
          <View
            style={{
              backgroundColor: '#7c3aed',
              borderRadius: 18,
              padding: 18,
              marginBottom: 16,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 100,
                height: 100,
                borderRadius: 50,
                backgroundColor: 'rgba(255,255,255,0.08)',
              }}
            />
            <Text style={{ fontSize: 24, marginBottom: 8 }}>⚡️</Text>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, marginBottom: 6 }}>
              Upgrade to Pro
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 13,
                lineHeight: 19,
                marginBottom: 14,
              }}
            >
              Unlimited clips, advanced AI analysis, team sharing, and direct publishing to all
              platforms.
            </Text>
            <Pressable
              style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#7c3aed', fontWeight: '900', fontSize: 15 }}>Get Pro →</Text>
            </Pressable>
          </View>

          <Text
            style={{
              color: 'rgba(255,255,255,0.2)',
              fontSize: 11,
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            ClipForge AI v1.0 · Made with ⚡
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
