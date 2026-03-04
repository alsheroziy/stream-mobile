import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'

type Props = {
  filters: string[]
  active: string
  onChange: (f: string) => void
  dark?: boolean
}

export function FilterChips({ filters, active, onChange }: Props) {
  const { colors } = useTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={[styles.bar, { backgroundColor: colors.bg }]}
    >
      {filters.map(f => {
        const isActive = f === active
        return (
          <TouchableOpacity
            key={f}
            onPress={() => onChange(f)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? colors.chipActive : colors.chip,
              },
            ]}
          >
            <Text style={[styles.text, { color: isActive ? colors.chipActiveText : colors.chipText }]}>
              {f}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  bar: { flexGrow: 0 },
  row: { paddingHorizontal: 14, gap: 8, paddingVertical: 10 },
  chip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  text: { fontSize: 13, fontWeight: '600' },
})
