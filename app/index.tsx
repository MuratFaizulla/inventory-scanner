import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { login, setApiHost } from '../constants/api'
import { Colors } from '../constants/colors'

export default function LoginScreen() {
  const [host,     setHost]     = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const router = useRouter()

  const userRef = useRef<TextInput>(null)
  const passRef = useRef<TextInput>(null)

  useEffect(() => {
    AsyncStorage.multiGet(['apiHost', 'authUsername', 'savedPassword', 'rememberMe'])
      .then(pairs => {
        const saved = Object.fromEntries(pairs.map(([k, v]) => [k, v ?? '']))
        if (saved.apiHost)      setHost(saved.apiHost)
        if (saved.authUsername) setUsername(saved.authUsername)
        if (saved.rememberMe === '1') {
          setRemember(true)
          if (saved.savedPassword) setPassword(saved.savedPassword)
        }
      })
  }, [])

  const isValid = host.trim() && username.trim() && password

  const handleLogin = async () => {
    if (!isValid || loading) return
    Keyboard.dismiss()
    setLoading(true)
    setError(null)

    const trimmedHost = host.trim()
    setApiHost(trimmedHost)

    try {
      const user = await login(username.trim(), password)
      await AsyncStorage.multiSet([
        ['apiHost',      trimmedHost],
        ['authUsername', username.trim()],
        ['authRole',     user.role],
        // Имя для актов инвентаризации — из AD, fallback на логин
        ['scannerName',  user.displayName || user.username],
        ['rememberMe',   remember ? '1' : ''],
        ['savedPassword', remember ? password : ''],
      ])
      router.replace('/sessions')
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } }; message?: string }
      if (err.response?.status === 401) {
        setError('Неверный логин или пароль')
      } else if (err.response?.status === 403) {
        setError('Нет доступа — обратитесь к администратору')
      } else {
        setError(err.response?.data?.message ?? err.message ?? 'Сервер недоступен')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.icon}>📦</Text>
          <Text style={styles.title}>1С Интеграция</Text>
          <Text style={styles.subtitle}>НИШ Туркестан</Text>

          <View style={styles.card}>
            {/* IP */}
            <Text style={styles.label}>🌐 Адрес сервера</Text>
            <TextInput
              style={styles.input}
              value={host}
              onChangeText={setHost}
              placeholder="10.216.209.118:3000"
              placeholderTextColor={Colors.text3}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="next"
              onSubmitEditing={() => userRef.current?.focus()}
              blurOnSubmit={false}
            />
            <Text style={styles.hint}>Только IP и порт — без http:// и /api</Text>

            <View style={styles.divider} />

            {/* Логин */}
            <Text style={styles.label}>👤 Логин</Text>
            <TextInput
              ref={userRef}
              style={styles.input}
              value={username}
              onChangeText={t => { setUsername(t); setError(null) }}
              placeholder="Учётная запись AD"
              placeholderTextColor={Colors.text3}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passRef.current?.focus()}
              blurOnSubmit={false}
            />

            {/* Пароль */}
            <Text style={styles.label}>🔑 Пароль</Text>
            <TextInput
              ref={passRef}
              style={styles.input}
              value={password}
              onChangeText={t => { setPassword(t); setError(null) }}
              placeholder="••••••••"
              placeholderTextColor={Colors.text3}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            {/* Запомнить логин и пароль */}
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRemember(r => !r)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                {remember && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Запомнить логин и пароль</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>❌ {error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, (!isValid || loading) && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={!isValid || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>{loading ? '⏳ Вход...' : 'Войти →'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  icon:     { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  title:    { fontSize: 24, fontWeight: '800', color: Colors.text1, textAlign: 'center', marginBottom: 4, letterSpacing: -0.4 },
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
  rememberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.bg3,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#0c4a2a', borderColor: '#166534' },
  checkboxMark: { color: Colors.accent2, fontSize: 13, fontWeight: '700' },
  rememberText: { fontSize: 14, color: Colors.text2 },
  errorBox: {
    backgroundColor: '#450a0a', borderRadius: 10,
    borderWidth: 1, borderColor: '#dc2626',
    padding: 12, marginBottom: 20,
  },
  errorText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
  btn: {
    backgroundColor: '#0c4a2a', borderWidth: 1, borderColor: '#166534',
    borderRadius: 14, padding: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: Colors.accent2, fontWeight: '700', fontSize: 16 },
})
