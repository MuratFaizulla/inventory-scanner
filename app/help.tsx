// app/help.tsx — «Как пользоваться»: подробное руководство со схемами
// (открывается из Настроек → Справка)

import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../constants/colors'
import { goBack } from '../constants/nav'

/* ════════════════ Кирпичики схем ════════════════ */

// Заголовок раздела: номер-иконка + название + бейдж «кому доступно»
function SectionHead({ icon, color, title, roles }: {
  icon: keyof typeof Feather.glyphMap
  color: string
  title: string
  roles?: string
}) {
  return (
    <View style={s.secHead}>
      <View style={[s.secIcon, { backgroundColor: `${color}20` }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={s.secTitle}>{title}</Text>
      {!!roles && (
        <View style={s.roleBadge}>
          <Text style={s.roleBadgeText}>{roles}</Text>
        </View>
      )}
    </View>
  )
}

// Вертикальная схема-таймлайн: нумерованные шаги, соединённые линией
function Steps({ steps, color = Colors.accent }: {
  steps: { t: string; d?: string }[]
  color?: string
}) {
  return (
    <View style={{ marginTop: 4 }}>
      {steps.map((st, i) => {
        const last = i === steps.length - 1
        return (
          <View key={i} style={s.stepRow}>
            <View style={s.stepRail}>
              <View style={[s.stepNum, { borderColor: color }]}>
                <Text style={[s.stepNumText, { color }]}>{i + 1}</Text>
              </View>
              {!last && <View style={s.stepLine} />}
            </View>
            <View style={[s.stepBody, last && { paddingBottom: 2 }]}>
              <Text style={s.stepTitle}>{st.t}</Text>
              {!!st.d && <Text style={s.stepDesc}>{st.d}</Text>}
            </View>
          </View>
        )
      })}
    </View>
  )
}

// Горизонтальная схема-поток: блок → стрелка → блок → стрелка → блок
function FlowChain({ items }: { items: { emoji: string; t: string; d?: string }[] }) {
  return (
    <View style={s.flowRow}>
      {items.map((it, i) => (
        <View key={i} style={s.flowSeg}>
          <View style={s.flowBox}>
            <Text style={s.flowEmoji}>{it.emoji}</Text>
            <Text style={s.flowTitle}>{it.t}</Text>
            {!!it.d && <Text style={s.flowDesc}>{it.d}</Text>}
          </View>
          {i < items.length - 1 && (
            <Feather name="arrow-right" size={15} color={Colors.text3} style={s.flowArrow} />
          )}
        </View>
      ))}
    </View>
  )
}

// Дерево решений сканера: корень + ветки «условие → результат»
function ScanTree() {
  const branches: { cond: string; emoji: string; label: string; color: string }[] = [
    { cond: 'Номера нет в базе 1С',            emoji: '❌', label: 'Не найден',    color: Colors.danger },
    { cond: 'Есть в 1С, но не входит в акт',   emoji: '➕', label: 'Излишек',      color: '#3b82f6' },
    { cond: 'Числится в другом кабинете',      emoji: '⚠️', label: 'Не на месте',  color: Colors.warn },
    { cond: 'Этот номер уже сканировали',      emoji: '🔄', label: 'Уже был',      color: '#60a5fa' },
    { cond: 'Всё совпадает',                   emoji: '✅', label: 'Найден',       color: Colors.accent2 },
  ]
  return (
    <View style={s.tree}>
      <View style={s.treeRoot}>
        <Text style={s.treeRootText}>📷  Скан штрих-кода</Text>
      </View>
      <View style={s.treeBody}>
        <View style={s.treeSpine} />
        {branches.map((b, i) => (
          <View key={i} style={s.treeRow}>
            <View style={s.treeTick} />
            <Text style={s.treeCond}>{b.cond}</Text>
            <Feather name="arrow-right" size={13} color={Colors.text3} />
            <View style={[s.treeChip, { borderColor: `${b.color}66`, backgroundColor: `${b.color}14` }]}>
              <Text style={[s.treeChipText, { color: b.color }]}>{b.emoji} {b.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

// «Что делать при каждом статусе»
function StatusActions() {
  const rows: { emoji: string; color: string; label: string; action: string }[] = [
    { emoji: '✅', color: Colors.accent2, label: 'Найден',
      action: 'Ничего делать не нужно — переходите к следующей ОС.' },
    { emoji: '⚠️', color: Colors.warn, label: 'Не на месте',
      action: 'Нажмите «Изменить» и укажите фактический кабинет и сотрудника. Это попадёт в примечание акта; в 1С исправляется вручную.' },
    { emoji: '➕', color: '#3b82f6', label: 'Излишек',
      action: 'ОС не из этого акта. Тоже нажмите «Изменить» и зафиксируйте, где её нашли.' },
    { emoji: '❌', color: Colors.danger, label: 'Не найден',
      action: 'Штрих-код может быть повреждён — введите инвентарный номер вручную (поле внизу сканера). Если ОС правда нет в базе — сообщите МОЛ.' },
    { emoji: '🔄', color: '#60a5fa', label: 'Уже отсканирован',
      action: 'Дубль — повторный скан ничего не портит и не записывается.' },
  ]
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={s.subHead}>Что делать при каждом статусе</Text>
      {rows.map((r, i) => (
        <View key={i} style={s.actionRow}>
          <View style={[s.actionBadge, { backgroundColor: `${r.color}14`, borderColor: `${r.color}55` }]}>
            <Text style={[s.actionBadgeText, { color: r.color }]}>{r.emoji} {r.label}</Text>
          </View>
          <Text style={s.actionText}>{r.action}</Text>
        </View>
      ))}
    </View>
  )
}

// Таблица «кому что доступно»
function AccessMatrix() {
  const cols = ['Админ', 'Рук-во', 'Сотр.']
  const rows: { name: string; access: [boolean, boolean, boolean] }[] = [
    { name: 'Акты инвентаризации',   access: [true,  true,  false] },
    { name: 'Поиск ОС',              access: [true,  true,  false] },
    { name: 'Моё оборудование',      access: [true,  true,  true ] },
    { name: 'Все ОС школы',          access: [true,  false, false] },
    { name: 'Виды ОС (с фото)',      access: [true,  false, false] },
    { name: 'Синхронизация 1С',      access: [true,  false, false] },
    { name: 'Акт закрепления (Excel)', access: [true, true,  true ] },
  ]
  return (
    <View style={s.matrix}>
      <View style={[s.mRow, s.mHeadRow]}>
        <Text style={[s.mName, s.mHeadText]}>Раздел</Text>
        {cols.map(c => (
          <Text key={c} style={[s.mCell, s.mHeadText]}>{c}</Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={r.name} style={[s.mRow, i % 2 === 1 && s.mRowAlt]}>
          <Text style={s.mName}>{r.name}</Text>
          {r.access.map((ok, j) => (
            <View key={j} style={s.mCell}>
              {ok
                ? <Feather name="check" size={14} color={Colors.accent2} />
                : <Text style={s.mDash}>—</Text>}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

// Маркированный список
function Bullets({ items }: { items: string[] }) {
  return (
    <View style={{ marginTop: 6 }}>
      {items.map((t, i) => (
        <View key={i} style={s.bulletRow}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{t}</Text>
        </View>
      ))}
    </View>
  )
}

// Подсказка-заметка
function Note({ text }: { text: string }) {
  return (
    <View style={s.note}>
      <Feather name="info" size={13} color={Colors.accent} style={{ marginTop: 2 }} />
      <Text style={s.noteText}>{text}</Text>
    </View>
  )
}

/* ════════════════ Экран ════════════════ */

export default function HelpScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => goBack(router, '/settings')} style={s.iconBtn}>
          <Feather name="arrow-left" size={19} color={Colors.text1} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Как пользоваться</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── 1. Как всё устроено ── */}
        <View style={s.card}>
          <SectionHead icon="share-2" color={Colors.accent} title="Как всё устроено" />
          <FlowChain items={[
            { emoji: '🗂️', t: '1С', d: 'бухгалтерия' },
            { emoji: '🖥️', t: 'Сервер школы', d: 'синхр. 8:00 и 14:00' },
            { emoji: '📱', t: 'Приложение', d: 'по Wi-Fi школы' },
          ]} />
          <Note text="Приложение показывает последнюю выгрузку из 1С (обновляется в будни в 8:00 и 14:00). Всё, что вы отмечаете здесь, — фиксация факта: сама база 1С правится бухгалтерией вручную." />
        </View>

        {/* ── 2. Кому что доступно ── */}
        <View style={s.card}>
          <SectionHead icon="users" color="#a78bfa" title="Кому что доступно" />
          <AccessMatrix />
          <Note text="Не видите вкладку «Акты» или «Поиск» — значит у вашей учётной записи роль «Сотрудник». Роли выдаёт IT-отдел." />
        </View>

        {/* ── 3. Вход ── */}
        <View style={s.card}>
          <SectionHead icon="log-in" color={Colors.accent} title="Вход" roles="все" />
          <Steps steps={[
            { t: 'Укажите адрес сервера',
              d: 'IP и порт без http:// — например 10.35.14.13:100. Обычно уже заполнен.' },
            { t: 'Введите доменные логин и пароль',
              d: 'Те же, что на рабочем компьютере школы.' },
            { t: 'Включите «Запомнить логин и пароль»',
              d: 'Чтобы не вводить каждый раз. Забыть вход можно в Настройках → Безопасность.' },
          ]} />
          <Note text="Телефон должен быть в Wi-Fi сети школы, иначе сервер недоступен." />
        </View>

        {/* ── 4. Инвентаризация: полный цикл ── */}
        <View style={s.card}>
          <SectionHead icon="clipboard" color={Colors.accent2} title="Инвентаризация: полный цикл" roles="админ и руководство" />
          <Steps color={Colors.accent2} steps={[
            { t: 'Создать акт',
              d: 'Вкладка «Акты» → «Создать акт». Назовите его и при необходимости сузьте охват: по МОЛ, по сотруднику или по кабинету. Перед созданием видно, сколько ОС попадёт в акт.' },
            { t: 'Запустить',
              d: 'Акт создаётся в статусе «Черновик» — нажмите «Запустить», чтобы начать проверку.' },
            { t: 'Сканировать по кабинетам',
              d: 'Нажмите «Сканировать», выберите кабинет, в котором находитесь, и сканируйте штрих-коды подряд. Перешли в другой кабинет — смените его в сканере.' },
            { t: 'Разбирать статусы на месте',
              d: 'Каждый скан сразу получает статус (схема ниже). Расхождения фиксируйте кнопкой «Изменить», не откладывая.' },
            { t: 'Пауза — если не успели',
              d: 'Меню «⋮» на карточке акта → «Пауза». Прогресс сохраняется, продолжить можно в любой день.' },
            { t: 'Завершить',
              d: 'Меню «⋮» → «Завершить». Все непроверенные ОС автоматически получают статус «Не найдено» — завершайте только когда обошли всё.' },
            { t: 'Посмотреть результат',
              d: 'В карточке акта — итоги по кабинетам: найдено, не на месте, не найдено. По каждой группе можно раскрыть список ОС.' },
          ]} />
        </View>

        {/* ── 5. Сканер: статусы ── */}
        <View style={s.card}>
          <SectionHead icon="camera" color="#f472b6" title="Сканер: как читать результат" />
          <Text style={s.plain}>
            Наведите камеру на штрих-код — распознавание сработает само. Сервер сверяет номер
            с актом и возвращает один из пяти статусов:
          </Text>
          <ScanTree />
          <StatusActions />
          <Note text="Штрих-код не читается (стёрт, заклеен)? Внизу сканера есть ручной ввод инвентарного номера — результат будет тот же." />
        </View>

        {/* ── 6. Поиск ── */}
        <View style={s.card}>
          <SectionHead icon="search" color={Colors.warn} title="Поиск ОС" roles="админ и руководство" />
          <Steps color={Colors.warn} steps={[
            { t: 'Откройте вкладку «Поиск»' },
            { t: 'Отсканируйте штрих-код или введите инв. номер',
              d: 'Любой ОС школы — без создания акта.' },
            { t: 'Смотрите карточку',
              d: 'Фото (можно увеличить на весь экран), наименование, кабинет, сотрудник, МОЛ, дата принятия к учёту.' },
          ]} />
        </View>

        {/* ── 7. Моё оборудование ── */}
        <View style={s.card}>
          <SectionHead icon="package" color={Colors.accent} title="Моё оборудование" roles="все" />
          <Bullets items={[
            'Вкладка «Моё» — всё, что закреплено за вами по данным 1С.',
            'Две группы: основные средства и библиотечный фонд.',
            'Акт закрепления скачивается в Настройках → «Мой акт»: Excel одним файлом или ZIP с разбивкой по кабинетам.',
            'Нашли ошибку (лишняя или чужая ОС)? Сообщите МОЛ или в бухгалтерию — данные правятся в 1С.',
          ]} />
        </View>

        {/* ── 8. ОС и Виды ── */}
        <View style={s.card}>
          <SectionHead icon="grid" color="#a78bfa" title="ОС и Виды" roles="только админ" />
          <Bullets items={[
            '«ОС» — все активы школы: поиск и фильтры по кабинету, МОЛ и сотруднику. Карточка ОС — по нажатию.',
            '«Виды» — те же активы, сгруппированные по наименованию (все проекторы, все ноутбуки…).',
            'Внутри вида: фото, количество, раскладка по кабинетам; кабинет можно раскрыть до конкретных ОС.',
            'Фото вида добавляется/заменяется прямо из карточки вида — оно же появится на сайте и в «Поиске».',
          ]} />
        </View>

        {/* ── 9. Связь и настройки ── */}
        <View style={s.card}>
          <SectionHead icon="wifi" color={Colors.accent} title="Связь с сервером" roles="все" />
          <FlowChain items={[
            { emoji: '📱', t: 'Телефон' },
            { emoji: '📶', t: 'Wi-Fi школы' },
            { emoji: '🖥️', t: 'Сервер', d: '10.35.14.13:100' },
          ]} />
          <Text style={s.subHead}>Пишет «Сервер недоступен» — проверьте по порядку:</Text>
          <Steps steps={[
            { t: 'Wi-Fi', d: 'Телефон подключён к сети школы, а не к мобильному интернету?' },
            { t: 'Адрес', d: 'Настройки → Сервер: адрес указан верно, без http:// и лишних пробелов.' },
            { t: '«Проверить связь»', d: 'Кнопка там же покажет доступность и время отклика. При входе в Настройки проверка запускается сама.' },
            { t: 'Всё верно, но не работает', d: 'Скорее всего лежит сервер — обратитесь в IT-отдел.' },
          ]} />
          <Note text="«Поделиться приложением» в Настройках отправит коллеге ссылку на страницу установки (Android APK и инструкция для iPhone)." />
        </View>

        <Text style={s.footer}>Вопросы и проблемы — в IT-отдел НИШ Туркестан</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  )
}

/* ════════════════ Стили ════════════════ */

const s = StyleSheet.create({
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

  card: {
    backgroundColor: Colors.bg2, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: 12,
  },

  /* Заголовок раздела */
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  secIcon: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  secTitle: { fontSize: 15, fontWeight: '700', color: Colors.text1, flexShrink: 1 },
  roleBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.bg3, borderRadius: 9999,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.text3 },

  plain: { fontSize: 13, color: Colors.text2, lineHeight: 19 },
  subHead: {
    fontSize: 12, fontWeight: '700', color: Colors.text2,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginTop: 12, marginBottom: 6,
  },

  /* Таймлайн шагов */
  stepRow: { flexDirection: 'row' },
  stepRail: { alignItems: 'center', width: 26, marginRight: 10 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: 11, fontWeight: '800' },
  stepLine: { flex: 1, width: 2, backgroundColor: Colors.border, marginVertical: 2 },
  stepBody: { flex: 1, paddingBottom: 14 },
  stepTitle: { fontSize: 13.5, fontWeight: '700', color: Colors.text1, marginTop: 3 },
  stepDesc: { fontSize: 12.5, color: Colors.text2, lineHeight: 18, marginTop: 2 },

  /* Горизонтальный поток */
  flowRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginVertical: 4,
  },
  flowSeg: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  flowBox: {
    backgroundColor: Colors.bg, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 8, paddingHorizontal: 10,
    alignItems: 'center', minWidth: 84, flexShrink: 1,
  },
  flowEmoji: { fontSize: 18, marginBottom: 3 },
  flowTitle: { fontSize: 11, fontWeight: '700', color: Colors.text1, textAlign: 'center' },
  flowDesc:  { fontSize: 9.5, color: Colors.text3, textAlign: 'center', marginTop: 1 },
  flowArrow: { marginHorizontal: 4 },

  /* Дерево сканера */
  tree: { marginTop: 12 },
  treeRoot: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.bg, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.accent + '66',
    paddingVertical: 7, paddingHorizontal: 12,
  },
  treeRootText: { fontSize: 13, fontWeight: '700', color: Colors.text1 },
  treeBody: { marginLeft: 14, paddingTop: 2 },
  treeSpine: {
    position: 'absolute', left: 0, top: 0, bottom: 17,
    width: 2, backgroundColor: Colors.border,
  },
  treeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingLeft: 10, marginTop: 9,
  },
  treeTick: {
    position: 'absolute', left: 0, width: 8, height: 2,
    backgroundColor: Colors.border,
  },
  treeCond: { flex: 1, fontSize: 12, color: Colors.text2, lineHeight: 16 },
  treeChip: {
    borderRadius: 9999, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  treeChipText: { fontSize: 11, fontWeight: '700' },

  /* Что делать при статусе */
  actionRow: { marginBottom: 9 },
  actionBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 2, marginBottom: 3,
  },
  actionBadgeText: { fontSize: 11.5, fontWeight: '700' },
  actionText: { fontSize: 12.5, color: Colors.text2, lineHeight: 18 },

  /* Матрица доступа */
  matrix: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    overflow: 'hidden', marginTop: 2,
  },
  mRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 10,
  },
  mHeadRow: { backgroundColor: Colors.bg3 },
  mRowAlt:  { backgroundColor: 'rgba(51,65,85,0.25)' },
  mName: { flex: 1, fontSize: 12, color: Colors.text2, paddingRight: 6 },
  mCell: { width: 52, alignItems: 'center', justifyContent: 'center' },
  mHeadText: { fontSize: 10.5, fontWeight: '700', color: Colors.text2, textAlign: 'center' },
  mDash: { fontSize: 12, color: Colors.text3 },

  /* Списки и заметки */
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 5 },
  bulletDot: { color: Colors.text3, fontSize: 13, lineHeight: 19 },
  bulletText: { flex: 1, fontSize: 13, color: Colors.text2, lineHeight: 19 },

  note: {
    flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(56,189,248,0.07)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)',
    padding: 10, marginTop: 12,
  },
  noteText: { flex: 1, fontSize: 12, color: Colors.text2, lineHeight: 17 },

  footer: { fontSize: 12, color: Colors.text3, textAlign: 'center', marginTop: 8 },
})
