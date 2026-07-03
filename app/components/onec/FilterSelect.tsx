import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import {
  FlatList, Modal, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { T } from './types'

// Аналог FilterSelect из AssetsAdminPage.jsx — выпадающий список в модалке
export default function FilterSelect({ value, onChange, options, placeholder, icon }: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder: string
  icon: keyof typeof Feather.glyphMap
}) {
  const [open, setOpen] = useState(false)

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.btn, !!value && styles.btnActive]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Feather name={icon} size={13} color={value ? T.accent : T.textFaint} />
        <Text
          style={[styles.btnText, !!value && styles.btnTextActive]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={12} color={T.textFaint} />
      </TouchableOpacity>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.dropdown}>
            <Text style={styles.dropdownTitle}>{placeholder}</Text>
            <FlatList
              data={['', ...options]}
              keyExtractor={(o, i) => `${i}-${o}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, value === item && styles.optionActive]}
                  onPress={() => pick(item)}
                >
                  <Text
                    style={[styles.optionText, value === item && styles.optionTextActive]}
                    numberOfLines={1}
                  >
                    {item || placeholder}
                  </Text>
                  {value === item && <Feather name="check" size={14} color={T.accent} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.surface, borderRadius: 10,
    borderWidth: 1, borderColor: T.border,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  btnActive:     { borderColor: T.accentBorder, backgroundColor: T.accentBg },
  btnText:       { flex: 1, fontSize: 13, color: T.textFaint },
  btnTextActive: { color: T.accent, fontWeight: '600' },

  overlay: {
    flex: 1, backgroundColor: 'rgba(2,6,23,0.7)',
    justifyContent: 'center', padding: 24,
  },
  dropdown: {
    backgroundColor: T.elevated, borderRadius: 16,
    borderWidth: 1, borderColor: T.border,
    maxHeight: '70%', paddingVertical: 8,
  },
  dropdownTitle: {
    fontSize: 12, fontWeight: '600', color: T.textFaint,
    textTransform: 'uppercase', letterSpacing: 0.4,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  optionActive:     { backgroundColor: T.accentBg },
  optionText:       { fontSize: 14, color: T.textSecondary, flex: 1 },
  optionTextActive: { color: T.accent, fontWeight: '600' },
})
