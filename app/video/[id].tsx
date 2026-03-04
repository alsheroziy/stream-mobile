import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Image, Alert, StatusBar, Dimensions,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { VideoView, useVideoPlayer } from 'expo-video'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { Video, Comment, Profile } from '@/lib/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Bugun'
  if (days === 1) return 'Kecha'
  if (days < 7) return `${days} kun oldin`
  if (days < 30) return `${Math.floor(days / 7)} hafta oldin`
  return `${Math.floor(days / 30)} oy oldin`
}

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// Player alohida komponent — URL bo'lmasa render qilinmaydi
function VideoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, p => {
    p.loop = false
    p.play()
  })

  return (
    <VideoView
      player={player}
      style={styles.player}
      allowsFullscreen
      allowsPictureInPicture
      contentFit="contain"
    />
  )
}

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [video, setVideo] = useState<Video | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [isLiked, setIsLiked] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [subscribersCount, setSubscribersCount] = useState(0)
  const [commentText, setCommentText] = useState('')
  const [showDescription, setShowDescription] = useState(false)
  const [loading, setLoading] = useState(true)
  const viewCounted = useRef(false)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    const [{ data: sessionData }, { data: videoData }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.from('videos')
        .select(`*, channel:profiles(*)`)
        .eq('id', id)
        .single(),
    ])

    if (!videoData) { setLoading(false); return }
    setVideo(videoData as Video)
    setLikesCount(videoData.likes_count)
    setSubscribersCount((videoData as any).channel?.subscribers_count ?? 0)

    if (sessionData.session) {
      const userId = sessionData.session.user.id

      const [profileRes, likeRes, subRes, commentsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('likes').select('id').eq('user_id', userId).eq('video_id', id).maybeSingle(),
        supabase.from('subscriptions').select('id')
          .eq('subscriber_id', userId).eq('channel_id', videoData.channel_id).maybeSingle(),
        supabase.from('comments')
          .select(`*, user:profiles(id, username, full_name, avatar_url)`)
          .eq('video_id', id).is('parent_id', null)
          .order('created_at', { ascending: false }),
      ])

      if (profileRes.data) setCurrentUser(profileRes.data as Profile)
      setIsLiked(!!likeRes.data)
      setIsSubscribed(!!subRes.data)
      if (commentsRes.data) setComments(commentsRes.data as Comment[])

      // Views count
      if (!viewCounted.current) {
        viewCounted.current = true
        await supabase.from('watch_history')
          .upsert({ user_id: userId, video_id: id, watched_at: new Date().toISOString() })
        await supabase.from('videos')
          .update({ views_count: videoData.views_count + 1 }).eq('id', id)
      }
    }
    setLoading(false)
  }

  async function toggleLike() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { Alert.alert('', 'Like bosish uchun login qiling'); return }

    if (isLiked) {
      await supabase.from('likes').delete()
        .eq('user_id', session.user.id).eq('video_id', id)
      setIsLiked(false)
      setLikesCount(c => c - 1)
    } else {
      await supabase.from('likes').insert({ user_id: session.user.id, video_id: id })
      setIsLiked(true)
      setLikesCount(c => c + 1)
    }
  }

  async function toggleSubscribe() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !video) { Alert.alert('', 'Obuna bo\'lish uchun login qiling'); return }
    if (session.user.id === video.channel_id) return

    if (isSubscribed) {
      await supabase.from('subscriptions').delete()
        .eq('subscriber_id', session.user.id).eq('channel_id', video.channel_id)
      setIsSubscribed(false)
      setSubscribersCount(c => c - 1)
    } else {
      await supabase.from('subscriptions')
        .insert({ subscriber_id: session.user.id, channel_id: video.channel_id })
      setIsSubscribed(true)
      setSubscribersCount(c => c + 1)
    }
  }

  async function postComment() {
    if (!commentText.trim()) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { Alert.alert('', 'Izoh yozish uchun login qiling'); return }

    const { data, error } = await supabase.from('comments')
      .insert({ user_id: session.user.id, video_id: id, content: commentText.trim() })
      .select(`*, user:profiles(id, username, full_name, avatar_url)`)
      .single()

    if (!error && data) {
      setComments(prev => [data as Comment, ...prev])
      setCommentText('')
    }
  }

  if (loading || !video) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#606060' }}>Yuklanmoqda...</Text>
      </View>
    )
  }

  const channel = video.channel as Profile

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Video Player */}
      <View style={styles.playerWrapper}>
        {video.video_url ? (
          <VideoPlayer url={video.video_url} />
        ) : (
          <View style={[styles.player, { justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="play-circle" size={64} color="#fff" />
          </View>
        )}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Title & Stats */}
        <View style={styles.titleSection}>
          <Text style={styles.videoTitle}>{video.title}</Text>
          <TouchableOpacity onPress={() => setShowDescription(!showDescription)}>
            <Text style={styles.statsRow}>
              {formatViews(video.views_count)} ko'rilgan · {timeAgo(video.created_at)}
              {'  '}<Text style={styles.moreText}>{showDescription ? 'Yopish' : 'Ko\'proq'}</Text>
            </Text>
          </TouchableOpacity>
          {showDescription && video.description ? (
            <Text style={styles.description}>{video.description}</Text>
          ) : null}
        </View>

        {/* Actions row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionsScroll}>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionChip, isLiked && styles.actionChipActive]} onPress={toggleLike}>
              <Ionicons name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={isLiked ? '#fff' : '#0f0f0f'} />
              <Text style={[styles.actionChipText, isLiked && styles.actionChipTextActive]}>
                {formatViews(likesCount)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionChip}>
              <Ionicons name="thumbs-down-outline" size={18} color="#0f0f0f" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionChip}>
              <Ionicons name="share-social-outline" size={18} color="#0f0f0f" />
              <Text style={styles.actionChipText}>Ulashish</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionChip}>
              <Ionicons name="download-outline" size={18} color="#0f0f0f" />
              <Text style={styles.actionChipText}>Yuklash</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Channel info */}
        <View style={styles.channelRow}>
          <TouchableOpacity
            style={styles.channelLeft}
            onPress={() => router.push(`/channel/${video.channel_id}` as any)}
          >
            <View style={styles.channelAvatar}>
              {channel?.avatar_url ? (
                <Image source={{ uri: channel.avatar_url }} style={styles.channelAvatarImg} />
              ) : (
                <Text style={styles.channelAvatarText}>
                  {(channel?.username ?? channel?.email ?? '?')[0].toUpperCase()}
                </Text>
              )}
            </View>
            <View>
              <Text style={styles.channelName}>
                {channel?.username ?? channel?.full_name ?? 'Kanal'}
              </Text>
              <Text style={styles.subscriberCount}>
                {formatViews(subscribersCount)} obunachi
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subscribeBtn, isSubscribed && styles.subscribedBtn]}
            onPress={toggleSubscribe}
          >
            <Text style={[styles.subscribeBtnText, isSubscribed && styles.subscribedBtnText]}>
              {isSubscribed ? 'Obuna bo\'lindi' : 'Obuna bo\'lish'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Izohlar {video.comments_count > 0 ? `(${video.comments_count})` : ''}
          </Text>

          {/* Add comment */}
          <View style={styles.addCommentRow}>
            <View style={styles.commentAvatar}>
              <Text style={styles.commentAvatarText}>
                {(currentUser?.username ?? currentUser?.email ?? '?')[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.commentInputWrapper}>
              <TextInput
                style={styles.commentInput}
                placeholder="Izoh qo'shing..."
                placeholderTextColor="#909090"
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              {commentText.length > 0 && (
                <TouchableOpacity style={styles.postBtn} onPress={postComment}>
                  <Text style={styles.postBtnText}>Yuborish</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Comment list */}
          {comments.map(comment => (
            <View key={comment.id} style={styles.commentItem}>
              <View style={styles.commentAvatar}>
                {comment.user?.avatar_url ? (
                  <Image source={{ uri: comment.user.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                ) : (
                  <Text style={styles.commentAvatarText}>
                    {(comment.user?.username ?? comment.user?.email ?? '?')[0]?.toUpperCase() ?? '?'}
                  </Text>
                )}
              </View>
              <View style={styles.commentContent}>
                <Text style={styles.commentUser}>
                  {comment.user?.username ?? comment.user?.full_name ?? 'Foydalanuvchi'}
                  <Text style={styles.commentTime}>  {timeAgo(comment.created_at)}</Text>
                </Text>
                <Text style={styles.commentText}>{comment.content}</Text>
                <View style={styles.commentActions}>
                  <TouchableOpacity style={styles.commentAction}>
                    <Ionicons name="thumbs-up-outline" size={14} color="#606060" />
                    {comment.likes_count > 0 && (
                      <Text style={styles.commentActionText}>{comment.likes_count}</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.commentAction}>
                    <Ionicons name="thumbs-down-outline" size={14} color="#606060" />
                  </TouchableOpacity>
                  <TouchableOpacity>
                    <Text style={styles.replyText}>Javob berish</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {comments.length === 0 && (
            <View style={styles.noComments}>
              <Text style={styles.noCommentsText}>Hali izoh yo'q. Birinchi bo'ling!</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playerWrapper: { backgroundColor: '#000', position: 'relative' },
  player: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * (9 / 16) },
  backBtn: {
    position: 'absolute', top: 48, left: 12,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6,
  },
  content: { flex: 1 },
  titleSection: { padding: 12, gap: 4 },
  videoTitle: { fontSize: 16, fontWeight: '700', color: '#0f0f0f', lineHeight: 22 },
  statsRow: { fontSize: 13, color: '#606060' },
  moreText: { color: '#0f0f0f', fontWeight: '600' },
  description: { fontSize: 13, color: '#0f0f0f', lineHeight: 20, marginTop: 6 },
  actionsScroll: { paddingLeft: 12 },
  actionsRow: { flexDirection: 'row', gap: 8, paddingRight: 12, paddingBottom: 12 },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f2f2f2', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
  },
  actionChipActive: { backgroundColor: '#0f0f0f' },
  actionChipText: { fontSize: 13, fontWeight: '600', color: '#0f0f0f' },
  actionChipTextActive: { color: '#fff' },
  channelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  channelLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  channelAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#0f0f0f',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  channelAvatarImg: { width: 40, height: 40 },
  channelAvatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  channelName: { fontSize: 14, fontWeight: '600', color: '#0f0f0f' },
  subscriberCount: { fontSize: 12, color: '#606060' },
  subscribeBtn: {
    backgroundColor: '#0f0f0f', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
  },
  subscribedBtn: { backgroundColor: '#f2f2f2' },
  subscribeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  subscribedBtnText: { color: '#0f0f0f' },
  divider: { height: 8, backgroundColor: '#f2f2f2' },
  commentsSection: { padding: 12, gap: 16 },
  commentsTitle: { fontSize: 16, fontWeight: '700', color: '#0f0f0f' },
  addCommentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  commentAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#0f0f0f',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  commentAvatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  commentInputWrapper: { flex: 1, gap: 8 },
  commentInput: {
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
    fontSize: 14, color: '#0f0f0f', paddingBottom: 6, minHeight: 36,
  },
  postBtn: {
    alignSelf: 'flex-end', backgroundColor: '#0f0f0f',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
  },
  postBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  commentItem: { flexDirection: 'row', gap: 10 },
  commentContent: { flex: 1, gap: 4 },
  commentUser: { fontSize: 13, fontWeight: '600', color: '#0f0f0f' },
  commentTime: { fontSize: 12, color: '#909090', fontWeight: '400' },
  commentText: { fontSize: 14, color: '#0f0f0f', lineHeight: 20 },
  commentActions: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 4 },
  commentAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionText: { fontSize: 12, color: '#606060' },
  replyText: { fontSize: 13, fontWeight: '600', color: '#606060' },
  noComments: { alignItems: 'center', paddingVertical: 24 },
  noCommentsText: { color: '#909090', fontSize: 14 },
})
