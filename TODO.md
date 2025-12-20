# TODO: Dart Data Class Generator Improvements

### Средний приоритет

- [ ] **Миграция на TypeScript (Отложено)**
  - Заменить JSDoc на нативные типы TypeScript
  - Улучшить type safety и автодополнение

## Улучшения генерируемого кода

- [ ] **Генерация const factory для compile-time JSON**
  - Если все поля final и immutable типов

- [ ] **Улучшить форматирование сгенерированного кода**
  - Консистентные отступы
  - Опциональная поддержка trailing commas (Dart style)

### Низкий приоритет

- [ ] **Добавить поддержку `sealed class` для Result types**
  - Автогенерация Success/Failure подклассов

- [ ] **Опция для генерации `copyWith` с `required` параметрами**
  - Для случаев когда нужно явно передавать все значения
