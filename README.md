# Datly - Safe Dart Data Classes

A VS Code extension that generates immutable, analyzer-clean Dart data classes — `toMap`/`fromMap`, `copyWith`, equality, `hashCode`, sealed types — without `build_runner`, codegen, or boilerplate.

## 🚀 Key Features

- **Full Data Class Support**: Generate constructors, `copyWith`, `toMap`, `fromMap`, `toJson`, `fromJson`, `toString`, equality (`==`), and `hashCode`.
- **Modular Engine**: Built on a clean, modular architecture (SOLID) that ensures fast and consistent code generation.
- **Type-Safe Serialization**: Built-in casting with customizable error handling.
- **Advanced hashCode**: Automatically optimizes for large classes by switching to `Object.hashAll` when exceeding 15 fields.
- **Defensive Copying**: Optional support for `unmodifiable` collection wrappers to ensure true immutability.
- **Custom Serialization**: Use comment directives or global settings to handle complex types (e.g., `DateTime`, `EnumType`).
- **Equatable Integration**: Seamlessly works with the `Equatable` package to reduce boilerplate.
- **Immutable Support**: Add `@immutable` annotations and generate `const` constructors automatically.
- **Zero Boilerplate**: No need to run `build_runner` or wait for code generation cycles.

---

## 🛠 Usage

### Generate from Class Properties
1. Define a class with its fields using `final`.
2. Place your cursor inside the class.
3. Use the **Quick Fix** menu (`Ctrl + .` / `Cmd + .`) and select **Generate data class** (or choose individual methods like `copyWith` or `serialization`).
4. Alternatively, use the Command Palette (`Ctrl + Shift + P`) and search for **Datly: Generate from class properties**.

### Generate from JSON
1. Create an empty `.dart` file and paste your raw JSON.
2. Open the Command Palette and run **Datly: Generate from JSON**.
3. Follow the prompts to name your top-level class and choose whether to separate nested objects into multiple files.

---

## 🔧 Technical Deep Dive

### Modular Registry
The extension uses a modular generator registry, allowing for precise control over which parts of the data class are generated. Whether you need a full data class or just a specific `copyWith` method, the engine handles it with high efficiency.

### Optimal hashCode Generation
Unlike simple implementations, this generator detects the number of fields in your class. 
- **1-15 fields**: Uses `Object.hash(field1, field2, ...)`.
- **15+ fields**: Automatically switches to `Object.hashAll([field1, field2, ...])` to stay within Dart's optimized hashing limits.

### Custom Serialization
The extension provides a flexible way to handle complex types (like `DateTime`, `Color`, or nested objects) that don't have built-in support. You can configure this locally for a single field or globally for your entire project.

#### 1. Local Directives (Comment-based)
Add a comment next to your field to specify its serialization logic. The format is: `// [fromMap], [toMap]`.

| Scenario | Example Field + Directive | Generated `fromMap` Segment |
|----------|---------------------------|----------------------------|
| **Factory Method** | `final DateTime date; // DateTime.parse(String), toIso8601String()` | `DateTime.parse(cast<String>('date'))` |
| **Constructor** | `final Color color; // Color(int), value` | `Color(cast<int>('color'))` |
| **Default Values** | `final DateTime date; // parse(String ?? DateTime.now())` | `DateTime.parse(cast<String?>('date') ?? DateTime.now())` |
| **Nested Objects** | `final User user; // User.fromMap(Map), toMap()` | `User.fromMap(Map.from(cast<Map<dynamic, dynamic>>('user')))` |
| **Enums** | `final Status s; // enum` | Uses global `json.enum_format` |
| **Ignore Field** | `final String secret; // ignore` | Excluded from everywhere |

#### 2. Raw Expression Syntax (Full Control)
For complex types where you need complete control over the generated code, use the `$from:` and `$to:` syntax:

```dart
final Duration timeout; // $from: Duration(milliseconds: map['timeout'] as int? ?? 0), $to: timeout.inMilliseconds
```

This inserts the expression **exactly as written**. You can also use template placeholders:
- `{value}` — replaced with `map['key']` (raw, `dynamic`)
- `{value:Type}` — replaced with `cast<Type>('key')` (typed access, safe under `strict-casts`)
- `{field}` — replaced with the field name
- `{key}` — replaced with the JSON key

Example with templates:
```dart
final Color background; // $from: Color({value} as int), $to: {field}.value
final QuizStatusEnum status; // $from: QuizStatusEnum.parse({value:String}), $to: status.serialize()
```

> [!TIP]
> Under `strict-casts` prefer `{value:Type}` so the generated call site is statically typed (e.g. `Enum.parse(cast<String>('status'))`) instead of receiving a raw `dynamic` value.

> [!NOTE]
> Local directives apply only to top-level fields. For custom types inside collections (e.g., `List<DateTime>`), use **Global Configuration**.

