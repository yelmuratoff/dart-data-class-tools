const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

// Models
const { DartClass, ClassField, ClassPart, Imports } = require("./models");

// Generators
const { GeneratorRegistry, isBlank, removeEnd, areStrictEqual, count } = require("./generators");

// Parsers
const { DartClassParser } = require("./parsers");

// Utils
const {
  readSetting,
  readSettings,
  createFileName,
  sanitizeFileName,
  capitalize,
  toVarName,
  varToKey,
} = require("./utils");

// Global state
let projectName = "";
let isFlutter = false;
let projectNamePromise = null;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dart_data_class.generate.from_props",
      generateDataClass
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dart_data_class.generate.from_json",
      generateJsonDataClass
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      {
        language: "dart",
        scheme: "file",
      },
      new DataClassCodeActions(),
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
      }
    )
  );

  findProjectName();
}

async function findProjectName() {
  const pubspecs = await vscode.workspace.findFiles("pubspec.yaml");

  if (pubspecs != null && pubspecs.length > 0) {
    const pubspec = pubspecs[0];
    const content = fs.readFileSync(pubspec.fsPath, "utf8");

    if (content != null && content.includes("name: ")) {
      isFlutter =
        content.includes("flutter:") && content.includes("sdk: flutter");

      for (const line of content.split("\n")) {
        if (line.startsWith("name: ")) {
          projectName = line.replace("name:", "").trim();
          break;
        }
      }
    }
  }
}

async function ensureProjectName() {
  if (projectNamePromise === null) {
    projectNamePromise = findProjectName();
  }
  await projectNamePromise;
}

async function generateJsonDataClass() {
  await ensureProjectName();
  let langId = getLangId();

  if (langId == "dart") {
    let document = getDocText();

    const name = await vscode.window.showInputBox({
      placeHolder: "Please type in a class name.",
    });

    if (name == null || name.length == 0) {
      return;
    }

    let reader = new JsonReader(document, name);
    let separate = true;

    if ((await reader.error) == null) {
      if (reader.files.length >= 2) {
        const setting = readSetting("json.separate");

        if (setting == "ask") {
          const r = await vscode.window.showQuickPick(["Yes", "No"], {
            canPickMany: false,
            placeHolder:
              "Do you wish to separate the JSON into multiple files?",
          });

          if (r != null) {
            separate = r == "Yes";
          } else {
            return;
          }
        } else {
          separate = setting == "separate";
        }
      }

      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          cancellable: false,
        },
        async function (progress, token) {
          progress.report({
            increment: 0,
            message: "Generating Data Classes...",
          });
          scrollTo(0);

          await reader.commitJson(progress, separate);

          clearSelection();
        }
      );
    } else {
      showError(await reader.error);
    }
  } else if (langId == "json") {
    showError(
      "Please paste the JSON directly into an empty .dart file and then try again!"
    );
  } else {
    showError("Make sure that you're editing a dart file and then try again!");
  }
}

async function generateDataClass(text = getDocText()) {
  await ensureProjectName();
  if (getLangId() == "dart") {
    const generator = new DataClassGenerator(text);
    let clazzes = generator.clazzes;

    if (clazzes.length == 0) {
      showError("No convertable dart classes were detected!");
      return null;
    } else if (clazzes.length >= 2) {
      clazzes = await showClassChooser(clazzes);

      if (clazzes == null) {
        showInfo("No classes selected!");
        return;
      }
    }

    for (let clazz of clazzes) {
      if (clazz.isValid && clazz.toReplace.length > 0) {
        if (readSetting("override.manual")) {
          let result = [];

          for (let replacement of clazz.toReplace) {
            const r = await vscode.window.showQuickPick(["Yes", "No"], {
              placeHolder: `Do you want to override ${replacement.name}?`,
              canPickMany: false,
            });

            if (r == null) {
              showInfo("Canceled!");
              return;
            } else if ("Yes" == r) result.push(replacement);
          }
          clazz.toReplace = result;
        }
      }
    }

    const edit = getReplaceEdit(clazzes, generator.imports, true);
    await vscode.workspace.applyEdit(edit);

    clearSelection();

    return clazzes;
  } else {
    showError("Make sure that you're editing a dart file and then try again!");
    return null;
  }
}

/**
 * @param {DartClass[]} clazzez
 */
