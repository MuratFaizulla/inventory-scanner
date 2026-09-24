// components/RelocateModal.tsx
//
// Перемещение позиции акта — одна модалка для экрана сканирования и деталей акта.
// Кабинет выбирается из справочника; сотрудник — из списка или вписывается
// вручную, если его там нет. Модалка сама грузит справочники, сохраняет через
// модуль акта (без связи — в очередь) и сообщает итог.

import { useEffect, useState } from 'react'
import {
  Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View,
} from 'react-native'
import type { Act, ActItem } from '../constants/act'
import { Colors } from '../constants/colors'
import { notify } from '../constants/dialog'
import { errorText } from '../constants/errorText'
import { getEmployees, getLocations } from '../constants/sessionsApi'

// '' — не меняем. Сотрудник либо выбран из списка, либо вписан: не оба сразу
type Choice = { location: string; employee: string; typed: string }

const EMPTY: Choice = { location: '', employee: '', typed: '' }

// «Как прошлый раз» — последнее перемещение в каждом акте, пока приложение открыто
const lastChoice = new WeakMap<Act, Choice>()

interface Props {
  act:      Act
  item:     ActItem | null   // null — модалка закрыта
  onClose:  () => void       // закрыть: отмена или после сохранения
  onSaved?: () => void       // перемещение сохранено или поставлено в очередь
}

