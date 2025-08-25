# 🤖 NazareAI Browser

**The Future of Web Browsing** - An AI-powered browser that understands natural language and can intelligently control web pages, extract information, and automate complex browsing tasks.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-37.2.1-blue.svg)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-blue.svg)](https://reactjs.org/)

## ✨ What Makes NazareAI Browser Different

Unlike traditional browsers that require manual navigation and complex extensions, NazareAI Browser features:

- **🧠 Natural Language Control**: Tell your browser what to do in plain English
- **🎯 Intelligent Automation**: AI automatically detects and executes browser actions
- **🔍 Smart Content Extraction**: Extract exactly what you need from any website
- **🛡️ Privacy-First**: All AI processing happens locally, your API keys never leave your device
- **🚀 Modern UX**: Clean, intuitive interface inspired by the best browser designs

## 🌟 Key Features

### 🤖 AI-Powered Browser Control
- **Natural Language Commands**: "Go to GitHub", "Search for AI tutorials", "Extract all links"
- **Intelligent Navigation**: AI understands context and performs the right actions
- **Page Interaction**: Scroll, click, fill forms, extract data - all through AI
- **Context Awareness**: AI understands what page you're on and adapts accordingly

### 🌐 Modern Browser Experience
- **Tabbed Browsing**: Full tab management with drag-and-drop support
- **Smart Address Bar**: Intelligent search and URL detection
- **Built-in Search**: Integrated with search.sh for privacy-focused results
- **Modern UI**: Clean, Arc-inspired design with smooth animations

### 🔧 Advanced Capabilities
- **Multiple AI Providers**: OpenAI, Anthropic, OpenRouter, Google Gemini
- **Secure API Management**: Local storage with encryption, never sent to servers
- **Command Palette**: Quick actions with ⌘K (Mac) or Ctrl+K (Windows/Linux)
- **Browser Automation**: Complex workflow automation through natural language
- **Page Analysis**: Extract text, links, images, metadata, and structured data
- **Domain-Specific Chats**: AI remembers context per website
- **PDF Support**: Full PDF reading and analysis capabilities

## ✨ What Makes NazareAI Browser Different

Unlike traditional browsers that require manual navigation and complex extensions, NazareAI Browser features:

- **🧠 Natural Language Control**: Tell your browser what to do in plain English
- **🎯 Intelligent Automation**: AI automatically detects and executes browser actions
- **🔍 Smart Content Extraction**: Extract exactly what you need from any website
- **🛡️ Privacy-First**: All AI processing happens locally, your API keys never leave your device
- **🚀 Modern UX**: Clean, intuitive interface inspired by the best browser designs

## 🌟 Key Features

### 🤖 AI-Powered Browser Control
- **Natural Language Commands**: "Go to GitHub", "Search for AI tutorials", "Extract all links"
- **Intelligent Navigation**: AI understands context and performs the right actions
- **Page Interaction**: Scroll, click, fill forms, extract data - all through AI
- **Context Awareness**: AI understands what page you're on and adapts accordingly

### 🌐 Modern Browser Experience
- **Tabbed Browsing**: Full tab management with drag-and-drop support
- **Smart Address Bar**: Intelligent search and URL detection
- **Built-in Search**: Integrated with search.sh for privacy-focused results
- **Modern UI**: Clean, Arc-inspired design with smooth animations

### 🔧 Advanced Capabilities
- **Multiple AI Providers**: OpenAI, Anthropic, OpenRouter, Google Gemini
- **Secure API Management**: Local storage with encryption, never sent to servers
- **Command Palette**: Quick actions with ⌘K (Mac) or Ctrl+K (Windows/Linux)
- **Browser Automation**: Complex workflow automation through natural language
- **Page Analysis**: Extract text, links, images, metadata, and structured data
- **Domain-Specific Chats**: AI remembers context per website
- **PDF Support**: Full PDF reading and analysis capabilities

## 🚀 Quick Start Commands

The AI automatically detects and executes browser actions from natural language:

### 🧭 Navigation & Search
```bash
"go to github.com"           # Navigate to website
"search for AI tutorials"    # Web search
"open reddit in new tab"     # New tab navigation
"find recipes online"        # Search action
```

### 🎮 Page Control & Interaction
```bash
"scroll down to see more"    # Scroll page
"click the login button"     # Element interaction
"go back to previous page"   # Navigation
"reload this page"          # Page refresh
```

### 📊 Content Extraction
```bash
"extract all links"          # Get all page links
"get the main article text"  # Extract content
"find all email addresses"   # Data extraction
"show me the page title"     # Metadata
```

### 📑 Tab Management
```bash
"open new tab"              # Create tab
"close this tab"            # Close current
"switch to next tab"        # Tab switching
"go to tab about AI"        # Named tab navigation
```

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js** 16+ (`node --version`)
- **npm** or **yarn** package manager
- **Git** for cloning the repository

### Quick Setup (3 minutes)

1. **Clone & Install**
   ```bash
   git clone https://github.com/nazareai/NazareAI-Browser.git
   cd NazareAI-Browser
   npm install
   ```

2. **Configure AI Provider**
   ```bash
   npm run dev
   ```
   - Open Settings → API Key Management
   - Add your API key (OpenAI, Anthropic, or OpenRouter)
   - Select preferred model

3. **Enable Browser Control**
   - Press **⌘J** (Mac) or **Ctrl+J** (Windows/Linux) to open AI Chat
   - Click settings icon in chat header
   - Enable "Browser Control" feature

### 🎨 Building for Production

#### Option 1: Quick Development Build
```bash
npm run build    # Build for development
npm run start    # Run built version
```

#### Option 2: macOS DMG Package (Recommended for Distribution)
```bash
npm run build:dmg
```
This creates a professional DMG installer with:
- ✅ Universal binary (Intel + Apple Silicon)
- ✅ Custom app icon and branding
- ✅ Drag-and-drop installation
- ✅ Proper macOS integration

#### Option 3: Cross-Platform Packages
```bash
npm run package          # All platforms
npm run package:mac      # macOS only
npm run package:dmg      # macOS DMG only
```

### 📦 Distribution Files
Built packages are saved to `build/` directory:
- **DMG**: `NazareAI Browser-0.1.0-arm64.dmg` (Apple Silicon)
- **DMG**: `NazareAI Browser-0.1.0-x64.dmg` (Intel)
- **ZIP**: `NazareAI Browser-0.1.0-arm64-mac.zip`

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **⌘K** | Open command palette |
| **⌘T** | New tab |
| **⌘W** | Close tab |
| **⌘J** | Toggle AI chat |
| **⌘N** | New window |
| **⌘R** | Refresh page |
| **⌘L** | Focus address bar |
| **⌘⌥I** | Developer tools |

## 📖 Usage Examples

### 💬 Basic AI Chat with Page Context
```bash
# 1. Navigate to any website (e.g., news article)
# 2. Press ⌘J to open AI Chat
# 3. Enable "Include page context" in settings
# 4. Ask intelligent questions:

"What is this article about?"           # AI summarizes content
"Extract key points from this page"    # AI extracts important information
"What are the main arguments?"         # AI analyzes the content
"Summarize this in 3 bullet points"    # AI provides structured summary
```

### 🤖 Advanced Browser Automation
```bash
# 1. Enable browser control in AI Chat settings
# 2. Type natural language commands:

"Go to github.com and search for React"     # Multi-step navigation
"Find the latest AI research papers"        # Intelligent search
"Extract all article titles and links"      # Data extraction
"Scroll to the bottom and click load more"  # Complex interaction
"Take me to YouTube and play cat videos"    # Cross-site workflow
```

### 🎯 Quick Actions via Command Palette
```bash
# Press ⌘K and type to find actions:

"Navigate to Google"          # Quick navigation
"Extract page content"        # Content extraction
"Scroll to top"              # Page control
"Open new tab"               # Tab management
"Toggle AI chat"             # Interface control
```

### 📄 PDF Analysis & Reading
```bash
# For PDF documents:
"Read this PDF and summarize it"              # Full PDF analysis
"What are the key findings?"                  # Extract specific information
"How many pages does this document have?"     # Metadata extraction
"Find all references to AI in this paper"     # Content search
```

## ⚙️ Configuration

### 🤖 AI Providers Setup

#### OpenRouter (Recommended - Multiple Models)
```bash
# Supports: GPT-4, Claude, Gemini, and more
Base URL: https://openrouter.ai/api/v1
Models: openai/gpt-5-mini, openai/gpt-4o, anthropic/claude-sonnet-4, anthropic/claude-opus-4.1, google/gemini-2.5-flash, google/gemini-2.5-pro
```

#### OpenAI (Direct)
```bash
# Direct OpenAI API access
Base URL: https://api.openai.com/v1
Models: openai/gpt-4o, openai/gpt-5-mini
```

#### Anthropic (Claude)
```bash
# Anthropic Claude models
Base URL: https://api.anthropic.com
Models: anthropic/claude-sonnet-4, anthropic/claude-opus-4.1
```

### 🔧 Browser Settings
- **Default Search**: search.sh (privacy-focused)
- **Browser Control**: Enable/disable AI automation
- **Page Context**: Include page content in AI chats
- **Theme**: Light/dark mode support
- **Permissions**: Granular control over site permissions

## Development

### Project Structure
```
/src
  /components     # React components
  /stores         # Zustand state management
  /types          # TypeScript type definitions
  App.tsx         # Main application component
  main.tsx        # React entry point

/electron         # Electron main process
```

### Key Components
- **BrowserStore**: Manages tabs, navigation, and browser actions
- **AIStore**: Handles AI providers, chat, and browser control
- **WebView**: Renders web content with automation capabilities
- **AIChat**: AI assistant interface with browser control
- **CommandPalette**: Quick action interface

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap

- [ ] MCP (Model Context Protocol) integration
- [ ] Local LLM support
- [ ] Advanced page automation
- [ ] Browser extension support
- [ ] Cross-platform improvements
- [ ] Performance optimizations

---

**Note**: This is an AI-powered browser that can control web pages and extract information. Use responsibly and be aware of the websites you're interacting with. 