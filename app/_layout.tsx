import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { getApiBase, initApiHost, onAuthExpired } from '../constants/api'

export default function RootLayout() {
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    onAuthExpired(() => router.replace('/'))
    initApiHost()
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
        <Stack.Screen name="collection/[id]"         options={{ title: 'Сбор ОС' }} />
        <Stack.Screen name="collection/detail/[id]"  options={{ title: 'Сессия сбора' }} />
      </Stack>
    </>
  )
}