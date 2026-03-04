import { useColorScheme } from './use-color-scheme'
import { Colors, ThemeColors } from '@/lib/theme'

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  return { colors: isDark ? Colors.dark : Colors.light, isDark }
}
