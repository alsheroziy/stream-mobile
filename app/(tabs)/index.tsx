import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, ScrollView, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { useVideoStore } from '@/lib/stores/videoStore'
import { useTheme } from '@/hooks/useTheme'
import { VideoCard } from '@/components/video/VideoCard'
import { ShortsRow } from '@/components/video/ShortsRow'
import { FilterChips } from '@/components/common/FilterChips'
import { EmptyState } from '@/components/common/EmptyState'

const FILTERS = ['Hammasi', 'Bugun', 'Gaming', 'Musiqa', 'Jonli', 'Texnologiya', 'Sport']

export default function HomeScreen() {
  const { colors, isDark } = useTheme()
  const { videos, loading, refreshing, fetchVideos, refresh } = useVideoStore()
  const [activeFilter, setActiveFilter] = useState('Hammasi')

  useEffect(() => { fetchVideos() }, [])

  const shorts = videos.slice(0, 4)
  const regularVideos = videos.slice(4)

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.logo, { color: colors.text }]}>
          <Text style={{ color: colors.accent }}>▶ </Text>Stream
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="notifications-outline" size={23} color={colors.iconActive} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.push('/(tabs)/search' as any)}
          >
            <Ionicons name="search-outline" size={23} color={colors.iconActive} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips */}
      <FilterChips
        filters={FILTERS}
        active={activeFilter}
        onChange={setActiveFilter}
        dark={isDark}
      />

      {loading ? (
        <View style={styles.centered}>
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Yuklanmoqda...</Text>
        </View>
      ) : videos.length === 0 ? (
        <EmptyState
          icon="videocam-outline"
          title="Videolar yo'q"
          description="Birinchi videoni yuklang!"
          actionLabel="Video yuklash"
          onAction={() => router.push('/(tabs)/upload' as any)}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.textMuted}
            />
          }
        >
          <ShortsRow videos={shorts} />
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 10,
    borderBottomWidth: 0.5,
  },
  logo: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: { padding: 6 },
})
