import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Video } from '@/lib/types'
import { formatViews } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'

type Props = { videos: Video[] }

export function ShortsRow({ videos }: Props) {
  const { colors } = useTheme()
  if (videos.length === 0) return null

  return (
    <View style={[styles.section, { borderBottomColor: colors.bgTertiary }]}>
      <View style={styles.header}>
        <View style={[styles.shortsBadge, { backgroundColor: colors.accent }]}>
          <Text style={styles.shortsBadgeText}>Shorts</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/shorts' as any)}>
          <Text style={[styles.seeAll, { color: colors.accent }]}>Hammasi</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={videos.slice(0, 6)}
        horizontal
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/(tabs)/shorts' as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.thumb, { backgroundColor: colors.thumbBg }]}>
              {item.thumbnail_url ? (
                <Image source={{ uri: item.thumbnail_url }} style={styles.thumbImg} resizeMode="cover" />
              ) : (
                <View style={[styles.thumbImg, { justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="play" size={22} color={colors.textMuted} />
                </View>
              )}
            </View>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {formatViews(item.views_count)} marta
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  section: { paddingVertical: 14, borderBottomWidth: 6, marginBottom: 6 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, marginBottom: 12,
  },
  shortsBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  shortsBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  seeAll: { fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 14, gap: 10 },
  card: { width: 108 },
  thumb: { width: 108, height: 188, borderRadius: 10, overflow: 'hidden', marginBottom: 6 },
  thumbImg: { width: '100%', height: '100%' },
  title: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  meta: { fontSize: 11, marginTop: 2 },
})
