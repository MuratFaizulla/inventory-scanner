// Текст ошибки для человека — одно место на всё приложение: в catch экраны
// показывают errorText(e) и сами ответ сервера не разбирают.
//
// Бэкенд на любую ошибку отвечает { success:false, data:{ error } } (глобальный
// HttpExceptionFilter), nginx, пока бэкенд запускается, — тем же конвертом (503).
// Русский текст бэкенда показываем как есть; английское — тексты Nest по
// умолчанию («Unauthorized», «Internal server error»…), страницы nginx, сеть —
// заменяем по коду ответа. Модуль без React Native — проверяется node --test.
import axios from 'axios'

export const NO_CONNECTION = 'Нет связи с сервером'

// Нет ответа, таймаут или nginx говорит «бэкенд запускается» — всё это
// «нет связи»: операцию надо отложить, а не показывать ошибку
export const isOfflineError = (e: unknown) =>
  axios.isAxiosError(e) && (!e.response || [502, 503, 504].includes(e.response.status))

const BY_STATUS: Record<number, string> = {
  400: 'Сервер не принял данные',
  401: 'Сессия истекла — войдите заново',
  403: 'Нет доступа',
  404: 'Не найдено на сервере',
  413: 'Файл слишком большой',
  429: 'Слишком много запросов — подождите минуту и повторите',
  502: 'Сервер недоступен — попробуйте через минуту',
  503: 'Сервер недоступен — попробуйте через минуту',
  504: 'Сервер недоступен — попробуйте через минуту',
}

const RUSSIAN = /[А-Яа-яЁё]/

// Текст из ответа с ошибкой. body — как пришёл: объект, строка с JSON или HTML
export function responseErrorText(status: number, body: unknown): string {
  let d = body
  if (typeof d === 'string') {
    try { d = JSON.parse(d) } catch { d = undefined }
  }
  // message на верхнем уровне — у ответов в обход фильтра (старые ручки)
  const env = d as { message?: string | string[]; data?: { error?: string } } | null | undefined
  const msg = env?.data?.error ?? (Array.isArray(env?.message) ? env.message.join(', ') : env?.message)
  const raw = typeof msg === 'string' ? msg.trim() : ''

  if (raw && RUSSIAN.test(raw)) {
    // Проверка полей (400) склеивает сообщения через запятую: русские бэкенд
    // пишет для людей, английские — class-validator по умолчанию
    return status === 400 ? raw.split(', ').filter(p => RUSSIAN.test(p)).join(', ') : raw
  }
  const text = BY_STATUS[status]
    ?? (status >= 500 ? 'Ошибка на сервере — попробуйте позже или сообщите администратору' : `Сервер ответил ${status}`)
  // 400 по-английски — от проверки полей: пригодится тому, кто будет разбираться
  return status === 400 && raw ? `${text}: ${raw}` : text
}

export function errorText(e: unknown): string {
  if (!axios.isAxiosError(e)) return (e as Error | undefined)?.message || 'Ошибка'
  if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
    return 'Сервер не ответил вовремя — проверьте связь и повторите'
  }
  if (!e.response) return NO_CONNECTION
  return responseErrorText(e.response.status, e.response.data)
}
