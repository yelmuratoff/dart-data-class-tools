const { toVarName, varToKey } = require("../utils/string-utils");

class ClassField {
  /**
   * @param {String} type
   * @param {String} name
   * @param {number} line
   * @param {boolean} isFinal
   * @param {boolean} isConst
   * @param {boolean} json
   */
  constructor(
    type,
    name,
    line = 1,
    isFinal = true,
    isConst = false,
    json = false,
  ) {
    this.rawType = type;
    this.name = toVarName(name);
    this.key = json ? name : varToKey(this.name);
    this.line = line;
    this.isFinal = isFinal;
    this.isConst = isConst;
    this.isEnum = false;
    this.ignore = false;
    this.fromCustom = ["", "", "", ""];
    this.toCustom = "";
    // Raw expression support for full control (@from:, @to: syntax)
    this.rawFromExpr = null;
    this.rawToExpr = null;
    this.isCollectionType = (/** @type {string} */ type) =>
      this.rawType == type || this.rawType.startsWith(type + "<");
  }

  get type() {
    return this.isNullable ? this.rawType.slice(0, -1) : this.rawType;
  }

  /**
   * Check if field has custom fromMap logic (either raw expression or parsed directive)
   */
  get isCustomFrom() {
    // Raw expression takes precedence
    if (this.rawFromExpr !== null && this.rawFromExpr.trim() !== "") {
      return true;
    }
    // Relaxed check: at least first element (method) or third element (typedef) must be non-empty
    return this.fromCustom[0].trim() !== "" || this.fromCustom[2].trim() !== "";
  }

  /**
   * Check if field has custom toMap logic (either raw expression or parsed directive)
   */
  get isCustomTo() {
    if (this.rawToExpr !== null && this.rawToExpr.trim() !== "") {
      return true;
    }
    return this.toCustom.trim() !== "";
  }

  /**
   * Check if field uses raw expression for fromMap
   */
  get isRawFrom() {
    return this.rawFromExpr !== null && this.rawFromExpr.trim() !== "";
  }

  /**
   * Check if field uses raw expression for toMap
   */
  get isRawTo() {
    return this.rawToExpr !== null && this.rawToExpr.trim() !== "";
  }

  get hasNullCheck() {
    return (
      (!this.isPrimitive || this.isCollection) &&
      this.isNullable &&
      !this.ignore
    );
  }

  get isNullable() {
    return this.rawType.endsWith("?");
  }

  get nullSafe() {
    return this.isNullable ? "?" : "";
  }

  get isList() {
    return this.isCollectionType("List");
  }

  get isMap() {
    return this.isCollectionType("Map");
  }

  get isSet() {
    return this.isCollectionType("Set");
  }

  get isCollection() {
    return this.isList || this.isMap || this.isSet;
  }

  get subtype() {
    if (this.isList || this.isSet) {
      const collection = this.isSet ? "Set" : "List";
      const sb = this.rawType.indexOf("<");
      const eb = this.rawType.lastIndexOf(">");
      const type =
        this.rawType == collection
          ? "dynamic"
          : this.rawType.substring(sb + 1, eb).trim();
      return new ClassField(type, "subtype", this.line, this.isFinal);
    }
    if (this.isMap) {
      const sb = this.rawType.lastIndexOf(",") + 1;
      const eb = this.rawType.lastIndexOf(">");
      const valueType = this.rawType.substring(sb, eb).trim();
      return new ClassField(valueType, "subtype", this.line, this.isFinal);
    }
    return null;
  }

  get mapKeyType() {
    if (this.isMap) {
      const sb = this.rawType.indexOf("<") + 1;
      const eb = this.rawType.lastIndexOf(",");
      return this.rawType.substring(sb, eb).trim();
    }
    return null;
  }

  get isSubtype() {
    return this.name === "subtype";
  }

  get isPrimitive() {
    const t = this.type;
    return (
      t == "String" ||
      t == "num" ||
      t == "dynamic" ||
      t == "bool" ||
      this.isDouble ||
      this.isInt
    );
  }

  /**
   * Check if field type is a generic type parameter (T, K, V, E, etc.)
   * These are single uppercase letters, possibly with bounds after 'extends'
   * Examples: T, K, V, E, S, R
   */
  get isGenericTypeParameter() {
    const t = this.type;
    // Single uppercase letter (A-Z) that's not a known type
    const knownTypes = ["String", "Object", "Null", "Never"];
    if (knownTypes.includes(t)) return false;
    // Match single uppercase letter
    return /^[A-Z]$/.test(t);
  }

  get base() {
    switch (this.type) {
      case "List":
        return "Iterable";
      case "Set":
        return "Iterable";
      case "int":
        return "num";
      case "double":
        return "num";
      default:
        return this.type;
    }
  }

  get isPrivate() {
    return this.name.startsWith("_");
  }

  get defValue() {
    if (this.isList) {
      return "const []";
    } else if (this.isMap || this.isSet) {
      return "const {}";
    } else {
      switch (this.type) {
        case "String":
          return "''";
        case "num":
        case "int":
          return "0";
        case "double":
          return "0.0";
        case "bool":
          return "false";
        case "dynamic":
          return "null";
        default:
          return `${this.type}()`;
      }
    }
  }

  get isInt() {
    return this.type == "int";
  }

  get isDouble() {
    return this.type == "double";
  }
}

module.exports = ClassField;