#### 3. Global Configuration (`custom.types`)
Define reusable mappings in your VS Code `settings.json`. These mappings are automatically applied to fields of that type, including those inside lists, maps, and sets.

```json
"dart-data-class-generator.custom.types": [
  {
    "type": "DateTime",
    "fromMap": "DateTime.parse(String)",
    "toMap": "toIso8601String()"
  },
  {
    "type": "Duration",
    "fromMap": "Duration(milliseconds: {value} as int ?? 0)",
    "toMap": "{field}.inMilliseconds"
  }
]
```

> [!TIP]
> Global configuration also supports template placeholders `{value}`, `{value:Type}`, `{field}`, `{key}` for flexible type mapping.

#### 🛠 Advanced `fromMap` Syntax
The `fromMap` configuration (both local and global) uses a smart parsing engine:
- **`Method(Type)`**: If the string contains a dot (e.g., `DateTime.parse`), it calls that method. Otherwise, it treats it as a constructor.
- **`Type ?? Fallback`**: You can provide a fallback if the value is missing in the JSON.
    - Example: `Color(int ?? 0xFF000000)`
    - Generated: `Color(cast<int?>('color') ?? 0xFF000000)`

#### 🛠 Advanced `toMap` Syntax
The `toMap` configuration simply appends the string to your field.
- If it's a method call, **must include parentheses**: `toIso8601String()`.
- If it's a property access, exclude them: `value`.

### Defensive Copying & Null-Safety
- **Defensive Copying**: Enabling `toMap.defensive_copy` wraps collections in `unmodifiable` wrappers (`List<X>.unmodifiable(...)`, `Set<X>.unmodifiable(...)`, `Map<K, V>.unmodifiable(...)`) to prevent external mutation. Nullable collections are hoisted into a conditional (`field == null ? null : List<X>.unmodifiable(field!)`) so the constructor still receives a non-null `Iterable`/`Map`.
- **Null-Filtering**: When deserializing nullable collections, the generator automatically applies `.whereType<T>()` to filter out `null` elements from the source map, ensuring type safety.
- **Strict analyzer modes**: Generated `toMap`/`fromMap` is clean under `strict-casts`, `strict-raw-types`, and `strict-inference` — every cast is typed (`cast<Iterable<dynamic>>`, `cast<Map<dynamic, dynamic>>`), map keys are parsed via `int.parse(k.toString())`, and defensive wrappers always carry explicit type arguments.

---

## ⚙️ Settings Reference

### General Settings
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `quick_fixes` | `bool` | `true` | Enable/disable code actions (lightbulb). |
| `useEquatable` | `bool` | `false` | Use `equatable` for equality and hashCode. |
| `strict_numbers` | `bool` | `false` | Use strict `int`/`double` casting instead of `num`. |
| `hashCode.use_jenkins` | `bool` | `false` | Use Jenkins SMI hash function instead of `Object.hash`. |
| `override.manual` | `bool` | `false` | Ask for confirmation before replacing existing methods. |

### Constructor Settings
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `constructor.enabled` | `bool` | `true` | Generate a constructor. |
| `constructor.default_values` | `bool` | `false` | Generate default values in the constructor. |
| `constructor.required` | `bool` | `false` | Enforce `@required` on all parameters. |
| `constructor.immutable` | `bool` | `false` | Add `@immutable` and use `const` constructors. |

### Serialization Settings
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `toMap.enabled` | `bool` | `true` | Generate `toMap`. |
| `fromMap.enabled` | `bool` | `true` | Generate `fromMap`. |
| `toJson.enabled` | `bool` | `true` | Generate `toJson`. |
| `fromJson.enabled` | `bool` | `true` | Generate `fromJson`. |
| `fromMap.default_values` | `bool` | `false` | Provide non-null fallbacks during deserialization. |
| `toMap.defensive_copy` | `bool` | `false` | Use `unmodifiable` wrappers for collections in `toMap`. |
| `json.enum_format` | `string` | `byName` | Enum serialization: `byName` or `byIndex`. |
| `json.separate` | `string` | `ask` | How to handle nested JSON (`ask`, `separate`, `current_file`). |

### Customization
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `custom.argumentError` | `string` | *(default throw)* | Custom error thrown on invalid `cast<T>()`. |
| `custom.headerLines` | `array` | *(labels)* | Custom lines added to the top of the generated files. |
| `custom.types` | `array` | *(defaults)* | Global mapping for complex types serialization. |

---

## 🏗 Contributing

This project is built with **Node.js** and follows modular design principles. 
- **Parsers**: `src/parsers/`
- **Generators**: `src/generators/`
- **Models**: `src/models/`

To run tests:
```bash
npm install
npm test
```

---

*Created with ❤️ for the Dart & Flutter community.*
