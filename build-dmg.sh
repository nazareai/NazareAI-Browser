#!/bin/bash

echo "🚀 Building NazareAI Browser DMG..."

# Set production environment
export NODE_ENV=production

# Step 1: Check if icon exists, if not create it
if [ ! -f "build_dmg/icon.icns" ]; then
    echo "📦 Creating app icon..."
    mkdir -p build_dmg
    ./create-icon.sh
fi

# Step 2: Build the app
echo "🔨 Building the application..."
NODE_ENV=production npm run build

# Step 3: Package the app
echo "📦 Packaging for macOS (this may take a few minutes)..."
NODE_ENV=production npm run package:mac

# Step 4: Copy DMG files to build_dmg folder
echo "📦 Copying DMG files to build_dmg folder..."
mkdir -p build_dmg
cp build/NazareAI\ Browser-*.dmg build_dmg/ 2>/dev/null || true
cp build/NazareAI\ Browser-*.dmg.blockmap build_dmg/ 2>/dev/null || true

# Step 5: Check if DMG was created
DMG_COUNT=$(ls build_dmg/NazareAI\ Browser-*.dmg 2>/dev/null | wc -l)
if [ "$DMG_COUNT" -gt 0 ]; then
    echo "✅ DMG created successfully!"
    echo ""
    echo "📍 Created DMG files in build_dmg:"
    ls -la build_dmg/NazareAI\ Browser-*.dmg
    echo ""
    echo "📋 Distribution Instructions:"
    echo "1. The DMG files are ready for distribution in build_dmg/"
    echo "2. Users can double-click the DMG to mount it"
    echo "3. They'll see NazareAI Browser and an Applications folder"
    echo "4. They drag NazareAI Browser to Applications to install"
    echo ""
    echo "💡 To test the DMG:"
    echo "   open \"build_dmg/NazareAI Browser-0.1.0.dmg\"        # for Intel Macs"
    echo "   open \"build_dmg/NazareAI Browser-0.1.0-arm64.dmg\" # for Apple Silicon Macs"
else
    echo "❌ DMG creation failed. Check the error messages above."
    echo ""
    echo "Common issues:"
    echo "- Missing dependencies: Run 'npm install'"
    echo "- Icon issues: Check if build_dmg/icon.icns exists"
    echo "- Build errors: Run 'npm run build' separately to debug"
fi 