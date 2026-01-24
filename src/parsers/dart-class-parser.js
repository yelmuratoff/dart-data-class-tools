const DartClass = require("../models/dart-class");
const ClassField = require("../models/class-field");
const { count } = require("../generators/base-generator");
const {
  extractFromMap,
  smartSplit,
  parseRawDirective,
  isRawDirective,
} = require("../utils/settings");

/**
 * Parses Dart source code to extract class definitions
 */
class DartClassParser {
  /**
   * @param {string} text
   */
  constructor(text) {
    this.text = text;
  }

  /**
   * @returns {DartClass[]}
   */
  parse() {
    let clazzes = [];
    let clazz = new DartClass();

    let lines = this.text.split("\n");
    let curlyBrackets = 0;
    let brackets = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const linePos = i + 1;

      const prefixes = [
        "class ",
        "abstract class ",
        "sealed class ",
        "final class ",
      ];

      const testPrefix = (prefix) => {
        const found = line.trim().startsWith(prefix);
        if (found) {
          clazz.classType = prefix.trim();
          return true;
        }
        return false;
      };

      const classLine = prefixes.some(testPrefix);

      if (classLine) {
        clazz.startsAtLine = linePos;

        if (lines[linePos - 2] && lines[linePos - 2].includes("@immutable")) {
          clazz.hasImmutableAnnotation = true;
        }

        let classNext = false;
        let extendsNext = false;
        let implementsNext = false;
        let mixinsNext = false;

        curlyBrackets = 0;
        brackets = 0;

        const words = this.splitWhileMaintaingGenerics(line);
        for (let word of words) {
          word = word.trim();
          if (word.length > 0) {
            if (word == "class") {
              classNext = true;
            } else if (word == "extends") {
              extendsNext = true;
            } else if (extendsNext) {
              extendsNext = false;
              clazz.superclass = word;
            } else if (word == "with") {
              mixinsNext = true;
              extendsNext = false;
              implementsNext = false;
            } else if (word == "implements") {
              mixinsNext = false;
              extendsNext = false;
              implementsNext = true;
            } else if (classNext) {
              classNext = false;

              if (word.includes("<")) {
                clazz.fullGenericType = word.substring(
                  word.indexOf("<"),
                  word.lastIndexOf(">") + 1,
                );
                word = word.substring(0, word.indexOf("<"));
              }

              clazz.name = word;
            } else if (mixinsNext) {
              const mixin = this.removeEnd(word, ",").trim();
              if (mixin.length > 0) {
                clazz.mixins.push(mixin);
              }
            } else if (implementsNext) {
              const impl = this.removeEnd(word, ",").trim();
              if (impl.length > 0) {
                clazz.interfaces.push(impl);
              }
            }
          }
        }

        if (!clazz.isState) {
          clazzes.push(clazz);
        }
      }

      if (clazz.classDetected) {
        curlyBrackets += count(line, "{");
        curlyBrackets -= count(line, "}");
        brackets += count(line, "(");
        brackets -= count(line, ")");

        const includesConstr = line
          .replace("const", "")
          .trimLeft()
          .startsWith(clazz.name + "(");
        if (includesConstr && !classLine) {
          clazz.constrStartsAtLine = linePos;
        }

        if (
          clazz.constrStartsAtLine != null &&
          clazz.constrEndsAtLine == null
        ) {
          clazz.constr =
            clazz.constr == null ? line + "\n" : clazz.constr + line + "\n";

          if (brackets == 0) {
            clazz.constrEndsAtLine = linePos;
            clazz.constr = this.removeEnd(clazz.constr, "\n");
          }
        }

        clazz.classContent += line;
        if (curlyBrackets != 0) {
          clazz.classContent += "\n";
        } else {
          clazz.endsAtLine = linePos;
          clazz = new DartClass();
        }

        if (brackets == 0 && curlyBrackets == 1) {
          // Handle multi-line field declarations by accumulating lines
          let effectiveLine = line;
          let effectiveLinePos = linePos;
          let consumedPending = false;

          const trimmedLine = line.trim();
          const isIncompleteFieldDecl =
            (trimmedLine.startsWith("final ") ||
              trimmedLine.startsWith("const ")) &&
            !trimmedLine.includes(";") &&
            !trimmedLine.includes("(") &&
            !trimmedLine.includes("class ");

          // Check if previous line was an incomplete field declaration (has 'final' but no ';')
          // Only join if current line is NOT also an incomplete field declaration
          if (i > 0 && clazz._pendingFieldLine) {
            if (isIncompleteFieldDecl) {
              // Current line is a NEW incomplete field declaration
              // The previous pending field had no continuation - it's invalid, discard it
              // Save current line as new pending
              clazz._pendingFieldLine = trimmedLine;
              clazz._pendingFieldLinePos = linePos;
              continue;
            }

            // Current line is a continuation (has semicolon) - join with pending
            effectiveLine = clazz._pendingFieldLine + " " + trimmedLine;
            effectiveLinePos = clazz._pendingFieldLinePos;
            clazz._pendingFieldLine = null;
            clazz._pendingFieldLinePos = null;
            consumedPending = true;
          }

          // Check if current line is incomplete (starts with 'final' but no ';')
          // Only check this if we didn't just consume a pending line
          if (!consumedPending && isIncompleteFieldDecl) {
            clazz._pendingFieldLine = trimmedLine;
            clazz._pendingFieldLinePos = linePos;
            continue;
          }

          // Extract code part before comment for validation (ignore comment content)
          const codePartForValidation = effectiveLine.split("//")[0];

          const lineValid =
            !effectiveLine.trimLeft().startsWith(clazz.name) &&
            !effectiveLine.trimLeft().startsWith("//") &&
            !this.includesOne(
              codePartForValidation,
              ["{", "}", "=>", "@"],
              false,
            ) &&
            !this.includesOne(codePartForValidation, [
              "static",
              "set",
              "get",
              "return",
              "factory",
            ]) &&
            !this.includesAll(codePartForValidation, ["final ", "="]) &&
            (clazz.constrStartsAtLine == null ||
              effectiveLine.includes("final ")) &&
            !codePartForValidation.replace(/\s/g, "").endsWith(");");

          if (lineValid) {
            let type = null;
            let name = null;
            let isFinal = false;
            let isConst = false;

            // Use effectiveLine which may contain joined multi-line declaration
            const words = effectiveLine
              .trim()
              .split(" ")
              .filter((w) => w.length > 0);
            for (let j = 0; j < words.length; j++) {
              const word = words[j];
              const isLast = j == words.length - 1;

              if (word.length > 0 && word != "}" && word != "{") {
                if (word == "final") {
                  isFinal = true;
                } else if (j == 0 && word == "const") {
                  isConst = true;
                }

                if (word != "final" && word != "const") {
                  let isVariable =
                    word.endsWith(";") || (!isLast && words[j + 1] == "=");
                  isVariable =
                    isVariable && !this.includesOne(word, ["(", ")"]);
                  if (isVariable) {
                    if (name == null) name = this.removeEnd(word, ";");
                  } else {
                    if (type == null) type = word;
                    else if (name == null) type += " " + word;
                  }
                }
              }
            }

            if (type != null && name != null) {
              const prop = new ClassField(
                type,
                name,
                effectiveLinePos,
                isFinal,
                isConst,
              );

              // Extract directives from effectiveLine (which contains comments after //)
              // Note: rejoin with '//' in case directive contains URLs like https://
              const commentParts = effectiveLine.split("//");
              const directives =
                commentParts.length > 1
                  ? commentParts.slice(1).join("//").trim()
                  : "";

              prop.ignore = !!(directives === "ignore");

              // Check previous line for enum directive
              if (i > 0) {
                const prevLine = lines[i - 1];
                prop.isEnum = !!(
                  prevLine.match(/^\s*\/\/(\s*)enum/) || directives === "enum"
                );
              }

              // Check for raw directive syntax (@from: and @to:)
              if (isRawDirective(directives)) {
                const { rawFrom, rawTo } = parseRawDirective(directives);
                prop.rawFromExpr = rawFrom;
                prop.rawToExpr = rawTo;
              } else {
                // Use smart split that respects generic brackets
                const parts = smartSplit(directives);
                const from = (parts[0] || "").trim();
                const to = (parts[1] || "").trim();

                if (from !== "" && from !== "enum" && from !== "ignore") {
                  prop.fromCustom = extractFromMap(from);
                }
                if (to !== "") prop.toCustom = to;
              }

              clazz.properties.push(prop);
            }
          }
        }
      }
    }

