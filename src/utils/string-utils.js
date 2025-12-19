const { readSetting } = require("./settings");

/**
 * Make a valid dart variable name from a string.
 * @param {string} source
 */
function toVarName(source) {
  let s = source;
  let r = "";

  /**
   * @param {string} char
   */
  let replace = (char) => {
    if (s.includes(char)) {
      const splits = s.split(char);
      for (let i = 0; i < splits.length; i++) {
        let w = splits[i];
        i > 0 ? (r += capitalize(w)) : (r += w);
      }
    }
  };

  replace("-");
  replace("~");
  replace(":");
  replace("#");
  replace("$");

  if (r.length == 0) r = s;

  const keywords = [
    "assert",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "else",
    "enum",
    "extends",
    "false",
    "final",
    "finally",
    "for",
    "if",
    "in",
    "is",
    "new",
    "null",
    "rethrow",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "var",
    "void",
    "while",
    "with",
  ];

  if (keywords.includes(r)) {
    r = r + "_";
  }

  if (r.length > 0 && r[0].match(new RegExp(/[0-9]/))) r = "n" + r;

  return r;
}

/**
 * @param {string} source
 */
function capitalize(source) {
  let s = source;
  if (s.length > 0) {
    if (s.length > 1) {
      return s.substr(0, 1).toUpperCase() + s.substring(1, s.length);
    } else {
      return s.substr(0, 1).toUpperCase();
    }
  }
  return s;
}

function camelCase(str) {
  const snakeToCamel = str.replace(/([-_][a-z])/g, (group) =>
    group.toUpperCase().replace("-", "").replace("_", "")
  );
  return snakeToCamel;
}

/**
 * @param {string} src
 */
function varToKey(src) {
  const snakeCase = (string) => {
    return string
      .replace(/\W+/g, " ")
      .split(/ |\B(?=[A-Z])/)
      .map((word) => word.toLowerCase())
      .join("_");
  };

  const format = readSetting("json.key_format");

  switch (format) {
    case "snake_case":
      return snakeCase(src);
    case "camelCase":
      return camelCase(src);
    default:
      return src;
  }
}

/**
 * @param {string} name
 */
function createFileName(name) {
  let r = "";
  for (let i = 0; i < name.length; i++) {
    let c = name[i];
    if (c == c.toUpperCase() && c.match(/[a-zA-Z]/)) {
      if (i == 0) r += c.toLowerCase();
      else r += "_" + c.toLowerCase();
    } else {
      r += c;
    }
  }
  return r;
}

/**
 * Sanitize file name to prevent path traversal
 * @param {string} name
 */
function sanitizeFileName(name) {
  // Remove path separators and dangerous characters
  return name
    .replace(/[\/\\]/g, "")
    .replace(/\.\./g, "")
    .replace(/[<>:"|?*]/g, "")
    .trim();
}

module.exports = {
  toVarName,
  capitalize,
  camelCase,
  varToKey,
  createFileName,
  sanitizeFileName,
};
