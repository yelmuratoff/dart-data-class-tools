const vscode = require("vscode");

/**
 * Base class for all generators
 * @abstract
 */
class BaseGenerator {
  /**
   * @param {import('../models/dart-class')} clazz
   * @param {import('../models/imports')} imports
   */
  constructor(clazz, imports) {
    this.clazz = clazz;
    this.imports = imports;
  }

  /**
   * @abstract
   * @returns {boolean} Whether the generator should run
   */
  shouldGenerate() {
    throw new Error("shouldGenerate() must be implemented");
  }

  /**
   * @abstract
   * @returns {void}
   */
  generate() {
    throw new Error("generate() must be implemented");
  }

  /**
   * @param {string} imp
   * @param {string[]} validOverrides
   */
  requiresImport(imp, validOverrides = []) {
    this.imports.requiresImport(imp, validOverrides);
  }

  /**
   * @param {string} method
   * @param {boolean} isConstructor
   */
  append(method, isConstructor = false) {
    const indented = indent(method);
    if (isConstructor) {
      this.clazz.constr = indented;
    } else {
      this.clazz.toInsert += "\n" + indented;
    }
  }

  /**
   * @param {import('../models/class-part')} part
   */
  replace(part) {
    this.clazz.toReplace.push(part);
  }

  /**
   * @param {string} name
   * @param {string} method
   * @param {string} finder
   */
  appendOrReplace(name, method, finder) {
    const part = this.findPart(name, finder);
    const replacement = removeEnd(indent(method.replace("@override\n", "")), "\n");

    if (part != null) {
      part.replacement = replacement;
      if (!areStrictEqual(part.current, part.replacement)) {
        this.replace(part);
      }
    } else {
      this.append(method);
    }
  }

  /**
   * @param {string} name
   * @param {string} finder
   */
  findPart(name, finder) {
    const normalize = (/** @type {string} */ src) => {
      let result = "";
      let generics = 0;
      let prevChar = "";
      for (const char of src) {
        if (char == "<") generics++;
        if (char != " " && generics == 0) {
          result += char;
        }
        if (prevChar != "=" && char == ">") generics--;
        prevChar = char;
      }
      return result;
    };

    const finderString = normalize(finder);
    const lines = this.clazz.classContent.split("\n");
    const ClassPart = require("../models/class-part");
    const part = new ClassPart(name);
    let curlies = 0;
    let singleLine = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = this.clazz.startsAtLine + i;

      curlies += count(line, "{");
      curlies -= count(line, "}");

      if (part.startsAt == null && normalize(line).startsWith(finderString)) {
        if (line.includes("=>")) singleLine = true;
        if (curlies == 2 || singleLine) {
          part.startsAt = lineNum;
          part.current = line + "\n";
        }
      } else if (
        part.startsAt != null &&
        part.endsAt == null &&
        (curlies >= 2 || singleLine)
      ) {
        part.current += line + "\n";
      } else if (part.startsAt != null && part.endsAt == null && curlies == 1) {
        part.endsAt = lineNum;
        part.current += line;
      }

      if (
        singleLine &&
        part.startsAt != null &&
        part.endsAt == null &&
        line.trimRight().endsWith(";")
      ) {
        part.endsAt = lineNum;
      }
    }

    return part.isValid ? part : null;
  }
}

// Utility functions
function indent(source) {
  let lines = source.split("\n");
  while (lines.length > 0 && isBlank(lines[0])) lines.shift();
  while (lines.length > 0 && isBlank(lines[lines.length - 1])) lines.pop();

  let r = "";
  for (let line of lines) {
    r += "  " + line + "\n";
  }
  return r.length > 0 ? r : source;
}

function isBlank(str) {
  return !str || /^\s*$/.test(str);
}

function removeEnd(source, end) {
  if (Array.isArray(end)) {
    let result = source.trim();
    for (let e of end) {
      result = removeEnd(result, e).trim();
    }
    return result;
  } else {
    const pos = source.length - end.length;
    return source.endsWith(end) ? source.substring(0, pos) : source;
  }
}

function areStrictEqual(a, b) {
  let x = a.replace(/\s/g, "");
  let y = b.replace(/\s/g, "");
  return x === y;
}

function count(source, match) {
  let result = 0;
  let index = 0;
  while ((index = source.indexOf(match, index)) !== -1) {
    result++;
    index += match.length;
  }
  return result;
}

module.exports = {
  BaseGenerator,
  indent,
  isBlank,
  removeEnd,
  areStrictEqual,
  count,
};
