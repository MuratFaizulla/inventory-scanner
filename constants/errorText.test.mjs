// Текст ошибки для человека — на ответах, которые реально приходят от бэкенда,
// nginx и сети. Запуск: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AxiosError } from 'axios'
import { errorText, isOfflineError, responseErrorText } from './errorText.ts'

const answer = (status, data) =>
  new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', { headers: {} }, {},
    { status, statusText: '', data, headers: {}, config: { headers: {} } })

const noAnswer = (code, message) => new AxiosError(message, code, { headers: {} }, {})

// Как отвечает бэкенд: глобальный HttpExceptionFilter
const envelope = (status, error) =>
  ({ success: false, data: { error, statusCode: status, timestamp: '2026-09-24T10:00:00.000Z', path: '/api/x' } })

test('русский текст бэкенда показываем как есть', () => {
  assert.equal(errorText(answer(401, envelope(401, 'Неверный логин или пароль'))), 'Неверный логин или пароль')
  assert.equal(errorText(answer(401, envelope(401, 'AD недоступен, войдите заново'))), 'AD недоступен, войдите заново')
  assert.equal(errorText(answer(409, envelope(409, 'Акт уже завершён'))), 'Акт уже завершён')
})

test('nginx: бэкенд запускается — его текст, и это «нет связи»', () => {
  const e = answer(503, { success: false, data: { error: 'Сервис запускается — подождите минуту и обновите страницу', statusCode: 503 } })
  assert.equal(errorText(e), 'Сервис запускается — подождите минуту и обновите страницу')
  assert.equal(isOfflineError(e), true)
})

test('HTML-страница nginx вместо JSON — текст по коду', () => {
  const e = answer(502, '<html><head><title>502 Bad Gateway</title></head></html>')
  assert.equal(errorText(e), 'Сервер недоступен — попробуйте через минуту')
  assert.equal(isOfflineError(e), true)
  assert.equal(errorText(answer(413, '<html>413 Request Entity Too Large</html>')), 'Файл слишком большой')
})

test('английские тексты Nest по умолчанию — по-русски', () => {
  assert.equal(errorText(answer(500, envelope(500, 'Internal server error'))),
    'Ошибка на сервере — попробуйте позже или сообщите администратору')
  assert.equal(errorText(answer(401, envelope(401, 'Unauthorized'))), 'Сессия истекла — войдите заново')
  assert.equal(errorText(answer(403, envelope(403, 'Forbidden resource'))), 'Нет доступа')
  assert.equal(errorText(answer(404, envelope(404, 'Cannot GET /api/nope'))), 'Не найдено на сервере')
  assert.equal(errorText(answer(429, envelope(429, 'ThrottlerException: Too Many Requests'))),
    'Слишком много запросов — подождите минуту и повторите')
  assert.equal(isOfflineError(answer(500, envelope(500, 'Internal server error'))), false)
})

test('проверка полей (400): русское и английское вперемешку — только русское', () => {
  // Настоящий ответ POST /api/auth с пустым телом
  assert.equal(errorText(answer(400, envelope(400,
    'username must be shorter than or equal to 100 characters, Укажите логин, username must be a string, ' +
    'password must be shorter than or equal to 256 characters, Укажите пароль, password must be a string'))),
  'Укажите логин, Укажите пароль')
  // Русский текст с запятой внутри не режем
  assert.equal(errorText(answer(401, envelope(401, 'AD недоступен, войдите заново'))), 'AD недоступен, войдите заново')
})

test('проверка полей (400) без русского — по-русски и с подробностями', () => {
  assert.equal(errorText(answer(400, envelope(400, 'property foo should not exist, title must be a string'))),
    'Сервер не принял данные: property foo should not exist, title must be a string')
  // В обход фильтра: message на верхнем уровне, массивом
  assert.equal(errorText(answer(400, { message: ['title should not be empty'], statusCode: 400 })),
    'Сервер не принял данные: title should not be empty')
})

test('нет сети и таймаут — «нет связи», разными словами', () => {
  const offline = noAnswer('ERR_NETWORK', 'Network Error')
  assert.equal(errorText(offline), 'Нет связи с сервером')
  assert.equal(isOfflineError(offline), true)
  const slow = noAnswer('ECONNABORTED', 'timeout of 6000ms exceeded')
  assert.equal(errorText(slow), 'Сервер не ответил вовремя — проверьте связь и повторите')
  assert.equal(isOfflineError(slow), true)
})

test('незнакомый код без текста — хотя бы код', () => {
  assert.equal(errorText(answer(418, '')), 'Сервер ответил 418')
})

test('ошибка не от сервера — её собственный текст', () => {
  assert.equal(errorText(new Error('Нет сохранённой копии акта — откройте его, когда будет связь')),
    'Нет сохранённой копии акта — откройте его, когда будет связь')
  assert.equal(errorText(undefined), 'Ошибка')
})

test('тело ответа строкой (файл на телефоне, blob в браузере)', () => {
  assert.equal(responseErrorText(404, JSON.stringify(envelope(404, 'Сотрудник не найден'))), 'Сотрудник не найден')
  assert.equal(responseErrorText(500, 'не JSON'), 'Ошибка на сервере — попробуйте позже или сообщите администратору')
  assert.equal(responseErrorText(500, ''), 'Ошибка на сервере — попробуйте позже или сообщите администратору')
})
