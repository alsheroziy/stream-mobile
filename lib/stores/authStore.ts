import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { Profile } from '../types'
import { supabase } from '../supabase'

type AuthState = {
  session: Session | null
  profile: Profile | null
  initialized: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  loadProfile: (userId: string, email?: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  initialized: false,

  setSession: (session) => set({ session, initialized: true }),
  setProfile: (profile) => set({ profile }),

  loadProfile: async (userId, email) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data) {
      set({ profile: data as Profile })
    } else {
      // Auto-create if not exists
      await supabase.from('profiles').insert({ id: userId, email: email ?? null })
      const { data: created } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (created) set({ profile: created as Profile })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null })
  },
}))
