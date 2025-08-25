# Building NazareAI Browser DMG for macOS

## Quick Start

To build a DMG file for distribution:

```bash
npm run build:dmg
```

This will:
1. Create an app icon (if missing)
2. Build the application
3. Package it as a DMG file
4. Output to `build/NazareAI Browser-[version].dmg`

## Step-by-Step Manual Build

### 1. Install Dependencies
```bash
npm install
```

### 2. Create App Icon (Optional)
```bash
./create-icon.sh
```
This creates a placeholder icon. For production, replace `build/icon.icns` with your custom icon.

### 3. Build the Application
```bash
npm run build
```

### 4. Create DMG
```bash
npm run package:dmg
```

## DMG Features

The generated DMG includes:
- **Universal Binary**: Works on both Intel and Apple Silicon Macs
- **Drag-and-drop installation**: Users drag the app to Applications
- **Custom background**: Dark themed installer window
- **Proper app naming**: Shows as "NazareAI Browser" everywhere

## Output Location

The DMG file will be created in:
```
build/NazareAI Browser-[version]-[arch].dmg
```

For example:
- `NazareAI Browser-0.1.0-arm64.dmg` (Apple Silicon)
- `NazareAI Browser-0.1.0-x64.dmg` (Intel)

## Testing the DMG

1. Double-click the DMG file to mount it
2. Drag NazareAI Browser to the Applications folder
3. Eject the DMG
4. Launch from Applications

## Distribution

The DMG file is ready for distribution. You can:
- Upload to your website
- Share via cloud storage
- Distribute through app stores

## Custom Icon

To use a custom icon:
1. Create a 1024x1024 PNG image
2. Save it as `build/icon.png`
3. Run `./create-icon.sh` to convert to ICNS format

## Troubleshooting

### "Developer cannot be verified" on macOS
Users may see this when opening the app. They can:
1. Right-click the app and select "Open"
2. Click "Open" in the security dialog

For production, you'll want to:
- Sign the app with an Apple Developer certificate
- Notarize the app with Apple

### Build Errors
- Ensure all dependencies are installed: `npm install`
- Check Node.js version: `node --version` (should be 16+)
- Clear old builds: `rm -rf build/ dist/`

## Advanced Options

### Sign and Notarize (Production)
Add to `package.json`:
```json
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist"
}
```

### Custom DMG Background
Replace the background by adding to `package.json`:
```json
"dmg": {
  "background": "build/dmg-background.png"
}
``` 