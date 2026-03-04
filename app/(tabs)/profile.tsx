import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, Image, StatusBar, ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { Profile, Video } from '@/lib/types'
import { Session } from '@supabase/supabase-js'

type ProfileTab = 'videos' | 'history' | 'edit'

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

export default function ProfileScreen() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myVideos, setMyVideos] = useState<Video[]>([])
  const [watchHistory, setWatchHistory] = useState<Video[]>([])
  const [activeTab, setActiveTab] = useState<ProfileTab>('videos')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadAll(session)
    })
  }, [])

  async function loadAll(s: Session) {
    const userId = s.user.id

    const [profileRes, videosRes, historyRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('videos').select('*').eq('channel_id', userId)
        .order('created_at', { ascending: false }),
      supabase.from('watch_history')
        .select(`video:videos(*, channel:profiles(id, username, full_name, avatar_url))`)
        .eq('user_id', userId)
        .order('watched_at', { ascending: false })
        .limit(20),
    ])

    if (profileRes.data) {
      const p = profileRes.data as Profile
      setProfile(p)
      setUsername(p.username ?? '')
      setFullName(p.full_name ?? '')
      setBio(p.bio ?? '')
      setWebsite(p.website ?? '')
    } else {
      // Auto-create profile
      await supabase.from('profiles').insert({ id: userId, email: s.user.email })
      loadAll(s)
      return
    }

    setMyVideos((videosRes.data ?? []) as Video[])
    setWatchHistory(
      (historyRes.data ?? [])
        .map((h: any) => h.video)
        .filter(Boolean) as Video[]
    )

    setLoading(false)
  }

  async function saveProfile() {
    if (!session) return
    setSaving(true)

    const updates: any = {
      id: session.user.id,
      username: username.trim() || null,
      full_name: fullName.trim() || null,
      bio: bio.trim() || null,
      website: website.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('profiles').upsert(updates)
    if (error) Alert.alert('Xato', error.message)
    else {
      Alert.alert('Saqlandi', 'Profil yangilandi!')
      loadAll(session)
    }
    setSaving(false)
  }

  async function pickAndUploadAvatar() {
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

  async function deleteVideo(videoId: string) {
    Alert.alert('O\'chirish', 'Videoni o\'chirmoqchimisiz?', [
      { text: 'Bekor', style: 'cancel' },
      {
        text: 'O\'chirish', style: 'destructive',
        onPress: async () => {
          await supabase.from('videos').delete().eq('id', videoId)
          setMyVideos(prev => prev.filter(v => v.id !== videoId))
        },
      },
    ])
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#0f0f0f" /></View>
  }

  if (!session || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noSession}>Profil ko'rish uchun login qiling</Text>
      </View>
    )
  }

  const displayName = profile.username ?? profile.full_name ?? profile.email ?? 'Foydalanuvchi'

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        {/* Avatar */}
        <TouchableOpacity style={styles.avatarWrapper} onPress={pickAndUploadAvatar}>
          <View style={styles.avatar}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{displayName[0].toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.avatarEdit}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>

        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.email}>{profile.email}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{formatViews(profile.subscribers_count)}</Text>
            <Text style={styles.statLabel}>Obunachi</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{profile.videos_count}</Text>
            <Text style={styles.statLabel}>Video</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{watchHistory.length}</Text>
            <Text style={styles.statLabel}>Ko'rilgan</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.channelBtn}
            onPress={() => router.push(`/channel/${session.user.id}` as any)}
          >
            <Text style={styles.channelBtnText}>Kanalim</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => supabase.auth.signOut()}
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([['videos', 'Videolarim'], ['history', 'Tarix'], ['edit', 'Tahrirlash']] as [ProfileTab, string][]).map(([tab, label]) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* My Videos Tab */}
      {activeTab === 'videos' && (
        <View style={styles.tabContent}>
          {myVideos.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="videocam-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Hali video yuklamagansiz</Text>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => router.push('/(tabs)/upload' as any)}>
                <Text style={styles.uploadBtnText}>Video yuklash</Text>
              </TouchableOpacity>
            </View>
          ) : (
            myVideos.map(video => (
              <View key={video.id} style={styles.videoRow}>
                <TouchableOpacity
                  style={styles.videoRowContent}
                  onPress={() => router.push(`/video/${video.id}` as any)}
                >
                  <View style={styles.videoThumb}>
                    {video.thumbnail_url ? (
                      <Image source={{ uri: video.thumbnail_url }} style={styles.thumbImg} resizeMode="cover" />
                    ) : (
                      <View style={[styles.thumbImg, styles.thumbPlaceholder]}>
                        <Ionicons name="play-circle" size={24} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
                    <Text style={styles.videoMeta}>
                      {formatViews(video.views_count)} ko'rilgan · {timeAgo(video.created_at)}
                    </Text>
                    <Text style={styles.videoMeta}>
                      {video.likes_count} like · {video.comments_count} izoh
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteVideo(video.id)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      {/* Watch History Tab */}
      {activeTab === 'history' && (
        <View style={styles.tabContent}>
          {watchHistory.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="time-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Ko'rish tarixi bo'sh</Text>
            </View>
          ) : (
            watchHistory.map(video => (
              <TouchableOpacity
                key={video.id}
                style={styles.videoRow}
                onPress={() => router.push(`/video/${video.id}` as any)}
              >
                <View style={styles.videoRowContent}>
                  <View style={styles.videoThumb}>
                    {video.thumbnail_url ? (
                      <Image source={{ uri: video.thumbnail_url }} style={styles.thumbImg} resizeMode="cover" />
                    ) : (
                      <View style={[styles.thumbImg, styles.thumbPlaceholder]}>
                        <Ionicons name="play-circle" size={24} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
                    <Text style={styles.videoMeta}>
                      {(video as any).channel?.username ?? 'Kanal'}
                    </Text>
                    <Text style={styles.videoMeta}>{formatViews(video.views_count)} ko'rilgan</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* Edit Profile Tab */}
      {activeTab === 'edit' && (
        <View style={styles.editSection}>
          <View style={styles.field}>
            <Text style={styles.label}>Foydalanuvchi nomi</Text>
            <TextInput style={styles.input} value={username} onChangeText={setUsername}
              placeholder="@username" placeholderTextColor="#909090" autoCapitalize="none" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>To'liq ism</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
              placeholder="Ism Familiya" placeholderTextColor="#909090" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Bio</Text>
            <TextInput style={[styles.input, styles.textarea]} value={bio} onChangeText={setBio}
              placeholder="O'zingiz haqida" placeholderTextColor="#909090"
              multiline numberOfLines={3} maxLength={200} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Veb-sayt</Text>
            <TextInput style={styles.input} value={website} onChangeText={setWebsite}
              placeholder="https://example.com" placeholderTextColor="#909090"
              autoCapitalize="none" keyboardType="url" />
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={saveProfile}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Saqlash</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  noSession: { fontSize: 16, color: '#606060' },
  header: { alignItems: 'center', paddingTop: 56, paddingBottom: 16, paddingHorizontal: 24, gap: 8 },
  avatarWrapper: { position: 'relative' },
  avatar: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#0f0f0f',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 88, height: 88 },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  avatarEdit: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#606060', borderRadius: 12, padding: 4,
    borderWidth: 2, borderColor: '#fff',
  },
  displayName: { fontSize: 20, fontWeight: '800', color: '#0f0f0f' },
  email: { fontSize: 13, color: '#606060' },
  statsRow: { flexDirection: 'row', gap: 24, alignItems: 'center', marginTop: 4 },
  statItem: { alignItems: 'center', gap: 2 },
  statNum: { fontSize: 18, fontWeight: '800', color: '#0f0f0f' },
  statLabel: { fontSize: 12, color: '#606060' },
  statDivider: { width: 1, height: 28, backgroundColor: '#e5e5e5' },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4 },
  channelBtn: {
    backgroundColor: '#0f0f0f', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9,
  },
  channelBtnText: { color: '#fff', fontWeight: '700' },
  signOutBtn: {
    borderWidth: 1.5, borderColor: '#fca5a5', borderRadius: 20, padding: 9,
  },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0f0f0f' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#606060' },
  tabTextActive: { color: '#0f0f0f' },
  tabContent: { padding: 4 },
  emptySection: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15, color: '#909090' },
  uploadBtn: { backgroundColor: '#0f0f0f', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9 },
  uploadBtnText: { color: '#fff', fontWeight: '700' },
  videoRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 0.5, borderBottomColor: '#f2f2f2',
  },
  videoRowContent: { flex: 1, flexDirection: 'row', gap: 10, padding: 12 },
  videoThumb: { width: 120, aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%', backgroundColor: '#0f0f0f' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  videoInfo: { flex: 1, gap: 2, justifyContent: 'center' },
  videoTitle: { fontSize: 13, fontWeight: '600', color: '#0f0f0f', lineHeight: 18 },
  videoMeta: { fontSize: 12, color: '#606060' },
  deleteBtn: { padding: 16 },
  editSection: { padding: 20, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#0f0f0f' },
  input: {
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#0f0f0f', backgroundColor: '#fafafa',
  },
  textarea: { height: 88, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: '#0f0f0f', borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
