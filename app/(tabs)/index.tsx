import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, Image, StatusBar,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { Video } from '@/lib/types'

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatViews(count: number) {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toString()
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Bugun'
  if (days === 1) return 'Kecha'
  if (days < 7) return `${days} kun oldin`
  if (days < 30) return `${Math.floor(days / 7)} hafta oldin`
  if (days < 365) return `${Math.floor(days / 30)} oy oldin`
  return `${Math.floor(days / 365)} yil oldin`
}

function VideoCard({ video }: { video: Video }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/video/${video.id}` as any)}
      activeOpacity={0.9}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailWrapper}>
        {video.thumbnail_url ? (
          <Image source={{ uri: video.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons name="play-circle" size={48} color="#fff" />
          </View>
        )}
        {video.duration > 0 && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.infoRow}>
        <TouchableOpacity onPress={() => router.push(`/channel/${video.channel_id}` as any)}>
          <View style={styles.avatar}>
            {video.channel?.avatar_url ? (
              <Image source={{ uri: video.channel.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>
                {(video.channel?.username ?? video.channel?.email ?? '?')[0].toUpperCase()}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={2}>{video.title}</Text>
          <TouchableOpacity onPress={() => router.push(`/channel/${video.channel_id}` as any)}>
            <Text style={styles.channelName}>
              {video.channel?.username ?? video.channel?.full_name ?? 'Noma\'lum kanal'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.stats}>
            {formatViews(video.views_count)} ko'rilgan · {timeAgo(video.created_at)}
          </Text>
        </View>

        <TouchableOpacity style={styles.menuBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color="#606060" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

export default function HomeScreen() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchVideos() {
    const { data, error } = await supabase
      .from('videos')
      .select(`*, channel:profiles(id, username, full_name, avatar_url, subscribers_count)`)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(30)

    if (!error && data) setVideos(data as Video[])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { fetchVideos() }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchVideos()
  }, [])

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Yuklanmoqda...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Stream</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/(tabs)/search' as any)}>
            <Ionicons name="search" size={24} color="#0f0f0f" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="notifications-outline" size={24} color="#0f0f0f" />
          </TouchableOpacity>
        </View>
      </View>

      {videos.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="videocam-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Hali video yo'q</Text>
          <Text style={styles.emptyDesc}>Birinchi videoni yuklang!</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => router.push('/(tabs)/upload' as any)}>
            <Text style={styles.uploadBtnText}>Video yuklash</Text>
          </TouchableOpacity>
        </View>
      ) : (
          <FlashList
            data={videos}
            renderItem={({ item }) => <VideoCard video={item} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { color: '#606060', fontSize: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5',
  },
  logo: { fontSize: 22, fontWeight: '800', color: '#ff0000', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerBtn: { padding: 6 },
  card: { marginBottom: 8 },
  thumbnailWrapper: { position: 'relative' },
  thumbnail: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0f0f0f' },
  thumbnailPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  durationBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  infoRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#0f0f0f',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 36, height: 36 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  meta: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '600', color: '#0f0f0f', lineHeight: 20 },
  channelName: { fontSize: 13, color: '#606060' },
  stats: { fontSize: 12, color: '#606060' },
  menuBtn: { padding: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0f0f0f' },
  emptyDesc: { fontSize: 14, color: '#606060' },
  uploadBtn: {
    backgroundColor: '#0f0f0f', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8,
  },
  uploadBtnText: { color: '#fff', fontWeight: '700' },
})
