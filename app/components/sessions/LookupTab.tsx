import { useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { useRef, useState } from 'react'
import {
  Modal, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native'
import api from '../../../constants/api'
import { Colors } from '../../../constants/colors'
import CameraScanner from '../scan/CameraScanner'
import LookupResultCard from './LookupResultCard'
import type { LookupResult } from './types'

export default function LookupTab() {
  const [permission, requestPermission] = useCameraPermissions()
  const [barcode,    setBarcode]    = useState('')
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState<LookupResult | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const cooldown = useRef(false)

  const lookup = async (code: string) => {
    const b = code.trim()
    if (!b || loading) return
    setCameraOpen(false)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.get(`/assets/scan/${encodeURIComponent(b)}`)
      setResult(res.data)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg ?? 'ОС не найдена')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setLoading(false)
    }
  }

  const handleBarcodeScan = (code: string) => {
    if (cooldown.current) return
    cooldown.current = true
    setBarcode(code)
    lookup(code)
    setTimeout(() => { cooldown.current = false }, 2000)
  }

  const reset = () => {
    setBarcode('')
    setResult(null)
    setError(null)
  }

  return (
    <View style={{ flex: 1 }}>

      {/* ── Полноэкранная камера ── */}
      <Modal visible={cameraOpen} animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {permission?.granted ? (
            <CameraScanner
              submitting={loading}
              onBarcodeScanned={handleBarcodeScan}
              onManual={() => setCameraOpen(false)}
            />
          ) : (
            <View style={styles.permWrap}>
              <Text style={styles.permIcon}>📷</Text>
              <Text style={styles.permText}>Нужен доступ к камере</Text>
              <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                <Text style={styles.permBtnText}>Разрешить</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.backBtn} onPress={() => setCameraOpen(false)}>
            <Text style={styles.backBtnText}>← Назад</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Основной экран ── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.cameraBtn}
          onPress={() => { reset(); setCameraOpen(true) }}
          activeOpacity={0.8}
        >
          <Text style={styles.cameraBtnText}>📷 Сканировать штрих-код</Text>
        </TouchableOpacity>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={barcode}
            onChangeText={t => { setBarcode(t); setError(null) }}
            placeholder="Инв. номер или штрих-код..."
            placeholderTextColor={Colors.text3}
            onSubmitEditing={() => lookup(barcode)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.searchBtn, (!barcode.trim() || loading) && { opacity: 0.5 }]}
            onPress={() => lookup(barcode)}
            disabled={!barcode.trim() || loading}
          >
            <Text style={styles.searchBtnText}>{loading ? '⏳' : '🔍'}</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loadingRow}>
            <Text style={styles.loadingText}>⏳ Поиск...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>❌ {error}</Text>
          </View>
        )}

        {result && <LookupResultCard result={result} onReset={reset} />}

        {!result && !error && !loading && (
          <View style={styles.hint}>
            <Text style={styles.hintIcon}>🔍</Text>
            <Text style={styles.hintText}>
              Отсканируйте штрих-код или введите инвентарный номер чтобы узнать информацию об ОС
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 10 },

  cameraBtn: {
    backgroundColor: '#0c4a2a', borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#166534',
  },
  cameraBtnText: { fontSize: 16, color: Colors.accent2, fontWeight: '700' },

  backBtn: {
    position: 'absolute', top: 52, left: 16,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  permIcon: { fontSize: 48, marginBottom: 16 },
  permText: { color: '#fff', fontSize: 16, marginBottom: 24, textAlign: 'center' },
  permBtn:  { backgroundColor: '#1a3a1a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2d6a2d' },
  permBtnText: { color: '#4ade80', fontWeight: '700', fontSize: 15 },

  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: Colors.bg2, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text1, fontSize: 15, padding: 14,
  },
  searchBtn: {
    backgroundColor: Colors.bg3, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    width: 52, alignItems: 'center', justifyContent: 'center',
  },
  searchBtnText: { fontSize: 20 },

  loadingRow: { alignItems: 'center', paddingVertical: 20 },
  loadingText: { color: Colors.text3, fontSize: 14 },

  errorBox: {
    backgroundColor: '#450a0a', borderRadius: 10,
    borderWidth: 1, borderColor: '#dc2626', padding: 12,
  },
  errorText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },

  hint:     { alignItems: 'center', paddingTop: 40 },
  hintIcon: { fontSize: 48, marginBottom: 12 },
  hintText: {
    fontSize: 14, color: Colors.text3,
    textAlign: 'center', lineHeight: 22, paddingHorizontal: 20,
  },
})
