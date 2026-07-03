// app/help.tsx — «Как пользоваться» (открывается из Настроек)

import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../constants/colors'
import { goBack } from '../constants/nav'

type Section = {
  icon: keyof typeof Feather.glyphMap
  color: string
  title: string
  roles?: string
  steps: string[]
}

const SECTIONS: Section[] = [
  {
    icon: 'log-in', color: Colors.accent,
    title: 'Вход',
    steps: [
      'Адрес сервера — IP и порт, без http:// (например 10.35.14.13:100)',
      'Логин и пароль — ваши доменные (как на рабочем компьютере)',
      '«Запомнить логин и пароль» — чтобы не вводить каждый раз',
    ],
  },
  {
    icon: 'clipboard', color: Colors.accent2,
    title: 'Акты инвентаризации',
    roles: 'админ и руководство',
    steps: [
      '«Создать акт» → назовите его и при необходимости сузьте: МОЛ, сотрудник или кабинет',
      'Перед созданием видно, сколько ОС попадёт в акт',
      '«Запустить» → «Сканировать» — и обходите кабинеты',
      'Меню «⋮» на карточке акта: пауза, завершение, отмена',
      'При завершении все непроверенные ОС получают статус «Не найдено»',
    ],
  },
  {
    icon: 'camera', color: '#f472b6',
    title: 'Сканер',
    steps: [
      'Наведите камеру на штрих-код — результат появится сам',
      '🟢 Найден — ОС на месте; 🟡 Не на месте — числится в другом кабинете',
      '🔵 Излишек — в акте её нет; 🔴 Не найден — нет в базе 1С',
      '«Изменить» — записать фактический кабинет/сотрудника (пойдёт в примечание, в 1С правится вручную)',
      'Нет штрих-кода? Внизу есть ручной ввод инвентарного номера',
    ],
  },
  {
    icon: 'search', color: Colors.warn,
    title: 'Поиск',
    roles: 'админ и руководство',
    steps: [
      'Отсканируйте штрих-код или введите инв. номер любой ОС',
      'Покажет карточку: фото, кабинет, сотрудник, МОЛ, дата принятия',
    ],
  },
  {
    icon: 'package', color: Colors.accent,
    title: 'Моё оборудование',
    roles: 'все сотрудники',
    steps: [
      'Всё, что закреплено за вами по данным 1С',
      'Вкладки: основные средства и библиотечный фонд',
      'Акт закрепления (Excel или ZIP по кабинетам) — в Настройках',
    ],
  },
  {
    icon: 'grid', color: '#a78bfa',
    title: 'ОС и Виды',
    roles: 'только админ',
    steps: [
      '«ОС» — все активы школы с фильтрами по кабинету, МОЛ и сотруднику',
      '«Виды» — группировка по наименованию; внутри — фото и раскладка по помещениям',
      'Фото вида можно добавить/заменить прямо из карточки вида',
    ],
  },
  {
    icon: 'settings', color: Colors.text2,
    title: 'Настройки',
    steps: [
      'Смена адреса сервера + «Проверить связь»',
      'Скачивание своего акта закрепления',
      'Синхронизация 1С (админ): статус выгрузки и запуск вручную',
      'Если приложение «не видит сервер» — проверьте Wi-Fi школы и связь в настройках',
    ],
  },
]

export default function HelpScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => goBack(router, '/settings')} style={styles.iconBtn}>
          <Feather name="arrow-left" size={19} color={Colors.text1} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Как пользоваться</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          «НИШ 1С» — учёт и инвентаризация имущества школы по данным 1С.
          Что видно в приложении — зависит от вашей роли.
        </Text>

        {SECTIONS.map(s => (
          <View key={s.title} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: `${s.color}18` }]}>
                <Feather name={s.icon} size={16} color={s.color} />
              </View>
              <Text style={styles.cardTitle}>{s.title}</Text>
              {!!s.roles && (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{s.roles}</Text>
                </View>
              )}
            </View>
            {s.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Text style={styles.stepDot}>•</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footer}>
          Вопросы и проблемы — в IT-отдел НИШ Туркестан
        </Text>
        <View style={{ height: 32 }} />
      </ScrollView>
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
  intro: {
    fontSize: 13, color: Colors.text2, lineHeight: 20, marginBottom: 14,
  },

  card: {
    backgroundColor: Colors.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: 10,
  },
  cardHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  cardIcon: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text1, flexShrink: 1 },
  roleBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.bg3, borderRadius: 9999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.text3 },

  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 5 },
  stepDot: { color: Colors.text3, fontSize: 13, lineHeight: 19 },
  stepText: { flex: 1, fontSize: 13, color: Colors.text2, lineHeight: 19 },

  footer: { fontSize: 12, color: Colors.text3, textAlign: 'center', marginTop: 8 },
})
