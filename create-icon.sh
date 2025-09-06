#!/bin/bash

# Create a simple icon for NazareAI Browser
echo "Creating placeholder icon for NazareAI Browser..."

# Ensure build_dmg directory exists
mkdir -p build_dmg

# Create a 1024x1024 PNG with a gradient background
cat > build_dmg/create_icon.py << 'EOF'
from PIL import Image, ImageDraw, ImageFont
import os

# Create a 1024x1024 image
size = 1024
img = Image.new('RGB', (size, size), color='white')
draw = ImageDraw.Draw(img)

# Create gradient background
for y in range(size):
    r = int(30 + (y / size) * 30)  # Dark blue to slightly lighter
    g = int(30 + (y / size) * 60)
    b = int(100 + (y / size) * 100)
    draw.rectangle([(0, y), (size, y+1)], fill=(r, g, b))

# Draw a circle in the center
center = size // 2
radius = size // 3
draw.ellipse(
    [(center - radius, center - radius), 
     (center + radius, center + radius)],
    fill=(255, 255, 255, 30),
    outline=(255, 255, 255, 100),
    width=8
)

# Add text (N for NazareAI)
try:
    # Try to use a nice font if available
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 400)
except:
    font = None

text = "N"
if font:
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    text_x = center - text_width // 2
    text_y = center - text_height // 2 - 50
    draw.text((text_x, text_y), text, fill=(255, 255, 255), font=font)

# Save the PNG
img.save('build_dmg/icon.png')
print("Icon created successfully!")
EOF

# Check if Python and PIL are available
if command -v python &> /dev/null && python -c "import PIL" 2> /dev/null; then
    python build_dmg/create_icon.py
    
    # Convert PNG to ICNS using macOS tools
    if [ -f "build_dmg/icon.png" ]; then
        echo "Converting to ICNS format..."
        # Create iconset directory
        mkdir -p build_dmg/icon.iconset
        
        # Generate different sizes
        sips -z 16 16     build_dmg/icon.png --out build_dmg/icon.iconset/icon_16x16.png
        sips -z 32 32     build_dmg/icon.png --out build_dmg/icon.iconset/icon_16x16@2x.png
        sips -z 32 32     build_dmg/icon.png --out build_dmg/icon.iconset/icon_32x32.png
        sips -z 64 64     build_dmg/icon.png --out build_dmg/icon.iconset/icon_32x32@2x.png
        sips -z 128 128   build_dmg/icon.png --out build_dmg/icon.iconset/icon_128x128.png
        sips -z 256 256   build_dmg/icon.png --out build_dmg/icon.iconset/icon_128x128@2x.png
        sips -z 256 256   build_dmg/icon.png --out build_dmg/icon.iconset/icon_256x256.png
        sips -z 512 512   build_dmg/icon.png --out build_dmg/icon.iconset/icon_256x256@2x.png
        sips -z 512 512   build_dmg/icon.png --out build_dmg/icon.iconset/icon_512x512.png
        sips -z 1024 1024 build_dmg/icon.png --out build_dmg/icon.iconset/icon_512x512@2x.png
        
        # Convert to icns
        iconutil -c icns build_dmg/icon.iconset -o build_dmg/icon.icns
        
        # Clean up
        rm -rf build_dmg/icon.iconset
        rm -f build_dmg/create_icon.py
        
        echo "✅ Icon created successfully at build_dmg/icon.icns"
    fi
else
    echo "⚠️  Python with PIL not found. Creating a simple placeholder icon..."
    
    # Create a simple 1024x1024 blue square as PNG using ImageMagick if available
    if command -v convert &> /dev/null; then
        convert -size 1024x1024 \
            -define gradient:angle=45 \
            gradient:'#1e3a8a-#3b82f6' \
            -fill white -gravity center -pointsize 500 -annotate +0+0 'N' \
            build_dmg/icon.png
            
        # Convert to ICNS
        mkdir -p build_dmg/icon.iconset
        sips -z 16 16     build_dmg/icon.png --out build_dmg/icon.iconset/icon_16x16.png 2>/dev/null
        sips -z 32 32     build_dmg/icon.png --out build_dmg/icon.iconset/icon_16x16@2x.png 2>/dev/null
        sips -z 32 32     build_dmg/icon.png --out build_dmg/icon.iconset/icon_32x32.png 2>/dev/null
        sips -z 64 64     build_dmg/icon.png --out build_dmg/icon.iconset/icon_32x32@2x.png 2>/dev/null
        sips -z 128 128   build_dmg/icon.png --out build_dmg/icon.iconset/icon_128x128.png 2>/dev/null
        sips -z 256 256   build_dmg/icon.png --out build_dmg/icon.iconset/icon_128x128@2x.png 2>/dev/null
        sips -z 256 256   build_dmg/icon.png --out build_dmg/icon.iconset/icon_256x256.png 2>/dev/null
        sips -z 512 512   build_dmg/icon.png --out build_dmg/icon.iconset/icon_256x256@2x.png 2>/dev/null
        sips -z 512 512   build_dmg/icon.png --out build_dmg/icon.iconset/icon_512x512.png 2>/dev/null
        sips -z 1024 1024 build_dmg/icon.png --out build_dmg/icon.iconset/icon_512x512@2x.png 2>/dev/null
        iconutil -c icns build_dmg/icon.iconset -o build_dmg/icon.icns 2>/dev/null
        rm -rf build_dmg/icon.iconset
        echo "✅ Icon created with ImageMagick"
    else
        echo "❌ Could not create icon. Please create an icon manually:"
        echo "   1. Create a 1024x1024 PNG image named 'icon.png'"
        echo "   2. Place it in the 'build_dmg' directory"
        echo "   3. Run: ./create-icon.sh again"
    fi
fi 