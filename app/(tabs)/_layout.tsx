import { Tabs } from 'expo-router';
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

function UploadTabButton({ onPress, children }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.uploadBtn} activeOpacity={0.8}>
      <View style={styles.uploadInner}>
        <Ionicons name="add" size={26} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const bg = colors.tabBar;
  const border = colors.tabBarBorder;
  const inactive = colors.iconInactive;
  const active = colors.iconActive;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: bg,
          borderTopColor: border,
          borderTopWidth: 0.5,
          height: 56,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: active,
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Asosiy',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shorts"
        options={{
          title: 'Shorts',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="play-circle-outline" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: '',
          tabBarButton: (props) => <UploadTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Obunalar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'tv' : 'tv-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Siz',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  uploadBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadInner: {
    width: 44,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#aaa',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
