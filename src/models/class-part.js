const vscode = require("vscode");

class ClassPart {
  /**
   * @param {string} name
   * @param {number} startsAt
   * @param {number} endsAt
   * @param {string} current
   * @param {string} replacement
   */
  constructor(
    name,
    startsAt = null,
    endsAt = null,
    current = null,
    replacement = null
  ) {
    this.name = name;
    this.startsAt = startsAt;
    this.endsAt = endsAt;
    this.current = current;
    this.replacement = replacement;
  }

  get isValid() {
    return this.startsAt != null && this.endsAt != null && this.current != null;
  }

  get startPos() {
    return new vscode.Position(this.startsAt, 0);
  }

  get endPos() {
    return new vscode.Position(this.endsAt, 0);
  }
}

module.exports = ClassPart;
