import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { setApiHost } from '../constants/api'
import { Colors } from '../constants/colors'

export default function LoginScreen() {
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const router  = useRouter()
  const hostRef = useRef<TextInput>(null)

  useEffect(() => {
    AsyncStorage.multiGet(['scannerName', 'apiHost']).then(pairs => {
      const saved = Object.fromEntries(pairs.map(([k, v]) => [k, v ?? '']))
      if (saved.scannerName) setName(saved.scannerName)
      if (saved.apiHost)     setHost(saved.apiHost)
    })
  }, [])

  const isValid = name.trim() && host.trim()

  const handleContinue = async () => {
    if (!isValid) return
    const trimmedHost = host.trim()
    await AsyncStorage.multiSet([
      ['scannerName', name.trim()],
      ['apiHost',     trimmedHost],
    ])
    setApiHost(trimmedHost)
    router.push('/sessions')
  }

  return (
    // Закрываем клавиатуру при тапе вне полей
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // На iOS без offset — контент встаёт ровно над клавиатурой
        // На Android 'height' сам сжимает доступное пространство
      >
        <View style={styles.inner}>
          <Text style={styles.icon}>📦</Text>
          <Text style={styles.title}>НИШ Инвентаризация</Text>
          <Text style={styles.subtitle}>Туркестан</Text>

          <View style={styles.card}>
            {/* Имя */}
            <Text style={styles.label}>👤 Ваше имя</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Например: Файзулла Мұрат"
              placeholderTextColor={Colors.text3}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => hostRef.current?.focus()}
              blurOnSubmit={false}
            />
            <Text style={styles.hint}>Имя будет записано в акт инвентаризации</Text>

            <View style={styles.divider} />

            {/* IP */}
            <Text style={styles.label}>🌐 Адрес сервера</Text>
            <TextInput
              ref={hostRef}
              style={styles.input}
              value={host}
              onChangeText={setHost}
              placeholder="10.216.209.118:8888"
              placeholderTextColor={Colors.text3}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
            <Text style={styles.hint}>Только IP и порт — без http:// и /api</Text>
          </View>

          <TouchableOpacity
            style={[styles.btn, !isValid && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={!isValid}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>Продолжить →</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  icon:     { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  title:    { fontSize: 24, fontWeight: '700', color: Colors.text1, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.text3, textAlign: 'center', marginBottom: 40 },
  card: {
    backgroundColor: Colors.bg2, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20, marginBottom: 20,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  label:   { fontSize: 13, color: Colors.text2, marginBottom: 10, fontWeight: '600' },
  input: {
    backgroundColor: Colors.bg3, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text1, fontSize: 16,
    padding: 14, marginBottom: 8,
  },
  hint: { fontSize: 12, color: Colors.text3 },
  btn: {
    backgroundColor: '#0c4a2a', borderWidth: 1, borderColor: '#166534',
    borderRadius: 14, padding: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: Colors.accent2, fontWeight: '700', fontSize: 16 },
})