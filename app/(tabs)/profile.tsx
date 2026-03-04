import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, StatusBar, ActivityIndicator, Alert,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { Profile, Video } from '@/lib/types'
import { Session } from '@supabase/supabase-js'

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Bugun'
  if (days < 7) return `${days} kun oldin`
  return `${Math.floor(days / 7)} hafta oldin`
}

type MenuItem = {
  icon: any
  iconName: string
  label: string
  onPress: () => void
}

export default function ProfileScreen() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [watchHistory, setWatchHistory] = useState<Video[]>([])
  const [myVideos, setMyVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadAll(session)
      else setLoading(false)
    })
  }, [])

  async function loadAll(s: Session) {
    const userId = s.user.id
    const [profileRes, historyRes, videosRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('watch_history')
        .select(`video:videos(*, channel:profiles(id, username, full_name, avatar_url))`)
        .eq('user_id', userId).order('watched_at', { ascending: false }).limit(10),
      supabase.from('videos').select('*').eq('channel_id', userId)
        .order('created_at', { ascending: false }).limit(10),
    ])

    if (profileRes.data) setProfile(profileRes.data as Profile)
    else {
      await supabase.from('profiles').insert({ id: userId, email: s.user.email })
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (data) setProfile(data as Profile)
    }
    setWatchHistory((historyRes.data ?? []).map((h: any) => h.video).filter(Boolean) as Video[])
    setMyVideos((videosRes.data ?? []) as Video[])
    setLoading(false)
  }

  async function pickAvatar() {
    if (!session) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    })
    if (result.canceled) return
    const uri = result.assets[0].uri
    const response = await fetch(uri)
    const blob = await response.blob()
    const arrayBuffer = await new Response(blob).arrayBuffer()
    const path = `${session.user.id}/avatar.jpg`
    const { error } = await supabase.storage.from('avatars')
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true })
    if (error) { Alert.alert('Xato', error.message); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', session.user.id)
    loadAll(session)
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#fff" />
      </View>
    )
  }

  if (!session || !profile) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.notLoggedIn}>Kirish qiling</Text>
      </View>
    )
  }

  const displayName = profile.full_name ?? profile.username ?? profile.email ?? 'Foydalanuvchi'
  const handle = profile.username ? `@${profile.username}` : profile.email ?? ''

  const menuItems: MenuItem[] = [
    {
      icon: Ionicons, iconName: 'time-outline', label: 'Ko\'rish tarixi',
      onPress: () => {},
    },
    {
      icon: Ionicons, iconName: 'play-outline', label: 'Videolaringiz',
      onPress: () => router.push(`/channel/${session.user.id}` as any),
    },
    {
      icon: Ionicons, iconName: 'download-outline', label: 'Yuklanmalar',
      onPress: () => {},
    },
    {
      icon: Ionicons, iconName: 'musical-notes-outline', label: 'Sizning kliplar',
      onPress: () => {},
    },
    {
      icon: Ionicons, iconName: 'bookmark-outline', label: 'Keyinroq ko\'rish',
      onPress: () => {},
    },
    {
      icon: Ionicons, iconName: 'thumbs-up-outline', label: 'Yoqqan videolar',
      onPress: () => {},
    },
  ]

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Siz</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="search-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <TouchableOpacity style={styles.avatarWrapper} onPress={pickAvatar}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{displayName[0].toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.handle}>{handle}</Text>
          <TouchableOpacity
            style={styles.channelLink}
            onPress={() => router.push(`/channel/${session.user.id}` as any)}
          >
            <Text style={styles.channelLinkText}>Kanalni ochish</Text>
            <Ionicons name="chevron-forward" size={14} color="#aaa" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Action chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingBottom: 16 }}
      >
        <TouchableOpacity style={styles.actionChip}>
          <Ionicons name="person-outline" size={16} color="#fff" />
          <Text style={styles.actionChipText}>Hisobni almashtirish</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip}>
          <MaterialIcons name="g-mobiledata" size={20} color="#fff" />
          <Text style={styles.actionChipText}>Google hisobi</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionChip}>
          <Ionicons name="glasses-outline" size={16} color="#fff" />
          <Text style={styles.actionChipText}>Inkognito rejim</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.divider} />

      {/* Watch History */}
      {watchHistory.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tomosha tarixi</Text>
            <TouchableOpacity>
              <Text style={styles.sectionAll}>Hammasi</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingBottom: 12 }}
          >
            {watchHistory.map(video => (
              <TouchableOpacity
                key={video.id}
                style={styles.historyCard}
                onPress={() => router.push(`/video/${video.id}` as any)}
              >
                <View style={styles.historyThumb}>
                  {video.thumbnail_url ? (
                    <Image source={{ uri: video.thumbnail_url }} style={styles.historyThumbImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.historyThumbImg, { justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="play" size={20} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={styles.historyTitle} numberOfLines={2}>{video.title}</Text>
                <Text style={styles.historyMeta}>
                  {(video as any).channel?.username ?? 'Kanal'}
                </Text>
                <TouchableOpacity style={styles.historyMenu}>
                  <Ionicons name="ellipsis-vertical" size={14} color="#aaa" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.divider} />
        </>
      )}

      {/* Menu Items */}
      {menuItems.map((item, i) => (
        <TouchableOpacity key={i} style={styles.menuItem} onPress={item.onPress}>
          <item.icon name={item.iconName} size={22} color="#fff" />
          <Text style={styles.menuItemText}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={18} color="#555" />
        </TouchableOpacity>
      ))}

      <View style={styles.divider} />

      {/* Sign out */}
      <TouchableOpacity style={styles.menuItem} onPress={() => supabase.auth.signOut()}>
        <Ionicons name="log-out-outline" size={22} color="#ff4444" />
        <Text style={[styles.menuItemText, { color: '#ff4444' }]}>Chiqish</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centered: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
  notLoggedIn: { color: '#fff', fontSize: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 52, paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 6 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 14, paddingBottom: 16,
  },
  avatarWrapper: {},
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  profileInfo: { flex: 1, gap: 2 },
  displayName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  handle: { fontSize: 13, color: '#aaa' },
  channelLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  channelLinkText: { fontSize: 13, color: '#aaa' },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#272727', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  actionChipText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  divider: { height: 8, backgroundColor: '#1a1a1a' },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  sectionAll: { fontSize: 14, color: '#3ea6ff', fontWeight: '600' },
  historyCard: { width: 160, position: 'relative' },
  historyThumb: { width: 160, height: 90, borderRadius: 8, overflow: 'hidden', backgroundColor: '#272727', marginBottom: 6 },
  historyThumbImg: { width: '100%', height: '100%' },
  historyTitle: { fontSize: 13, color: '#fff', fontWeight: '500', lineHeight: 17, paddingRight: 20 },
  historyMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  historyMenu: { position: 'absolute', top: 92, right: 0, padding: 4 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: '#1f1f1f',
  },
  menuItemText: { flex: 1, fontSize: 15, color: '#fff', fontWeight: '500' },
})
