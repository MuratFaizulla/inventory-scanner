// app/settings.tsx — страница настроек (открывается с шестерёнки)

import { Feather } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { clearTokens, logout, setApiHost } from '../constants/api'
import { goBack } from '../constants/nav'
import { confirmDialog, notify } from '../constants/dialog'
import { downloadFile } from '../constants/download'
import { Colors } from '../constants/colors'
import SyncView from '../components/onec/SyncView'

const ROLE_LABELS: Record<string, string> = {
  admin:   'Администратор',
  lead:    'Руководство',
  curator: 'Куратор',
  user:    'Пользователь',
}

const PLATFORM_LABEL =
  Platform.OS === 'web' ? 'Веб (браузер)'
  : Platform.OS === 'android' ? 'Android'
  : Platform.OS === 'ios' ? 'iOS'
  : Platform.OS

export default function SettingsScreen() {
  const [host,      setHost]      = useState('')
  const [origHost,  setOrigHost]  = useState('')
  const [username,  setUsername]  = useState('')
  const [name,      setName]      = useState('')
  const [role,      setRole]      = useState('')
  const [saving,    setSaving]    = useState(false)
  const [exporting, setExporting] = useState(false)
  const [syncOpen,  setSyncOpen]  = useState(false)
  const [remembered, setRemembered] = useState(false)
  const [pinging,   setPinging]   = useState(false)
  const [ping,      setPing]      = useState<{ ok: boolean; ms?: number } | null>(null)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    AsyncStorage.multiGet(['apiHost', 'authUsername', 'scannerName', 'authRole', 'rememberMe'])
      .then(pairs => {
        const v = Object.fromEntries(pairs.map(([k, val]) => [k, val ?? '']))
        setHost(v.apiHost)
        setOrigHost(v.apiHost)
        setUsername(v.authUsername)
        setName(v.scannerName)
        setRole(v.authRole)
        setRemembered(v.rememberMe === '1')
      })
  }, [])

  const hostChanged = host.trim() !== origHost

  const handleSave = async () => {
    const trimmed = host.trim()
    if (!trimmed || saving) return
    setSaving(true)
    await AsyncStorage.setItem('apiHost', trimmed)
    setApiHost(trimmed)
    if (hostChanged) {
      // Токены выданы старым сервером — на новом они не подойдут
      await clearTokens()
      setSaving(false)
      router.replace('/')
      return
    }
    setSaving(false)
    notify('Сохранено', 'Настройки применены')
  }

  // Проверка связи: публичный эндпоинт, без авторизации — тестирует адрес из поля
  const checkConnection = async () => {
    const trimmed = host.trim()
    if (!trimmed || pinging) return
    setPinging(true)
    setPing(null)
    const start = Date.now()
    try {
      await axios.get(`http://${trimmed}/api/info-tablo/houses`, { timeout: 6000 })
      setPing({ ok: true, ms: Date.now() - start })
    } catch {
      setPing({ ok: false })
    } finally {
      setPinging(false)
    }
  }

  // Мой акт закрепления ОС: single — один Excel, zip — файл на каждый кабинет
  const exportAct = async (format: 'single' | 'zip') => {
    if (exporting) return
    setExporting(true)
    try {
      const date = new Date().toISOString().slice(0, 10)
      await downloadFile(
        '/inventory/my-assets/export-act',
        { format },
        format === 'zip' ? `act_po_kabinetam_${date}.zip` : `act_${date}.xlsx`,
      )
    } catch {
      notify('Ошибка', 'Не удалось сформировать акт')
    } finally {
      setExporting(false)
    }
  }

  const forgetSavedLogin = async () => {
    const ok = await confirmDialog(
      'Забыть сохранённый вход?',
      'Логин и пароль будут удалены с этого устройства — при следующем входе их придётся ввести заново',
      'Забыть',
      { destructive: true },
    )
    if (!ok) return
    await AsyncStorage.multiSet([['rememberMe', ''], ['savedPassword', '']])
    setRemembered(false)
    notify('Готово', 'Сохранённый логин и пароль удалены')
  }

  const handleLogout = async () => {
    const ok = await confirmDialog('Выход', 'Выйти из аккаунта?', 'Выйти', { destructive: true })
    if (!ok) return
    await logout()
    await AsyncStorage.multiRemove(['scannerName', 'authRole'])
    router.replace('/')
  }

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => goBack(router)} style={styles.iconBtn}>
          <Feather name="arrow-left" size={19} color={Colors.text1} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Настройки</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Аккаунт */}
        <Text style={styles.sectionTitle}>Аккаунт</Text>
        <View style={styles.card}>
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Feather name="user" size={18} color={Colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>{name || username || '—'}</Text>
              <Text style={styles.accountSub}>
                {username}{role ? ` · ${ROLE_LABELS[role] ?? role}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Сервер */}
        <Text style={styles.sectionTitle}>Сервер</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Адрес сервера</Text>
          <TextInput
            style={styles.input}
            value={host}
            onChangeText={t => { setHost(t); setPing(null) }}
            placeholder="10.216.209.118:3000"
            placeholderTextColor={Colors.text3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.hint}>
            Только IP и порт — без http:// и /api.
            {hostChanged ? ' После смены адреса потребуется войти заново.' : ''}
          </Text>

          <View style={styles.serverBtnRow}>
            <TouchableOpacity
              style={[styles.pingBtn, (!host.trim() || pinging) && { opacity: 0.4 }]}
              onPress={checkConnection}
              disabled={!host.trim() || pinging}
              activeOpacity={0.8}
            >
              <Feather name="wifi" size={14} color={Colors.accent} />
              <Text style={styles.pingBtnText}>
                {pinging ? 'Проверяю…' : 'Проверить связь'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!host.trim() || saving) && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={!host.trim() || saving}
              activeOpacity={0.8}
            >
              <Feather name="check" size={14} color={Colors.accent2} />
              <Text style={styles.saveBtnText}>
                {saving ? 'Сохраняю…' : 'Сохранить'}
              </Text>
            </TouchableOpacity>
          </View>

          {ping && (
            <View style={[styles.pingResult, ping.ok ? styles.pingOk : styles.pingFail]}>
              <Feather
                name={ping.ok ? 'check-circle' : 'x-circle'}
                size={13}
                color={ping.ok ? Colors.accent2 : Colors.danger}
              />
              <Text style={[styles.pingResultText, { color: ping.ok ? Colors.accent2 : Colors.danger }]}>
                {ping.ok
                  ? `Сервер доступен · ${ping.ms} мс`
                  : 'Сервер недоступен — проверьте адрес, сеть или VPN'}
              </Text>
            </View>
          )}
        </View>

        {/* Мой акт закрепления ОС */}
        <Text style={styles.sectionTitle}>Мой акт закрепления ОС</Text>
        <View style={styles.card}>
          <View style={styles.exportRow}>
            <TouchableOpacity
              style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
              onPress={() => exportAct('single')}
              disabled={exporting}
              activeOpacity={0.7}
            >
              <Feather name="file-text" size={14} color={Colors.accent} />
              <Text style={styles.exportText}>
                {exporting ? 'Формирую…' : 'Акт (Excel)'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
              onPress={() => exportAct('zip')}
              disabled={exporting}
              activeOpacity={0.7}
            >
              <Feather name="folder" size={14} color={Colors.accent} />
              <Text style={styles.exportText}>ZIP по кабинетам</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Акт закрепления по вашему оборудованию — один файл или отдельный на каждый кабинет
          </Text>
        </View>

        {/* Синхронизация 1С — только admin */}
        {role === 'admin' && (
          <>
            <Text style={styles.sectionTitle}>Администрирование</Text>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => setSyncOpen(true)}
              activeOpacity={0.7}
            >
              <View style={styles.navIcon}>
                <Feather name="database" size={17} color={Colors.text2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navLabel}>Синхронизация 1С</Text>
                <Text style={styles.navSub}>Статус выгрузки, изменения, запуск</Text>
              </View>
              <Feather name="chevron-right" size={15} color={Colors.text3} />
            </TouchableOpacity>
          </>
        )}

        {/* Безопасность */}
        {remembered && (
          <>
            <Text style={styles.sectionTitle}>Безопасность</Text>
            <TouchableOpacity
              style={styles.navItem}
              onPress={forgetSavedLogin}
              activeOpacity={0.7}
            >
              <View style={styles.navIcon}>
                <Feather name="key" size={17} color={Colors.warn} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navLabel}>Забыть сохранённый вход</Text>
                <Text style={styles.navSub}>Удалить логин и пароль с этого устройства</Text>
              </View>
              <Feather name="chevron-right" size={15} color={Colors.text3} />
            </TouchableOpacity>
          </>
        )}

        {/* О приложении */}
        <Text style={styles.sectionTitle}>О приложении</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Версия</Text>
            <Text style={styles.aboutValue}>
              {Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Платформа</Text>
            <Text style={styles.aboutValue}>{PLATFORM_LABEL}</Text>
          </View>
          <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.aboutLabel}>Сервер</Text>
            <Text style={styles.aboutValue} numberOfLines={1}>{origHost || '—'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Feather name="log-out" size={15} color={Colors.danger} />
          <Text style={styles.logoutBtnText}>Выйти из аккаунта</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Полноэкранная «Синхронизация 1С» */}
      <Modal visible={syncOpen} animationType="slide" onRequestClose={() => setSyncOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#020617', paddingTop: insets.top }}>
          <View style={styles.syncHeader}>
            <TouchableOpacity onPress={() => setSyncOpen(false)} style={styles.iconBtn}>
              <Feather name="arrow-left" size={19} color={Colors.text1} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Синхронизация 1С</Text>
          </View>
          <SyncView />
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingBottom: 10,
    backgroundColor: Colors.bg2,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.bg3,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text1 },

  scroll: { padding: 16 },

  sectionTitle: {
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4,
    color: Colors.text3, fontWeight: '600',
    marginTop: 16, marginBottom: 6,
  },
  card: {
    backgroundColor: Colors.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
  },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 9999,
    backgroundColor: 'rgba(56,189,248,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  accountName: { fontSize: 15, fontWeight: '700', color: Colors.text1 },
  accountSub:  { fontSize: 12, color: Colors.text3, marginTop: 2 },

  label: { fontSize: 13, color: Colors.text2, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: Colors.bg3, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text1, fontSize: 15, padding: 12,
  },
  hint: { fontSize: 11, color: Colors.text3, marginTop: 6, lineHeight: 16 },

  serverBtnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pingBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)',
    borderRadius: 12, padding: 12,
  },
  pingBtnText: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#0c4a2a', borderWidth: 1, borderColor: '#166534',
    borderRadius: 12, padding: 12,
  },
  saveBtnText: { color: Colors.accent2, fontWeight: '700', fontSize: 13 },

  pingResult: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: 10, borderWidth: 1,
    paddingVertical: 9, paddingHorizontal: 11, marginTop: 10,
  },
  pingOk:   { backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.3)' },
  pingFail: { backgroundColor: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.3)' },
  pingResultText: { fontSize: 12, fontWeight: '600', flex: 1 },

  exportRow: { flexDirection: 'row', gap: 8 },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)',
    borderRadius: 10, paddingVertical: 11,
  },
  exportText: { fontSize: 12, fontWeight: '600', color: Colors.accent },

  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.bg2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 12,
  },
  navIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.bg3,
    alignItems: 'center', justifyContent: 'center',
  },
  navLabel: { fontSize: 14, fontWeight: '600', color: Colors.text1 },
  navSub:   { fontSize: 11, color: Colors.text3, marginTop: 1 },

  aboutRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.5)',
  },
  aboutLabel: { fontSize: 13, color: Colors.text3 },
  aboutValue: { fontSize: 13, fontWeight: '600', color: Colors.text1, maxWidth: '60%' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#450a0a', borderWidth: 1, borderColor: '#7f1d1d',
    borderRadius: 12, padding: 14, marginTop: 20,
  },
  logoutBtnText: { color: Colors.danger, fontWeight: '700', fontSize: 14 },

  syncHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
})
