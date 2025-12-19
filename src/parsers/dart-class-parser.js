const DartClass = require("../models/dart-class");
const ClassField = require("../models/class-field");
const { count } = require("../generators/base-generator");
const { extractFromMap } = require("../utils/settings");

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

      function testPrefix(prefix) {
        const found = line.trim().startsWith(prefix);
        if (found) {
          clazz.classType = prefix.trim();
          return true;
        }
        return false;
      }

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
                  word.lastIndexOf(">") + 1
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
          const lineValid =
            !line.trimLeft().startsWith(clazz.name) &&
            !line.trimLeft().startsWith("//") &&
            !this.includesOne(line, ["{", "}", "=>", "@"], false) &&
            !this.includesOne(line, ["static", "set", "get", "return", "factory"]) &&
            !this.includesAll(line, ["final ", "="]) &&
            (clazz.constrStartsAtLine == null || line.includes("final ")) &&
            !line.replace(/\s/g, "").endsWith(");");

          if (lineValid) {
            let type = null;
            let name = null;
            let isFinal = false;
            let isConst = false;

            const words = line.trim().split(" ");
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
                  isVariable = isVariable && !this.includesOne(word, ["(", ")"]);
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
                linePos,
                isFinal,
                isConst
              );

              if (i > 0) {
                const prevLine = lines[i - 1];
                const commentParts = lines[i].split("//");
                const directives =
                  commentParts.length > 1 ? commentParts[1].trim() : "";

                prop.ignore = !!(directives === "ignore");
                prop.isEnum = !!(
                  prevLine.match(/^\s*\/\/(\s*)enum/) || directives === "enum"
                );

                const [from, to] = directives.split(",").map((x) => x.trim());

                if (from !== "") {
                  prop.fromCustom = extractFromMap(from);
                }
                if (to !== "") prop.toCustom = to ?? "";
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
