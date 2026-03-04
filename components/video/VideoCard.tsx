import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Video } from '@/lib/types'
import { formatDuration, formatViews, timeAgo } from '@/lib/utils'
import { Avatar } from '@/components/common/Avatar'
import { useTheme } from '@/hooks/useTheme'

type Props = {
  video: Video
  onMenuPress?: (video: Video) => void
}

export function VideoCard({ video, onMenuPress }: Props) {
  const { colors } = useTheme()
  const ch = video.channel as any

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/video/${video.id}` as any)}
      activeOpacity={0.88}
    >
      {/* Thumbnail */}
      <View style={styles.thumbWrapper}>
        {video.thumbnail_url ? (
          <Image source={{ uri: video.thumbnail_url }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.thumbBg, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="play-circle-outline" size={48} color={colors.textMuted} />
          </View>
        )}
        {video.duration > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{formatDuration(video.duration)}</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <TouchableOpacity onPress={() => router.push(`/channel/${video.channel_id}` as any)}>
          <Avatar
            uri={ch?.avatar_url}
            name={ch?.username ?? ch?.full_name ?? ch?.email}
            size={36}
          />
        </TouchableOpacity>

        <View style={styles.meta}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {video.title}
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
            {ch?.username ?? ch?.full_name ?? 'Kanal'}
            {' · '}{formatViews(video.views_count)} ko'rilgan
            {' · '}{timeAgo(video.created_at)}
          </Text>
        </View>

        <TouchableOpacity style={styles.menu} onPress={() => onMenuPress?.(video)}>
          <Ionicons name="ellipsis-vertical" size={15} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: 20 },
  thumbWrapper: { position: 'relative' },
  thumb: { width: '100%', aspectRatio: 16 / 9 },
  badge: {
    position: 'absolute', bottom: 6, right: 8,
    backgroundColor: 'rgba(0,0,0,0.82)', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  info: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 10, alignItems: 'flex-start' },
  meta: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  sub: { fontSize: 12 },
  menu: { padding: 4 },
})