export default function RelocateModal({ act, item, onClose, onSaved }: Props) {
  const [locations, setLocations] = useState<string[]>([])
  const [employees, setEmployees] = useState<string[]>([])

  useEffect(() => {
    getLocations().then(setLocations).catch(() => {})
    getEmployees().then(setEmployees).catch(() => {})
  }, [])

  return (
    <Modal visible={!!item} transparent animationType="fade" onRequestClose={onClose}>
      {/* key — выбор сбрасывается для каждой новой позиции */}
      {item && (
        <RelocateForm
          key={item.id}
          act={act}
          item={item}
          locations={locations}
          employees={employees}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  )
}

interface FormProps extends Omit<Props, 'item'> {
  item:      ActItem
  locations: string[]
  employees: string[]
}

function RelocateForm({ act, item, locations, employees, onClose, onSaved }: FormProps) {
  const { height: screenHeight } = useWindowDimensions()
  const [choice,  setChoice]  = useState<Choice>(EMPTY)
  const [tab,     setTab]     = useState<'location' | 'employee'>('location')
  const [search,  setSearch]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  // Снимок при открытии: читать изменяемый WeakMap в рендере React Compiler не даёт
  const [last] = useState(() => lastChoice.get(act))

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => setKeyboardHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  const q = search.toLowerCase()
  const shownLocations = locations.filter(l => l !== item.location && l.toLowerCase().includes(q))
  const shownEmployees = employees.filter(e => e.toLowerCase().includes(q))

  const employee = choice.employee || choice.typed.trim()
  const chosen   = !!(choice.location || employee)
  const keyboard = keyboardHeight > 0

  const pickLocation = (name: string) =>
    setChoice(c => ({ ...c, location: c.location === name ? '' : name }))
  const pickEmployee = (name: string) =>
    setChoice(c => ({ ...c, employee: c.employee === name ? '' : name, typed: '' }))
  const typeEmployee = (typed: string) =>
    setChoice(c => ({ ...c, employee: '', typed }))

  const save = async () => {
    if (!chosen || saving) return
    setSaving(true)
    try {
      const { queued } = await act.relocate(item.id, {
        ...(choice.location && { location: choice.location }),
        ...(employee && { employee }),
      })
      lastChoice.set(act, { ...choice, typed: choice.typed.trim() })
      notify('✅ Готово', [
        choice.location && `Кабинет: ${choice.location}`,
        employee && `Сотрудник: ${employee}`,
        queued && '📴 Сохранено на телефоне — уйдёт, когда появится связь',
      ].filter(Boolean).join('\n'))
      onClose()
      onSaved?.()
    } catch (e) {
      // Модуль акта отдаёт текст для человека: отказ сервера или «нет копии»
      notify('Не удалось сохранить', errorText(e))
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

      <View style={styles.modal}>
        <Text style={styles.title}>✏️ Изменить данные ОС</Text>

        {/* Инфо об ОС — прячем, пока открыта клавиатура */}
        {!keyboard && (
          <View style={styles.assetInfo}>
            <Text style={styles.assetName} numberOfLines={2}>{item.name ?? '—'}</Text>
            <Text style={styles.assetInv}>{item.invNumber ?? '—'}</Text>
            {!!item.barcode && <Text style={styles.assetInv}>📊 {item.barcode}</Text>}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <Text style={styles.assetMeta}>📍 {item.location ?? '—'}</Text>
              {!!item.employee && (
                <Text style={styles.assetMeta}>🧑‍💼 {item.employee.split(' ')[0]}</Text>
              )}
            </View>
          </View>
        )}

        {/* ── Как прошлый раз ── */}
        {last && !keyboard && (
          <TouchableOpacity style={styles.lastBtn} onPress={() => setChoice(last)} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lastLabel}>⚡ Применить как прошлый раз</Text>
              <View style={styles.lastTags}>
                {!!last.location && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>📍 {last.location}</Text>
                  </View>
                )}
                {!!last.employee && (
                  <View style={[styles.tag, styles.tagEmp]}>
                    <Text style={[styles.tagText, { color: Colors.accent }]}>
                      🧑‍💼 {last.employee.split(' ')[0]}
                    </Text>
                  </View>
                )}
                {!!last.typed && (
                  <View style={[styles.tag, styles.tagTyped]}>
                    <Text style={[styles.tagText, { color: Colors.warn }]}>✏️ {last.typed}</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.lastArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* Вкладки */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'location' && styles.tabActive]}
            onPress={() => { setTab('location'); setSearch('') }}
          >
            <Text style={[styles.tabText, tab === 'location' && { color: Colors.accent }]}>
              📍 Кабинет {choice.location ? '✓' : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'employee' && styles.tabActive]}
            onPress={() => { setTab('employee'); setSearch('') }}
          >
            <Text style={[styles.tabText, tab === 'employee' && { color: Colors.accent }]}>
              🧑‍💼 Сотрудник {employee ? '✓' : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Поиск */}
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={tab === 'location' ? 'Поиск кабинета...' : 'Поиск сотрудника...'}
          placeholderTextColor={Colors.text3}
        />

        {/* Список */}
        <ScrollView
          style={[styles.list, { maxHeight: keyboard ? screenHeight - keyboardHeight - 240 : 300 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'location'
            ? shownLocations.map(name => {
                const sel = choice.location === name
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.item, sel && styles.itemSelLoc]}
                    onPress={() => pickLocation(name)}
                  >
                    <Text style={[styles.itemText, sel && { color: Colors.accent2, fontWeight: '700' }]}>
                      {sel ? '✓ ' : ''}{name}
                    </Text>
                  </TouchableOpacity>
                )
              })
            : shownEmployees.map(name => {
                const sel = choice.employee === name
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.item, sel && styles.itemSelEmp]}
                    onPress={() => pickEmployee(name)}
                  >
                    <Text style={[styles.itemText, sel && { color: Colors.accent, fontWeight: '700' }]}>
                      {sel ? '✓ ' : ''}{name}
                    </Text>
                  </TouchableOpacity>
                )
              })
          }
        </ScrollView>

        {/* Сотрудника нет в списке — вписать вручную */}
        {tab === 'employee' && (
          <View style={styles.typedWrap}>
            <Text style={styles.typedLabel}>✏️ Нет в списке? Напишите вручную:</Text>
            <TextInput
              style={styles.typedInput}
              value={choice.typed}
              onChangeText={typeEmployee}
              placeholder="Фамилия И.О."
              placeholderTextColor={Colors.text3}
            />
          </View>
        )}

        {/* Итог выбора */}
        {chosen && (
          <View style={styles.summary}>
            {!!choice.location && <Text style={styles.sumLoc}>📍 → {choice.location}</Text>}
            {!!choice.employee && <Text style={styles.sumEmp}>🧑‍💼 → {choice.employee}</Text>}
            {/* !! обязательно: пустая строка от trim() попадает ребёнком в View */}
            {!!choice.typed.trim() && <Text style={styles.sumTyped}>✏️ → {choice.typed.trim()}</Text>}
          </View>
        )}

        <View style={styles.warning}>
          <Text style={styles.warningText}>⚠️ Изменится только в акте. В 1С исправьте вручную.</Text>
        </View>

        {/* Кнопки */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, (!chosen || saving) && styles.disabled]}
            onPress={save}
            disabled={!chosen || saving}
          >
            <Text style={styles.confirmText}>{saving ? 'Сохраняем...' : '✅ Сохранить'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', padding: 16 },
  modal:   {
    backgroundColor: Colors.bg2, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20, maxHeight: '88%',
  },
  title:     { fontSize: 16, fontWeight: '700', color: Colors.text1, marginBottom: 12 },
  assetInfo: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, marginBottom: 12 },
  assetName: { fontSize: 14, fontWeight: '600', color: Colors.text1, marginBottom: 4 },
  assetInv:  { fontSize: 11, color: Colors.text3, fontFamily: 'monospace' },
  assetMeta: { fontSize: 11, color: Colors.text3 },

  // ── Кнопка «как прошлый раз» ─────────────────────────────────────────────────
  lastBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0c2a1a',
    borderRadius: 10, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.accent2 + '66',
  },
  lastLabel: { fontSize: 12, fontWeight: '700', color: Colors.accent2, marginBottom: 6 },
  lastTags:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  lastArrow: { fontSize: 18, color: Colors.accent2, marginLeft: 8 },
  tag: {
    backgroundColor: Colors.bg3, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagEmp:   { backgroundColor: '#0c1a2a' },
  tagTyped: { backgroundColor: '#1a1200' },
  tagText:  { fontSize: 11, color: Colors.accent2 },

  tabs:    { flexDirection: 'row', gap: 8, marginBottom: 10 },
  tab: {
    flex: 1, padding: 10, borderRadius: 8, alignItems: 'center',
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { borderColor: Colors.accent, backgroundColor: '#0c2a4a' },
  tabText:   { fontSize: 13, color: Colors.text2, fontWeight: '600' },
  search: {
    backgroundColor: Colors.bg3, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text1, fontSize: 14, padding: 10, marginBottom: 8,
  },
  list: { marginBottom: 8 },
  item: {
    padding: 12, borderRadius: 8, marginBottom: 6,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  itemSelLoc: { backgroundColor: '#0c2a1a', borderColor: Colors.accent2 },
  itemSelEmp: { backgroundColor: '#0c1a2a', borderColor: Colors.accent },
  itemText:   { fontSize: 13, color: Colors.text1 },
  typedWrap:  { marginBottom: 8 },
  typedLabel: { fontSize: 11, color: Colors.text3, marginBottom: 6, fontWeight: '500' },
  typedInput: {
    backgroundColor: Colors.bg3, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text1, fontSize: 13, padding: 10,
  },
  summary:  { backgroundColor: '#0c2a1a', borderRadius: 8, padding: 10, marginBottom: 8, gap: 4 },
  sumLoc:   { fontSize: 12, color: Colors.accent2, fontWeight: '600' },
  sumEmp:   { fontSize: 12, color: Colors.accent,  fontWeight: '600' },
  sumTyped: { fontSize: 12, color: Colors.warn,    fontWeight: '600' },
  warning:     { backgroundColor: '#451a0322', borderRadius: 8, padding: 8, marginBottom: 12 },
  warningText: { fontSize: 11, color: Colors.warn },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, backgroundColor: Colors.bg3, borderRadius: 12,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  cancelText:  { color: Colors.text2, fontWeight: '600' },
  confirmBtn: {
    flex: 2, backgroundColor: '#0c4a2a', borderRadius: 12,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#166534',
  },
  confirmText: { color: Colors.accent2, fontWeight: '700', fontSize: 15 },
  disabled:    { opacity: 0.4 },
})
