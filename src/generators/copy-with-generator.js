const { BaseGenerator } = require("./base-generator");
const { readSetting } = require("../utils/settings");

class CopyWithGenerator extends BaseGenerator {
  shouldGenerate() {
    return readSetting("copyWith.enabled") && !this.clazz.isAbstract;
  }

  generate() {
    if (!this.shouldGenerate()) return;

    const clazz = this.clazz;
    const propertiesRequiringSentinel = clazz.properties.filter(
      (prop) => prop.isNullable || prop.rawType === "dynamic"
    );

    if (
      propertiesRequiringSentinel.length > 0 &&
      !clazz.classContent.includes("_sentinel") &&
      !clazz.toInsert.includes("_sentinel")
    ) {
      clazz.toInsert =
        "\n  static const Object _sentinel = Object();" + clazz.toInsert;
    }

    let method = clazz.type + " copyWith({\n";
    for (const prop of clazz.properties) {
      if (prop.isNullable || prop.rawType === "dynamic") {
        method += `  Object? ${prop.name} = _sentinel,\n`;
      } else {
        method += `  ${prop.type}? ${prop.name},\n`;
      }
    }

    method += "}) {\n";
    method += `  return ${clazz.type}(\n`;

    for (let p of clazz.properties) {
      const assignment =
        p.isNullable || p.rawType === "dynamic"
          ? `${p.name} == _sentinel ? this.${p.name} : (${p.name} as ${p.rawType})`
          : `${p.name} ?? this.${p.name}`;
      method += `    ${
        clazz.hasNamedConstructor ? `${p.name}: ` : ""
      }${assignment},\n`;
    }

    method += "  );\n";
    method += "}";

    this.appendOrReplace("copyWith", method, `${clazz.name} copyWith(`);
  }
}

module.exports = CopyWithGenerator;
