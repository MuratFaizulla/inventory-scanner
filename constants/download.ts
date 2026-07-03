// Скачивание файлов (акты .xlsx/.zip) с Bearer-авторизацией.
// Web — через blob+anchor, телефон — expo-file-system + системный share.
import { Platform } from 'react-native'
import api, { getAccessToken, getApiBase } from './api'

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
    const res = await api.get(path, { params: clean, responseType: 'blob' })
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

  const doDownload = () =>
    FileSystem.downloadAsync(url, dest, {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        'x-client': 'mobile',
      },
    })

  let result = await doDownload()
  if (result.status === 401) {
    // Токен истёк — любой api-запрос обновит его через interceptor
    await api.get('/inventory/my-assets').catch(() => {})
    result = await doDownload()
  }
  if (result.status !== 200) {
    throw new Error(`Сервер вернул ${result.status}`)
  }

  const ext = filename.split('.').pop() ?? ''
  await Sharing.shareAsync(result.uri, {
    mimeType: MIME[ext],
    dialogTitle: filename,
  })
}
