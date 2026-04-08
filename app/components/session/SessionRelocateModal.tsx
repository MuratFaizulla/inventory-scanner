// components/session/SessionRelocateModal.tsx

import {
    KeyboardAvoidingView, Modal, Platform, ScrollView,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { Colors } from '../../../constants/colors'
import type { Employee, Item, Location } from './types'

interface Props {
  item:               Item | null
  locations:          Location[]
  employees:          Employee[]
  selectedLocationId: number | null
  selectedEmployeeId: number | null
  employeeNote:       string
  relocating:         boolean
  modalTab:           'location' | 'employee'
  search:             string
  onClose:            () => void
  onConfirm:          () => void
  onTabChange:        (tab: 'location' | 'employee') => void
  onSearchChange:     (v: string) => void
  onSelectLocation:   (id: number | null) => void
  onSelectEmployee:   (id: number | null) => void
  onNoteChange:       (v: string) => void
}

export default function SessionRelocateModal({
  item, locations, employees,
  selectedLocationId, selectedEmployeeId, employeeNote,
  relocating, modalTab, search,
  onClose, onConfirm, onTabChange, onSearchChange,
  onSelectLocation, onSelectEmployee, onNoteChange,
}: Props) {
  const filteredLocations = locations
    .filter(l => l.name !== item?.asset.location.name)
    .filter(l => l.name.toLowerCase().includes(search.toLowerCase()))

  const filteredEmployees = employees
    .filter(e => e.fullName.toLowerCase().includes(search.toLowerCase()))

  const hasSelection  = !!(selectedLocationId || selectedEmployeeId || employeeNote.trim())
  const canConfirm    = hasSelection && !relocating

  return (
    <Modal visible={!!item} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

        <View style={styles.modal}>
          <Text style={styles.title}>✏️ Изменить данные ОС</Text>

          {/* Инфо об ОС */}
          {item && (
            <View style={styles.assetInfo}>
              <Text style={styles.assetName} numberOfLines={2}>{item.asset.name}</Text>
              <Text style={styles.assetInv}>{item.asset.inventoryNumber}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <Text style={styles.assetMeta}>📍 {item.asset.location.name}</Text>
                {item.asset.employee && (
                  <Text style={styles.assetMeta}>🧑‍💼 {item.asset.employee.fullName.split(' ')[0]}</Text>
                )}
              </View>
            </View>
          )}

          {/* Вкладки */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, modalTab === 'location' && styles.tabActive]}
              onPress={() => onTabChange('location')}
            >
              <Text style={[styles.tabText, modalTab === 'location' && { color: Colors.accent }]}>
                📍 Кабинет {selectedLocationId ? '✓' : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, modalTab === 'employee' && styles.tabActive]}
              onPress={() => onTabChange('employee')}
            >
              <Text style={[styles.tabText, modalTab === 'employee' && { color: Colors.accent }]}>
                🧑‍💼 Сотрудник {selectedEmployeeId || employeeNote.trim() ? '✓' : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Поиск */}
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={onSearchChange}
            placeholder={modalTab === 'location' ? 'Поиск кабинета...' : 'Поиск сотрудника...'}
            placeholderTextColor={Colors.text3}
          />

          {/* Список */}
          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {modalTab === 'location'
              ? filteredLocations.map(l => (
                  <TouchableOpacity
                    key={l.id}
                    style={[styles.item, selectedLocationId === l.id && styles.itemSelLoc]}
                    onPress={() => onSelectLocation(selectedLocationId === l.id ? null : l.id)}
                  >
                    <Text style={[styles.itemText, selectedLocationId === l.id && { color: Colors.accent2, fontWeight: '700' }]}>
                      {selectedLocationId === l.id ? '✓ ' : ''}{l.name}
                    </Text>
                  </TouchableOpacity>
                ))
              : filteredEmployees.map(e => (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.item, selectedEmployeeId === e.id && styles.itemSelEmp]}
                    onPress={() => onSelectEmployee(selectedEmployeeId === e.id ? null : e.id)}
                  >
                    <Text style={[styles.itemText, selectedEmployeeId === e.id && { color: Colors.accent, fontWeight: '700' }]}>
                      {selectedEmployeeId === e.id ? '✓ ' : ''}{e.fullName}
                    </Text>
                  </TouchableOpacity>
                ))
            }
          </ScrollView>

          {/* Ручной ввод сотрудника */}
          {modalTab === 'employee' && (
            <View style={styles.noteWrap}>
              <Text style={styles.noteLabel}>✏️ Нет в списке? Напишите вручную:</Text>
              <TextInput
                style={styles.noteInput}
                value={employeeNote}
                onChangeText={onNoteChange}
                placeholder="Например: Иванов И.И., каб. 305"
                placeholderTextColor={Colors.text3}
                multiline numberOfLines={2} scrollEnabled
              />
            </View>
          )}

          {/* Итог выбора */}
          {hasSelection && (
            <View style={styles.summary}>
              {selectedLocationId && (
                <Text style={styles.sumLoc}>📍 → {locations.find(l => l.id === selectedLocationId)?.name}</Text>
              )}
              {selectedEmployeeId && (
                <Text style={styles.sumEmp}>🧑‍💼 → {employees.find(e => e.id === selectedEmployeeId)?.fullName}</Text>
              )}
              {employeeNote.trim() && !selectedEmployeeId && (
                <Text style={styles.sumNote}>✏️ {employeeNote.trim()}</Text>
              )}
            </View>
          )}

          {/* Предупреждение */}
          <View style={styles.warning}>
            <Text style={styles.warningText}>⚠️ Только в примечание. Обновите в 1С вручную.</Text>
          </View>

          {/* Кнопки */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && styles.disabled]}
              onPress={onConfirm}
              disabled={!canConfirm}
            >
              <Text style={styles.confirmText}>
                {relocating ? 'Сохраняем...' : '✅ Сохранить'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modal:   {
    backgroundColor: Colors.bg2, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '90%',
  },
  title:     { fontSize: 16, fontWeight: '700', color: Colors.text1, marginBottom: 12 },
  assetInfo: { backgroundColor: Colors.bg3, borderRadius: 10, padding: 12, marginBottom: 12 },
  assetName: { fontSize: 14, fontWeight: '600', color: Colors.text1, marginBottom: 4 },
  assetInv:  { fontSize: 11, color: Colors.text3, fontFamily: 'monospace' },
  assetMeta: { fontSize: 11, color: Colors.text3 },
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
  list:       { maxHeight: 180, marginBottom: 8 },
  item: {
    padding: 12, borderRadius: 8, marginBottom: 6,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
  },
  itemSelLoc: { backgroundColor: '#0c2a1a', borderColor: Colors.accent2 },
  itemSelEmp: { backgroundColor: '#0c1a2a', borderColor: Colors.accent },
  itemText:   { fontSize: 13, color: Colors.text1 },
  noteWrap:   { marginBottom: 8 },
  noteLabel:  { fontSize: 11, color: Colors.text3, marginBottom: 6, fontWeight: '500' },
  noteInput: {
    backgroundColor: Colors.bg3, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    color: Colors.text1, fontSize: 13,
    padding: 10, minHeight: 52, textAlignVertical: 'top',
  },
  summary:  { backgroundColor: '#0c2a1a', borderRadius: 8, padding: 10, marginBottom: 8, gap: 4 },
  sumLoc:   { fontSize: 12, color: Colors.accent2, fontWeight: '600' },
  sumEmp:   { fontSize: 12, color: Colors.accent,  fontWeight: '600' },
  sumNote:  { fontSize: 12, color: Colors.warn,    fontWeight: '600' },
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