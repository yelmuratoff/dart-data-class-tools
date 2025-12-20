const assert = require("assert");
require("./test-setup");

const DartClassParser = require("../src/parsers/dart-class-parser");

describe("DartClassParser", () => {
  describe("Basic Class Parsing", () => {
    it("should parse a simple class with one property", () => {
      const code = `
class User {
  final String name;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes.length, 1);
      assert.strictEqual(classes[0].name, "User");
      assert.strictEqual(classes[0].properties.length, 1);
      assert.strictEqual(classes[0].properties[0].name, "name");
      assert.strictEqual(classes[0].properties[0].type, "String");
      assert.strictEqual(classes[0].properties[0].isFinal, true);
    });

    it("should parse a class with multiple properties", () => {
      const code = `
class Person {
  final String name;
  final int age;
  final bool isActive;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes.length, 1);
      assert.strictEqual(classes[0].properties.length, 3);
      assert.strictEqual(classes[0].properties[0].name, "name");
      assert.strictEqual(classes[0].properties[1].name, "age");
      assert.strictEqual(classes[0].properties[2].name, "isActive");
    });

    it("should parse nullable types", () => {
      const code = `
class User {
  final String? name;
  final int? age;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].properties[0].isNullable, true);
      assert.strictEqual(classes[0].properties[0].type, "String");
      assert.strictEqual(classes[0].properties[1].isNullable, true);
    });
  });

  describe("Collection Types", () => {
    it("should parse List types", () => {
      const code = `
class Container {
  final List<String> items;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].properties[0].isList, true);
      assert.strictEqual(classes[0].properties[0].rawType, "List<String>");
    });

    it("should parse Map types", () => {
      const code = `
class Container {
  final Map<String, int> data;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].properties[0].isMap, true);
      assert.strictEqual(classes[0].properties[0].rawType, "Map<String, int>");
    });

    it("should parse Set types", () => {
      const code = `
class Container {
  final Set<int> numbers;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].properties[0].isSet, true);
    });

    it("should parse nested collection types", () => {
      const code = `
class Container {
  final List<Map<String, dynamic>> items;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      const prop = classes[0].properties[0];
      assert.strictEqual(prop.isList, true);
      assert.strictEqual(prop.subtype.isMap, true);
    });
  });

  describe("Generics", () => {
    it("should parse class with generic type parameter", () => {
      const code = `
class Box<T> {
  final T value;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].name, "Box");
      assert.strictEqual(classes[0].fullGenericType, "<T>");
    });

    it("should parse class with multiple generic parameters", () => {
      const code = `
class Pair<K, V> {
  final K key;
  final V value;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].name, "Pair");
      assert.strictEqual(classes[0].fullGenericType, "<K, V>");
    });

    it("should parse class with bounded generic", () => {
      const code = `
class Repository<T extends Entity> {
  final T entity;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].name, "Repository");
      assert.ok(classes[0].fullGenericType.includes("extends"));
    });
  });

  describe("Inheritance", () => {
    it("should parse class with extends", () => {
      const code = `
class Admin extends User {
  final String role;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].superclass, "User");
      assert.strictEqual(classes[0].hasSuperclass, true);
    });

    it("should parse class with implements", () => {
      const code = `
class User implements Serializable {
  final String name;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].interfaces.length, 1);
      assert.strictEqual(classes[0].interfaces[0], "Serializable");
    });

    it("should parse class with mixins", () => {
      const code = `
class User with Comparable {
  final String name;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].mixins.length, 1);
      assert.strictEqual(classes[0].mixins[0], "Comparable");
    });

    it("should parse class with extends, with and implements", () => {
      const code = `
class Admin extends User with Comparable implements Serializable {
  final String role;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].superclass, "User");
      assert.strictEqual(classes[0].mixins[0], "Comparable");
      assert.strictEqual(classes[0].interfaces[0], "Serializable");
    });
  });

  describe("Abstract and Sealed Classes", () => {
    it("should parse abstract class", () => {
      const code = `
abstract class Entity {
  final String id;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].classType, "abstract class");
      assert.strictEqual(classes[0].isAbstract, true);
    });

    it("should parse sealed class", () => {
      const code = `
sealed class Result {
  final String value;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].classType, "sealed class");
      assert.strictEqual(classes[0].isAbstract, true);
    });

    it("should parse final class", () => {
      const code = `
final class Config {
  final String key;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].classType, "final class");
    });
  });

  describe("Constructor Parsing", () => {
    it("should detect constructor", () => {
      const code = `
class User {
  final String name;

  User({required this.name});
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].hasConstructor, true);
      assert.ok(classes[0].constr.includes("User"));
    });

    it("should detect const constructor", () => {
      const code = `
class User {
  final String name;

  const User({required this.name});
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.ok(classes[0].constr.includes("const"));
    });
  });

  describe("Multiple Classes", () => {
    it("should parse multiple classes in one file", () => {
      const code = `
class User {
  final String name;
}

class Admin {
  final String role;
}

class Guest {
  final bool isTemporary;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes.length, 3);
      assert.strictEqual(classes[0].name, "User");
      assert.strictEqual(classes[1].name, "Admin");
      assert.strictEqual(classes[2].name, "Guest");
    });
  });

  describe("Enum Directive", () => {
    it("should detect enum directive from comment", () => {
      const code = `
class User {
  // enum
  final Status status;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].properties[0].isEnum, true);
    });

    it("should detect enum directive inline", () => {
      const code = `
class User {
  final Status status; // enum
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].properties[0].isEnum, true);
    });
  });

  describe("Widget Detection", () => {
    it("should detect StatelessWidget", () => {
      const code = `
class MyWidget extends StatelessWidget {
  final String title;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].isWidget, true);
      assert.strictEqual(classes[0].isStatelessWidget, true);
    });

    it("should detect StatefulWidget", () => {
      const code = `
class MyWidget extends StatefulWidget {
  final String title;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].isWidget, true);
      assert.strictEqual(classes[0].isStatelessWidget, false);
    });

    it("should skip State classes", () => {
      const code = `
class _MyWidgetState extends State<MyWidget> {
  final String data;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      // State classes should be filtered out
      assert.strictEqual(classes.length, 0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty class", () => {
      const code = `
class Empty {
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes.length, 1);
      assert.strictEqual(classes[0].hasProperties, false);
      assert.strictEqual(classes[0].isValid, false);
    });

    it("should ignore static fields", () => {
      const code = `
class Config {
  static const String version = "1.0";
  final String name;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].properties.length, 1);
      assert.strictEqual(classes[0].properties[0].name, "name");
    });

    it("should ignore getters and setters", () => {
      const code = `
class User {
  final String _name;

  String get name => _name;
  set name(String value) => _name = value;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].properties.length, 1);
      assert.strictEqual(classes[0].properties[0].name, "_name");
    });

    it("should handle properties with special characters in keys", () => {
      const code = `
class Data {
  final String user_name;
  final int item_count;
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(classes[0].properties[0].name, "user_name");
      assert.strictEqual(classes[0].properties[1].name, "item_count");
    });
  });

  describe("Custom Directives", () => {
    it("should parse raw @from: directive", () => {
      const code = `
class Event {
  final String timeout; // $from: Duration(milliseconds: map['timeout'] as int)
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(
        classes[0].properties[0].rawFromExpr,
        "Duration(milliseconds: map['timeout'] as int)"
      );
      assert.strictEqual(classes[0].properties[0].isRawFrom, true);
    });

    it("should parse raw @to: directive", () => {
      const code = `
class Event {
  final String timeout; // $to: timeout.inMilliseconds
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(
        classes[0].properties[0].rawToExpr,
        "timeout.inMilliseconds"
      );
      assert.strictEqual(classes[0].properties[0].isRawTo, true);
    });

    it("should parse combined @from: and @to: directives", () => {
      const code = `
class Event {
  final String timeout; // $from: Duration(milliseconds: map['timeout'] as int), $to: timeout.inMilliseconds
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      assert.strictEqual(
        classes[0].properties[0].rawFromExpr,
        "Duration(milliseconds: map['timeout'] as int)"
      );
      assert.strictEqual(
        classes[0].properties[0].rawToExpr,
        "timeout.inMilliseconds"
      );
    });

    it("should handle commas inside generic types with smart split", () => {
      const code = `
class Data {
  final Map<String, int> data; // Map<String, int>.from(Map), toMap()
}`;
      const parser = new DartClassParser(code);
      const classes = parser.parse();

      // The toCustom should be "toMap()", not broken by the generic comma
      assert.strictEqual(classes[0].properties[0].toCustom, "toMap()");
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
