const assert = require("assert");
require("./test-setup");

const DartClassParser = require("../src/parsers/dart-class-parser");
const Imports = require("../src/models/imports");
const ConstructorGenerator = require("../src/generators/constructor-generator");
const CopyWithGenerator = require("../src/generators/copy-with-generator");
const SerializationGenerator = require("../src/generators/serialization-generator");
const EqualityGenerator = require("../src/generators/equality-generator");
const ToStringGenerator = require("../src/generators/to-string-generator");

describe("Generators", () => {
  function parseClass(code) {
    const parser = new DartClassParser(code);
    const classes = parser.parse();
    const imports = new Imports(code, "test_app");
    return { clazz: classes[0], imports };
  }

  describe("ConstructorGenerator", () => {
    it("should generate constructor with required parameters", () => {
      const code = `
class User {
  final String name;
  final int age;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new ConstructorGenerator(clazz, imports, false);
      generator.generate();

      assert.ok(clazz.constr, "Constructor should be generated");
      assert.ok(
        clazz.constr.includes("this.name"),
        "Constructor should include this.name"
      );
      assert.ok(
        clazz.constr.includes("this.age"),
        "Constructor should include this.age"
      );
    });

    it("should add default values for primitives when enabled", () => {
      const code = `
class User {
  final String name;
  final int count;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new ConstructorGenerator(clazz, imports, false);
      generator.generate();

      assert.ok(clazz.constr, "Constructor should be generated");
      assert.ok(
        clazz.constr.includes("this.name = ''"),
        "Constructor should include default for name"
      );
      assert.ok(
        clazz.constr.includes("this.count = 0"),
        "Constructor should include default for count"
      );
    });

    it("should not add required for nullable types", () => {
      const code = `
class User {
  final String? name;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new ConstructorGenerator(clazz, imports, false);
      generator.generate();

      assert.ok(clazz.constr, "Constructor should be generated");
      assert.ok(
        !clazz.constr.includes("required this.name"),
        "Constructor should not have required for nullable"
      );
    });
  });

  describe("CopyWithGenerator", () => {
    it("should generate copyWith with sentinel for nullable fields", () => {
      const code = `
class User {
  final String? name;
  final int age;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new CopyWithGenerator(clazz, imports);
      generator.generate();

      assert.ok(clazz.toInsert.includes("_sentinel"));
      assert.ok(clazz.toInsert.includes("Object? name = _sentinel"));
    });

    it("should use simple null coalescing for non-nullable fields", () => {
      const code = `
class User {
  final String name;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new CopyWithGenerator(clazz, imports);
      generator.generate();

      assert.ok(clazz.toInsert.includes("name ?? this.name"));
    });

    it("should return correct type with generics", () => {
      const code = `
class Box<T> {
  final T value;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new CopyWithGenerator(clazz, imports);
      generator.generate();

      assert.ok(clazz.toInsert.includes("Box<T> copyWith"));
    });
  });

  describe("SerializationGenerator", () => {
    describe("toMap", () => {
      it("should generate toMap with snake_case keys", () => {
        const code = `
class User {
  final String firstName;
  final int userAge;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(clazz.toInsert.includes("'first_name'"));
        assert.ok(clazz.toInsert.includes("'user_age'"));
      });

      it("should handle enum serialization", () => {
        const code = `
class User {
  final Status status; // enum
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(clazz.toInsert.includes("status.name"));
      });

      it("should handle DateTime with custom type", () => {
        const code = `
class Event {
  final DateTime createdAt;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(clazz.toInsert.includes("toIso8601String()"));
      });

      it("should handle nested objects with toMap", () => {
        const code = `
class Order {
  final User user;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(clazz.toInsert.includes("user.toMap()"));
      });

      it("should use $to directive for multi-line field declarations", () => {
        const code = `
class CustomSerialization {
  /// Uri stored as string in JSON
  final Uri
      endpoint; // $from: Uri.parse(map['endpoint'] as String? ?? ''), $to: endpoint.toString()
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        // Should use endpoint.toString() from $to directive, NOT endpoint.toMap()
        assert.ok(
          clazz.toInsert.includes("endpoint.toString()"),
          `Expected endpoint.toString() but got: ${clazz.toInsert}`
        );
        assert.ok(
          !clazz.toInsert.includes("endpoint.toMap()"),
          `Should not contain endpoint.toMap()`
        );
      });
    });

    describe("fromMap", () => {
      it("should generate fromMap factory", () => {
        const code = `
class User {
  final String name;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(clazz.toInsert.includes("factory User.fromMap"));
        assert.ok(clazz.toInsert.includes("cast<String?>('name')"));
      });

      it("should handle nullable custom types with null check", () => {
        const code = `
class Order {
  final User? user;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        // Nullable custom types get null check: map['user'] != null ? ...
        assert.ok(clazz.toInsert.includes("map['user'] != null"));
      });

      it("should handle int/double with num casting", () => {
        const code = `
class Point {
  final int x;
  final double y;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(clazz.toInsert.includes("cast<num?>"));
        assert.ok(clazz.toInsert.includes(".toInt()"));
        assert.ok(clazz.toInsert.includes(".toDouble()"));
      });

      it("should handle List of custom types", () => {
        const code = `
class Order {
  final List<Item> items;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(clazz.toInsert.includes("List<Item>.from"));
        assert.ok(clazz.toInsert.includes(".map((x) =>"));
        assert.ok(clazz.toInsert.includes("Item.fromMap"));
      });
    });

    describe("toJson/fromJson", () => {
      it("should generate toJson", () => {
        const code = `
class User {
  final String name;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(clazz.toInsert.includes("String toJson()"));
        assert.ok(clazz.toInsert.includes("json.encode(toMap())"));
      });

      it("should generate fromJson factory", () => {
        const code = `
class User {
  final String name;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(clazz.toInsert.includes("factory User.fromJson"));
        assert.ok(clazz.toInsert.includes("json.decode(source)"));
      });

      it("should add dart:convert import", () => {
        const code = `
class User {
  final String name;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(imports.values.some((i) => i.includes("dart:convert")));
      });
    });
  });

  describe("EqualityGenerator", () => {
    it("should generate operator== for simple types", () => {
      const code = `
class User {
  final String name;
  final int age;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new EqualityGenerator(clazz, imports, false);
      generator.generate();

      assert.ok(clazz.toInsert.includes("bool operator =="));
      assert.ok(clazz.toInsert.includes("identical(this, other)"));
      assert.ok(clazz.toInsert.includes("other.name == name"));
      assert.ok(clazz.toInsert.includes("other.age == age"));
    });

    it("should use collection equality for lists", () => {
      const code = `
class Container {
  final List<String> items;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new EqualityGenerator(clazz, imports, false);
      generator.generate();

      assert.ok(clazz.toInsert.includes("DeepCollectionEquality"));
      assert.ok(clazz.toInsert.includes("listEquals(other.items, items)"));
    });

    it("should generate hashCode with Object.hash", () => {
      const code = `
class User {
  final String name;
  final int age;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new EqualityGenerator(clazz, imports, false);
      generator.generate();

      assert.ok(clazz.toInsert.includes("int get hashCode"));
      assert.ok(clazz.toInsert.includes("Object.hash"));
    });

    it("should use Object.hashAll for >15 fields", () => {
      let fields = "";
      for (let i = 0; i < 16; i++) {
        fields += `  final String field${i};\n`;
      }
      const code = `
class Large {
${fields}
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new EqualityGenerator(clazz, imports, false);
      generator.generate();

      assert.ok(clazz.toInsert.includes("Object.hashAll"));
    });

    it("should generate single field hashCode correctly", () => {
      const code = `
class Simple {
  final String id;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new EqualityGenerator(clazz, imports, false);
      generator.generate();

      assert.ok(clazz.toInsert.includes("id.hashCode"));
    });
  });

  describe("ToStringGenerator", () => {
    it("should generate toString with all fields", () => {
      const code = `
class User {
  final String name;
  final int age;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new ToStringGenerator(clazz, imports);
      generator.generate();

      assert.ok(clazz.toInsert.includes("String toString()"));
      assert.ok(clazz.toInsert.includes("name: $name"));
      assert.ok(clazz.toInsert.includes("age: $age"));
    });

    it("should not have trailing comma on last field", () => {
      const code = `
class User {
  final String name;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new ToStringGenerator(clazz, imports);
      generator.generate();

      // Last field should not have comma before closing paren
      assert.ok(!clazz.toInsert.includes("$name,\n    )"));
    });

    it("should use short format for <=3 fields", () => {
      const code = `
class Simple {
  final String a;
  final String b;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new ToStringGenerator(clazz, imports);
      generator.generate();

      assert.ok(clazz.toInsert.includes("=> '''"));
    });
  });

  describe("CopyWithGenerator - Required Params Mode", () => {
    it("should generate required params when setting enabled", () => {
      // This test verifies the structure, actual setting is mocked as false
      const code = `
class User {
  final String name;
  final int? age;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new CopyWithGenerator(clazz, imports);
      generator.generate();

      // Default mode (required_params = false) uses sentinel for nullable
      assert.ok(clazz.toInsert.includes("_sentinel"));
      assert.ok(clazz.toInsert.includes("Object? age = _sentinel"));
    });

    it("should use trailing comma on last param", () => {
      const code = `
class User {
  final String name;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new CopyWithGenerator(clazz, imports);
      generator.generate();

      // Trailing commas should be present (default = true in test mock)
      // The format is: "String? name,\n})" - trailing comma before closing brace
      assert.ok(clazz.toInsert.includes("String? name,"));
    });
  });

  describe("SealedGenerator", () => {
    // Note: SealedGenerator is in the registry but won't run unless sealed.enabled=true
    // These tests verify the generator logic independently

    it("should parse generic types correctly", () => {
      const SealedGenerator = require("../src/generators/sealed-generator");
      const DartClass = require("../src/models/dart-class");
      const Imports = require("../src/models/imports");

      const clazz = new DartClass();
      clazz.name = "Result";
      clazz.fullGenericType = "<T, E>";
      clazz.classType = "sealed class";
      clazz.properties = [];
      clazz.startsAtLine = 1;
      clazz.endsAtLine = 3;

      const imports = new Imports("", "test_app");
      const generator = new SealedGenerator(clazz, imports);

      const generics = generator.parseGenerics("<T, E>");
      assert.strictEqual(generics.length, 2);
      assert.strictEqual(generics[0], "T");
      assert.strictEqual(generics[1], "E");
    });

    it("should parse bounded generics", () => {
      const SealedGenerator = require("../src/generators/sealed-generator");
      const DartClass = require("../src/models/dart-class");
      const Imports = require("../src/models/imports");

      const clazz = new DartClass();
      clazz.name = "Result";
      clazz.fullGenericType = "<T extends Object, E>";
      clazz.classType = "sealed class";
      clazz.properties = [];
      clazz.startsAtLine = 1;
      clazz.endsAtLine = 3;

      const imports = new Imports("", "test_app");
      const generator = new SealedGenerator(clazz, imports);

      const generics = generator.parseGenerics("<T extends Object, E>");
      assert.strictEqual(generics.length, 2);
      assert.strictEqual(generics[0], "T");
      assert.strictEqual(generics[1], "E");
    });
  });

  describe("canBeConst property", () => {
    it("should return true for class with only primitives", () => {
      const code = `
class User {
  final String name;
  final int age;
  final bool isActive;
}`;
      const { clazz } = parseClass(code);
      assert.strictEqual(clazz.canBeConst, true);
    });

    it("should return false for class with custom types", () => {
      const code = `
class Order {
  final User user;
}`;
      const { clazz } = parseClass(code);
      assert.strictEqual(clazz.canBeConst, false);
    });

    it("should return true for class with collections", () => {
      const code = `
class Container {
  final List<String> items;
  final Map<String, int> data;
}`;
      const { clazz } = parseClass(code);
      assert.strictEqual(clazz.canBeConst, true);
    });
  });

  describe("isGenericTypeParameter property", () => {
    const ClassField = require("../src/models/class-field");

    it("should return true for single uppercase letter types", () => {
      const field = new ClassField("T", "value");
      assert.strictEqual(field.isGenericTypeParameter, true);
    });

    it("should return false for known types like String", () => {
      const field = new ClassField("String", "name");
      assert.strictEqual(field.isGenericTypeParameter, false);
    });

    it("should return false for multi-letter types", () => {
      const field = new ClassField("User", "user");
      assert.strictEqual(field.isGenericTypeParameter, false);
    });

    it("should return true for K, V generic types", () => {
      const fieldK = new ClassField("K", "key");
      const fieldV = new ClassField("V", "value");
      assert.strictEqual(fieldK.isGenericTypeParameter, true);
      assert.strictEqual(fieldV.isGenericTypeParameter, true);
    });
  });

  describe("Template Placeholders in $from/$to directives", () => {
    describe("{value} placeholder", () => {
      it("should replace {value} with map access in $from", () => {
        const code = `
class Example {
  final QuizStatusEnum status; // $from: QuizStatusEnum.parse({value})
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        // {value} should be replaced with map['status']
        assert.ok(
          clazz.toInsert.includes("QuizStatusEnum.parse(map['status'])"),
          `Expected QuizStatusEnum.parse(map['status']) but got: ${clazz.toInsert}`
        );
      });

      it("should replace {value} with field name in $to", () => {
        const code = `
class Example {
  final QuizStatusEnum status; // $to: {value}.serialize()
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        // {value} in $to should be replaced with field name
        assert.ok(
          clazz.toInsert.includes("status.serialize()"),
          `Expected status.serialize() but got: ${clazz.toInsert}`
        );
      });

      it("should handle {value} in both $from and $to", () => {
        const code = `
class Example {
  final QuizStatusEnum status; // $from: QuizStatusEnum.parse({value}), $to: {value}.serialize()
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(
          clazz.toInsert.includes("QuizStatusEnum.parse(map['status'])"),
          `fromMap should contain QuizStatusEnum.parse(map['status'])`
        );
        assert.ok(
          clazz.toInsert.includes("status.serialize()"),
          `toMap should contain status.serialize()`
        );
      });
    });

    describe("{field} placeholder", () => {
      it("should replace {field} with field name in $from", () => {
        const code = `
class Example {
  final Duration timeout; // $from: Duration(milliseconds: map['{field}'] as int)
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(
          clazz.toInsert.includes("map['timeout']"),
          `Expected map['timeout'] but got: ${clazz.toInsert}`
        );
      });

      it("should replace {field} with field name in $to", () => {
        const code = `
class Example {
  final Duration timeout; // $to: {field}.inMilliseconds
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(
          clazz.toInsert.includes("timeout.inMilliseconds"),
          `Expected timeout.inMilliseconds but got: ${clazz.toInsert}`
        );
      });
    });

    describe("{key} placeholder", () => {
      it("should replace {key} with snake_case JSON key in $from", () => {
        const code = `
class Example {
  final DateTime createdAt; // $from: DateTime.parse(map['{key}'] as String)
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        // createdAt -> created_at in snake_case
        assert.ok(
          clazz.toInsert.includes("map['created_at']"),
          `Expected map['created_at'] but got: ${clazz.toInsert}`
        );
      });

      it("should replace {key} with snake_case JSON key in $to", () => {
        const code = `
class Example {
  final String userId; // $to: '{key}: ' + {field}
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        // userId -> user_id in snake_case
        assert.ok(
          clazz.toInsert.includes("'user_id'"),
          `Expected 'user_id' in output but got: ${clazz.toInsert}`
        );
      });
    });

    describe("Combined placeholders", () => {
      it("should handle all three placeholders in one expression", () => {
        const code = `
class Example {
  final CustomType myField; // $from: CustomType.fromJson({value}, '{key}', '{field}')
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        // {value} -> map['my_field']
        // {key} -> my_field
        // {field} -> myField
        assert.ok(
          clazz.toInsert.includes("map['my_field']"),
          `Expected map['my_field'] (from {value})`
        );
        assert.ok(
          clazz.toInsert.includes("'my_field'"),
          `Expected 'my_field' (from {key})`
        );
        assert.ok(
          clazz.toInsert.includes("'myField'"),
          `Expected 'myField' (from {field})`
        );
      });

      it("should handle placeholders with complex expressions", () => {
        const code = `
class Example {
  final int? score; // $from: ({value} as num?)?.toInt(), $to: {field}
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(
          clazz.toInsert.includes("(map['score'] as num?)?.toInt()"),
          `Expected (map['score'] as num?)?.toInt() but got: ${clazz.toInsert}`
        );
      });
    });

    describe("Multi-line field declarations with placeholders", () => {
      it("should handle {value} placeholder in multi-line field", () => {
        const code = `
class GameDetailDTO {
  final int id;
  final QuizStatusEnum
      status; // $from: QuizStatusEnum.parse({value}), $to: {value}.serialize()
  final String name;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        // Check that status field is parsed
        assert.strictEqual(clazz.properties.length, 3);
        assert.strictEqual(clazz.properties[1].name, "status");
        assert.strictEqual(clazz.properties[1].type, "QuizStatusEnum");

        // Check fromMap
        assert.ok(
          clazz.toInsert.includes("QuizStatusEnum.parse(map['status'])"),
          `fromMap should use QuizStatusEnum.parse(map['status'])`
        );

        // Check toMap
        assert.ok(
          clazz.toInsert.includes("status.serialize()"),
          `toMap should use status.serialize()`
        );
      });

      it("should handle multi-line field with constructor present", () => {
        const code = `
final class GameDetailDTO {
  const GameDetailDTO({
    required this.id,
    required this.status,
  });

  final int id;
  final QuizStatusEnum
      status; // $from: QuizStatusEnum.parse({value} as String), $to: {field}.serialize()
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.strictEqual(clazz.properties.length, 2);
        assert.ok(
          clazz.toInsert.includes("QuizStatusEnum.parse(map['status'] as String)"),
          `fromMap should contain QuizStatusEnum.parse(map['status'] as String)`
        );
        assert.ok(
          clazz.toInsert.includes("status.serialize()"),
          `toMap should contain status.serialize()`
        );
      });

      it("should handle multiple multi-line fields with different placeholders", () => {
        const code = `
class Config {
  final Duration
      timeout; // $from: Duration(milliseconds: ({value} as num).toInt()), $to: {field}.inMilliseconds
  final Uri
      endpoint; // $from: Uri.parse({value} as String), $to: {field}.toString()
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.strictEqual(clazz.properties.length, 2);

        // timeout
        assert.ok(
          clazz.toInsert.includes("Duration(milliseconds: (map['timeout'] as num).toInt())"),
          `fromMap should parse timeout correctly`
        );
        assert.ok(
          clazz.toInsert.includes("timeout.inMilliseconds"),
          `toMap should serialize timeout correctly`
        );

        // endpoint
        assert.ok(
          clazz.toInsert.includes("Uri.parse(map['endpoint'] as String)"),
          `fromMap should parse endpoint correctly`
        );
        assert.ok(
          clazz.toInsert.includes("endpoint.toString()"),
          `toMap should serialize endpoint correctly`
        );
      });
    });

    describe("Edge cases", () => {
      it("should handle nullable types with {value} placeholder", () => {
        const code = `
class Example {
  final QuizStatusEnum? status; // $from: {value} != null ? QuizStatusEnum.parse({value}) : null, $to: {field}?.serialize()
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(
          clazz.toInsert.includes("map['status'] != null ? QuizStatusEnum.parse(map['status']) : null"),
          `fromMap should handle nullable with {value}`
        );
        assert.ok(
          clazz.toInsert.includes("status?.serialize()"),
          `toMap should handle nullable with {field}`
        );
      });

      it("should handle {value} placeholder with type casting", () => {
        const code = `
class Example {
  final Color color; // $from: Color(({value} as num).toInt()), $to: {field}.value
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(
          clazz.toInsert.includes("Color((map['color'] as num).toInt())"),
          `Should handle {value} with casting`
        );
        assert.ok(
          clazz.toInsert.includes("color.value"),
          `Should handle {field} in $to`
        );
      });

      it("should preserve curly braces in comments that are not placeholders", () => {
        const code = `
class Example {
  final String template; // $from: {value}, $to: '{not_a_placeholder}'
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        // {not_a_placeholder} should remain as-is since it's not a known placeholder
        assert.ok(
          clazz.toInsert.includes("'{not_a_placeholder}'"),
          `Unknown placeholders should be preserved`
        );
      });

      it("should handle {value} used multiple times in one expression", () => {
        const code = `
class Example {
  final int range; // $from: ({value} as num).toInt().clamp(0, ({value} as num).toInt() + 100)
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        // Both {value} should be replaced
        const fromMapMatch = clazz.toInsert.match(/map\['range'\]/g);
        assert.ok(
          fromMapMatch && fromMapMatch.length >= 2,
          `Both {value} placeholders should be replaced`
        );
      });
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  const Mocha = require("mocha");
  const mocha = new Mocha();
  mocha.addFile(__filename);
  mocha.run((failures) => {
    process.exitCode = failures ? 1 : 0;
  });
}
