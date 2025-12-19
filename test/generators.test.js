const assert = require("assert");

// Mock vscode module
const mockVscode = {
  workspace: {
    getConfiguration: () => ({
      get: (key) => {
        const defaults = {
          "dart-data-class-generator.json.key_format": "snake_case",
          "dart-data-class-generator.json.enum_format": "byName",
          "dart-data-class-generator.constructor.enabled": true,
          "dart-data-class-generator.constructor.default_values": true,
          "dart-data-class-generator.constructor.immutable": false,
          "dart-data-class-generator.copyWith.enabled": true,
          "dart-data-class-generator.toMap.enabled": true,
          "dart-data-class-generator.toMap.defensive_copy": false,
          "dart-data-class-generator.fromMap.enabled": true,
          "dart-data-class-generator.fromMap.default_values": true,
          "dart-data-class-generator.toJson.enabled": true,
          "dart-data-class-generator.fromJson.enabled": true,
          "dart-data-class-generator.toString.enabled": true,
          "dart-data-class-generator.equality.enabled": true,
          "dart-data-class-generator.hashCode.enabled": true,
          "dart-data-class-generator.hashCode.use_jenkins": false,
          "dart-data-class-generator.useEquatable": false,
          "dart-data-class-generator.strict_numbers": false,
          "dart-data-class-generator.custom.types": [
            {
              type: "DateTime",
              fromMap: "DateTime.parse(String)",
              toMap: "toIso8601String()",
            },
            {
              type: "Color",
              fromMap: "Color(int)",
              toMap: "value",
            },
          ],
          "dart-data-class-generator.custom.argumentError":
            "throw ArgumentError.value(map[k], k, '$T ← ${map[k].runtimeType}');",
        };
        return defaults[key];
      },
    }),
  },
  Position: class {
    constructor(line, char) {
      this.line = line;
      this.character = char;
    }
  },
  Range: class {
    constructor(start, end) {
      this.start = start;
      this.end = end;
    }
  },
};

require.cache[require.resolve("vscode")] = {
  exports: mockVscode,
};

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

      assert.ok(clazz.constr.includes("this.name"));
      assert.ok(clazz.constr.includes("this.age"));
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

      assert.ok(clazz.constr.includes("this.name = ''"));
      assert.ok(clazz.constr.includes("this.count = 0"));
    });

    it("should not add required for nullable types", () => {
      const code = `
class User {
  final String? name;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new ConstructorGenerator(clazz, imports, false);
      generator.generate();

      assert.ok(!clazz.constr.includes("required this.name"));
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

      it("should handle nullable fields with null check", () => {
        const code = `
class User {
  final String? bio;
}`;
        const { clazz, imports } = parseClass(code);
        const generator = new SerializationGenerator(clazz, imports);
        generator.generate();

        assert.ok(clazz.toInsert.includes("map['bio'] != null"));
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
      assert.ok(clazz.toInsert.includes("collectionEquals(other.items, items)"));
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
