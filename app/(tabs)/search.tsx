import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, FlatList, StatusBar, Keyboard,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { Video, Profile } from '@/lib/types'

type SearchTab = 'videos' | 'channels'

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const TRENDING = [
  'React Native', 'Expo', 'JavaScript', 'Python', 'Flutter',
  'AI', 'Web development', 'Gaming', 'Music', 'Travel',
]

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [videos, setVideos] = useState<Video[]>([])
  const [channels, setChannels] = useState<Profile[]>([])
  const [activeTab, setActiveTab] = useState<SearchTab>('videos')
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setVideos([])
      setChannels([])
      setHasSearched(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      doSearch(query.trim())
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  async function doSearch(q: string) {
    setSearching(true)
    setHasSearched(true)

    const [{ data: vData }, { data: cData }] = await Promise.all([
      supabase.from('videos')
        .select(`*, channel:profiles(id, username, full_name, avatar_url)`)
        .eq('is_published', true)
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .order('views_count', { ascending: false })
        .limit(20),
      supabase.from('profiles')
        .select('*')
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .order('subscribers_count', { ascending: false })
        .limit(10),
    ])

    setVideos((vData ?? []) as Video[])
    setChannels((cData ?? []) as Profile[])
    setSearching(false)
  }

  const totalResults = activeTab === 'videos' ? videos.length : channels.length

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f0f0f" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#606060" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Video yoki kanal qidiring"
            placeholderTextColor="#909090"
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#909090" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* No query — show trending */}
      {!query.trim() && (
        <View style={styles.trendingSection}>
          <Text style={styles.sectionTitle}>Trending</Text>
          {TRENDING.map(term => (
            <TouchableOpacity
              key={term}
              style={styles.trendingItem}
              onPress={() => setQuery(term)}
            >
              <Ionicons name="trending-up" size={20} color="#606060" />
              <Text style={styles.trendingText}>{term}</Text>
              <Ionicons name="arrow-up-outline" size={16} color="#909090" style={{ transform: [{ rotate: '45deg' }] }} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Searching */}
      {searching && (
        <View style={styles.centered}>
          <Text style={{ color: '#606060' }}>Qidirilmoqda...</Text>
        </View>
      )}

      {/* Results */}
      {!searching && hasSearched && (
        <>
          {/* Tabs */}
          <View style={styles.tabs}>
            {(['videos', 'channels'] as SearchTab[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'videos' ? `Videolar (${videos.length})` : `Kanallar (${channels.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {totalResults === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="search-outline" size={48} color="#ccc" />
              <Text style={styles.noResults}>"{query}" bo'yicha hech narsa topilmadi</Text>
            </View>
          ) : null}

          {activeTab === 'videos' && (
            <FlatList
              data={videos}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.videoItem}
                  onPress={() => router.push(`/video/${item.id}` as any)}
                >
                  <View style={styles.videoThumb}>
                    {item.thumbnail_url ? (
                      <Image source={{ uri: item.thumbnail_url }} style={styles.thumbImg} resizeMode="cover" />
                    ) : (
                      <View style={[styles.thumbImg, styles.thumbPlaceholder]}>
                        <Ionicons name="play-circle" size={28} color="#fff" />
                      </View>
                    )}
                    {item.duration > 0 && (
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.videoMeta}>
                      {(item as any).channel?.username ?? 'Kanal'}
                    </Text>
                    <Text style={styles.videoMeta}>
                      {formatViews(item.views_count)} ko'rilgan
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.menuBtn}>
                    <Ionicons name="ellipsis-vertical" size={18} color="#606060" />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}

          {activeTab === 'channels' && (
            <FlatList
              data={channels}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const name = item.username ?? item.full_name ?? 'Kanal'
                return (
                  <TouchableOpacity
                    style={styles.channelItem}
                    onPress={() => router.push(`/channel/${item.id}` as any)}
                  >
                    <View style={styles.channelAvatar}>
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.channelAvatarImg} />
                      ) : (
                        <Text style={styles.channelAvatarText}>{name[0].toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.channelInfo}>
                      <Text style={styles.channelName}>{name}</Text>
                      <Text style={styles.channelMeta}>
                        {formatViews(item.subscribers_count)} obunachi · {item.videos_count} video
                      </Text>
                      {item.bio ? <Text style={styles.channelBio} numberOfLines={1}>{item.bio}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#909090" />
                  </TouchableOpacity>
                )
              }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 52, paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5',
  },
  backBtn: { padding: 4 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f2f2f2', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#0f0f0f' },
  trendingSection: { padding: 16, gap: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f0f0f', marginBottom: 8 },
  trendingItem: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#f2f2f2',
  },
  trendingText: { flex: 1, fontSize: 15, color: '#0f0f0f' },
  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0f0f0f' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#606060' },
  tabTextActive: { color: '#0f0f0f' },
  noResults: { fontSize: 15, color: '#606060', textAlign: 'center' },
  videoItem: { flexDirection: 'row', gap: 10, padding: 12, alignItems: 'flex-start' },
  videoThumb: { width: 160, aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  thumbImg: { width: '100%', height: '100%', backgroundColor: '#0f0f0f' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  durationBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
  },
  durationText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  videoInfo: { flex: 1, gap: 2 },
  videoTitle: { fontSize: 14, fontWeight: '600', color: '#0f0f0f', lineHeight: 20 },
  videoMeta: { fontSize: 12, color: '#606060' },
  menuBtn: { padding: 4 },
  channelItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#f2f2f2',
  },
  channelAvatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#0f0f0f',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  channelAvatarImg: { width: 56, height: 56 },
  channelAvatarText: { color: '#fff', fontWeight: '700', fontSize: 20 },
  channelInfo: { flex: 1, gap: 2 },
  channelName: { fontSize: 15, fontWeight: '700', color: '#0f0f0f' },
  channelMeta: { fontSize: 13, color: '#606060' },
  channelBio: { fontSize: 12, color: '#909090' },
})
