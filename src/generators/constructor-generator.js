const { BaseGenerator, removeEnd, indent } = require("./base-generator");
const { readSetting } = require("../utils/settings");
const ClassPart = require("../models/class-part");

class ConstructorGenerator extends BaseGenerator {
  /**
   * @param {import('../models/dart-class')} clazz
   * @param {import('../models/imports')} imports
   * @param {boolean} isFlutter
   */
  constructor(clazz, imports, isFlutter = false) {
    super(clazz, imports);
    this.isFlutter = isFlutter;
  }

  shouldGenerate() {
    return readSetting("constructor.enabled");
  }

  generate() {
    if (!this.shouldGenerate()) return;

    const clazz = this.clazz;
    const withDefaults = readSetting("constructor.default_values");
    const withImmutable = readSetting("constructor.immutable");

    let constr = "";
    let startBracket = "({";
    let endBracket = "})";

    if (withImmutable) {
      this.requiresImport(
        this.isFlutter ? "package:flutter/foundation.dart" : "package:meta/meta.dart"
      );
    }

    if (clazz.constr != null) {
      if (clazz.constr.trimLeft().startsWith("const") || withImmutable) {
        constr += "const ";
      }

      const fConstr = clazz.constr.replace("const", "").trimLeft();

      if (fConstr.startsWith(clazz.name + "([")) startBracket = "([";
      else if (fConstr.startsWith(clazz.name + "({")) startBracket = "({";
      else startBracket = "(";

      if (fConstr.includes("])")) endBracket = "])";
      else if (fConstr.includes("})")) endBracket = "})";
      else endBracket = ")";
    } else {
      if (clazz.isWidget || clazz.isImmutable || withImmutable)
        constr += "const ";
    }

    constr += clazz.name + startBracket + "\n";

    if (clazz.isWidget) {
      let hasKey = false;
      let clazzConstr = clazz.constr || "";
      for (let line of clazzConstr.split("\n")) {
        if (line.trim().startsWith("Key? key")) {
          hasKey = true;
          break;
        }
      }

      if (!hasKey) constr += "  Key? key,\n";
    }

    const oldProperties = this.findOldConstrProperties();
    for (let prop of oldProperties) {
      if (!prop.isThis) {
        constr += "  " + prop.text;
      }
    }

    for (let prop of clazz.properties) {
      const oldProperty = this.findConstrParameter(prop, oldProperties);
      if (oldProperty != null) {
        if (oldProperty.isThis) constr += "  " + oldProperty.text;
        continue;
      }

      const parameter = `this.${prop.name}`;

      constr += "  ";

      if (!prop.isNullable) {
        const hasDefault =
          withDefaults &&
          (prop.isPrimitive || prop.isCollection) &&
          prop.rawType != "dynamic";
        const isNamedConstr = startBracket == "({" && endBracket == "})";

        if (hasDefault) {
          constr += `${parameter} = ${prop.defValue},\n`;
        } else if (isNamedConstr) {
          constr += `required ${parameter},\n`;
        } else {
          constr += `${parameter},\n`;
        }
      } else {
        constr += `${parameter},\n`;
      }
    }

    const stdConstrEnd = () => {
      constr += endBracket + (clazz.isWidget ? " : super(key: key);" : ";");
    };

    if (clazz.constr != null) {
      let i = null;
      if (clazz.constr.includes(" : ")) i = clazz.constr.indexOf(" : ") + 1;
      else if (clazz.constr.trimRight().endsWith("{"))
        i = clazz.constr.lastIndexOf("{");

      if (i != null) {
        let ending = clazz.constr.substring(i, clazz.constr.length);
        constr += `${endBracket} ${ending}`;
      } else {
        stdConstrEnd();
      }
    } else {
      stdConstrEnd();
    }

    if (clazz.hasConstructor) {
      clazz.constrDifferent = !this.areStrictEqual(clazz.constr, constr);
      if (clazz.constrDifferent) {
        constr = removeEnd(indent(constr), "\n");
        this.replace(
          new ClassPart(
            "constructor",
            clazz.constrStartsAtLine,
            clazz.constrEndsAtLine,
            clazz.constr,
            constr
          )
        );
      }
    } else {
      clazz.constrDifferent = true;
      this.append(constr, true);
    }
  }

  findOldConstrProperties() {
    const clazz = this.clazz;
    if (
      !clazz.hasConstructor ||
      clazz.constrStartsAtLine == clazz.constrEndsAtLine
    ) {
      return [];
    }

    let oldConstr = "";
    let brackets = 0;
    let didFindConstr = false;
    for (let c of clazz.constr) {
      if (c == "(") {
        if (didFindConstr) oldConstr += c;
        brackets++;
        didFindConstr = true;
        continue;
      } else if (c == ")") {
        brackets--;
        if (didFindConstr && brackets == 0) break;
      }

      if (brackets >= 1) oldConstr += c;
    }

    oldConstr = this.removeStart(oldConstr, ["{", "["]);
    oldConstr = removeEnd(oldConstr, ["}", "]"]);

    let oldArguments = oldConstr.split("\n");
    const oldProperties = [];
    for (let arg of oldArguments) {
      let formatted = arg.replace("required", "").trim();
      if (formatted.indexOf("=") != -1) {
        formatted = formatted.substring(0, formatted.indexOf("=")).trim();
      }

      let name = null;
      let isThis = false;
      if (formatted.startsWith("this.")) {
        name = formatted.replace("this.", "");
        isThis = true;
      } else {
        const words = formatted.split(" ");
        if (words.length >= 1) {
          const w = words[1];
          if (w && w.trim().length > 0) name = w;
        }
      }

      if (name != null) {
        oldProperties.push({
          name: removeEnd(name.trim(), ","),
          text: arg.trim() + "\n",
          isThis: isThis,
        });
      }
    }

    return oldProperties;
  }

  /**
   * @param {import('../models/class-field') | string} prop
   * @param {{ "name": string; "text": string; "isThis": boolean; }[]} oldProps
   */
  findConstrParameter(prop, oldProps) {
    const name = typeof prop === "string" ? prop : prop.name;
    for (let oldProp of oldProps) {
      if (name === oldProp.name) {
        return oldProp;
      }
    }
    return null;
  }

  /**
   * @param {string} source
   * @param {string | any[]} start
   */
  removeStart(source, start) {
    if (Array.isArray(start)) {
      let result = source.trim();
      for (let s of start) {
        result = this.removeStart(result, s).trim();
      }
      return result;
    } else {
      return source.startsWith(start)
        ? source.substring(start.length, source.length)
        : source;
    }
  }

  /**
   * @param {string} a
   * @param {string} b
   */
  areStrictEqual(a, b) {
    let x = a.replace(/\s/g, "");
    let y = b.replace(/\s/g, "");
    return x === y;
  }
}

module.exports = ConstructorGenerator;
