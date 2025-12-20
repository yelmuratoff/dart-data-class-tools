const { readSetting } = require("../utils/settings");
const { removeEnd } = require("../generators/base-generator");

class DartClass {
  constructor() {
    /** @type {string} */
    this.name = null;
    /** @type {string} */
    this.fullGenericType = "";
    /** @type {string} */
    this.superclass = null;
    /** @type {string[]} */
    this.interfaces = [];
    /** @type {string[]} */
    this.mixins = [];
    /** @type {string} */
    this.constr = null;
    /** @type {import('./class-field')[]} */
    this.properties = [];
    /** @type {number} */
    this.startsAtLine = null;
    /** @type {number} */
    this.endsAtLine = null;
    /** @type {number} */
    this.constrStartsAtLine = null;
    /** @type {number} */
    this.constrEndsAtLine = null;
    this.constrDifferent = false;
    this.isArray = false;
    this.hasImmutableAnnotation = false;
    this.classContent = "";
    this.classType = "class";
    this.toInsert = "";
    /** @type {import('./class-part')[]} */
    this.toReplace = [];
    this.isLastInFile = false;
  }

  get type() {
    return this.name + this.genericType;
  }

  get genericType() {
    const parts = this.fullGenericType.split(",");
    return parts
      .map((type) => {
        let part = type.trim();
        if (part.includes("extends")) {
          part = part.substring(0, part.indexOf("extends")).trim();
          if (type === parts[parts.length - 1]) {
            part += ">";
          }
        }
        return part;
      })
      .join(", ");
  }

  get propsEndAtLine() {
    if (this.properties.length > 0) {
      return this.properties[this.properties.length - 1].line;
    } else {
      return -1;
    }
  }

  get hasSuperclass() {
    return this.superclass != null;
  }

  get classDetected() {
    return this.startsAtLine != null;
  }

  get didChange() {
    return (
      this.toInsert.length > 0 ||
      this.toReplace.length > 0 ||
      this.constrDifferent
    );
  }

  get hasNamedConstructor() {
    if (this.constr != null) {
      return this.constr
        .replace("const", "")
        .trimLeft()
        .startsWith(this.name + "({");
    }
    return true;
  }

  get hasConstructor() {
    return (
      this.constrStartsAtLine != null &&
      this.constrEndsAtLine != null &&
      this.constr != null
    );
  }

  get hasMixins() {
    return this.mixins != null && this.mixins.length > 0;
  }

  get hasInterfaces() {
    return this.interfaces != null && this.interfaces.length > 0;
  }

  get hasEnding() {
    return this.endsAtLine != null;
  }

  get hasProperties() {
    return this.properties.length > 0;
  }

  get fewProps() {
    return this.properties.length <= 3;
  }

  get isValid() {
    return (
      this.classDetected &&
      this.hasEnding &&
      this.hasProperties &&
      this.uniquePropNames
    );
  }

  get isWidget() {
    return (
      this.superclass != null &&
      (this.superclass == "StatelessWidget" ||
        this.superclass == "StatefulWidget")
    );
  }

  get isStatelessWidget() {
    return (
      this.isWidget &&
      this.superclass != null &&
      this.superclass == "StatelessWidget"
    );
  }

  get isState() {
    return (
      !this.isWidget &&
      this.superclass != null &&
      this.superclass.startsWith("State<")
    );
  }

  get isAbstract() {
    return (
      this.classType == "abstract class" || this.classType == "sealed class"
    );
  }

  get isImmutable() {
    return this.properties.every((prop) => prop.isFinal || prop.isConst);
  }

  /**
   * Check if class can have a const constructor.
   * Requires all fields to be final AND no non-const-eligible types.
   */
  get canBeConst() {
    if (!this.isImmutable) return false;

    // These types can be used in const constructors
    const CONST_ELIGIBLE_TYPES = [
      "String",
      "int",
      "double",
      "num",
      "bool",
      "dynamic",
      "Object",
      "List",
      "Map",
      "Set", // Collections with const literals
    ];

    return this.properties.every((prop) => {
      const baseType = prop.type.replace(/[<>?].*/, ""); // Remove generics and nullability
      return (
        CONST_ELIGIBLE_TYPES.includes(baseType) ||
        prop.isEnum ||
        prop.isCollection
      );
    });
  }

