# TODO: Dart Data Class Generator Improvements

## Архитектурные улучшения

### Высокий приоритет

- [ ] **Разбить `DataClassGenerator` на отдельные модули (SRP)**
  - `DartClassParser` — парсинг классов из текста
  - `ConstructorGenerator` — генерация конструкторов
  - `CopyWithGenerator` — генерация copyWith
  - `SerializationGenerator` — toMap/fromMap/toJson/fromJson
  - `EqualityGenerator` — operator==/hashCode
  - `ToStringGenerator` — toString

- [ ] **Применить Strategy/Plugin pattern для генераторов (OCP)**
  ```javascript
  const generators = [
    new ConstructorGenerator(),
    new CopyWithGenerator(),
    // легко добавить новый генератор
  ];
  generators.forEach(g => g.generate(clazz));
  ```

### Средний приоритет

- [ ] **Устранить дублирование кода (DRY)**
  - Вынести `const nullSafe = prop.isNullable ? "?" : ""` в метод ClassField
  - Объединить логику default values в одном месте

- [ ] **Миграция на TypeScript**
  - Заменить JSDoc на нативные типы TypeScript
  - Улучшить type safety и автодополнение

- [ ] **Добавить unit tests**
  - Покрыть тестами парсинг классов
  - Покрыть тестами генерацию каждого метода
  - Тесты для edge cases (generics, nullable, collections)

## Улучшения генерируемого кода

### Высокий приоритет

- [ ] **hashCode: автоматический переход на `Object.hashAll` при >15 полях**
  - `Object.hash` поддерживает max 20 аргументов
  - Снизить порог до 15 для запаса

- [ ] **fromMap: улучшить обработку nullable в коллекциях**
  - Добавить фильтрацию null элементов: `.whereType<T>()`

### Средний приоритет

- [ ] **Defensive copying для mutable collections в toMap**
  ```dart
  // Опционально через настройку
  'names': List.unmodifiable(names),
  ```

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

## Безопасность

- [ ] **Санитизация имени файла в `writeFile`**
  - Защита от path traversal атак
  - Валидация символов в имени класса

## Исправлено (v0.12.2)

- [x] Path separator — кроссплатформенная поддержка (macOS/Linux/Windows)
- [x] Функция `count()` — исправлен баг в индексации
- [x] DateTime.parse('') crash — добавлена null-проверка для custom types в коллекциях
- [x] Race condition в `findProjectName` — добавлена `ensureProjectName()`
- [x] Redundant `.map((x) => x)` для `List<Map<...>>` в toMap
- [x] Trailing comma в toString — убрана запятая перед закрывающей скобкой
