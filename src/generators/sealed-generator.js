const { BaseGenerator } = require("./base-generator");
const { readSetting } = require("../utils/settings");

/**
 * Generator for sealed class Result type hierarchies.
 * Generates Success and Failure subclasses for sealed Result/Either patterns.
 */
class SealedGenerator extends BaseGenerator {
  shouldGenerate() {
    return (
      readSetting("sealed.enabled") && this.clazz.classType === "sealed class"
    );
  }

  generate() {
    if (!this.shouldGenerate()) return;

    const clazz = this.clazz;
    const genericType = clazz.fullGenericType; // e.g., "<T, E>" or "<T>" or ""

    // Parse generic parameters
    const generics = this.parseGenerics(genericType);

    // Determine if this is a Result-like pattern (has 2 type params)
    if (generics.length < 1) return; // Need at least one generic

    const dataType = generics[0] || "T";
    const errorType = generics[1] || "Object";

    // Generate Success subclass
    const successClass = this.generateSuccessClass(
      clazz.name,
      genericType,
      dataType
    );

    // Generate Failure subclass (only if we have 2+ generics or it's named Result/Either)
    const isResultPattern =
      generics.length >= 2 ||
      clazz.name.toLowerCase().includes("result") ||
      clazz.name.toLowerCase().includes("either");

    let failureClass = "";
    if (isResultPattern) {
      failureClass = this.generateFailureClass(
        clazz.name,
        genericType,
        errorType
      );
    }

    // Append to class content
    clazz.toInsert += "\n" + successClass;
    if (failureClass) {
      clazz.toInsert += "\n\n" + failureClass;
    }
  }

  /**
   * Parse generics string like "<T, E extends Object>" into array of type names
   * @param {string} genericType
   * @returns {string[]}
   */
  parseGenerics(genericType) {
    if (!genericType || genericType.length < 3) return [];

    // Remove < and >
    const inner = genericType.slice(1, -1).trim();
    if (!inner) return [];

    // Split by comma, handling nested generics
    const result = [];
    let current = "";
    let depth = 0;

    for (const char of inner) {
      if (char === "<") depth++;
      else if (char === ">") depth--;

      if (char === "," && depth === 0) {
        const part = current.trim().split(/\s+/)[0]; // Get just the type name, not "extends X"
        if (part) result.push(part);
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      const part = current.trim().split(/\s+/)[0];
      if (part) result.push(part);
    }

    return result;
  }

  /**
   * Generate Success subclass
   * @param {string} parentName
   * @param {string} genericType
   * @param {string} dataType
   */
  generateSuccessClass(parentName, genericType, dataType) {
    return `final class Success${genericType} extends ${parentName}${genericType} {
  final ${dataType} data;
  
  const Success(this.data);
  
  @override
  String toString() => 'Success(data: \$data)';
}`;
  }

  /**
   * Generate Failure subclass
   * @param {string} parentName
   * @param {string} genericType
   * @param {string} errorType
   */
  generateFailureClass(parentName, genericType, errorType) {
    return `final class Failure${genericType} extends ${parentName}${genericType} {
  final ${errorType} error;
  
  const Failure(this.error);
  
  @override
  String toString() => 'Failure(error: \$error)';
}`;
  }
}

module.exports = SealedGenerator;
