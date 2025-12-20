const { BaseGenerator } = require("./base-generator");
const { readSetting, getTrailingComma } = require("../utils/settings");

class CopyWithGenerator extends BaseGenerator {
  shouldGenerate() {
    return readSetting("copyWith.enabled") && !this.clazz.isAbstract;
  }

  generate() {
    if (!this.shouldGenerate()) return;

    const clazz = this.clazz;
    const requireAll = readSetting("copyWith.required_params");
    const trailingComma = getTrailingComma();

    // Sentinel is only needed when NOT using required params and there are nullable/dynamic fields
    const propertiesRequiringSentinel = clazz.properties.filter(
      (prop) => prop.isNullable || prop.rawType === "dynamic"
    );

    const needsSentinel = !requireAll && propertiesRequiringSentinel.length > 0;

    if (
      needsSentinel &&
      !clazz.classContent.includes("_sentinel") &&
      !clazz.toInsert.includes("_sentinel")
    ) {
      clazz.toInsert =
        "\n  static const Object _sentinel = Object();" + clazz.toInsert;
    }

    let method = clazz.type + " copyWith({\n";

    for (let i = 0; i < clazz.properties.length; i++) {
      const prop = clazz.properties[i];
      const isLast = i === clazz.properties.length - 1;
      const comma = isLast ? trailingComma : ",";

      if (requireAll) {
        method += `  required ${prop.rawType} ${prop.name}${comma}\n`;
      } else if (prop.isNullable || prop.rawType === "dynamic") {
        method += `  Object? ${prop.name} = _sentinel${comma}\n`;
      } else {
        method += `  ${prop.type}? ${prop.name}${comma}\n`;
      }
    }

    method += "}) {\n";
    method += `  return ${clazz.type}(\n`;

    for (let i = 0; i < clazz.properties.length; i++) {
      const p = clazz.properties[i];
      const isLast = i === clazz.properties.length - 1;
      const comma = isLast ? trailingComma : ",";

      let assignment;
      if (requireAll) {
        // Direct assignment - no sentinel or null coalescing needed
        assignment = p.name;
      } else if (p.isNullable || p.rawType === "dynamic") {
        assignment = `${p.name} == _sentinel ? this.${p.name} : (${p.name} as ${p.rawType})`;
      } else {
        assignment = `${p.name} ?? this.${p.name}`;
      }

      method += `    ${
        clazz.hasNamedConstructor ? `${p.name}: ` : ""
      }${assignment}${comma}\n`;
    }

    method += "  );\n";
    method += "}";

    this.appendOrReplace("copyWith", method, `${clazz.name} copyWith(`);
  }
}

module.exports = CopyWithGenerator;
