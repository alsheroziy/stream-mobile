import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  RefreshControl, ScrollView, StatusBar, FlatList,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { Video, Profile, Notification } from '@/lib/types'

const SUB_FILTERS = ['Hammasi', 'Bugun', 'Videolar', 'Shorts', 'Jonli']

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 1) return `${Math.floor(diff / 60000)} daqiqa oldin`
  if (hours < 24) return `${hours} soat oldin`
  if (days < 7) return `${days} kun oldin`
  return `${Math.floor(days / 7)} hafta oldin`
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

type SubTab = 'feed' | 'notifications'

const NOTIF_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  like: 'thumbs-up', comment: 'chatbubble', subscribe: 'people', reply: 'return-down-forward',
}

export default function SubscriptionsScreen() {
  const [activeTab, setActiveTab] = useState<SubTab>('feed')
  const [activeFilter, setActiveFilter] = useState('Hammasi')
  const [videos, setVideos] = useState<Video[]>([])
  const [subscriptions, setSubscriptions] = useState<Profile[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const userId = session.user.id

    const [{ data: subData }, { data: notifData }] = await Promise.all([
      supabase.from('subscriptions').select('channel_id').eq('subscriber_id', userId),
      supabase.from('notifications')
        .select(`*, from_user:profiles!notifications_from_user_id_fkey(id, username, full_name, avatar_url), video:videos(id, title, thumbnail_url)`)
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
    ])

    const channelIds = (subData ?? []).map((s: any) => s.channel_id)
    setUnreadCount((notifData ?? []).filter((n: any) => !n.is_read).length)
    setNotifications((notifData ?? []) as Notification[])

    if (channelIds.length > 0) {
      const [{ data: feedVideos }, { data: channels }] = await Promise.all([
        supabase.from('videos')
          .select(`*, channel:profiles(id, username, full_name, avatar_url)`)
          .in('channel_id', channelIds).eq('is_published', true)
          .order('created_at', { ascending: false }).limit(30),
        supabase.from('profiles').select('*').in('id', channelIds),
      ])
      setVideos((feedVideos ?? []) as Video[])
      setSubscriptions((channels ?? []) as Profile[])
    }
    setLoading(false); setRefreshing(false)
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadData() }, [])

  async function markAllRead() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {activeTab === 'feed' ? 'Obunalar' : 'Bildirishnomalar'}
        </Text>
        <View style={styles.headerRight}>
          {activeTab === 'notifications' && unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.headerBtn}>
              <Ionicons name="checkmark-done" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="search-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>Yangiliklar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notifications' && styles.tabActive]}
          onPress={() => setActiveTab('notifications')}
        >
          <View style={styles.tabInner}>
            <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>Bildirishnomalar</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* FEED TAB */}
      {activeTab === 'feed' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#aaa" />}
        >
          {/* Channel avatar strip */}
          {subscriptions.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 14, paddingVertical: 12 }}
            >
              {subscriptions.map(ch => {
                const name = ch.username ?? ch.full_name ?? '?'
                return (
                  <TouchableOpacity key={ch.id} style={styles.subChip}
                    onPress={() => router.push(`/channel/${ch.id}` as any)}
                  >
                    <View style={styles.subAvatar}>
                      {ch.avatar_url
                        ? <Image source={{ uri: ch.avatar_url }} style={styles.subAvatarImg} />
                        : <Text style={styles.subAvatarText}>{name[0].toUpperCase()}</Text>
                      }
                    </View>
                    <Text style={styles.subChipName} numberOfLines={1}>{name}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingBottom: 10 }}
          >
            {SUB_FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Videos */}
          {loading ? (
            <View style={styles.centered}><Text style={{ color: '#aaa' }}>Yuklanmoqda...</Text></View>
          ) : videos.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="tv-outline" size={64} color="#444" />
              <Text style={styles.emptyTitle}>Obuna bo'lmadingiz</Text>
              <Text style={styles.emptyDesc}>Kanallar topish uchun asosiy sahifaga boring</Text>
            </View>
          ) : (
            videos.map(video => {
              const ch = video.channel as any
              return (
                <TouchableOpacity key={video.id} style={styles.videoCard}
                  onPress={() => router.push(`/video/${video.id}` as any)}
                >
                  <View style={styles.thumbWrapper}>
                    {video.thumbnail_url
                      ? <Image source={{ uri: video.thumbnail_url }} style={styles.thumb} resizeMode="cover" />
                      : <View style={[styles.thumb, styles.thumbPlaceholder]}><Ionicons name="play-circle" size={48} color="#555" /></View>
                    }
                    {video.duration > 0 && (
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardRow}>
                    <TouchableOpacity style={styles.cardAvatar}
                      onPress={() => router.push(`/channel/${video.channel_id}` as any)}
                    >
                      {ch?.avatar_url
                        ? <Image source={{ uri: ch.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                        : <Text style={styles.cardAvatarText}>{(ch?.username ?? '?')[0].toUpperCase()}</Text>
                      }
                    </TouchableOpacity>
                    <View style={styles.cardMeta}>
                      <Text style={styles.cardTitle} numberOfLines={2}>{video.title}</Text>
                      <Text style={styles.cardSub}>
                        {ch?.username ?? 'Kanal'} · {formatViews(video.views_count)} ko'rilgan · {timeAgo(video.created_at)}
                      </Text>
                    </View>
                    <TouchableOpacity style={{ padding: 4 }}>
                      <Ionicons name="ellipsis-vertical" size={16} color="#aaa" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )
            })
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* NOTIFICATIONS TAB */}
      {activeTab === 'notifications' && (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#aaa" />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="notifications-off-outline" size={64} color="#444" />
              <Text style={styles.emptyTitle}>Bildirishnomalar yo'q</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifItem, !item.is_read && styles.notifUnread]}
              onPress={() => { if (item.video_id) router.push(`/video/${item.video_id}` as any) }}
            >
              <View style={styles.notifLeft}>
                <View style={styles.notifFromAvatar}>
                  {(item as any).from_user?.avatar_url
                    ? <Image source={{ uri: (item as any).from_user.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    : <Ionicons name={NOTIF_ICONS[item.type] ?? 'notifications'} size={20} color="#fff" />
                  }
                </View>
              </View>
              <View style={styles.notifContent}>
                <Text style={styles.notifText}>
                  <Text style={styles.notifUser}>{(item as any).from_user?.username ?? 'Foydalanuvchi'}</Text>
                  {' '}{item.message}
                </Text>
                <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
              </View>
              {(item as any).video?.thumbnail_url && (
                <Image source={{ uri: (item as any).video.thumbnail_url }} style={styles.notifThumb} />
              )}
              {!item.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40, minHeight: 300 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 52, paddingBottom: 10,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 6 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#272727' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#fff' },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#aaa' },
  tabTextActive: { color: '#fff' },
  badge: {
    backgroundColor: '#ff0000', borderRadius: 10, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  subChip: { alignItems: 'center', gap: 4, width: 52 },
  subAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  subAvatarImg: { width: 48, height: 48 },
  subAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  subChipName: { fontSize: 11, color: '#ccc', textAlign: 'center' },
  filterChip: { backgroundColor: '#272727', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  filterChipActive: { backgroundColor: '#fff' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  filterTextActive: { color: '#0f0f0f' },
  videoCard: { marginBottom: 16 },
  thumbWrapper: { position: 'relative' },
  thumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#1a1a1a' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  durationBadge: {
    position: 'absolute', bottom: 6, right: 8,
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 10 },
  cardAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0,
  },
  cardAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cardMeta: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#fff', lineHeight: 20 },
  cardSub: { fontSize: 12, color: '#aaa' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center' },
  emptyDesc: { fontSize: 13, color: '#aaa', textAlign: 'center' },
  notifItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 0.5, borderBottomColor: '#1f1f1f', position: 'relative',
  },
  notifUnread: { backgroundColor: '#1a1a1a' },
  notifLeft: {},
  notifFromAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  notifContent: { flex: 1, gap: 2 },
  notifText: { fontSize: 13, color: '#fff', lineHeight: 18 },
  notifUser: { fontWeight: '700' },
  notifTime: { fontSize: 12, color: '#aaa' },
  notifThumb: { width: 64, height: 48, borderRadius: 4 },
  unreadDot: {
    position: 'absolute', top: 14, right: 12,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#3ea6ff',
  },
})
