# TODO: Dart Data Class Generator Improvements

## Архитектурные улучшения

### Высокий приоритет

- [x] **Разбить `DataClassGenerator` на отдельные модули (SRP)**
  - [x] `DartClassParser` — парсинг классов из текста (`src/parsers/dart-class-parser.js`)
  - [x] `ConstructorGenerator` — генерация конструкторов (`src/generators/constructor-generator.js`)
  - [x] `CopyWithGenerator` — генерация copyWith (`src/generators/copy-with-generator.js`)
  - [x] `SerializationGenerator` — toMap/fromMap/toJson/fromJson (`src/generators/serialization-generator.js`)
  - [x] `EqualityGenerator` — operator==/hashCode (`src/generators/equality-generator.js`)
  - [x] `ToStringGenerator` — toString (`src/generators/to-string-generator.js`)

- [x] **Применить Strategy/Plugin pattern для генераторов (OCP)**
  - [x] `GeneratorRegistry` — единая точка входа для всех генераторов (`src/generators/index.js`)
  - [x] `BaseGenerator` — базовый класс с общей логикой (`src/generators/base-generator.js`)

- [x] **Модели вынесены в отдельные файлы**
  - [x] `DartClass` (`src/models/dart-class.js`)
  - [x] `ClassField` с геттером `nullSafe` (`src/models/class-field.js`)
  - [x] `ClassPart` (`src/models/class-part.js`)
  - [x] `Imports` (`src/models/imports.js`)

### Средний приоритет

- [x] **Устранить дублирование кода (DRY)**
  - [x] Вынесен `nullSafe` геттер в ClassField
  - [x] Utility функции в `src/utils/`

- [ ] **Миграция на TypeScript (Отложено)**
  - Заменить JSDoc на нативные типы TypeScript
  - Улучшить type safety и автодополнение

- [x] **Добавить unit tests**
  - [x] Покрыть тестами парсинг классов (`test/dart-class-parser.test.js`)
  - [x] Покрыть тестами генерацию каждого метода (`test/generators.test.js`)
  - [x] Тесты для edge cases (generics, nullable, collections)

## Улучшения генерируемого кода

### Высокий приоритет

- [x] **hashCode: автоматический переход на `Object.hashAll` при >15 полях**
  - Константа `HASH_THRESHOLD = 15` в `EqualityGenerator`
  - `Object.hash` используется до 15 полей, `Object.hashAll` для большего

- [x] **fromMap: улучшить обработку nullable в коллекциях**
  - [x] Добавлена фильтрация null элементов: `.whereType<T>()`

### Средний приоритет

- [x] **Defensive copying для mutable collections в toMap**
  - [x] Добавлена настройка `dart-data-class-generator.toMap.defensive_copy`
  - [x] При включении обёртывает коллекции в `List.unmodifiable()`, `Map.unmodifiable()`, `Set.unmodifiable()`

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

- [x] **Санитизация имени файла в `writeFile`**
  - [x] Функция `sanitizeFileName` — защита от path traversal
  - [x] Удаление опасных символов: `/ \ .. < > : " | ? *`

## Структура проекта

```
src/
├── extension.js          # Modular entry point
├── generators/
│   ├── index.js          # Экспорт всех генераторов + GeneratorRegistry
│   ├── base-generator.js # Базовый класс
│   ├── constructor-generator.js
│   ├── copy-with-generator.js
│   ├── serialization-generator.js
│   ├── equality-generator.js
│   └── to-string-generator.js
├── models/
│   ├── index.js
│   ├── dart-class.js
│   ├── class-field.js
│   ├── class-part.js
│   └── imports.js
├── parsers/
│   ├── index.js
│   └── dart-class-parser.js
└── utils/
    ├── index.js
    ├── settings.js
    └── string-utils.js

test/
├── test-setup.js           # Общая настройка mock vscode
├── dart-class-parser.test.js # Тесты парсера
└── generators.test.js      # Тесты генераторов
```

## Миграция

Для перехода на новую архитектуру:
1. В `package.json` изменить `"main": "./src/extension.js"` на новое модульное решение [Done]
2. Протестировать все функции [Done]
3. Старая версия заменена новой структурой [Done]

## Исправлено (v0.12.2)

- [x] Path separator — кроссплатформенная поддержка (macOS/Linux/Windows)
- [x] Функция `count()` — исправлен баг в индексации
- [x] DateTime.parse('') crash — добавлена null-проверка для custom types в коллекциях
- [x] Race condition в `findProjectName` — добавлена `ensureProjectName()`
- [x] Redundant `.map((x) => x)` для `List<Map<...>>` в toMap
- [x] Trailing comma в toString — убрана запятая перед закрывающей скобкой
