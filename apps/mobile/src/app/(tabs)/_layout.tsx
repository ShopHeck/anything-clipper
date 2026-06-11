import { Tabs } from 'expo-router';
import { Home, Scissors, Send, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a16',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.06)',
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#a78bfa',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color }) => <Home color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="clips"
        options={{
          title: 'Clips',
          tabBarIcon: ({ color }) => <Scissors color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="publish"
        options={{
          title: 'Publish',
          tabBarIcon: ({ color }) => <Send color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
