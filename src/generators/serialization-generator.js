const { BaseGenerator } = require("./base-generator");
const { readSetting, readCustomTypeSetting, extractFromMap } = require("../utils/settings");
const ClassField = require("../models/class-field");

class SerializationGenerator extends BaseGenerator {
  shouldGenerateToMap() {
    return readSetting("toMap.enabled") && !this.clazz.isAbstract;
  }

  shouldGenerateFromMap() {
    return readSetting("fromMap.enabled") && !this.clazz.isAbstract;
  }

  shouldGenerateToJson() {
    return readSetting("toJson.enabled") && !this.clazz.isAbstract;
  }

  shouldGenerateFromJson() {
    return readSetting("fromJson.enabled") && !this.clazz.isAbstract;
  }

  generate() {
    if (this.shouldGenerateToMap()) this.generateToMap();
    if (this.shouldGenerateFromMap()) this.generateFromMap();
    if (this.shouldGenerateToJson()) this.generateToJson();
    if (this.shouldGenerateFromJson()) this.generateFromJson();
  }

  generateToMap() {
    const clazz = this.clazz;
    const props = clazz.properties;

    /**
     * @param {ClassField} prop
     * @param {string} name
     * @param {string} endFlag
     */
    const customTypeMapping = (prop, name = null, endFlag = ",\n") => {
      let nullSafe = "";

      if (prop.isCollection) {
        nullSafe = prop.rawType.match(/<(.+?)>/)[1].endsWith("?") ? "?" : "";
      } else {
        nullSafe = prop.isNullable ? "?" : "";
      }

      const typeSetting = readCustomTypeSetting(prop.type);

      if (typeSetting) {
        if (typeSetting.toMap === "") {
          return `${name ?? prop.name}${endFlag}`;
        }
        return `${name ?? prop.name}${nullSafe}.${typeSetting.toMap}${endFlag}`;
      }

      prop = prop.isCollection ? prop.subtype : prop;
      name = name == null ? prop.name : name;

      return `${name}${
        !prop.isPrimitive ? `${nullSafe}.toMap()` : ""
      }${endFlag}`;
    };

    let method = `Map<String, dynamic> toMap() {\n`;
    method += "  return {\n";
    for (let p of props) {
      method += `    '${p.key}': `;
      const nullSafe = p.isNullable ? "?" : "";

      if (p.ignore) {
        method += `${p.name},\n`;
      } else if (p.isCustomTo) {
        method += `${p.name}${nullSafe}.${p.toCustom},\n`;
      } else if (p.isEnum) {
        const setting = readSetting("json.enum_format");
        const toEnum = setting === "byIndex" ? "index" : "name";

        method += `${p.name}${nullSafe}.${toEnum},\n`;
      } else if (p.isCollection) {
        const nullSafeSub = p.type.match(/<(.+?)>/)[1].endsWith("?") ? "?" : "";

        if (p.isMap || p.subtype.isPrimitive || p.subtype.isMap) {
          const mapFlag = p.isSet ? `${nullSafe}.toList()` : "";
          method += `${p.name}${mapFlag},\n`;
        } else {
          method += `${p.name}${nullSafe}.map((x) => ${customTypeMapping(
            p.subtype,
            "x",
            ""
          )})${nullSafeSub}.toList(),\n`;
        }
      } else {
        method += customTypeMapping(p);
      }
      if (p.name == props[props.length - 1].name) method += "  };\n";
    }
    method += "}";

    this.appendOrReplace(
      "toMap",
      method,
      "Map<String, dynamic> toMap()"
    );
  }

