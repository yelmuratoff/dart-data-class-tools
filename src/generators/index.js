const { BaseGenerator, indent, isBlank, removeEnd, areStrictEqual, count } = require("./base-generator");
const ConstructorGenerator = require("./constructor-generator");
const CopyWithGenerator = require("./copy-with-generator");
const SerializationGenerator = require("./serialization-generator");
const EqualityGenerator = require("./equality-generator");
const ToStringGenerator = require("./to-string-generator");

/**
 * Generator registry - applies Strategy pattern for extensibility
 */
class GeneratorRegistry {
  /**
   * @param {import('../models/dart-class')} clazz
   * @param {import('../models/imports')} imports
   * @param {boolean} isFlutter
   * @param {string} part - specific part to generate, or null for all
   */
  constructor(clazz, imports, isFlutter = false, part = null) {
    this.clazz = clazz;
    this.imports = imports;
    this.isFlutter = isFlutter;
    this.part = part;
  }

  /**
   * @param {string} partName
   */
  isPartSelected(partName) {
    return this.part == null || this.part == partName;
  }

  /**
   * Run all applicable generators
   */
  generateAll() {
    const clazz = this.clazz;

    // Constructor generator
    if (this.isPartSelected("constructor")) {
      const constructorGen = new ConstructorGenerator(clazz, this.imports, this.isFlutter);
      constructorGen.generate();
    }

    // Skip other generators for widgets
    if (clazz.isWidget) return;

    // Non-abstract class generators
    if (!clazz.isAbstract) {
      if (this.isPartSelected("copyWith")) {
        const copyWithGen = new CopyWithGenerator(clazz, this.imports);
        copyWithGen.generate();
      }

      if (this.isPartSelected("serialization")) {
        const serializationGen = new SerializationGenerator(clazz, this.imports);
        serializationGen.generate();
      }
    }

    // toString - for all non-widget classes
    if (this.isPartSelected("toString")) {
      const toStringGen = new ToStringGenerator(clazz, this.imports);
      toStringGen.generate();
    }

    // Equality - for all non-widget classes
    if (this.isPartSelected("equality") || this.isPartSelected("useEquatable")) {
      const equalityGen = new EqualityGenerator(clazz, this.imports, this.isFlutter);
      equalityGen.generate();
    }
  }
}

module.exports = {
  BaseGenerator,
  ConstructorGenerator,
  CopyWithGenerator,
  SerializationGenerator,
  EqualityGenerator,
  ToStringGenerator,
  GeneratorRegistry,
  // Utilities
  indent,
  isBlank,
  removeEnd,
  areStrictEqual,
  count,
};
