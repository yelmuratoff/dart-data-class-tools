const Module = require("module");

// Complete vscode mock with all settings
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
          "dart-data-class-generator.formatting.trailing_commas": true,
          "dart-data-class-generator.copyWith.required_params": false,
          "dart-data-class-generator.sealed.enabled": false,
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

// Intercept require for 'vscode' - only set once
if (!Module.prototype._originalRequire) {
  Module.prototype._originalRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === "vscode") {
      return mockVscode;
    }
    return Module.prototype._originalRequire.apply(this, arguments);
  };
}

module.exports = { mockVscode };
