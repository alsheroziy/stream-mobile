import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  RefreshControl, ScrollView, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { FlashList } from '@shopify/flash-list'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { Video, Profile, Notification } from '@/lib/types'

type SubTab = 'feed' | 'notifications'

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} daqiqa oldin`
  if (hours < 24) return `${hours} soat oldin`
  if (days < 7) return `${days} kun oldin`
  return `${Math.floor(days / 7)} hafta oldin`
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const NOTIF_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  like: 'thumbs-up',
  comment: 'chatbubble',
  subscribe: 'people',
  reply: 'return-down-forward',
}

export default function SubscriptionsScreen() {
  const [activeTab, setActiveTab] = useState<SubTab>('feed')
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

    const [{ data: subChannels }, { data: notifData }] = await Promise.all([
      supabase.from('subscriptions').select('channel_id').eq('subscriber_id', userId),
      supabase.from('notifications')
        .select(`*, from_user:profiles!notifications_from_user_id_fkey(id, username, full_name, avatar_url), video:videos(id, title, thumbnail_url)`)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const channelIds = (subChannels ?? []).map((s: any) => s.channel_id)
    setUnreadCount((notifData ?? []).filter((n: any) => !n.is_read).length)
    setNotifications((notifData ?? []) as Notification[])

    if (channelIds.length > 0) {
      const [{ data: feedVideos }, { data: channelsData }] = await Promise.all([
        supabase.from('videos')
          .select(`*, channel:profiles(id, username, full_name, avatar_url)`)
          .in('channel_id', channelIds)
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('profiles').select('*').in('id', channelIds).order('subscribers_count', { ascending: false }),
      ])
      setVideos((feedVideos ?? []) as Video[])
      setSubscriptions((channelsData ?? []) as Profile[])
    }

    setLoading(false)
    setRefreshing(false)
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    loadData()
  }, [])

  async function markAllRead() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  if (loading) {
    return <View style={styles.centered}><Text style={{ color: '#606060' }}>Yuklanmoqda...</Text></View>
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {activeTab === 'feed' ? 'Obunalar' : 'Bildirishnomalar'}
        </Text>
        {activeTab === 'notifications' && unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markReadText}>Barchasini o'qildi</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
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
            <Text style={[styles.tabText, activeTab === 'notifications' && styles.tabTextActive]}>
              Bildirishnomalar
            </Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Feed Tab */}
      {activeTab === 'feed' && (
        <>
          {/* Channel avatars strip */}
          {subscriptions.length > 0 && (
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              style={styles.channelStrip} contentContainerStyle={{ gap: 16, paddingHorizontal: 16 }}
            >
              {subscriptions.map(ch => {
                const name = ch.username ?? ch.full_name ?? '?'
                return (
                  <TouchableOpacity
                    key={ch.id}
                    style={styles.channelChip}
                    onPress={() => router.push(`/channel/${ch.id}` as any)}
                  >
                    <View style={styles.chipAvatar}>
                      {ch.avatar_url ? (
                        <Image source={{ uri: ch.avatar_url }} style={styles.chipAvatarImg} />
                      ) : (
                        <Text style={styles.chipAvatarText}>{name[0].toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={styles.chipName} numberOfLines={1}>{name}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}

          {videos.length === 0 ? (
            <View style={styles.emptySection}>
              <Ionicons name="tv-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>Obuna bo'lmadingiz</Text>
              <Text style={styles.emptyDesc}>Yangi videolar uchun kanallarga obuna bo'ling</Text>
              <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/(tabs)/' as any)}>
                <Text style={styles.exploreBtnText}>Kanallarni topish</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlashList
              data={videos}
              keyExtractor={item => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.videoCard}
                  onPress={() => router.push(`/video/${item.id}` as any)}
                >
                  <View style={styles.videoThumb}>
                    {item.thumbnail_url ? (
                      <Image source={{ uri: item.thumbnail_url }} style={styles.thumbImg} resizeMode="cover" />
                    ) : (
                      <View style={[styles.thumbImg, styles.thumbPlaceholder]}>
                        <Ionicons name="play-circle" size={32} color="#fff" />
                      </View>
                    )}
                    {item.duration > 0 && (
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.videoInfo}>
                    <View style={styles.videoAvatar}>
                      {(item as any).channel?.avatar_url ? (
                        <Image source={{ uri: (item as any).channel.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                      ) : (
                        <Text style={styles.videoAvatarText}>
                          {((item as any).channel?.username ?? '?')[0].toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.videoMeta}>
                        {(item as any).channel?.username ?? 'Kanal'}
                      </Text>
                      <Text style={styles.videoMeta}>
                        {formatViews(item.views_count)} ko'rilgan · {timeAgo(item.created_at)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
          <FlashList
              data={notifications}
              keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptySection}>
              <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>Bildirishnoma yo'q</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifItem, !item.is_read && styles.notifUnread]}
              onPress={() => {
                if (item.video_id) router.push(`/video/${item.video_id}` as any)
              }}
            >
              <View style={[styles.notifIcon, { backgroundColor: item.type === 'like' ? '#fee2e2' : item.type === 'subscribe' ? '#dbeafe' : '#dcfce7' }]}>
                <Ionicons name={NOTIF_ICONS[item.type] ?? 'notifications'} size={20} color="#0f0f0f" />
              </View>
              <View style={styles.notifContent}>
                <Text style={styles.notifText}>
                  <Text style={styles.notifUser}>
                    {item.from_user?.username ?? item.from_user?.full_name ?? 'Foydalanuvchi'}
                  </Text>
                  {' '}{item.message}
                </Text>
                <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
              </View>
              {item.video?.thumbnail_url && (
                <Image source={{ uri: item.video.thumbnail_url }} style={styles.notifThumb} />
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
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f0f0f' },
  markReadText: { fontSize: 13, color: '#065fd4', fontWeight: '600' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0f0f0f' },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#606060' },
  tabTextActive: { color: '#0f0f0f' },
  badge: {
    backgroundColor: '#ff0000', borderRadius: 10, minWidth: 18,
    height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  channelStrip: { maxHeight: 88, paddingVertical: 10 },
  channelChip: { alignItems: 'center', gap: 4, width: 56 },
  chipAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#0f0f0f',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  chipAvatarImg: { width: 48, height: 48 },
  chipAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  chipName: { fontSize: 11, color: '#0f0f0f', textAlign: 'center' },
  emptySection: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40, minHeight: 400 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#0f0f0f' },
  emptyDesc: { fontSize: 14, color: '#606060', textAlign: 'center' },
  exploreBtn: { backgroundColor: '#0f0f0f', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  exploreBtnText: { color: '#fff', fontWeight: '700' },
  videoCard: { marginBottom: 8 },
  videoThumb: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
  thumbImg: { width: '100%', height: '100%', backgroundColor: '#0f0f0f' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  durationBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  videoInfo: { flexDirection: 'row', gap: 10, padding: 12 },
  videoAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#0f0f0f',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  videoAvatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  videoTitle: { fontSize: 14, fontWeight: '600', color: '#0f0f0f', lineHeight: 20 },
  videoMeta: { fontSize: 12, color: '#606060' },
  notifItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#f2f2f2', position: 'relative',
  },
  notifUnread: { backgroundColor: '#fafafa' },
  notifIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifContent: { flex: 1, gap: 2 },
  notifText: { fontSize: 13, color: '#0f0f0f', lineHeight: 18 },
  notifUser: { fontWeight: '700' },
  notifTime: { fontSize: 12, color: '#909090' },
  notifThumb: { width: 48, height: 36, borderRadius: 4 },
  unreadDot: {
    position: 'absolute', top: 16, right: 12,
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#065fd4',
  },
})
