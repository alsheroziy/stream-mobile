export type Profile = {
  id: string
  email: string | null
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  website: string | null
  subscribers_count: number
  videos_count: number
  created_at: string
  updated_at: string
}

export type Video = {
  id: string
  channel_id: string
  title: string
  description: string | null
  video_url: string
  thumbnail_url: string | null
  duration: number
  views_count: number
  likes_count: number
  comments_count: number
  is_published: boolean
  created_at: string
  updated_at: string
  channel?: Profile
  is_liked?: boolean
  is_subscribed?: boolean
}

export type Comment = {
  id: string
  user_id: string
  video_id: string
  parent_id: string | null
  content: string
  likes_count: number
  created_at: string
  updated_at: string
  user?: Profile
  replies?: Comment[]
}

export type Notification = {
  id: string
  user_id: string
  from_user_id: string | null
  video_id: string | null
  type: 'like' | 'comment' | 'subscribe' | 'reply'
  message: string | null
  is_read: boolean
  created_at: string
  from_user?: Profile
  video?: Video
}
