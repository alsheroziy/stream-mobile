import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Dimensions, StatusBar, FlatList, ViewToken,
} from 'react-native'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Video } from '@/lib/types'

const { width: W, height: H } = Dimensions.get('window')

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function ShortItem({
  video,
  isActive,
}: {
  video: Video
  isActive: boolean
}) {
  const [isLiked, setIsLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(video.likes_count)
  const [isMuted, setIsMuted] = useState(false)

  const player = useVideoPlayer(video.video_url, p => {
    p.loop = true
    p.muted = false
  })

  useEffect(() => {
    if (isActive) {
      player.muted = isMuted
      player.play()
    } else {
      player.pause()
    }
  }, [isActive])

  useEffect(() => {
    player.muted = isMuted
  }, [isMuted])

  async function toggleLike() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', session.user.id).eq('video_id', video.id)
      setIsLiked(false)
      setLikesCount(c => c - 1)
    } else {
      await supabase.from('likes').insert({ user_id: session.user.id, video_id: video.id })
      setIsLiked(true)
      setLikesCount(c => c + 1)
    }
  }

  const channel = video.channel as any

  return (
    <View style={styles.shortItem}>
      <StatusBar hidden />
      <VideoView
        player={player}
        style={styles.shortVideo}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => setIsMuted(m => !m)}
      />

      {/* Mute icon */}
      {isMuted && (
        <View style={styles.muteIcon}>
          <Ionicons name="volume-mute" size={28} color="#fff" />
        </View>
      )}

      {/* Right side actions */}
      <View style={styles.rightActions}>
        <TouchableOpacity
          style={styles.channelAvatarBtn}
          onPress={() => router.push(`/channel/${video.channel_id}` as any)}
        >
          <View style={styles.shortAvatar}>
            {channel?.avatar_url ? (
              <Image source={{ uri: channel.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
            ) : (
              <Text style={styles.shortAvatarText}>
                {(channel?.username ?? '?')[0].toUpperCase()}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={toggleLike}>
          <Ionicons name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={26} color="#fff" />
          <Text style={styles.actionCount}>{formatCount(likesCount)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="thumbs-down-outline" size={26} color="#fff" />
          <Text style={styles.actionCount}>Yoqmadi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => router.push(`/video/${video.id}` as any)}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={26} color="#fff" />
          <Text style={styles.actionCount}>{formatCount(video.comments_count)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="arrow-redo-outline" size={26} color="#fff" />
          <Text style={styles.actionCount}>Ulashish</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="ellipsis-horizontal" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom info */}
      <View style={styles.bottomInfo}>
        <TouchableOpacity
          style={styles.channelRow}
          onPress={() => router.push(`/channel/${video.channel_id}` as any)}
        >
          <Text style={styles.channelName}>
            @{channel?.username ?? channel?.full_name ?? 'kanal'}
          </Text>
          <View style={styles.subscribeSmallBtn}>
            <Text style={styles.subscribeSmallText}>Obuna</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.shortTitle} numberOfLines={2}>{video.title}</Text>
      </View>
    </View>
  )
}

export default function ShortsScreen() {
  const [shorts, setShorts] = useState<Video[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadShorts()
  }, [])

  async function loadShorts() {
    const { data } = await supabase
      .from('videos')
      .select(`*, channel:profiles(id, username, full_name, avatar_url)`)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setShorts(data as Video[])
    setLoading(false)
  }

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index)
      }
    },
    []
  )

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 })

  if (loading || shorts.length === 0) {
    return (
      <View style={styles.empty}>
        <StatusBar hidden />
        <Ionicons name="play-circle-outline" size={64} color="#555" />
        <Text style={styles.emptyText}>Shorts hali mavjud emas</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={shorts}
      keyExtractor={item => item.id}
      renderItem={({ item, index }) => (
        <ShortItem video={item} isActive={index === activeIndex} />
      )}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig.current}
      getItemLayout={(_, index) => ({ length: H, offset: H * index, index })}
    />
  )
}

const styles = StyleSheet.create({
  shortItem: { width: W, height: H, backgroundColor: '#000' },
  shortVideo: { position: 'absolute', width: W, height: H },
  overlay: { position: 'absolute', width: W, height: H },
  muteIcon: {
    position: 'absolute', top: '45%', left: '45%',
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 40, padding: 12,
  },
  rightActions: {
    position: 'absolute', right: 10, bottom: 100,
    alignItems: 'center', gap: 20,
  },
  channelAvatarBtn: { marginBottom: 4 },
  shortAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  shortAvatarText: { color: '#fff', fontWeight: '700' },
  actionBtn: { alignItems: 'center', gap: 2 },
  actionCount: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bottomInfo: {
    position: 'absolute', bottom: 80, left: 12, right: 70, gap: 6,
  },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  channelName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  subscribeSmallBtn: {
    borderWidth: 1, borderColor: '#fff', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  subscribeSmallText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  shortTitle: { color: '#fff', fontSize: 14, lineHeight: 20 },
  empty: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: '#666', fontSize: 15 },
})
