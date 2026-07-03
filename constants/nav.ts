import type { Router } from 'expo-router'

// Безопасный «назад»: на вебе после F5/прямого открытия история пуста —
// router.back() тогда не срабатывает («GO_BACK was not handled»), а кнопка
// молчит. В этом случае уводим на главный экран.
export const goBack = (router: Router, fallback = '/sessions') => {
  if (router.canGoBack()) router.back()
  else router.replace(fallback as never)
}
