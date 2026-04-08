import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { getApiBase, initApiHost } from '../constants/api'

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
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
  }, [])

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
      />
    </>
  )
}