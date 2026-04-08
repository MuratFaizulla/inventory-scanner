// components/scan/ManualInput.tsx

import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Colors } from '../../../constants/colors'

interface Props {
  value:      string
  submitting: boolean
  onChange:   (v: string) => void
  onSubmit:   () => void
  onCancel:   () => void
}

export default function ManualInput({ value, submitting, onChange, onSubmit, onCancel }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>⌨️ Ручной ввод</Text>
      <Text style={styles.subtitle}>Введите инвентарный номер или штрих-код</Text>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="Например: 1234567890"
        placeholderTextColor={Colors.text3}
        autoFocus
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCapitalize="none"
      />

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Отмена</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, (!value.trim() || submitting) && styles.disabled]}
          onPress={onSubmit}
          disabled={!value.trim() || submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? '⏳ Поиск...' : 'Найти →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title:     { fontSize: 22, fontWeight: '700', color: Colors.text1, marginBottom: 8 },
  subtitle:  { fontSize: 13, color: Colors.text3, marginBottom: 24 },
  input: {
    backgroundColor: Colors.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text1, fontSize: 18,
    padding: 16, marginBottom: 16, fontFamily: 'monospace',
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, backgroundColor: Colors.bg3, borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  cancelText: { color: Colors.text2, fontWeight: '600', fontSize: 15 },
  submitBtn: {
    flex: 2, backgroundColor: '#0c4a2a', borderRadius: 12,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#166534',
  },
  submitText: { color: Colors.accent2, fontWeight: '700', fontSize: 15 },
  disabled:   { opacity: 0.4 },
})