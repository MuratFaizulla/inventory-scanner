// PM2-конфиг для Metro (Expo dev server) на Windows-сервере 10.35.14.13.
// Нужен для запуска приложения на iPhone через Expo Go (exp://10.35.14.13:8081).
//
// Запуск (PowerShell, из папки inventory-scanner):
//   pm2 start metro.pm2.config.js
//   pm2 save
//
// Не забыть открыть порт: netsh advfirewall firewall add rule
//   name="Expo Metro 8081" dir=in action=allow protocol=TCP localport=8081

module.exports = {
  apps: [
    {
      name: 'nis-scanner',
      // expo CLI — обычный node-скрипт: pm2 запускает его сам, без cmd/npx.
      // --offline: не ходить в сервера Expo (авторизация, проверки) —
      // без него в неинтерактивном режиме падает «Input is required»
      script: './node_modules/expo/bin/cli',
      args: 'start --host lan --port 8081 --offline',
      env: {
        // Адрес, который Metro отдаёт телефонам (иначе подставит внутренний IP)
        REACT_NATIVE_PACKAGER_HOSTNAME: '10.35.14.13',
        // Неинтерактивный режим — под pm2 нет клавиатуры
        CI: '1',
        EXPO_NO_TELEMETRY: '1',
      },
      autorestart: true,
      // Metro прожорлив (особенно если открыть веб-версию в браузере) —
      // низкий лимит вызывает цикл рестартов и драку за порт 8081
      max_memory_restart: '2500M',
    },
  ],
};
