const { BaseGenerator } = require("./base-generator");
const { readSetting } = require("../utils/settings");

const HASH_THRESHOLD = 15; // Switch to hashAll when more than 15 fields

class EqualityGenerator extends BaseGenerator {
  /**
   * @param {import('../models/dart-class')} clazz
   * @param {import('../models/imports')} imports
   * @param {boolean} isFlutter
   */
  constructor(clazz, imports, isFlutter = false) {
    super(clazz, imports);
    this.isFlutter = isFlutter;
  }

  shouldGenerateEquality() {
    return readSetting("equality.enabled");
  }

  shouldGenerateHashCode() {
    return readSetting("hashCode.enabled");
  }

  shouldGenerateEquatable() {
    return this.clazz.usesEquatable || readSetting("useEquatable");
  }

  generate() {
    if (this.shouldGenerateEquatable()) {
      this.generateEquatable();
    } else {
      if (this.shouldGenerateEquality()) this.generateEquality();
      if (this.shouldGenerateHashCode()) this.generateHashCode();
    }
  }

  generateEquality() {
    const clazz = this.clazz;
    const props = clazz.properties;
    const hasCollection = props.find((p) => p.isCollection) != undefined;

    let collectionEqualityFn;
    if (hasCollection) {
      if (this.isFlutter) {
        this.requiresImport("package:flutter/foundation.dart");
      } else {
        this.requiresImport("package:collection/collection.dart");

        collectionEqualityFn = "collectionEquals";
        const isListOnly =
          props.find((p) => p.isCollection && !p.isList) == undefined;
        if (isListOnly) collectionEqualityFn = "listEquals";
        const isMapOnly =
          props.find((p) => p.isCollection && !p.isMap) == undefined;
        if (isMapOnly) collectionEqualityFn = "mapEquals";
        const isSetOnly =
          props.find((p) => p.isCollection && !p.isSet) == undefined;
        if (isSetOnly) collectionEqualityFn = "setEquals";
      }
    }

    let method = "@override\n";
    method += "bool operator ==(Object other) {\n";
    method += "  if (identical(this, other)) return true;\n";
    if (hasCollection && !this.isFlutter)
      method += `  final ${collectionEqualityFn} = const DeepCollectionEquality().equals;\n`;
    method += "\n";
    method += "  return other is " + clazz.type + " &&\n";
    for (let prop of props) {
      if (prop.isCollection) {
        if (this.isFlutter)
          collectionEqualityFn = prop.isSet
            ? "setEquals"
            : prop.isMap
            ? "mapEquals"
            : "listEquals";
        method += `    ${collectionEqualityFn}(other.${prop.name}, ${prop.name})`;
      } else {
        method += `    other.${prop.name} == ${prop.name}`;
      }
      if (prop.name != props[props.length - 1].name) method += " &&\n";
      else method += ";\n";
    }
    method += "}";

    this.appendOrReplace("equality", method, "bool operator ==");
  }

  generateHashCode() {
    const useJenkins = readSetting("hashCode.use_jenkins");
    const props = this.clazz.properties;
    let method = "@override\n";

    if (useJenkins) {
      this.requiresImport("dart:ui", [
        "package:flutter/material.dart",
        "package:flutter/cupertino.dart",
        "package:flutter/widgets.dart",
      ]);

      method += "int get hashCode {\n";
      method += "  return hashList([\n";
      for (let p of props) {
        method += "    " + p.name + `,\n`;
      }
      method += "  ]);\n";
      method += "}";
    } else {
      const short = props.length <= 3;
      method += `int get hashCode ${short ? "=> " : "{\n  return "}`;

      if (props.length === 1) {
        method += `${props[0].name}.hashCode;`;
      } else if (props.length <= HASH_THRESHOLD) {
        // Use Object.hash for up to HASH_THRESHOLD fields
        method += "Object.hash(\n";
        for (let i = 0; i < props.length; i++) {
          method += `${short ? " " : "    "}${props[i].name}${
            i == props.length - 1 ? "" : ","
          }${short ? "" : "\n"}`;
        }
        method += `${short ? " " : "  "});`;
      } else {
        // Use Object.hashAll for more than HASH_THRESHOLD fields
        method += "Object.hashAll([\n";
        for (let p of props) {
          method += "    " + p.name + `,\n`;
        }
        method += "  ]);";
      }

      if (!short) method += "\n}";
    }

    this.appendOrReplace("hashCode", method, "int get hashCode");
  }

  generateEquatable() {
    this.addEquatableDetails();

    const props = this.clazz.properties;
    const short = props.length <= 4;
    const split = short ? ", " : ",\n";
    let method = "@override\n";
    method += `List<Object?> get props ${!short ? "{\n" : "=>"}`;
    method += `${!short ? "  return" : ""} ` + "[" + (!short ? "\n" : "");
    for (let prop of props) {
      const isLast = prop.name == props[props.length - 1].name;
      const inset = !short ? "    " : "";
      method += inset + prop.name + split;

      if (isLast) {
        if (short) method = method.slice(0, -split.length);
        method += (!short ? "  " : "") + "];" + (!short ? "\n" : "");
      }
    }
    method += !short ? "}" : "";

    this.appendOrReplace("props", method, "List<Object?> get props");
  }

  addEquatableDetails() {
    const clazz = this.clazz;

    // Do not generate Equatable for class with 'Base' in their names
    if (clazz.hasSuperclass && clazz.superclass.includes("Base")) return;

    this.requiresImport("package:equatable/equatable.dart");

    if (!clazz.usesEquatable) {
      if (clazz.hasSuperclass) {
        this.addMixin("EquatableMixin");
      } else {
        this.setSuperClass("Equatable");
      }
    }
  }

  /**
   * @param {string} mixin
   */
  addMixin(mixin) {
    const mixins = this.clazz.mixins;
    if (!mixins.includes(mixin)) {
      mixins.push(mixin);
    }
  }

  /**
   * @param {string} superClass
   */
  setSuperClass(superClass) {
    this.clazz.superclass = superClass;
  }
}

module.exports = EqualityGenerator;
