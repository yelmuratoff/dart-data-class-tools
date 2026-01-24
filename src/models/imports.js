const vscode = require("vscode");
const path = require("path");
const { readSetting } = require("../utils/settings");
const {
  isBlank,
  removeEnd,
  areStrictEqual,
} = require("../generators/base-generator");

class Imports {
  /**
   * @param {string} text
   * @param {string} projectName
   */
  constructor(text, projectName = "") {
    /** @type {string[]} */
    this.values = [];
    /** @type {number} */
    this.startAtLine = null;
    /** @type {number} */
    this.endAtLine = null;
    /** @type {string} */
    this.rawImports = null;
    this.text = text;
    this.projectName = projectName;

    this.readImports();
  }

  get hasImports() {
    return this.values != null && this.values.length > 0;
  }

  get hasExportDeclaration() {
    return /^export /m.test(this.formatted);
  }

  get hasImportDeclaration() {
    return /^import /m.test(this.formatted);
  }

  get hasPreviousImports() {
    return this.startAtLine != null && this.endAtLine != null;
  }

  get didChange() {
    return !areStrictEqual(this.rawImports, this.formatted);
  }

  get range() {
    return new vscode.Range(
      new vscode.Position(this.startAtLine - 1, 0),
      new vscode.Position(this.endAtLine, 1),
    );
  }

  readImports() {
    this.rawImports = "";
    const lines = this.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isLast = i == lines.length - 1;

      if (
        line.startsWith("import") ||
        line.startsWith("export") ||
        line.startsWith("part")
      ) {
        this.values.push(line);
        this.rawImports += `${line}\n`;

        if (this.startAtLine == null) {
          // Look backwards for contiguous headers/comments
          let start = i;
          while (start > 0) {
            const prev = lines[start - 1].trim();
            if (
              isBlank(prev) ||
              prev.startsWith("//") ||
              prev.startsWith("library")
            ) {
              start--;
            } else {
              break;
            }
          }
          this.startAtLine = start + 1;
        }

        if (isLast) {
          this.endAtLine = i + 1;
          break;
        }
      } else {
        const isLicenseComment =
          line.startsWith("//") && this.values.length == 0;
        const didEnd = !(
          isBlank(line) ||
          line.startsWith("library") ||
          isLicenseComment
        );

        if (isLast || didEnd) {
          if (this.startAtLine != null) {
            if (i > 0 && isBlank(lines[i - 1])) {
              this.endAtLine = i - 1;
            } else {
              this.endAtLine = i;
            }
          }
          break;
        }
      }
    }
  }

  get formatted() {
    if (!this.hasImports) return "";

    let workspace = this.projectName;

    if (workspace == null || workspace.length == 0) {
      try {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const file = editor.document.uri;
          if (file.scheme === "file") {
            const folder = vscode.workspace.getWorkspaceFolder(file);
            if (folder) {
              workspace = path.basename(folder.uri.fsPath).replace("-", "_");
            }
          }
        }
      } catch (e) {
        // Fallback if no editor
      }
    }

    const dartImports = [];
    const packageImports = [];
    const packageLocalImports = [];
    const relativeImports = [];
    const partStatements = [];
    const exports = [];

    for (let imp of this.values) {
      if (imp.startsWith("export")) {
        exports.push(imp);
      } else if (imp.startsWith("part")) {
        partStatements.push(imp);
      } else if (imp.includes("dart:")) {
        dartImports.push(imp);
      } else if (workspace != null && imp.includes(`package:${workspace}`)) {
        packageLocalImports.push(imp);
      } else if (imp.includes("package:")) {
        packageImports.push(imp);
      } else {
        relativeImports.push(imp);
      }
    }

    let imps = "";

    /**
     * @param {any[]} imports
     */
    function addImports(imports) {
      imports.sort();
      for (let i = 0; i < imports.length; i++) {
        const isLast = i == imports.length - 1;
        const imp = imports[i];
        imps += imp + "\n";

        if (isLast) {
          imps += "\n";
        }
      }
    }

    function addHeaderLines() {
      const headerLines = readSetting("custom.headerLines");
      for (const imp of headerLines) {
        imps += imp + "\n";
      }
    }

    addHeaderLines();
    addImports(dartImports);
    addImports(packageImports);
    addImports(packageLocalImports);
    addImports(relativeImports);
    addImports(exports);
    addImports(partStatements);

    return removeEnd(imps, "\n");
  }

  /**
   * @param {string} imp
   */
  includes(imp) {
    return this.values.includes(imp);
  }

  /**
   * @param {string} imp
   */
  push(imp) {
    return this.values.push(imp);
  }

  /**
   * @param {string[]} imps
   */
  hasAtLeastOneImport(imps) {
    for (let imp of imps) {
      const impt1 = `import '${imp}';`;
      const impt2 = `import "${imp}";`;
      if (
        this.text.includes(impt1) ||
        this.text.includes(impt2) ||
        this.includes(impt1) ||
        this.includes(impt2)
      )
        return true;
    }
    return false;
  }

  /**
   * @param {string} imp
   * @param {string[]} validOverrides
   */
  requiresImport(imp, validOverrides = []) {
    const formattedImport = !imp.startsWith("import")
      ? "import '" + imp + "';"
      : imp;

    const isMeta =
      imp.includes("package:meta/meta.dart") ||
      imp.includes("package:flutter/foundation.dart");

    if (isMeta) {
      if (
        this.hasAtLeastOneImport([
          "package:flutter/widgets.dart",
          "package:flutter/material.dart",
          "package:flutter/cupertino.dart",
        ])
      ) {
        return;
      }
    }

    if (
      !this.includes(formattedImport) &&
      !this.hasAtLeastOneImport(validOverrides)
    ) {
      this.values.push(formattedImport);
    }
  }
}

module.exports = Imports;
