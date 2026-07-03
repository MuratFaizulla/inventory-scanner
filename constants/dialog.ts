// Кроссплатформенные диалоги.
// На вебе react-native-web НЕ реализует Alert.alert — диалог с кнопками
// молча не показывается, поэтому там используем window.confirm / window.alert.

import { Alert, Platform } from 'react-native'

// Простое уведомление (без кнопок выбора)
export const notify = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title)
    return
  }
  Alert.alert(title, message)
}

// Подтверждение «Отмена / <confirmText>» → true, если пользователь согласился
export const confirmDialog = (
  title: string,
  message: string,
  confirmText = 'Да',
  opts?: { cancelText?: string; destructive?: boolean },
): Promise<boolean> =>
  new Promise(resolve => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(`${title}\n\n${message}`))
      return
    }
    Alert.alert(
      title,
      message,
      [
        { text: opts?.cancelText ?? 'Отмена', style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmText,
          style: opts?.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      // Тап мимо диалога на Android — считаем отказом
      { cancelable: true, onDismiss: () => resolve(false) },
    )
  })
