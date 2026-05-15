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
  });
});
