const assert = require("assert");
const { mockVscode } = require("./test-setup");

const DartClassParser = require("../src/parsers/dart-class-parser");
const Imports = require("../src/models/imports");
const SerializationGenerator = require("../src/generators/serialization-generator");

describe("SerializationGenerator - Map<K, V>", () => {
  function parseClass(code) {
    const parser = new DartClassParser(code);
    const classes = parser.parse();
    const imports = new Imports(code, "test_app");
    return { clazz: classes[0], imports };
  }

  it("should handle Map<int, CustomType>", () => {
    const code = `
class GameDetailDTO {
  final Map<int, Quiz> quizzes;
}`;
    const { clazz, imports } = parseClass(code);
    const generator = new SerializationGenerator(clazz, imports);
    generator.generate();

    // Verify toMap
    // Expected: quizzes.map((k, v) => MapEntry(k.toString(), v.toMap()))
    assert.ok(
      clazz.toInsert.includes(
        "quizzes.map((k, v) => MapEntry(k.toString(), v.toMap()))",
      ),
      `toMap failed. Output: ${clazz.toInsert}`,
    );

    // Verify fromMap
    // Expected: cast<Map<dynamic, dynamic>?>('quizzes')?.map((k, x) => MapEntry(int.parse(k.toString()), Quiz.fromMap(Map.from(x as Map<dynamic, dynamic>))))
    assert.ok(
      clazz.toInsert.includes(
        "cast<Map<dynamic, dynamic>?>('quizzes')?.map((k, x) => MapEntry(int.parse(k.toString()), Quiz.fromMap(Map.from(x as Map<dynamic, dynamic>))))",
      ),
      `fromMap failed. Output: ${clazz.toInsert}`,
    );
  });

  describe("defensive_copy=true emits explicit type args for Map.unmodifiable", () => {
    beforeEach(() => mockVscode.setSetting("toMap.defensive_copy", true));
    afterEach(() => mockVscode.setSetting("toMap.defensive_copy", false));

    it("should use <String, dynamic> for Map<int, CustomType>", () => {
      const code = `
class GameDetailDTO {
  final Map<int, Quiz> quizzes;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new SerializationGenerator(clazz, imports);
      generator.generate();

      assert.ok(
        clazz.toInsert.includes(
          "Map<String, dynamic>.unmodifiable(quizzes.map((k, v) => MapEntry(k.toString(), v.toMap())))",
        ),
        `toMap failed. Output: ${clazz.toInsert}`,
      );
    });

    it("should preserve <K, V> for primitive Map<String, int>", () => {
      const code = `
class Settings {
  final Map<String, int> scores;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new SerializationGenerator(clazz, imports);
      generator.generate();

      assert.ok(
        clazz.toInsert.includes("Map<String, int>.unmodifiable(scores)"),
        `toMap failed. Output: ${clazz.toInsert}`,
      );
    });

    it("should emit typed List.unmodifiable for primitive List<String>", () => {
      const code = `
class Container {
  final List<String> items;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new SerializationGenerator(clazz, imports);
      generator.generate();

      assert.ok(
        clazz.toInsert.includes("List<String>.unmodifiable(items)"),
        `toMap failed. Output: ${clazz.toInsert}`,
      );
    });

    it("should bang receiver for nullable List<String>?", () => {
      const code = `
class Container {
  final List<String>? tags;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new SerializationGenerator(clazz, imports);
      generator.generate();

      assert.ok(
        clazz.toInsert.includes(
          "tags == null ? null : List<String>.unmodifiable(tags!)",
        ),
        `toMap failed. Output: ${clazz.toInsert}`,
      );
    });

    it("should bang receiver for nullable Set<String>?", () => {
      const code = `
class Container {
  final Set<String>? categories;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new SerializationGenerator(clazz, imports);
      generator.generate();

      assert.ok(
        clazz.toInsert.includes(
          "categories == null ? null : Set<String>.unmodifiable(categories!.toList())",
        ),
        `toMap failed. Output: ${clazz.toInsert}`,
      );
    });

    it("should bang receiver for nullable Map<String, int>?", () => {
      const code = `
class Container {
  final Map<String, int>? scores;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new SerializationGenerator(clazz, imports);
      generator.generate();

      assert.ok(
        clazz.toInsert.includes(
          "scores == null ? null : Map<String, int>.unmodifiable(scores!)",
        ),
        `toMap failed. Output: ${clazz.toInsert}`,
      );
    });

    it("should bang receiver for nullable List of custom type", () => {
      const code = `
class Container {
  final List<Address>? partners;
}`;
      const { clazz, imports } = parseClass(code);
      const generator = new SerializationGenerator(clazz, imports);
      generator.generate();

      assert.ok(
        clazz.toInsert.includes(
          "partners == null ? null : List<Map<String, dynamic>>.unmodifiable(partners!.map((x) => x.toMap()).toList())",
        ),
        `toMap failed. Output: ${clazz.toInsert}`,
      );
    });
  });
});
