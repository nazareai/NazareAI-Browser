# Troubleshooting Guide

## ✅ Fixed Issues

### 1. **`__dirname` Already Declared Error**

**Error**: `SyntaxError: Identifier '__dirname' has already been declared`

**Solution**: ✅ **FIXED** - Removed redundant `__dirname` declaration since it's already available in CommonJS modules.

### 2. **File Path Issues**

**Error**: `Failed to load URL: file:///.../dist/dist/renderer/index.html with error: ERR_FILE_NOT_FOUND`

**Solution**: ✅ **FIXED** - Corrected file paths to account for Electron's working directory being in the `dist` folder.

### 3. **Preload Script Path**

**Error**: Preload script not found

**Solution**: ✅ **FIXED** - Updated preload path to `path.join(__dirname, 'preload.js')`

## 🔧 Common Issues & Solutions

### Electron Won't Start

```bash
# Clean build and restart
rm -rf dist/
npm run build
npm run dev
```

### Dependencies Issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Compilation Errors

```bash
# Check TypeScript configuration
npx tsc --noEmit
npm run build:electron
```

### Vite Build Issues

```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run build:renderer
```

## 🎯 Verification Checklist

Run our test script to verify everything is working:

```bash
./test-run.sh
```

Expected output:

- ✅ Build successful
- ✅ All required files exist
- ✅ No error messages

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm run start
```

### Package for Distribution

```bash
npm run package
```

## 🔍 Debug Mode

For detailed debugging, run with additional logging:

```bash
DEBUG=* npm run dev
```

Or with Electron debugging:

```bash
npm run dev -- --inspect-brk
```

## 📝 Common Warnings (Safe to Ignore)

1. **Vite CJS Node API deprecated** - This is a known warning, doesn't affect functionality
2. **Electron certificate warnings** - Expected in development mode
3. **React warnings** - Normal development warnings

## 🎛️ Keyboard Shortcuts

- `Cmd/Ctrl + K` - Command palette
- `Cmd/Ctrl + T` - New tab
- `Cmd/Ctrl + W` - Close tab
- `Cmd/Ctrl + R` - Reload page
- `Cmd/Ctrl + Shift + I` - Developer tools

## 🛠️ Development Tips

1. **Hot Reload**: The renderer process supports hot reload via Vite
2. **Electron Restart**: Changes to main process require restart (nodemon handles this)
3. **DevTools**: Available in development mode for debugging React components

## 📱 Platform-Specific Notes

### macOS

- Uses `hiddenInset` title bar style for modern look
- Cmd key shortcuts work as expected

### Windows

- Uses Ctrl key shortcuts
- Different window decorations

### Linux

- Standard window decorations
- Ctrl key shortcuts

## 🔒 Security Features

- Context isolation enabled
- Node integration disabled
- Secure preload script
- CSP headers configured

## 📊 Performance Monitoring

Check memory usage:

```bash
# Activity Monitor (macOS) or Task Manager (Windows)
# Look for "AI Browser" or "Electron" processes
```

## 🆘 Getting Help

If you encounter new issues:

1. Check the terminal output for specific error messages
2. Run `./test-run.sh` to verify setup
3. Clear caches and rebuild: `rm -rf dist/ && npm run build`
4. Check browser console for React/JS errors

## 🎯 Next Steps

The application is now running error-free! You can focus on:

1. **WebView Integration** - Adding real web page rendering
2. **AI Features** - Configuring API keys and enabling chat
3. **Advanced Features** - MCP integration, workspaces, etc.

---

**Status**: 🟢 **All Major Issues Resolved** - Application runs without Electron errors!