  generateFromMap() {
    const clazz = this.clazz;
    const withDefaultValues = readSetting("fromMap.default_values");
    const withStrictNumbers = readSetting("strict_numbers");
    const props = clazz.properties;

    /**
     * @param {ClassField} p
     */
    const retype = (p) => {
      let type = p.type;
      let suffix = "";

      if (!withStrictNumbers && (p.isInt || p.isDouble)) {
        type = "num";
        suffix = p.isDouble ? ".toDouble()" : ".toInt()";
      } else if (p.isList || p.isSet) {
        type = "Iterable";

        if (p.subtype.isMap) {
          suffix = `.map((x) => ${p.subtype.rawType}.from(x as Map))`;
        } else if (p.subtype.isCollection) {
          suffix = `.map((x) => ${p.subtype.rawType}.from(x as Iterable))`;
        }
      } else if (p.isMap) {
        type = "Map";
      }

      let nullable =
        (p.isNullable || withDefaultValues) && !p.hasNullCheck ? "?" : "";
      type += nullable;

      suffix = nullable && suffix ? "?" + suffix : suffix;

      return [type, suffix];
    };

    /**
     * @param {ClassField} p
     * @param {string} customType
     */
    const cast = (p, customType = null) => {
      const [type, suffix] = retype(p);
      return `cast<${customType ?? type}>('${p.key}')${suffix}`;
    };

    /**
     * @param {ClassField} p
     */
    const customTypeMapping = (p) => {
      const defVal = (value) => {
        if (!value) return "";
        return withDefaultValues && !p.isNullable ? ` ?? ${value}` : "";
      };

      const typeSetting = readCustomTypeSetting(p.type);

      if (typeSetting) {
        if (typeSetting.fromMap === "") {
          return cast(p);
        }

        const [from, open1, typedef, close1] = extractFromMap(
          typeSetting.fromMap
        );
        const [stype, def] = typedef.split("??").map((i) => (i ?? "").trim());

        const hasDef = (def ?? "") !== "" && !p.hasNullCheck;
        const defValue = hasDef ? ` ?? ${def}` : "";

        const type = stype === "" ? p.type : stype;
        const dot = from === "" ? "" : `.${from}`;

        const localWithDefaultValues = readSetting("fromMap.default_values");

        if (p.isSubtype) {
          const inclass = new ClassField(stype, "type", p.line);
          let [intype, suffix] = retype(inclass);

          const [open2, close2] = suffix === "" ? ["", ""] : ["(", ")"];

          if (localWithDefaultValues) {
            suffix += ` ?? ${inclass.defValue}`;
          }

          const castExpr = `${open2}x as ${intype}${hasDef ? "?" : ""}${close2}${suffix}`;
          const nullGuard = hasDef ? `x != null ? ${p.type}${dot}${open1}${castExpr}${close1} : null` : `${p.type}${dot}${open1}${castExpr}${close1}`;
          return nullGuard;
        }

        return `${p.type}${dot}${open1}cast<${type}${hasDef ? "?" : ""}>('${
          p.key
        }')${defValue}${close1}`;
      }

      if (p.isSubtype) {
        return `${p.type}.fromMap(Map.from(x as Map))`;
      }
      return `${p.type}.fromMap(Map.from(${cast(p, "Map")}${defVal("{}")}))`;
    };

    const customError = readSetting("custom.argumentError");

    let method = `factory ${clazz.name}.fromMap(Map<String, dynamic> map) {\n`;
    method += `   T cast<T>(String k) => map[k] is T ? map[k] as T : ${customError}\n`;
    method += "  return " + clazz.type + "(\n";
    for (let p of props) {
      method += `    ${clazz.hasNamedConstructor ? `${p.name}: ` : ""}`;

      const value = cast(p);
      const hasNullCheck = p.hasNullCheck;

      if (hasNullCheck) {
        method += `map['${p.key}'] != null ? `;
      }

      const defVal = (value) => {
        return withDefaultValues && !p.isNullable ? ` ?? ${value}` : "";
      };

      if (p.ignore) {
        method += `cast<${p.rawType}>('${p.key}')`;
      } else if (p.isCustomFrom) {
        const [from, open, typedef, close] = p.fromCustom;
        const [type, def] = typedef.split("??").map((i) => (i ?? "").trim());

        const hasDef = (def ?? "") !== "" && !p.hasNullCheck;
        const putDef = hasDef ? ` ?? ${def}` : "";

        method += `${p.type}.${from}${open}cast<${type}${hasDef ? "?" : ""}>('${
          p.key
        }')${putDef}${close}`;
      } else if (p.isEnum) {
        const setting = readSetting("json.enum_format");
        const evalues = p.type + ".values";

        if (setting === "byIndex") {
          p.rawType = "int";
          method += `${evalues}[${cast(p)}${defVal("0")}]`;
        } else {
          p.rawType = "String";
          method += `${evalues}.byName(${cast(p)}${defVal(
            `${evalues}.first.name`
          )})`;
        }
      } else if (p.isCollection) {
        let listSubtype = p.type.match(/<(.+?)>/)[1];
        if (listSubtype.startsWith("Map")) listSubtype = listSubtype + ">";

        const defaultValue =
          withDefaultValues && !p.isNullable
            ? ` ?? const ${
                p.isMap
                  ? "{}"
                  : p.isList
                  ? `<${listSubtype}>[]`
                  : `<${listSubtype}>{}`
              }`
            : "";

        method += `${p.type}.from(`;
        if (p.subtype.isPrimitive || p.subtype.isCollection) {
          method += `${value}${defaultValue})`;
        } else {
          const qm = defaultValue === "" ? "" : "?";
          method += `cast<Iterable${qm}>('${
            p.key
          }')${qm}.map((x) => ${customTypeMapping(p.subtype)})${defaultValue})`;
        }
      } else if (p.isPrimitive) {
        const defaultValue =
          withDefaultValues && !p.isNullable ? ` ?? ${p.defValue} ` : "";
        method += `${value}${defaultValue}`;
      } else {
        method += customTypeMapping(p);
      }

      if (hasNullCheck) {
        method += ` : null`;
      }

      method += ",\n";

      const isLast = p.name == props[props.length - 1].name;
      if (isLast) method += "  );\n";
    }
    method += "}";

    this.appendOrReplace(
      "fromMap",
      method,
      `factory ${clazz.name}.fromMap(Map<String, dynamic> map)`
    );
  }

  generateToJson() {
    this.requiresImport("dart:convert");

    const method = "String toJson() => json.encode(toMap());";
    this.appendOrReplace("toJson", method, "String toJson()");
  }

  generateFromJson() {
    this.requiresImport("dart:convert");

    const clazz = this.clazz;
    const method = `factory ${clazz.name}.fromJson(String source) => ${clazz.name}.fromMap(json.decode(source) as Map<String, dynamic>);`;
    this.appendOrReplace(
      "fromJson",
      method,
      `factory ${clazz.name}.fromJson(String source)`
    );
  }
}

module.exports = SerializationGenerator;
