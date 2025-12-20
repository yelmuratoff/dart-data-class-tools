const vscode = require("vscode");

/**
 * @param {string} key
 */
function readSetting(key) {
  return vscode.workspace
    .getConfiguration()
    .get("dart-data-class-generator." + key);
}

/**
 * @param {string} typeName
 */
function readCustomTypeSetting(typeName) {
  const customTypes = readSetting("custom.types");
  const customTypeConfig = customTypes.find(
    (custom) => custom.type === typeName
  );
  return customTypeConfig;
}

/**
 * @param {string[]} keys
 */
function readSettings(keys) {
  for (let key of keys) {
    if (readSetting(key)) {
      return true;
    }
  }
  return false;
}

/**
 * Split directive string by comma while respecting <> brackets for generics.
 * Example: "Map<String, int>, toMap()" -> ["Map<String, int>", "toMap()"]
 * @param {string} input
 * @returns {string[]}
 */
function smartSplit(input) {
  const parts = [];
  let current = "";
  let depth = 0;
  let parenDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (char === "<") depth++;
    else if (char === ">") depth--;
    else if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;

    if (char === "," && depth === 0 && parenDepth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

/**
 * Parse raw directive expressions with $from: and $to: syntax.
 * Example: "$from: Duration(milliseconds: map['x'] as int), $to: x.inMilliseconds"
 * @param {string} directive
 * @returns {{ rawFrom: string|null, rawTo: string|null }}
 */
function parseRawDirective(directive) {
  let rawFrom = null;
  let rawTo = null;

  // Match $from: ... pattern (captures until $to: or end of string)
  const fromMatch = directive.match(/\$from:\s*(.+?)(?=,\s*\$to:|$)/);
  if (fromMatch) {
    rawFrom = fromMatch[1].trim();
  }

  // Match $to: ... pattern
  const toMatch = directive.match(/\$to:\s*(.+?)$/);
  if (toMatch) {
    rawTo = toMatch[1].trim();
  }

  return { rawFrom, rawTo };
}

/**
 * Check if directive uses raw syntax (@from: or @to:)
 * @param {string} directive
 * @returns {boolean}
 */
function isRawDirective(directive) {
  return directive.includes("$from:") || directive.includes("$to:");
}

/**
 * Process template placeholders in an expression.
 * Replaces {value}, {field}, {key} with actual values.
 * @param {string} template - The template string with placeholders
 * @param {object} context - Context object with field, key, valueExpr
 * @param {string} context.field - The field name (e.g., "timeout")
 * @param {string} context.key - The JSON key (e.g., "timeout" or "time_out")
 * @param {string} context.valueExpr - The value expression (e.g., "cast<int>('timeout')")
 * @returns {string}
 */
function processTemplate(template, context) {
  if (!template) return template;

  return template
    .replace(/\{value\}/g, context.valueExpr || `map['${context.key}']`)
    .replace(/\{field\}/g, context.field)
    .replace(/\{key\}/g, context.key);
}

/**
 * Extract method/constructor call from fromMap syntax with balanced bracket matching.
 * Supports nested generics like Map<String, List<int>>.
 *
 * Input formats:
 * - "DateTime.parse(String)" -> ["parse", "(", "String", ")"]
 * - "Color(int)" -> ["", "(", "int", ")"]
 * - "Duration(milliseconds: int ?? 0)" -> ["", "(", "milliseconds: int ?? 0", ")"]
 * - "" (empty) -> ["", "", "", ""]
 *
 * @param {string} fromMap
 * @returns {[string, string, string, string]} [methodName, openBracket, typedefContent, closeBracket]
 */
function extractFromMap(fromMap) {
  if (!fromMap || fromMap.trim() === "") {
    return ["", "", "", ""];
  }

  const trimmed = fromMap.trim();

  // Find the first opening bracket (either ( or [)
  let openIndex = -1;
  let openChar = "";

  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "(" || trimmed[i] === "[") {
      openIndex = i;
      openChar = trimmed[i];
      break;
    }
  }

  if (openIndex === -1) {
    // No brackets found - might be a simple property access or empty
    return ["", "", "", ""];
  }

  const closeChar = openChar === "(" ? ")" : "]";

  // Extract method name (everything before the opening bracket)
  const beforeBracket = trimmed.substring(0, openIndex);

  // Find method name (after the last dot, if any)
  let methodName = "";
  if (fromMap.includes(".")) {
    const dotIndex = beforeBracket.lastIndexOf(".");
    if (dotIndex !== -1) {
      methodName = beforeBracket.substring(dotIndex + 1);
    } else {
      methodName = beforeBracket;
    }
  }

  // Find matching close bracket using balanced matching
  let depth = 1;
  let closeIndex = -1;

  for (let i = openIndex + 1; i < trimmed.length; i++) {
    if (trimmed[i] === openChar) depth++;
    else if (trimmed[i] === closeChar) {
      depth--;
      if (depth === 0) {
        closeIndex = i;
        break;
      }
    }
  }

  if (closeIndex === -1) {
    // Unbalanced brackets - return empty
    return ["", "", "", ""];
  }

  const content = trimmed.substring(openIndex + 1, closeIndex);

  return [methodName, openChar, content, closeChar];
}

/**
 * Get trailing comma based on setting.
 * @returns {string} "," or ""
 */
function getTrailingComma() {
  return readSetting("formatting.trailing_commas") ? "," : "";
}

module.exports = {
  readSetting,
  readCustomTypeSetting,
  readSettings,
  extractFromMap,
  smartSplit,
  parseRawDirective,
  isRawDirective,
  processTemplate,
  getTrailingComma,
};