    return clazzes;
  }

  /**
   * @param {string} line
   */
  splitWhileMaintaingGenerics(line) {
    let words = [];
    let index = 0;
    let generics = 0;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const isCurly = char == "{";
      const isSpace = char == " ";

      if (char == "<") generics++;
      if (char == ">") generics--;

      if (generics == 0 && (isSpace || isCurly)) {
        const word = line.substring(index, i).trim();

        if (word.length == 0) continue;
        const isOnlyGeneric = word.startsWith("<");

        if (isOnlyGeneric) {
          words[words.length - 1] = words[words.length - 1] + word;
        } else {
          words.push(word);
        }

        if (isCurly) {
          break;
        }

        index = i;
      }
    }

    return words;
  }

  /**
   * @param {string} source
   * @param {string} end
   */
  removeEnd(source, end) {
    const pos = source.length - end.length;
    return source.endsWith(end) ? source.substring(0, pos) : source;
  }

  /**
   * @param {string} source
   * @param {string[]} matches
   * @param {boolean} wordBased
   */
  includesOne(source, matches, wordBased = true) {
    const words = wordBased ? source.split(" ") : [source];
    for (let word of words) {
      for (let match of matches) {
        if (wordBased) {
          if (word === match) return true;
        } else {
          if (source.includes(match)) return true;
        }
      }
    }
    return false;
  }

  /**
   * @param {string} source
   * @param {string[]} matches
   */
  includesAll(source, matches) {
    for (let match of matches) {
      if (!source.includes(match)) return false;
    }
    return true;
  }
}

module.exports = DartClassParser;
