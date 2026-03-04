import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'

type Props = {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon = 'videocam-outline', title, description, actionLabel, onAction }: Props) {
  const { colors } = useTheme()

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={56} color={colors.textMuted} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {description ? <Text style={[styles.desc, { color: colors.textSecondary }]}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.text }]} onPress={onAction}>
          <Text style={[styles.btnText, { color: colors.bg }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40, minHeight: 300 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  desc: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  btn: { borderRadius: 20, paddingHorizontal: 22, paddingVertical: 10, marginTop: 4 },
  btnText: { fontWeight: '700', fontSize: 14 },
})
