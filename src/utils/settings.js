const vscode = require("vscode");

/**
 * @param {string} key
 */
function readSetting(key) {
  return vscode.workspace
    .getConfiguration()
    .get("dart-data-class-generator." + key);
}

/**
 * @param {string} typeName
 */
function readCustomTypeSetting(typeName) {
  const customTypes = readSetting("custom.types");
  const customTypeConfig = customTypes.find(
    (custom) => custom.type === typeName
  );
  return customTypeConfig;
}

/**
 * @param {string[]} keys
 */
function readSettings(keys) {
  for (let key of keys) {
    if (readSetting(key)) {
      return true;
    }
  }
  return false;
}

/**
 * @param {string} fromMap
 */
function extractFromMap(fromMap) {
  const regex = /(\w+)([\[(])((?:[^()\[\]]|\((?:[^()]*\)))*)((?:[\])]))/;
  const r = regex.exec(fromMap);

  if (r) {
    const [from, open, typedef, close] = r.slice(1);
    let fixFrom = from;

    if (!fromMap.includes(".")) {
      fixFrom = "";
    }

    return [fixFrom, open, typedef, close];
  }
  return ["", "", "", ""];
}

module.exports = {
  readSetting,
  readCustomTypeSetting,
  readSettings,
  extractFromMap,
};
