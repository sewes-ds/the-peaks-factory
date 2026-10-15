export const ATTENTION_COPY = {
  BROKEN_MACHINES: {
    title: 'Неисправные станки',
    description: 'Требуют внимания начальника производства'
  },
  SKU_PRODUCTIVITY_MISSING: {
    title: 'Не заполнена производительность SKU',
    description: 'Проверьте плановую производительность активных SKU'
  },
  ADDITIONAL_WORK_OPEN: {
    title: 'Незавершенные дополнительные работы',
    description: 'Открытые назначения ожидают завершения или решения'
  }
} as const;

const ACTION_COPY: Record<string, string> = {
  admin_session_started: 'Выполнен вход в админ-панель',
  admin_session_revoked: 'Завершена сессия админ-панели',
  admin_password_changed: 'Изменен пароль администратора',
  create_employee: 'Создан сотрудник',
  update_employee: 'Изменены данные сотрудника',
  change_employee_status: 'Изменен статус сотрудника',
  update_sku_tariff: 'Изменен тариф SKU',
  rotate_machine_qr_token: 'Обновлен QR станка',
  rotate_sku_qr_token: 'Обновлен QR SKU',
  admin_create_employee: 'Создан сотрудник',
  admin_update_employee: 'Изменены данные сотрудника',
  admin_create_position: 'Создана должность',
  admin_update_position: 'Изменена должность',
  admin_create_machine: 'Создан станок',
  admin_update_machine: 'Изменен станок',
  admin_create_sku: 'Создан SKU',
  admin_update_sku: 'Изменен SKU',
  admin_create_additional_work_type: 'Создан вид дополнительной работы',
  admin_update_additional_work_type: 'Изменен вид дополнительной работы',
  admin_create_activity_type: 'Создан вид перерыва или простоя',
  admin_deactivate_activity_type: 'Отключен вид перерыва или простоя',
  admin_download_machine_qr_label: 'Скачан QR-ярлык станка',
  admin_download_sku_qr_label: 'Скачан QR-ярлык SKU'
};

export function formatAuditAction(actionName: string): string {
  return ACTION_COPY[actionName] ?? actionName.replaceAll('_', ' ');
}

export function formatAdminDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