async function showClassChooser(clazzez) {
  const values = clazzez.map((v) => v.name);

  const r = await vscode.window.showQuickPick(values, {
    placeHolder:
      "Please select the classes you want to generate data classes of.",
    canPickMany: true,
  });

  let result = [];

  if (r != null && r.length > 0) {
    for (let c of r) {
      for (let clazz of clazzez) {
        if (clazz.name == c) result.push(clazz);
      }
    }
  } else return null;

  return result;
}

/**
 * Main Data Class Generator using modular architecture
 */
class DataClassGenerator {
  /**
   * @param {String} text
   * @param {DartClass[]} clazzes
   * @param {boolean} fromJSON
   * @param {string} part
   */
  constructor(text, clazzes = null, fromJSON = false, part = null) {
    this.text = text;
    this.fromJSON = fromJSON;
    this.part = part;

    // Parse classes using DartClassParser
    if (clazzes == null) {
      const parser = new DartClassParser(text);
      this.clazzes = parser.parse();
    } else {
      this.clazzes = clazzes;
    }

    this.imports = new Imports(text, projectName);
    this.generateDataClazzes();
  }

  get hasImports() {
    return this.imports.hasImports;
  }

  /**
   * @param {string} imp
   * @param {string[]} validOverrides
   */
  requiresImport(imp, validOverrides = []) {
    this.imports.requiresImport(imp, validOverrides);
  }

  /**
   * @param {string} part
   */
  isPartSelected(part) {
    return this.part == null || this.part == part;
  }

  generateDataClazzes() {
    const insertConstructor =
      readSetting("constructor.enabled") && this.isPartSelected("constructor");

    for (let clazz of this.clazzes) {
      // Use GeneratorRegistry for each class
      const registry = new GeneratorRegistry(
        clazz,
        this.imports,
        isFlutter,
        this.part
      );

      registry.generateAll();
    }
  }
}

class DartFile {
  /**
   * @param {DartClass} clazz
   * @param {string} content
   */
  constructor(clazz, content = null) {
    this.clazz = clazz;
    this.name = createFileName(clazz.name);
    this.content = content || clazz.classContent;
  }
}

class JsonReader {
  /**
   * @param {string} source
   * @param {string} className
   */
  constructor(source, className) {
    this.json = this.toPlainJson(source);

    this.clazzName = capitalize(className);
    /** @type {DartClass[]} */
    this.clazzes = [];
    /** @type {DartFile[]} */
    this.files = [];

    this.error = this.checkJson();
  }

  async checkJson() {
    const isArray = this.json.startsWith("[");
    if (isArray && !this.json.includes("{")) {
      return "Primitive JSON arrays are not supported! Please serialize them directly.";
    }

    if (await this.generateFiles()) {
      return "The provided JSON is malformed or couldn't be parsed!";
    }

    return null;
  }

  /**
   * @param {string} source
   */
  toPlainJson(source) {
    return source
      .replace(new RegExp(" ", "g"), "")
      .replace(new RegExp("\n", "g"), "");
  }

  /**
   * @param {any} value
   */
  getPrimitive(value) {
    let type = typeof value;
    let sType = null;

    if (type === "number") {
      sType = Number.isInteger(value) ? "int" : "double";
    } else if (type === "string") {
      sType = "String";
    } else if (type === "boolean") {
      sType = "bool";
    }

    return sType;
  }

  /**
   * @param {any} object
   * @param {string} key
   */
  getClazzes(object, key) {
    let clazz = new DartClass();
    clazz.startsAtLine = 1;
    clazz.name = capitalize(key);

    let isArray = false;
    if (object instanceof Array) {
      isArray = true;
      clazz.isArray = true;
      clazz.name += "s";
    } else {
      this.clazzes.push(clazz);
    }

    let i = 1;
    clazz.classContent += "class " + clazz.name + " {\n";
    for (let key in object) {
      let k = !isArray ? key : removeEnd(clazz.name.toLowerCase(), "s");

      let value = object[key];
      let type = this.getPrimitive(value);

      if (type == null) {
        if (value instanceof Array) {
          if (value.length > 0) {
            let listType = k;
            if (k.endsWith("ies")) listType = removeEnd(k, "ies") + "y";
            if (k.endsWith("s")) listType = removeEnd(k, "s");
            const i0 = this.getPrimitive(value[0]);

            if (i0 == null) {
              this.getClazzes(value[0], listType);
              type = "List<" + capitalize(listType) + ">";
            } else {
              type = "List<" + i0 + ">";
            }
          } else {
            type = "List<dynamic>";
          }
        } else {
          this.getClazzes(value, k);
          type = !isArray ? capitalize(k) : `List<${capitalize(k)}>`;
        }
      }

      clazz.properties.push(new ClassField(type, k, ++i, true, false, true));
      clazz.classContent += `  final ${type} ${toVarName(k)};\n`;

      if (isArray) break;
    }
    clazz.endsAtLine = ++i;
    clazz.classContent += "}";
  }

