const assert = require("assert");
require("./test-setup");

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
    // Expected: cast<Map>('quizzes').map((k, x) => MapEntry(int.parse(k), Quiz.fromMap(Map.from(x as Map))))
    assert.ok(
      clazz.toInsert.includes(
        "cast<Map?>('quizzes')?.map((k, x) => MapEntry(int.parse(k), Quiz.fromMap(Map.from(x as Map))))",
      ),
      `fromMap failed. Output: ${clazz.toInsert}`,
    );
  });
});
