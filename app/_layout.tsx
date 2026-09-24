import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { Platform, View } from 'react-native'
import { getApiBase, initApiHost, onAuthExpired, sameOrigin } from '../constants/api'
import { initActs, useAutoSync } from '../constants/act'

export default function RootLayout() {
  const [ready, setReady] = useState(false)
  const router = useRouter()
  useAutoSync()

  useEffect(() => {
    onAuthExpired(() => router.replace('/'))
    // Веб по HTTPS: service worker держит приложение в кэше браузера —
    // открывается и без сети (шаблон pwa/sw.js, сборка — scripts/build-web.js)
    if (Platform.OS === 'web' && sameOrigin && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${process.env.EXPO_BASE_URL ?? ''}/sw.js`).catch(e => {
        console.warn('[SW] register failed:', e)
      })
    }
    initApiHost()
      .then(initActs)
      .then(() => {
        console.log('[API] host loaded:', getApiBase())
        setReady(true)
      })
      .catch(e => {
        console.error('[API] initApiHost failed:', e)
        // Всё равно рендерим — иначе приложение зависнет
        setReady(true)
      })
  }, [router])

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#0f172a' }} />

  return (
    <>
      <StatusBar style="light" backgroundColor="#0f172a" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0f172a' },
          headerShadowVisible: false,
        }}
      >
        {/* У этих экранов свои шапки с кнопкой «назад» — нативная не нужна */}
        <Stack.Screen name="index"        options={{ headerShown: false }} />
        <Stack.Screen name="sessions"     options={{ headerShown: false }} />
        <Stack.Screen name="settings"     options={{ headerShown: false }} />
        <Stack.Screen name="help"         options={{ headerShown: false }} />
        <Stack.Screen name="scan"         options={{ headerShown: false }} />
        <Stack.Screen name="session/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  )
}