  /**
   * @param {string} property
   */
  getGeneratedTypeCount(property) {
    let p = new ClassField(property, "x");
    let i = 0;
    if (!p.isPrimitive) {
      for (let clazz of this.clazzes) {
        if (clazz.name == p.rawType) {
          i++;
        }
      }
    }

    return i;
  }

  async generateFiles() {
    try {
      const json = JSON.parse(this.json);
      this.getClazzes(json, this.clazzName);
      this.removeDuplicates();

      for (let clazz of this.clazzes) {
        this.files.push(new DartFile(clazz));
      }

      return false;
    } catch (e) {
      console.log(e.msg);
      return true;
    }
  }

  removeDuplicates() {
    let result = [];
    let clazzes = this.clazzes.map((item) => item.classContent);
    clazzes.forEach((item, index) => {
      if (clazzes.indexOf(item) == index) {
        result.push(this.clazzes[index]);
      }
    });

    this.clazzes = result;
  }

  /**
   * @param {DataClassGenerator} generator
   */
  addGeneratedFilesAsImport(generator) {
    const clazz = generator.clazzes[0];
    for (let prop of clazz.properties) {
      if (this.getGeneratedTypeCount((prop.subtype ?? prop).rawType) == 1) {
        const imp = `import '${createFileName(
          (prop.subtype ?? prop).rawType
        )}.dart';`;
        generator.imports.push(imp);
      }
    }
  }

  /**
   * @param {vscode.Progress} progress
   * @param {boolean} separate
   */
  async commitJson(progress, separate) {
    let basePath = getCurrentPath();
    let fileContent = "";

    const length = this.files.length;
    for (let i = 0; i < length; i++) {
      const file = this.files[i];
      const isLast = i == length - 1;
      const generator = new DataClassGenerator(
        file.content,
        [file.clazz],
        true
      );

      if (separate) this.addGeneratedFilesAsImport(generator);

      const imports = `${generator.imports.formatted}\n`;

      progress.report({
        increment: (1 / length) * 100,
        message: `Creating file ${file.name}...`,
      });

      if (separate) {
        const clazz = generator.clazzes[0];

        const replacement = imports + clazz.generateClassReplacement();
        if (i > 0) {
          await writeFile(replacement, file.name, false, basePath);
        } else {
          await getEditor().edit((editor) => {
            editorReplace(editor, 0, null, replacement);
          });
        }

        await new Promise((resolve) => setTimeout(() => resolve(), 120));
      } else {
        for (let clazz of generator.clazzes) {
          fileContent += clazz.generateClassReplacement() + "\n\n";
        }

        if (isLast) {
          fileContent = removeEnd(fileContent, "\n\n");
          await getEditor().edit((editor) => {
            editorReplace(editor, 0, null, fileContent);
            editorInsert(editor, 0, imports);
          });
        }
      }
    }
  }
}

class DataClassCodeActions {
  constructor() {
    this.clazz = new DartClass();
    this.generator = null;
    this.document = getDoc();
    this.line = "";
    this.range;
  }

  get uri() {
    return this.document.uri;
  }

  get lineNumber() {
    return this.range.start.line + 1;
  }

