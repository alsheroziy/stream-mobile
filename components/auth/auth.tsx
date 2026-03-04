import { useState } from 'react'
import {
  Alert, View, Text, TextInput, TouchableOpacity,
  AppState, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'

WebBrowser.maybeCompleteAuthSession()

AppState.addEventListener('change', state => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})

export default function Auth() {
  const { colors, isDark } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleContinue() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('', 'Email va parolni kiriting')
      return
    }
    if (password.length < 6) {
      Alert.alert('', "Parol kamida 6 ta belgidan iborat bo'lishi kerak")
      return
    }
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (!signInError) { setLoading(false); return }

    if (
      signInError.message.includes('Invalid login credentials') ||
      signInError.message.includes('invalid_credentials')
    ) {
      const { data: { session }, error } = await supabase.auth.signUp({ email, password })
      if (error) Alert.alert('', error.message)
      else if (!session) Alert.alert('', 'Emailni tasdiqlang — xat yuborildi')
    } else {
      Alert.alert('', signInError.message)
    }
    setLoading(false)
  }

  async function signInWithGoogle() {
    setGoogleLoading(true)
    try {
      const redirectUri = makeRedirectUri({ scheme: 'stream', path: 'auth/callback' })
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      })
      if (error) throw error
      const result = await WebBrowser.openAuthSessionAsync(data.url ?? '', redirectUri)
      if (result.type === 'success') {
        const params = new URLSearchParams(
          result.url.split('#')[1] ?? result.url.split('?')[1]
        )
        const at = params.get('access_token')
        const rt = params.get('refresh_token')
        if (at && rt) await supabase.auth.setSession({ access_token: at, refresh_token: rt })
      }
    } catch (err: any) {
      Alert.alert('', err.message ?? 'Google bilan kirishda xato')
    } finally {
      setGoogleLoading(false)
    }
  }

  const c = colors
  const busy = loading || googleLoading

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoBlock}>
          <View style={[styles.logoBox, { backgroundColor: c.accent }]}>
            <Ionicons name="play" size={32} color="#fff" />
          </View>
          <Text style={[styles.logoText, { color: c.text }]}>Stream</Text>
          <Text style={[styles.tagline, { color: c.textMuted }]}>
            Kirish yoki ro'yxatdan o'tish
          </Text>
        </View>

        {/* Google */}
        <TouchableOpacity
          style={[styles.googleBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={signInWithGoogle}
          disabled={busy}
          activeOpacity={0.75}
        >
          {googleLoading ? (
            <ActivityIndicator color={c.text} size="small" />
          ) : (
            <>
              <GoogleG size={20} />
              <Text style={[styles.googleLabel, { color: c.text }]}>
                Google bilan davom etish
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divRow}>
          <View style={[styles.divLine, { backgroundColor: c.border }]} />
          <Text style={[styles.divLabel, { color: c.textMuted }]}>yoki</Text>
          <View style={[styles.divLine, { backgroundColor: c.border }]} />
        </View>

        {/* Email */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Email</Text>
          <View style={[styles.inputRow, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}>
            <Ionicons name="mail-outline" size={16} color={c.textMuted} />
            <TextInput
              style={[styles.input, { color: c.inputText }]}
              placeholder="email@example.com"
              placeholderTextColor={c.inputPlaceholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: c.textSecondary }]}>Parol</Text>
          <View style={[styles.inputRow, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}>
            <Ionicons name="lock-closed-outline" size={16} color={c.textMuted} />
            <TextInput
              style={[styles.input, { color: c.inputText }]}
              placeholder="Kamida 6 ta belgi"
              placeholderTextColor={c.inputPlaceholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={16}
                color={c.textMuted}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: c.textMuted }]}>
            Hisob bo'lsa kiradi, bo'lmasa avtomatik yaratadi
          </Text>
        </View>

        {/* Continue */}
        <TouchableOpacity
          style={[styles.continueBtn, { backgroundColor: c.accent }, busy && styles.disabled]}
          onPress={handleContinue}
          disabled={busy}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.continueBtnText}>Davom etish</Text>
          )}
        </TouchableOpacity>

        {/* Footer */}
        <Text style={[styles.footer, { color: c.textMuted }]}>
          Davom etish orqali siz foydalanish shartlariga rozilik bildirasiz
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <Text style={{ fontSize: size, fontWeight: '800', letterSpacing: -0.5 }}>
      <Text style={{ color: '#4285F4' }}>G</Text>
      <Text style={{ color: '#EA4335' }}>o</Text>
      <Text style={{ color: '#FBBC05' }}>o</Text>
      <Text style={{ color: '#4285F4' }}>g</Text>
      <Text style={{ color: '#34A853' }}>l</Text>
      <Text style={{ color: '#EA4335' }}>e</Text>
    </Text>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, padding: 28, justifyContent: 'center', gap: 4 },

  logoBlock: { alignItems: 'center', marginBottom: 40, gap: 10 },
  logoBox: {
    width: 64, height: 64, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  logoText: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  tagline: { fontSize: 14 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 12, borderWidth: 1,
    paddingVertical: 14, marginBottom: 20,
  },
  googleLabel: { fontSize: 15, fontWeight: '600' },

  divRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  divLine: { flex: 1, height: 1 },
  divLabel: { fontSize: 13 },

  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15 },
  eyeBtn: { padding: 4 },
  hint: { fontSize: 12, marginTop: 6 },

  continueBtn: {
    borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 8, marginBottom: 16,
  },
  disabled: { opacity: 0.45 },
  continueBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  footer: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
})
