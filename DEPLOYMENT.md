# Extension Deployment & Publishing Guide

This guide describes how to build, test locally, and publish the **Dart Safe Data Class Generator** extension to the Visual Studio Marketplace.

## Prerequisites

- [Node.js](https://nodejs.org/) (includes npm)
- [Visual Studio Code](https://code.visualstudio.com/)
- A [Microsoft Account](https://signup.live.com/) (to publish to the Marketplace)

## Local Testing & Development

### 1. Build the Extension
First, install dependencies and package the extension into a `.vsix` file:

```bash
# Install dependencies
npm install

# Build the .vsix package
npx vsce package --no-yarn
```

### 2. Local Installation
To test the extension in your own VS Code instance:
1. Open VS Code.
2. Open the **Extensions** view (`Cmd+Shift+X`).
3. Click the **...** (Views and More Actions) menu in the top right.
4. Select **Install from VSIX...**.
5. Choose the generated `.vsix` file.

---

## Publishing to the Marketplace

### 1. Create a Publisher
If you don't have a publisher ID yet:
1. Go to the [Azure DevOps Marketplace Management](https://marketplace.visualstudio.com/manage) page.
2. Sign in with your Microsoft account.
3. Create a new **Publisher** and note the `Publisher ID`.
4. Create a **Personal Access Token (PAT)** in Azure DevOps with the scope `Marketplace (Manage)`.

### 2. Login with `vsce`
In your terminal, authorize `vsce` with your publisher and PAT:

```bash
npx vsce login [your-publisher-id]
```

### 3. Publish the Extension
Before publishing, ensure you've updated the version in `package.json`.

```bash
# Publish to the Marketplace
npx vsce publish --no-yarn
```

> [!IMPORTANT]
> Always run `dart format` on your `extension.js` or any templates before packaging to ensure clean output.

### 4. Direct Upload (Manual)
Alternatively, you can manually upload the `.vsix` file:
1. Go to [Marketplace Management](https://marketplace.visualstudio.com/manage).
2. Select your publisher.
3. Click **New Extension** -> **Visual Studio Code**.
4. Upload your `.vsix` file.
