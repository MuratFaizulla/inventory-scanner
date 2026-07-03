import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import {
  createSession, getCreateOptions, previewSession, RawSession,
} from '../../constants/sessionsApi'
import { Colors } from '../../constants/colors'
import { notify } from '../../constants/dialog'
import FilterSelect from '../onec/FilterSelect'

// Модалка создания акта — как SessionCreateModal.jsx в вебе:
// каскад МОЛ → сотрудники → кабинеты + живое превью количества ОС
export default function CreateSessionModal({ visible, scannerName, onClose, onCreated }: {
  visible: boolean
  scannerName: string
  onClose: () => void
  onCreated: (session: RawSession) => void
}) {
  const [title,       setTitle]       = useState('')
  const [conductedBy, setConductedBy] = useState('')
  const [mol,         setMol]         = useState('')
  const [employee,    setEmployee]    = useState('')
  const [location,    setLocation]    = useState('')
  const [notes,       setNotes]       = useState('')
  const [busy,        setBusy]        = useState(false)

  const [opts, setOpts] = useState<{ mols: string[]; employees: string[]; locations: string[] }>(
    { mols: [], employees: [], locations: [] },
  )
  const [preview,        setPreview]        = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (visible) setConductedBy(prev => prev || scannerName)
  }, [visible, scannerName])

  // Каскад: МОЛ → сотрудники под ним → кабинеты под выбором (как в вебе)
  useEffect(() => {
    if (!visible) return
    getCreateOptions(mol.trim() || undefined, employee.trim() || undefined)
      .then(setOpts)
      .catch(() => {})
  }, [visible, mol, employee])

  // Живое превью количества ОС
  const hasFilter = !!(mol.trim() || employee.trim() || location.trim())
  useEffect(() => {
    if (!visible || !hasFilter) { setPreview(null); return }
    setPreviewLoading(true)
    const t = setTimeout(() => {
      previewSession({
        location: location.trim() || undefined,
        mol:      mol.trim()      || undefined,
        employee: employee.trim() || undefined,
      })
        .then(d => setPreview(d.total))
        .catch(() => setPreview(null))
        .finally(() => setPreviewLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [visible, mol, employee, location, hasFilter])

  const onMolChange = (v: string) => { setMol(v); setEmployee(''); setLocation('') }
  const onEmpChange = (v: string) => { setEmployee(v); setLocation('') }

  const reset = () => {
    setTitle(''); setMol(''); setEmployee(''); setLocation(''); setNotes('')
    setPreview(null)
  }

  const submit = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      const session = await createSession({
        title:          title.trim(),
        conductedBy:    conductedBy.trim() || undefined,
        mol:            mol.trim()         || undefined,
        employee:       employee.trim()    || undefined,
        locationFilter: location.trim()    || undefined,
        notes:          notes.trim()       || undefined,
      })
      reset()
      onCreated(session)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      notify('Ошибка', err.response?.data?.message ?? 'Не удалось создать акт')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>Новый акт инвентаризации</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={15} color={Colors.text2} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Название *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Напр. Инвентаризация каб. 204"
              placeholderTextColor={Colors.text3}
            />

            <Text style={styles.label}>Кто проводит</Text>
            <TextInput
              style={styles.input}
              value={conductedBy}
              onChangeText={setConductedBy}
              placeholder="ФИО"
              placeholderTextColor={Colors.text3}
            />

            <Text style={styles.label}>МОЛ</Text>
            <FilterSelect
              value={mol} onChange={onMolChange}
              options={opts.mols} placeholder="Все МОЛ" icon="user"
            />

            <Text style={styles.label}>Сотрудник</Text>
            <FilterSelect
              value={employee} onChange={onEmpChange}
              options={opts.employees}
              placeholder={mol ? 'Сотрудники выбранного МОЛ' : 'Все сотрудники'}
              icon="users"
            />

            <Text style={styles.label}>Кабинет</Text>
            <FilterSelect
              value={location} onChange={setLocation}
              options={opts.locations} placeholder="Вся школа" icon="map-pin"
            />

            <Text style={styles.label}>Примечание</Text>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Необязательно"
              placeholderTextColor={Colors.text3}
              multiline
            />

            {/* Живое превью */}
            {hasFilter && (
              <View style={styles.preview}>
                {previewLoading ? (
                  <ActivityIndicator size={14} color={Colors.accent} />
                ) : (
                  <Text style={styles.previewText}>
                    {preview === null
                      ? 'Не удалось посчитать'
                      : `В акт попадёт: ${preview.toLocaleString('ru')} ОС`}
                  </Text>
                )}
              </View>
            )}
            {!hasFilter && (
              <View style={styles.preview}>
                <Text style={styles.previewText}>
                  Без фильтров в акт попадут все ОС школы
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, (!title.trim() || busy) && { opacity: 0.4 }]}
              onPress={submit}
              disabled={!title.trim() || busy}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={15} color={Colors.accent2} />
              <Text style={styles.submitText}>
                {busy ? 'Создаю...' : 'Создать акт'}
              </Text>
            </TouchableOpacity>
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // Карточка по центру — как остальные модалки приложения
  overlay: {
    flex: 1, backgroundColor: 'rgba(2,6,23,0.85)',
    justifyContent: 'center', padding: 16,
  },
  card: {
    backgroundColor: Colors.bg, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
    maxHeight: '90%', padding: 20,
  },
  head: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text1 },
  closeBtn: {
    backgroundColor: Colors.bg3, borderRadius: 9999,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },

  label: {
    fontSize: 12, fontWeight: '600', color: Colors.text2,
    marginTop: 12, marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.bg2, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text1, fontSize: 14, padding: 12,
  },

  preview: {
    backgroundColor: 'rgba(56,189,248,0.08)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)',
    padding: 10, marginTop: 14, alignItems: 'center',
  },
  previewText: { fontSize: 13, color: Colors.accent },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0c4a2a', borderWidth: 1, borderColor: '#166534',
    borderRadius: 12, padding: 14, marginTop: 14,
  },
  submitText: { color: Colors.accent2, fontWeight: '700', fontSize: 14 },
})
