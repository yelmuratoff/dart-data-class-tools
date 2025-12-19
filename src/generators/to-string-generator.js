const { BaseGenerator } = require("./base-generator");
const { readSetting } = require("../utils/settings");

class ToStringGenerator extends BaseGenerator {
  shouldGenerate() {
    return readSetting("toString.enabled");
  }

  generate() {
    if (!this.shouldGenerate()) return;

    const clazz = this.clazz;
    const short = clazz.fewProps;
    const props = clazz.properties;
    let method = "@override\n";
    method += `String toString() ${short ? "=> " : "{\n"}`;
    method += `${short ? "" : "  return "}'''${clazz.name}(\n`;

    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      const name = p.name;
      const isLast = i === props.length - 1;
      method += `    ${name}: $${name}${isLast ? "" : ","}\n`;
    }

    method += "    )'''";
    method += short ? ";" : ";\n}";

    this.appendOrReplace("toString", method, "String toString()");
  }
}

module.exports = ToStringGenerator;