  get charPos() {
    return this.range.start.character;
  }

  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Range} range
   */
  provideCodeActions(document, range) {
    if (!readSetting("quick_fixes")) {
      return;
    }

    this.range = range;
    this.document = document;
    this.line = document.lineAt(range.start).text;
    this.generator = new DataClassGenerator(document.getText());
    this.clazz = this.getClass();

    const codeActions = [this.createImportsFix()];

    if (this.clazz == null || !this.clazz.isValid) {
      return codeActions;
    }

    const line = this.lineNumber;
    const clazz = this.clazz;
    const isAtClassDeclaration = line == clazz.startsAtLine;
    const isInProperties =
      clazz.properties.find((p) => p.line == line) != undefined;
    const isInConstrRange =
      line >= clazz.constrStartsAtLine && line <= clazz.constrEndsAtLine;
    if (!(isAtClassDeclaration || isInProperties || isInConstrRange))
      return codeActions;

    if (!this.clazz.isWidget)
      codeActions.push(this.createDataClassFix(this.clazz));

    if (readSetting("constructor.enabled"))
      codeActions.push(this.createConstructorFix());

    if (!this.clazz.isWidget) {
      if (!this.clazz.isAbstract) {
        if (readSetting("copyWith.enabled"))
          codeActions.push(this.createCopyWithFix());
        if (
          readSettings([
            "toMap.enabled",
            "fromMap.enabled",
            "toJson.enabled",
            "fromJson.enabled",
          ])
        )
          codeActions.push(this.createSerializationFix());
      }

      if (readSetting("toString.enabled"))
        codeActions.push(this.createToStringFix());

      if (clazz.usesEquatable || readSetting("useEquatable"))
        codeActions.push(this.createUseEquatableFix());
      else {
        if (readSettings(["equality.enabled", "hashCode.enabled"]))
          codeActions.push(this.createEqualityFix());
      }
    }

    return codeActions;
  }

  /**
   * @param {string} description
   * @param {(arg0: vscode.WorkspaceEdit) => void} editor
   */
  createFix(description, editor) {
    const fix = new vscode.CodeAction(
      description,
      vscode.CodeActionKind.QuickFix
    );
    const edit = new vscode.WorkspaceEdit();
    editor(edit);
    fix.edit = edit;
    return fix;
  }

  /**
   * @param {DartClass} clazz
   */
  createDataClassFix(clazz) {
    if (clazz.didChange) {
      const fix = new vscode.CodeAction(
        "Generate data class",
        vscode.CodeActionKind.QuickFix
      );
      fix.edit = this.getClazzEdit(clazz);
      return fix;
    }
  }

  /**
   * @param {string} part
   * @param {string} description
   */
  constructQuickFix(part, description) {
    const generator = new DataClassGenerator(
      this.document.getText(),
      null,
      false,
      part
    );
    const fix = new vscode.CodeAction(
      description,
      vscode.CodeActionKind.QuickFix
    );
    const clazz = this.findQuickFixClazz(generator);
    if (clazz != null && clazz.didChange) {
      fix.edit = this.getClazzEdit(clazz, generator.imports);
      return fix;
    }
  }

  /** @param {DataClassGenerator} generator */
  findQuickFixClazz(generator) {
    for (let clazz of generator.clazzes) {
      if (clazz.name == this.clazz.name) return clazz;
    }
  }

  /**
   * @param {DartClass} clazz
   */
  getClazzEdit(clazz, imports = null) {
    return getReplaceEdit(clazz, imports || this.generator.imports);
  }

  createConstructorFix() {
    return this.constructQuickFix("constructor", "Generate constructor");
  }

  createCopyWithFix() {
    return this.constructQuickFix("copyWith", "Generate copyWith");
  }

  createSerializationFix() {
    return this.constructQuickFix(
      "serialization",
      "Generate JSON serialization"
    );
  }

  createToStringFix() {
    return this.constructQuickFix("toString", "Generate toString");
  }

  createEqualityFix() {
    return this.constructQuickFix("equality", "Generate equality");
  }

  createUseEquatableFix() {
    return this.constructQuickFix("useEquatable", `Generate Equatable`);
  }

  createImportsFix() {
    const imports = new Imports(this.document.getText(), projectName);
    if (!imports.didChange) return;

    const inImportsRange =
      this.lineNumber >= imports.startAtLine &&
      this.lineNumber <= imports.endAtLine;
    if (inImportsRange) {
      let title = "Sort imports";
      if (imports.hasImportDeclaration && imports.hasExportDeclaration) {
        title = "Sort imports/exports";
      } else if (imports.hasExportDeclaration) {
        title = "Sort exports";
      }

      return this.createFix(title, (edit) => {
        edit.replace(this.uri, imports.range, imports.formatted);
      });
    }
  }

  getClass() {
    for (let clazz of this.generator.clazzes) {
      if (
        clazz.startsAtLine <= this.lineNumber &&
        clazz.endsAtLine >= this.lineNumber
      ) {
        return clazz;
      }
    }
  }
}

/**
 * @param {any} values
 * @param {Imports} imports
 */
