#!/bin/bash

# Launch script for NazareAI Browser in development mode

# Set the app name for macOS menu bar
export ELECTRON_APP_NAME="NazareAI Browser"

# Build first
echo "Building NazareAI Browser..."
npm run build

# Launch with proper environment
echo "Launching NazareAI Browser..."
cd dist && ../node_modules/.bin/electron . --name="NazareAI Browser" 