import { StyleSheet } from 'react-native'
import { Colors } from '../../../constants/colors'

export const sessionStyles = StyleSheet.create({
  // Cards
  card: {
    backgroundColor: Colors.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 16,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 6, gap: 8,
  },
  cardName:     { fontSize: 14, fontWeight: '600', color: Colors.text1, flex: 1 },
  cardLocation: { fontSize: 12, color: Colors.text3, marginBottom: 10 },
  cardMeta:     { fontSize: 12, color: Colors.text3 },
  badge: { backgroundColor: '#1e3a5f', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, color: '#60a5fa', fontWeight: '600' },

  progressBar: {
    height: 4, backgroundColor: Colors.border, borderRadius: 2,
    overflow: 'hidden', marginBottom: 4, flexDirection: 'row',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },
  progressText: { fontSize: 11, color: Colors.text3, marginBottom: 8 },
  statsRow:     { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stat:         { fontSize: 12 },

  btnRow: { flexDirection: 'row', gap: 8 },
  detailBtn: {
    flex: 1, backgroundColor: Colors.bg3, borderRadius: 10,
    padding: 10, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  moreBtn: {
    backgroundColor: Colors.bg3, borderRadius: 10,
    padding: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, minWidth: 42,
  },
  detailBtnText: { fontSize: 13, color: Colors.text2, fontWeight: '600' },
  scanBtn: {
    flex: 1, backgroundColor: '#0c4a2a', borderRadius: 10,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#166534',
  },
  scanBtnText: { fontSize: 13, color: Colors.accent2, fontWeight: '700' },

  // Empty state
  empty:     { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: Colors.text2, fontWeight: '600' },
  emptySub:  { fontSize: 13, color: Colors.text3, marginTop: 6 },
})
