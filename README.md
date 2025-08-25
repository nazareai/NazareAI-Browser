# NazareAI Browser

A modern Electron-based browser with built-in AI assistance and intelligent browser control capabilities.

## Features

### 🌐 Modern Browser Experience
- Tabbed browsing with WebView support
- Intelligent address bar with search integration
- Built-in search.sh integration
- Modern UI inspired by Arc browser

### 🤖 AI-Powered Browser Control
- **Natural Language Commands**: Control your browser with natural language
- **Intelligent Navigation**: Ask AI to navigate to websites, search, or perform actions
- **Content Extraction**: Extract text, links, images, and structured data from web pages
- **Page Interaction**: Scroll, click elements, fill forms, and more through AI commands
- **Context Awareness**: AI understands the current page context and can answer questions about it

### 🔧 Advanced Features
- Multiple AI provider support (OpenAI, Anthropic, OpenRouter)
- Secure API key management
- Command palette (⌘K) for quick actions
- Browser action automation
- Page content analysis
- Developer tools integration

## NazareAI Browser Control Commands

The AI can automatically detect and execute browser actions from natural language. Here are some examples:

### Navigation
- "Go to google.com"
- "Navigate to https://github.com"
- "Search for artificial intelligence"
- "Open YouTube in a new tab"

### Page Control
- "Scroll down"
- "Go to the top of the page"
- "Reload this page"
- "Go back"
- "Go forward"

### Content Extraction
- "Extract all links from this page"
- "Get all images on this page"
- "Extract the main text content"
- "Show me the page structure"

### Tab Management
- "Open a new tab"
- "Close this tab"
- "Switch to the next tab"

### Advanced Actions
- "Click on the first link"
- "Fill out the form with my email"
- "Find all mentions of 'AI' on this page"
- "Get page metadata"

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set up AI Provider**
   - Click the Settings button in the bottom toolbar
   - Add your API key for OpenAI, Anthropic, or OpenRouter
   - Select your preferred model

3. **Enable Browser Control**
   - Open AI Chat (⌘J or click the chat icon)
   - Click the settings icon in the chat header
   - Enable "Browser Control" feature

4. **Start Development**
   ```bash
   npm run dev
   ```

## Keyboard Shortcuts

- **⌘K** - Open command palette
- **⌘T** - New tab
- **⌘W** - Close tab
- **⌘J** - Toggle AI chat
- **⌘⌥I** - Open developer tools

## Usage Examples

### Basic Chat with Page Context
1. Navigate to any website
2. Open AI Chat (⌘J)
3. Enable "Include page context"
4. Ask questions about the current page

### Browser Automation
1. Open AI Chat
2. Enable browser control in settings
3. Type commands like:
   - "Go to reddit.com"
   - "Search for machine learning tutorials"
   - "Extract all the article links"
   - "Scroll down to see more content"

### Quick Actions via Command Palette
1. Press ⌘K to open command palette
2. Type to search for actions:
   - "Navigate" - Quick navigation
   - "Extract" - Extract page data
   - "Scroll" - Scroll controls
   - "AI" - AI-related commands

## Configuration

### AI Providers
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-3.5-turbo
- **Anthropic**: Claude-3.5-Sonnet, Claude-3.5-Haiku
- **OpenRouter**: Multiple models including Gemini, Claude, and more

### Browser Settings
- Default search engine: search.sh
- Browser control can be enabled/disabled
- Page context inclusion is optional

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