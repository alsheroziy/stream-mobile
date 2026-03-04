import { create } from 'zustand'
import { Video } from '../types'
import { supabase } from '../supabase'

type VideoState = {
  videos: Video[]
  loading: boolean
  refreshing: boolean
  fetchVideos: () => Promise<void>
  refresh: () => Promise<void>
}

export const useVideoStore = create<VideoState>((set, get) => ({
  videos: [],
  loading: true,
  refreshing: false,

  fetchVideos: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('videos')
      .select(`*, channel:profiles(id, username, full_name, avatar_url, subscribers_count)`)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(30)

    set({ videos: (data ?? []) as Video[], loading: false })
  },

  refresh: async () => {
    set({ refreshing: true })
    await get().fetchVideos()
    set({ refreshing: false })
  },
}))
