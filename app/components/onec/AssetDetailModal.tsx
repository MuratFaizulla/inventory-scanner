import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import {
  Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { assetMeta, InvAsset, photoUri } from './inventory'
import { T } from './types'

const ROWS: { key: keyof InvAsset; label: string; copy?: boolean }[] = [
  { key: 'inventoryNumber',   label: 'Инв. номер', copy: true },
  { key: 'barcode',           label: 'Штрих-код',  copy: true },
  { key: 'person',            label: 'Сотрудник' },
  { key: 'accountablePerson', label: 'МОЛ' },
  { key: 'locationCode',      label: 'Код кабинета' },
  { key: 'sn',                label: 'Серийный №', copy: true },
  { key: 'dateFix',           label: 'Дата принятия' },
  { key: 'account',           label: 'Счёт' },
  { key: 'comment',           label: 'Примечание' },
  { key: 'properties',        label: 'Характеристики' },
  { key: 'upgradeInfo',       label: 'Модернизация' },
]

export default function AssetDetailModal({ asset, onClose }: {
  asset: InvAsset | null
  onClose: () => void
}) {
  const meta = assetMeta(asset?.name)
  const photo = photoUri(asset?.photoPath)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copy = async (key: string, value: string) => {
    await Clipboard.setStringAsync(value)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 1500)
  }

  return (
    <Modal
      visible={!!asset}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.head}>
            <View style={styles.titleRow}>
              <View style={[styles.iconWrap, { backgroundColor: `${meta.color}22` }]}>
                <MaterialCommunityIcons name={meta.icon as never} size={20} color={meta.color} />
              </View>
              <Text style={styles.title} numberOfLines={3}>
                {asset?.name || 'Без наименования'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={15} color={T.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {!!photo && (
              <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />
            )}

            {!!asset?.location?.name && (
              <View style={styles.locRow}>
                <Feather name="map-pin" size={13} color={T.accent} />
                <Text style={styles.locText}>{asset.location.name}</Text>
              </View>
            )}

            {ROWS.map(({ key, label, copy: canCopy }) => {
              const v = asset?.[key]
              if (v === null || v === undefined || v === '') return null
              const value = String(v)
              return (
                <View key={key} style={styles.row}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <View style={styles.rowValueRow}>
                    <Text
                      style={[styles.rowValue, canCopy && styles.rowValueMono]}
                      selectable
                    >
                      {value}
                    </Text>
                    {canCopy && (
                      <TouchableOpacity
                        style={styles.copyBtn}
                        onPress={() => copy(key, value)}
                        activeOpacity={0.6}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather
                          name={copiedKey === key ? 'check' : 'copy'}
                          size={14}
                          color={copiedKey === key ? T.emerald : T.textMuted}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )
            })}
            <View style={{ height: 8 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(2,6,23,0.8)',
    justifyContent: 'center', padding: 20,
  },
  card: {
    backgroundColor: T.surface, borderRadius: 20,
    borderWidth: 1, borderColor: T.border,
    maxHeight: '82%', padding: 18,
  },
  head: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 12, marginBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: T.textPrimary, flex: 1 },
  closeBtn: {
    backgroundColor: T.elevated, borderRadius: 9999,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
  },

  // contain + белый фон — фото 1С обычно на белом, cover их обрезал
  photo: {
    width: '100%', height: 200, borderRadius: 12,
    backgroundColor: '#fff', marginBottom: 12,
  },

  locRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.accentBg, borderWidth: 1, borderColor: T.accentBorder,
    borderRadius: 10, padding: 10, marginBottom: 8,
  },
  locText: { fontSize: 14, color: T.textPrimary, fontWeight: '600', flex: 1 },

  row: {
    paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: T.borderFaint,
  },
  rowLabel: {
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4,
    color: T.textFaint, marginBottom: 3,
  },
  rowValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowValue:     { fontSize: 14, color: T.textPrimary, lineHeight: 20, flex: 1 },
  rowValueMono: { fontVariant: ['tabular-nums'] },
  copyBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: T.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
})
