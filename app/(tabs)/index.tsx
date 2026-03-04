import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  RefreshControl, ScrollView, StatusBar, FlatList,
  useColorScheme,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { Video } from '@/lib/types'

function formatDuration(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 60) return `${mins} daqiqa oldin`
  if (hours < 24) return `${hours} soat oldin`
  if (days < 7) return `${days} kun oldin`
  if (days < 30) return `${Math.floor(days / 7)} hafta oldin`
  if (days < 365) return `${Math.floor(days / 30)} oy oldin`
  return `${Math.floor(days / 365)} yil oldin`
}

const FILTERS = ['Hammasi', 'Bugun', 'Gaming', 'Musiqa', 'Jonli', 'Texnologiya', 'Sport', 'Yangiliklar']

function ShortsRow({ videos }: { videos: Video[] }) {
  if (videos.length === 0) return null
  return (
    <View style={styles.shortsSection}>
      <View style={styles.shortsSectionHeader}>
        <MaterialIcons name="play-circle-outline" size={22} color="#fff" />
        <Text style={styles.shortsSectionTitle}>Shorts</Text>
        <TouchableOpacity style={styles.moreBtn} onPress={() => router.push('/(tabs)/shorts' as any)}>
          <Ionicons name="ellipsis-vertical" size={18} color="#aaa" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={videos.slice(0, 6)}
        horizontal
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.shortCard}
            onPress={() => router.push('/(tabs)/shorts' as any)}
          >
            <View style={styles.shortThumb}>
              {item.thumbnail_url ? (
                <Image source={{ uri: item.thumbnail_url }} style={styles.shortThumbImg} resizeMode="cover" />
              ) : (
                <View style={[styles.shortThumbImg, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#272727' }]}>
                  <Ionicons name="play" size={24} color="#fff" />
                </View>
              )}
            </View>
            <Text style={styles.shortCardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.shortCardMeta}>{formatViews(item.views_count)} marta ko'rilgan</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

function VideoCard({ video }: { video: Video }) {
  const ch = video.channel as any
  return (
    <TouchableOpacity
      style={styles.videoCard}
      onPress={() => router.push(`/video/${video.id}` as any)}
      activeOpacity={0.95}
    >
      {/* Thumbnail */}
      <View style={styles.thumbWrapper}>
        {video.thumbnail_url ? (
          <Image source={{ uri: video.thumbnail_url }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="play-circle" size={52} color="#555" />
          </View>
        )}
        {video.duration > 0 && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <TouchableOpacity onPress={() => router.push(`/channel/${video.channel_id}` as any)}>
          <View style={styles.cardAvatar}>
            {ch?.avatar_url ? (
              <Image source={{ uri: ch.avatar_url }} style={styles.cardAvatarImg} />
            ) : (
              <Text style={styles.cardAvatarText}>
                {(ch?.username ?? ch?.email ?? '?')[0].toUpperCase()}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle} numberOfLines={2}>{video.title}</Text>
          <Text style={styles.cardSub}>
            {ch?.username ?? ch?.full_name ?? 'Kanal'}
            {' · '}{formatViews(video.views_count)} marta ko'rilgan
            {' · '}{timeAgo(video.created_at)}
          </Text>
        </View>
        <TouchableOpacity style={styles.cardMenuBtn}>
          <Ionicons name="ellipsis-vertical" size={16} color="#aaa" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

export default function HomeScreen() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState('Hammasi')

  async function fetchVideos() {
    const { data } = await supabase
      .from('videos')
      .select(`*, channel:profiles(id, username, full_name, avatar_url, subscribers_count)`)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setVideos(data as Video[])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { fetchVideos() }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchVideos()
  }, [])

  const shorts = videos.slice(0, 4)
  const regularVideos = videos.slice(4)

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0f0f0f' : '#fff' }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f0f" />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDark ? '#0f0f0f' : '#fff' }]}>
        <Text style={[styles.logo, { color: isDark ? '#fff' : '#0f0f0f' }]}>
          <Text style={styles.logoRed}>▶ </Text>Stream
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="tv-outline" size={24} color={isDark ? '#fff' : '#0f0f0f'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="notifications-outline" size={24} color={isDark ? '#fff' : '#0f0f0f'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/(tabs)/search' as any)}>
            <Ionicons name="search-outline" size={24} color={isDark ? '#fff' : '#0f0f0f'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { backgroundColor: isDark ? '#0f0f0f' : '#fff' }]}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              activeFilter === f
                ? (isDark ? styles.filterChipActiveDark : styles.filterChipActiveLight)
                : (isDark ? styles.filterChipDark : styles.filterChipLight),
            ]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[
              styles.filterText,
              { color: activeFilter === f ? (isDark ? '#0f0f0f' : '#fff') : (isDark ? '#fff' : '#0f0f0f') },
            ]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <Text style={{ color: '#aaa' }}>Yuklanmoqda...</Text>
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="videocam-outline" size={64} color="#555" />
          <Text style={[styles.emptyTitle, { color: isDark ? '#fff' : '#0f0f0f' }]}>Videolar yo'q</Text>
          <TouchableOpacity style={styles.uploadPromptBtn} onPress={() => router.push('/(tabs)/upload' as any)}>
            <Text style={styles.uploadPromptText}>Birinchi videoni yuklash</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#aaa" />}
        >
          {/* Shorts section */}
          <ShortsRow videos={shorts} />

          {/* Regular videos */}
          {regularVideos.map(video => (
            <VideoCard key={video.id} video={video} />
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 52, paddingBottom: 8,
  },
  logo: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  logoRed: { color: '#ff0000' },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 6 },
  filterBar: { flexGrow: 0 },
  filterChip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  filterChipDark: { backgroundColor: '#272727' },
  filterChipLight: { backgroundColor: '#f2f2f2' },
  filterChipActiveDark: { backgroundColor: '#fff' },
  filterChipActiveLight: { backgroundColor: '#0f0f0f' },
  filterText: { fontSize: 13, fontWeight: '600' },

  // Shorts section
  shortsSection: { paddingVertical: 12, borderBottomWidth: 8, borderBottomColor: '#272727' },
  shortsSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, marginBottom: 10,
  },
  shortsSectionTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#fff' },
  moreBtn: { padding: 4 },
  shortCard: { width: 110 },
  shortThumb: { width: 110, height: 190, borderRadius: 10, overflow: 'hidden', marginBottom: 6 },
  shortThumbImg: { width: '100%', height: '100%' },
  shortCardTitle: { fontSize: 13, color: '#fff', fontWeight: '500', lineHeight: 17 },
  shortCardMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },

  // Video cards
  videoCard: { marginBottom: 16 },
  thumbWrapper: { position: 'relative' },
  thumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#1a1a1a' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  durationBadge: {
    position: 'absolute', bottom: 6, right: 8,
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardInfo: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 10 },
  cardAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0,
  },
  cardAvatarImg: { width: 36, height: 36 },
  cardAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cardMeta: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#fff', lineHeight: 20 },
  cardSub: { fontSize: 12, color: '#aaa' },
  cardMenuBtn: { padding: 4 },

  emptyTitle: { fontSize: 17, fontWeight: '700' },
  uploadPromptBtn: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 9 },
  uploadPromptText: { color: '#0f0f0f', fontWeight: '700' },
})
