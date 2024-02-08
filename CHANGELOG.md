# Change Log

## 0.8.1

- Make sealed and final class compatible. Sealed will behave as abstract and final will behave as concrete.
- Use `Map.from` instead of `as Map<String, dynamic>` for correctly parsing `Map<dynamic, dynamic>` types.

## 0.8.0

New features:

- New setting: custom.headerLines. Adds header lines that shows on top of the generated file.
- New settings: constructor.immutable. Adds @immutable annotation on the generated class.
- New behavior: Add `const` keyword on constructor if the class has no constructor and all properties are final or if contructor.immutable is set to true.

Refactor to better reflect EffectiveDart style:

- Changed fromMap.isA: `T isA<T>(String k) => map[k] is T ? map[k] as T : throw ...`.
- Added `as Map<String, dynamic>` to fromJson.decode.

## 0.7.3

- Added custom.argumentError config in settings. Customize isA() error. Defaults to: "throw ArgumentError.value(map[k], k, '$T ← ${map[k].runtimeType}');"
- Fix minor bugs.

## 0.7.2

- Added option to ignore serialization with `//ignore`
- Fixed serialization of custom list types.

## 0.7.1

- Improved the regular expression used for parsing directives to correctly handle nested parentheses and brackets.
- Fixed comment-directive conflicts with `//enum`.
- Fixed nested json serialization types comming with unnecessary "?" in mapping.

## 0.7.0

Introducing Custom Serialization:
You can now implement your own custom from/to methods for serialization using comment-directives. Refer to the README for details.

## 0.6.0

Added ArgumentError Safety:

- `isA<T>()` was added to TypeSafe arguments.
- Default Values won't be called on required arguments anymore, unless set on settings.
- Solved dynamic casts and getters called on dynamic.

- Now you can mark enums with a comment-directive. Ex: `final MyEnum type; // enum`.
- Fixed unnecessary null check marks on custom classes.
- Added support to Timestamp and improved DateTime, Color and IconData.
- Refactor and minor improvements.

## 0.5.7

- Updated the badges in README.md.

## 0.5.2

Added support for snake_case json keys
Generate toString() when converting with Equatable
Other improvements

## 0.5.0

Added support for enums
Use factory constructors instead of static methods for json serialization

### 0.3.17

Added support for value equality on `Lists`, `Maps` and `Sets`.

### 0.3.16

Class fields can now also be declared after the constructor.
Minor improvements.

### 0.3.6 - 0.3.15

Fixed some bugs.

### 0.3.5

Added support for equatable by setting dart-data-class-generator.useEquatable to true.

Changed setting `dart-data-class-generator.constructor` to `dart-data-class-generator.constructor.enabled`
Changed setting `dart-data-class-generator.copyWith` to `dart-data-class-generator.copyWith.enabled`
Changed setting `dart-data-class-generator.toMap` to `dart-data-class-generator.toMap.enabled`
Changed setting `dart-data-class-generator.fromMap` to `dart-data-class-generator.fromMap.enabled`
Changed setting `dart-data-class-generator.toJson` to `dart-data-class-generator.toJson.enabled`
Changed setting `dart-data-class-generator.fromJson` to `dart-data-class-generator.fromJson.enabled`
Changed setting `dart-data-class-generator.toString` to `dart-data-class-generator.toString.enabled`
Changed setting `dart-data-class-generator.equality` to `dart-data-class-generator.equality.enabled`
Changed setting `dart-data-class-generator.hashCode` to `dart-data-class-generator.hashCode.enabled`

## 0.3.0

Added quick fixes.

## 0.2.0

Added support for @required annotation.
Changed the default hashCode implementation to bitwise operator.

## 0.1.0

Initial release (Beta).