function getReplaceEdit(values, imports = null, showLogs = false) {
  /** @type {DartClass[]} */
  const clazzes = values instanceof DartClass ? [values] : values;
  const hasMultiple = clazzes.length > 1;
  const edit = new vscode.WorkspaceEdit();
  const uri = getDoc().uri;

  const noChanges = [];
  for (var i = clazzes.length - 1; i >= 0; i--) {
    const clazz = clazzes[i];

    if (clazz.isValid) {
      if (clazz.didChange) {
        let replacement = clazz.generateClassReplacement();
        if (!clazz.isLastInFile) {
          replacement += "\n";
        }

        if (!isBlank(replacement)) {
          edit.replace(
            uri,
            new vscode.Range(
              new vscode.Position(clazz.startsAtLine - 1, 0),
              new vscode.Position(clazz.endsAtLine, 1)
            ),
            replacement
          );
        }
      } else if (showLogs) {
        noChanges.push(clazz.name);
        if (i == 0) {
          const info =
            noChanges.length == 1
              ? `class ${noChanges[0]}`
              : `classes ${noChanges.join(", ")}`;
          showInfo(`No changes detected for ${info}`);
        }
      }
    } else if (showLogs) {
      showError(clazz.issue);
    }
  }

  if (imports != null && imports.hasImports) {
    const areImportsseparated =
      !hasMultiple || (imports.startAtLine || 0) < clazzes[0].startsAtLine - 1;
    if (imports.hasPreviousImports && areImportsseparated) {
      edit.replace(uri, imports.range, imports.formatted);
    } else {
      edit.insert(
        uri,
        new vscode.Position(imports.startAtLine, 0),
        imports.formatted + "\n"
      );
    }
  }

  return edit;
}

// ============ Utility Functions ============

function getCurrentPath() {
  const filePath = vscode.window.activeTextEditor.document.fileName;
  return path.dirname(filePath) + path.sep;
}

/**
 * Sanitize file name to prevent path traversal and invalid characters
 * @param {string} name
 */
function sanitizeFileNameLocal(name) {
  return name
    .replace(/[\/\\]/g, "")
    .replace(/\.\./g, "")
    .replace(/[<>:"|?*]/g, "")
    .replace(/[\x00-\x1f]/g, "")
    .trim();
}

/**
 * @param {string} content
 * @param {string} name
 */
async function writeFile(content, name, open = true, basePath = getCurrentPath()) {
  const safeName = sanitizeFileNameLocal(name);
  if (!safeName || safeName.length === 0) {
    showError("Invalid file name!");
    return;
  }

  let p = basePath + safeName + ".dart";
  if (fs.existsSync(p)) {
    let i = 0;
    do {
      p = basePath + safeName + "_" + ++i + ".dart";
    } while (fs.existsSync(p));
  }

  fs.writeFileSync(p, content, "utf8");
  if (open) {
    let openPath = vscode.Uri.parse("file:///" + p);
    let doc = await vscode.workspace.openTextDocument(openPath);
    await vscode.window.showTextDocument(doc);
  }
  return;
}

/**
 * @param {vscode.TextEditorEdit} editor
 * @param {number} start
 * @param {number} end
 * @param {string} value
 */
function editorReplace(editor, start = null, end = null, value) {
  editor.replace(
    new vscode.Range(
      new vscode.Position(start || 0, 0),
      new vscode.Position(end || getDocText().split("\n").length, 1)
    ),
    value
  );
}

/**
 * @param {vscode.TextEditorEdit} editor
 * @param {number} at
 * @param {string} value
 */
function editorInsert(editor, at, value) {
  editor.insert(new vscode.Position(at, 0), value);
}

/**
 * @param {number} from
 * @param {number} to
 */
function scrollTo(from = null, to = null) {
  getEditor().revealRange(
    new vscode.Range(
      new vscode.Position(from || 0, 0),
      new vscode.Position(to || 0, 0)
    ),
    0
  );
}

function clearSelection() {
  getEditor().selection = new vscode.Selection(
    new vscode.Position(0, 0),
    new vscode.Position(0, 0)
  );
}

function getEditor() {
  return vscode.window.activeTextEditor;
}

function getDoc() {
  return getEditor().document;
}

function getDocText() {
  return getDoc().getText();
}

function getLangId() {
  return getDoc().languageId;
}

/**
 * @param {string} msg
 */
function showError(msg) {
  vscode.window.showErrorMessage(msg);
}

/**
 * @param {string} msg
 */
function showInfo(msg) {
  vscode.window.showInformationMessage(msg);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
  generateDataClass,
  generateJsonDataClass,
  DartFile,
  DataClassGenerator,
  JsonReader,
  writeFile,
  getCurrentPath,
  editorInsert,
  editorReplace,
  scrollTo,
  clearSelection,
  getEditor,
  getDoc,
  getDocText,
  getLangId,
  showError,
  showInfo,
};
