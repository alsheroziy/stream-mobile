import { View, Text, Image, StyleSheet } from 'react-native'

type Props = {
  uri?: string | null
  name?: string | null
  size?: number
}

export function Avatar({ uri, name, size = 36 }: Props) {
  const letter = (name ?? '?')[0].toUpperCase()
  const radius = size / 2

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, { width: size, height: size, borderRadius: radius }]}
      />
    )
  }

  return (
    <View style={[styles.base, styles.placeholder, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.letter, { fontSize: size * 0.4 }]}>{letter}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', flexShrink: 0 },
  placeholder: { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  letter: { color: '#fff', fontWeight: '700' },
})
