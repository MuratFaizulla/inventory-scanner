// Скачивание файлов (акты .xlsx/.zip) с Bearer-авторизацией.
// Web — через blob+anchor, телефон — expo-file-system + системный share.
import axios from 'axios'
import { Platform } from 'react-native'
import api, { getAccessToken, getApiBase } from './api'
import { NO_CONNECTION, responseErrorText } from './errorText'

const MIME: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip:  'application/zip',
}

export const downloadFile = async (
  path: string,
  params: Record<string, string | undefined>,
  filename: string,
): Promise<void> => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v != null && v !== ''),
  ) as Record<string, string>

  if (Platform.OS === 'web') {
    const res = await api.get(path, { params: clean, responseType: 'blob' }).catch(async (e: unknown) => {
      // Ответ с ошибкой тоже пришёл blob'ом — текст сервера внутри
      if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
        throw new Error(responseErrorText(e.response.status, await e.response.data.text()))
      }
      throw e
    })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  const FileSystem = await import('expo-file-system/legacy')
  const Sharing = await import('expo-sharing')

  const qs = new URLSearchParams(clean).toString()
  const url = `${getApiBase()}${path}${qs ? `?${qs}` : ''}`
  const dest = `${FileSystem.cacheDirectory}${filename}`

  // downloadAsync падает только без связи; ответ с ошибкой — это status
  const doDownload = () =>
    FileSystem.downloadAsync(url, dest, {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        'x-client': 'mobile',
      },
    }).catch(() => { throw new Error(NO_CONNECTION) })

  let result = await doDownload()
  if (result.status === 401) {
    // Токен истёк — любой api-запрос обновит его через interceptor
    await api.get('/inventory/my-assets').catch(() => {})
    result = await doDownload()
  }
  if (result.status !== 200) {
    // Тело ответа с ошибкой легло в файл — в нём текст сервера
    const body = await FileSystem.readAsStringAsync(result.uri).catch(() => '')
    throw new Error(responseErrorText(result.status, body))
  }

  const ext = filename.split('.').pop() ?? ''
  await Sharing.shareAsync(result.uri, {
    mimeType: MIME[ext],
    dialogTitle: filename,
  })
}
