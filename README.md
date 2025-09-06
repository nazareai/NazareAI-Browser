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

2. **Start Development Server**
   ```bash
   npm run dev    # Starts both Vite (frontend) and Electron (desktop app)
   ```
   - The app will open automatically
   - **Note**: In development mode, macOS will show "Electron" in the menu bar instead of "NazareAI Browser"

3. **Configure AI Provider**
   - Open Settings (⚙️ icon) → API Key Management
   - Add your API key (OpenAI, Anthropic, or OpenRouter)
   - Select preferred model

4. **Enable Browser Control**
   - Press **⌘J** (Mac) or **Ctrl+J** (Windows/Linux) to open AI Chat
   - Click settings icon in chat header
   - Enable "Browser Control" feature

### 🛠️ Development

```bash
npm run build    # You need to package it first
npm run dev      # Start development server (Vite + Electron) - USE THIS FOR DEVELOPMENT
```

**Important Notes**:
- ⚠️ `npm run start` does NOT work for development - always use `npm run dev`
- In development mode, the app will show "Electron" in the macOS menu bar instead of "NazareAI Browser"
- This is a known Electron limitation that only affects development - the production build will display the correct app name

### 🎨 Building for Production

#### Option 1: Quick Production Build
```bash
npm run build    # Build the app
# Note: To run the built version, you need to package it first (see Option 2 or 3)
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
Built packages are saved to `build_dmg/` directory:
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

## 📖 AI-Powered Page Analysis Examples

### 🧠 Content Analysis & Summarization
```bash
# Navigate to any content-rich page (news, articles, documentation)
# Press ⌘J to open AI Chat, enable "Include page context"

"What is the main topic of this article?"              # Core subject identification
"Summarize this page in 2 paragraphs"                 # Concise overview
"What are the 5 most important points?"               # Key information extraction
"Explain this concept in simple terms"                # Simplification
"Give me the TL;DR version"                           # Ultra-brief summary
```

### 🔍 Information Extraction & Search
```bash
"Is there any mention of artificial intelligence?"    # Content search
"Find all dates mentioned on this page"               # Temporal information
"Extract all email addresses and phone numbers"       # Contact information
"What are the key statistics or numbers?"             # Quantitative data
"List all the companies or organizations mentioned"   # Entity extraction
"Find references to specific technologies"             # Technical mentions
```

### 📊 Data Analysis & Tables
```bash
"Analyze this table and explain the trends"           # Data interpretation
"What are the highest/lowest values in this data?"    # Comparative analysis
"Calculate the percentage changes"                    # Mathematical analysis
"Summarize the key metrics and KPIs"                  # Business data analysis
"Compare these two datasets"                          # Comparative insights
```

### 🎯 Fact-Checking & Verification
```bash
"Is this information accurate?"                        # Factual verification
"What are the sources cited?"                         # Source analysis
"Are there any conflicting statements?"               # Contradiction detection
"How current is this information?"                    # Timeliness assessment
"What evidence supports these claims?"                # Evidence evaluation
```

### 🏗️ Structure & Organization
```bash
"What is the structure of this document?"             # Content organization
"How is this page organized?"                         # Layout analysis
"What are the main sections?"                         # Content segmentation
"Create an outline of this page"                     # Structural overview
"How does this content flow logically?"               # Flow analysis
```

### 🔬 Technical Analysis
```bash
"What technologies are mentioned?"                    # Technical content
"Explain the technical concepts on this page"         # Technical breakdown
"What programming languages or frameworks?"          # Development analysis
"Are there any code examples or APIs?"               # Technical extraction
"What are the system requirements?"                   # Specification analysis
```

### 📈 Comparative & Evaluative
```bash
"Compare the pros and cons mentioned"                 # Balanced analysis
"What are the advantages and disadvantages?"         # Critical evaluation
"How does this compare to industry standards?"        # Benchmarking
"What are the best practices described?"              # Recommendation analysis
"What are the potential risks or drawbacks?"          # Risk assessment
```

### 🎨 Content Quality & Style
```bash
"What is the writing style?"                          # Style analysis
"Is this content well-structured?"                   # Quality assessment
"What is the target audience?"                       # Audience analysis
"How readable is this content?"                      # Readability evaluation
"What is the tone and sentiment?"                    # Sentiment analysis
```

### 📝 Research & Study Assistance
```bash
"Extract key quotes from this article"               # Quote extraction
"What are the main arguments presented?"             # Argument analysis
"Summarize the methodology used"                     # Method analysis
"What are the conclusions reached?"                  # Conclusion extraction
"What further research is suggested?"                # Research direction
```

### 🗣️ Language & Communication
```bash
"What is the main message or call to action?"        # Communication analysis
"Are there any persuasive elements?"                 # Persuasion analysis
"What emotions does this content evoke?"             # Emotional analysis
"What is the intended impact on readers?"            # Impact assessment
```

### 🤖 Advanced AI-Powered Operations
```bash
# With browser control enabled:
"Read this entire page and create a study guide"     # Comprehensive analysis
"Extract all actionable insights"                    # Actionable information
"Find similar content on other sites"                # Cross-reference search
"Create a mind map of this topic"                    # Conceptual mapping
"Generate questions about this content"              # Question generation
"Suggest related topics to explore"                  # Topic expansion
"Identify the most important paragraphs"             # Content prioritization
"Rewrite this in academic language"                  # Style transformation
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

## 🐛 Troubleshooting

### App Shows "Electron" Instead of "NazareAI Browser" in Menu Bar

This is a known limitation when running in development mode (`npm run dev`). The app name will display correctly when:

1. **Built and packaged**: Run `npm run package:mac` to create a proper `.app` bundle
2. **DMG installer**: Run `npm run build:dmg` for the best experience
3. **Production build**: The packaged app will show "NazareAI Browser" correctly

This only affects the menu bar name - all other functionality works normally in development.

### Common Issues

- **Can't close last tab**: By design, the browser always keeps at least one tab open
- **API keys not saving**: Make sure you click "Save" after entering your API key
- **AI commands not working**: Ensure "Browser Control" is enabled in the AI chat settings

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