  get usesEquatable() {
    return (
      (this.hasSuperclass && this.superclass == "Equatable") ||
      (this.hasMixins && this.mixins.includes("EquatableMixin"))
    );
  }

  get issue() {
    const def = this.name + " couldn't be converted to a data class: ";
    let msg = def;

    if (!this.hasProperties) {
      msg += "Class must have at least one property!";
    } else if (!this.hasEnding) {
      msg += "Class has no ending!";
    } else if (!this.uniquePropNames) {
      msg += "Class doesn't have unique property names!";
    } else {
      msg = removeEnd(msg, ": ") + ".";
    }

    return msg;
  }

  get uniquePropNames() {
    let props = [];
    for (let p of this.properties) {
      const n = p.name;
      if (props.includes(n)) return false;
      props.push(n);
    }
    return true;
  }

  /**
   * @param {number} line
   */
  replacementAtLine(line) {
    for (let part of this.toReplace) {
      if (part.startsAt <= line && part.endsAt >= line) {
        return part.replacement;
      }
    }
    return null;
  }

  generateClassReplacement() {
    let replacement = "";
    let lines = this.classContent.split("\n");

    const copyWithPart = this.toReplace.find((p) => p.name === "copyWith");
    let needsSentinel = copyWithPart
      ? copyWithPart.replacement.includes("_sentinel")
      : this.toInsert.includes("_sentinel");

    if (!needsSentinel) {
      const remainingContent = lines
        .filter(
          (line) => !line.includes("static const Object _sentinel = Object();")
        )
        .join("\n");
      if (remainingContent.includes("_sentinel")) {
        needsSentinel = true;
      }
    }

    for (let i = this.endsAtLine - this.startsAtLine; i >= 0; i--) {
      let line = lines[i] + "\n";
      let l = this.startsAtLine + i;

      if (
        !needsSentinel &&
        line.includes("static const Object _sentinel = Object();")
      ) {
        continue;
      }

      if (i == 0) {
        let classDeclaration = "";

        if (
          readSetting("constructor.immutable") &&
          !this.hasImmutableAnnotation
        ) {
          classDeclaration += "@immutable\n";
        }

        classDeclaration +=
          this.classType + " " + this.name + this.fullGenericType;

        if (this.superclass != null) {
          classDeclaration += " extends " + this.superclass;
        }

        /**
         * @param {string[]} list
         * @param {string} keyword
         */
        const addSuperTypes = (list, keyword) => {
          if (list.length == 0) return;

          const length = list.length;
          classDeclaration += ` ${keyword} `;

          for (let x = 0; x < length; x++) {
            const isLast = x == length - 1;
            const type = list[x];
            classDeclaration += type;

            if (!isLast) {
              classDeclaration += ", ";
            }
          }
        };

        addSuperTypes(this.mixins, "with");
        addSuperTypes(this.interfaces, "implements");

        classDeclaration += " {\n";
        replacement = classDeclaration + replacement;
      } else if (
        l == this.propsEndAtLine &&
        this.constr != null &&
        !this.hasConstructor
      ) {
        replacement = this.constr + replacement;
        replacement = line + replacement;
      } else if (l == this.endsAtLine && this.isValid) {
        replacement = line + replacement;
        replacement = this.toInsert + replacement;
      } else {
        let rp = this.replacementAtLine(l);
        if (rp != null) {
          if (!replacement.includes(rp)) replacement = rp + "\n" + replacement;
        } else {
          replacement = line + replacement;
        }
      }
    }

    replacement = removeEnd(replacement, "\n");
    replacement = replacement.replace(/\n\s*\n\s*\n/g, "\n\n");
    return replacement;
  }
}

module.exports = DartClass;
