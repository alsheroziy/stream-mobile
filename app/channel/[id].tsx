import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, StatusBar, Dimensions,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { FlashList } from '@shopify/flash-list'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { Profile, Video } from '@/lib/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

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
  if (days < 30) return `${Math.floor(days / 7)} hafta oldin`
  return `${Math.floor(days / 30)} oy oldin`
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

type Tab = 'videos' | 'about'

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [channel, setChannel] = useState<Profile | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [subscribersCount, setSubscribersCount] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('videos')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadChannel() }, [id])

  async function loadChannel() {
    const [{ data: { session } }, { data: channelData }, { data: videosData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('videos').select('*').eq('channel_id', id)
        .eq('is_published', true).order('created_at', { ascending: false }),
    ])

    if (channelData) {
      setChannel(channelData as Profile)
      setSubscribersCount(channelData.subscribers_count)
    }
    if (videosData) setVideos(videosData as Video[])

    if (session) {
      setIsOwner(session.user.id === id)
      const { data: subData } = await supabase.from('subscriptions')
        .select('id').eq('subscriber_id', session.user.id).eq('channel_id', id).maybeSingle()
      setIsSubscribed(!!subData)
    }
    setLoading(false)
  }

  async function toggleSubscribe() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    if (isSubscribed) {
      await supabase.from('subscriptions').delete()
        .eq('subscriber_id', session.user.id).eq('channel_id', id)
      setIsSubscribed(false)
      setSubscribersCount(c => c - 1)
    } else {
      await supabase.from('subscriptions')
        .insert({ subscriber_id: session.user.id, channel_id: id })
      setIsSubscribed(true)
      setSubscribersCount(c => c + 1)
    }
  }

  if (loading) {
    return <View style={styles.centered}><Text style={{ color: '#606060' }}>Yuklanmoqda...</Text></View>
  }

  if (!channel) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Kanal topilmadi</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Orqaga</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const displayName = channel.username ?? channel.full_name ?? channel.email ?? 'Kanal'

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.banner} />

        {/* Channel Header */}
        <View style={styles.channelHeader}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              {channel.avatar_url ? (
                <Image source={{ uri: channel.avatar_url }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{displayName[0].toUpperCase()}</Text>
              )}
            </View>
          </View>

          <Text style={styles.channelName}>{displayName}</Text>
          <Text style={styles.channelHandle}>@{channel.username ?? 'kanal'}</Text>

          <Text style={styles.channelStats}>
            {formatViews(subscribersCount)} obunachi · {channel.videos_count} video
          </Text>

          {channel.bio ? <Text style={styles.bio} numberOfLines={2}>{channel.bio}</Text> : null}

          <View style={styles.channelActions}>
            {isOwner ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => router.push('/(tabs)/profile' as any)}
              >
                <Text style={styles.editBtnText}>Profilni tahrirlash</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.subscribeBtn, isSubscribed && styles.subscribedBtn]}
                onPress={toggleSubscribe}
              >
                <Text style={[styles.subscribeBtnText, isSubscribed && styles.subscribedBtnText]}>
                  {isSubscribed ? 'Obuna bo\'lindi' : 'Obuna bo\'lish'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['videos', 'about'] as Tab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'videos' ? 'Videolar' : 'Haqida'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Videos Tab */}
        {activeTab === 'videos' && (
          <View style={styles.videosGrid}>
            {videos.length === 0 ? (
              <View style={styles.emptyVideos}>
                <Ionicons name="videocam-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Hali video yo'q</Text>
              </View>
            ) : (
              videos.map(video => (
                <TouchableOpacity
                  key={video.id}
                  style={styles.videoCard}
                  onPress={() => router.push(`/video/${video.id}` as any)}
                >
                  <View style={styles.videoThumb}>
                    {video.thumbnail_url ? (
                      <Image source={{ uri: video.thumbnail_url }} style={styles.videoThumbImg} resizeMode="cover" />
                    ) : (
                      <View style={[styles.videoThumbImg, styles.videoThumbPlaceholder]}>
                        <Ionicons name="play-circle" size={32} color="#fff" />
                      </View>
                    )}
                    {video.duration > 0 && (
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
                  <Text style={styles.videoMeta}>
                    {formatViews(video.views_count)} ko'rilgan · {timeAgo(video.created_at)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <View style={styles.aboutSection}>
            {channel.bio ? (
              <View style={styles.aboutItem}>
                <Ionicons name="information-circle-outline" size={20} color="#606060" />
                <Text style={styles.aboutText}>{channel.bio}</Text>
              </View>
            ) : null}
            {channel.website ? (
              <View style={styles.aboutItem}>
                <Ionicons name="link-outline" size={20} color="#606060" />
                <Text style={styles.aboutLink}>{channel.website}</Text>
              </View>
            ) : null}
            <View style={styles.aboutItem}>
              <Ionicons name="people-outline" size={20} color="#606060" />
              <Text style={styles.aboutText}>{formatViews(subscribersCount)} obunachi</Text>
            </View>
            <View style={styles.aboutItem}>
              <Ionicons name="videocam-outline" size={20} color="#606060" />
              <Text style={styles.aboutText}>{channel.videos_count} video yuklangan</Text>
            </View>
            {channel.created_at && (
              <View style={styles.aboutItem}>
                <Ionicons name="calendar-outline" size={20} color="#606060" />
                <Text style={styles.aboutText}>
                  {new Date(channel.created_at).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long' })} da qo'shilgan
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  notFound: { fontSize: 16, color: '#606060' },
  backLink: { color: '#065fd4', fontWeight: '600' },
  backBtn: {
    position: 'absolute', top: 48, left: 12, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6,
  },
  banner: { height: 120, backgroundColor: '#0f0f0f' },
  channelHeader: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  avatarWrapper: { marginTop: -44 },
  avatar: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#0f0f0f',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    borderWidth: 3, borderColor: '#fff',
  },
  avatarImg: { width: 88, height: 88 },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  channelName: { fontSize: 20, fontWeight: '800', color: '#0f0f0f', marginTop: 6 },
  channelHandle: { fontSize: 14, color: '#606060' },
  channelStats: { fontSize: 13, color: '#606060' },
  bio: { fontSize: 14, color: '#0f0f0f', textAlign: 'center', lineHeight: 20 },
  channelActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  subscribeBtn: {
    backgroundColor: '#0f0f0f', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
  },
  subscribedBtn: { backgroundColor: '#f2f2f2' },
  subscribeBtnText: { color: '#fff', fontWeight: '700' },
  subscribedBtnText: { color: '#0f0f0f' },
  editBtn: {
    borderWidth: 1.5, borderColor: '#e5e5e5', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
  },
  editBtnText: { color: '#0f0f0f', fontWeight: '700' },
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0f0f0f' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#606060' },
  tabTextActive: { color: '#0f0f0f' },
  videosGrid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 8,
  },
  videoCard: { width: (SCREEN_WIDTH - 24) / 2, padding: 4, marginBottom: 8 },
  videoThumb: { position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: 16 / 9 },
  videoThumbImg: { width: '100%', height: '100%', backgroundColor: '#0f0f0f' },
  videoThumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  durationBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
  },
  durationText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  videoTitle: { fontSize: 13, fontWeight: '600', color: '#0f0f0f', marginTop: 6, lineHeight: 18 },
  videoMeta: { fontSize: 12, color: '#606060' },
  emptyVideos: { flex: 1, alignItems: 'center', paddingVertical: 60, gap: 12, width: '100%' },
  emptyText: { fontSize: 15, color: '#909090' },
  aboutSection: { padding: 20, gap: 16 },
  aboutItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  aboutText: { fontSize: 14, color: '#0f0f0f', flex: 1 },
  aboutLink: { fontSize: 14, color: '#065fd4', flex: 1 },
})
