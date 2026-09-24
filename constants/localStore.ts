// Строковое хранилище на телефоне для копий данных (акты, справочники).
//
// Акт «Вся школа» — тысячи позиций. AsyncStorage на Android не читает значение
// больше ~2 МБ (CursorWindow) и весь ограничен 6 МБ — поэтому на телефоне
// копии лежат файлами в documentDirectory/offline/, а на вебе — в
// localStorage через AsyncStorage. Пути и ключи — как у первой версии
// оффлайна: копии, сохранённые до этой версии, читаются как есть.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const filePath = async (key: string) => {
  const FS = await import('expo-file-system/legacy')
  const dir = `${FS.documentDirectory}offline/`
  return { FS, dir, path: `${dir}${key}.json` }
}

export const localStore = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(`offline:${key}`)
    const { FS, path } = await filePath(key)
    return (await FS.getInfoAsync(path)).exists ? FS.readAsStringAsync(path) : null
  },

  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.setItem(`offline:${key}`, value)
    const { FS, dir, path } = await filePath(key)
    if (!(await FS.getInfoAsync(dir)).exists) {
      await FS.makeDirectoryAsync(dir, { intermediates: true })
    }
    await FS.writeAsStringAsync(path, value)
  },
}
