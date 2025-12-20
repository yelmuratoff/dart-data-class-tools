# Dart Data Class Generator

A powerful and modular VS Code extension to generate human-readable, type-safe Dart data classes without the need for external code generation tools or repetitive boilerplate.

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
4. Alternatively, use the Command Palette (`Ctrl + Shift + P`) and search for **Dart Data Class Generator: Generate from class properties**.

### Generate from JSON
1. Create an empty `.dart` file and paste your raw JSON.
2. Open the Command Palette and run **Dart Data Class Generator: Generate from JSON**.
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
You can handle custom types globally in settings or locally using comment directives.

#### Local Directive (Comment)
```dart
final DateTime createdAt; // DateTime.parse(String), toIso8601String()
final MyCustomType data; // MyCustomType.fromMap(Map), toMap()
```

#### Global Configuration (`custom.types`)
Define reusable mappings in your `settings.json`:
```json
"dart-data-class-generator.custom.types": [
  {
    "type": "DateTime",
    "fromMap": "DateTime.parse(String)",
    "toMap": "toIso8601String()"
  }
]
```

### Defensive Copying & Null-Safety
- **Defensive Copying**: Enabling `toMap.defensive_copy` wraps collections in `unmodifiable` wrappers to prevent external mutation.
- **Null-Filtering**: When deserializing nullable collections, the generator automatically applies `.whereType<T>()` to filter out `null` elements from the source map, ensuring type safety.

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

*Generated with ❤️ for the Dart & Flutter community.*
