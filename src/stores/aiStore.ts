import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AIProvider {
  id: string
  name: string
  apiKey?: string
  baseUrl?: string
  models: string[]
  selectedModel?: string
  isActive: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  actions?: BrowserAction[]
  actionResults?: BrowserActionResult[]
  domain?: string
  url?: string
}

export interface DomainChat {
  domain: string
  title: string
  messages: ChatMessage[]
  lastActivity: Date
  isPDF?: boolean
  pageType?: 'html' | 'pdf' | 'image' | 'video' | 'unknown'
}

// Import browser action types from browserStore
import type { BrowserAction, BrowserActionResult } from './browserStore'

interface AIState {
  providers: AIProvider[]
  activeProvider: string | null
  isConnected: boolean
  chatHistory: ChatMessage[] // Legacy - will be removed
  domainChats: Record<string, DomainChat>
  currentDomain: string | null
  isLoading: boolean
  streamingMessageId: string | null
  browserControlEnabled: boolean
  mcpServers: string[];
  
  // Actions
  addProvider: (provider: Omit<AIProvider, 'id'>) => void
  updateProvider: (id: string, updates: Partial<AIProvider>) => void
  setActiveProvider: (id: string) => void
  testConnection: (providerId: string) => Promise<boolean>
  chat: (message: string, context?: string) => Promise<string>
  streamChat: (message: string, context?: string) => Promise<void>
  updateStreamingMessage: (messageId: string, content: string) => void
  clearChatHistory: () => void
  initializeConnections: () => Promise<void>
  setBrowserControlEnabled: (enabled: boolean) => void
  parseBrowserActions: (message: string) => Promise<BrowserAction[]>
  executeBrowserActions: (actions: BrowserAction[]) => Promise<BrowserActionResult[]>
  enhanceMessageWithActions: (message: string) => Promise<string>
  executeWorkflow: (goal: string) => Promise<string>
  
  // Domain-specific chat actions
  switchToDomain: (domain: string, url: string, pageType?: 'html' | 'pdf' | 'image' | 'video' | 'unknown') => void
  getCurrentDomainChat: () => DomainChat | null
  clearDomainChat: (domain: string) => void
  getAllDomainChats: () => DomainChat[]
  detectPageType: (url: string) => 'html' | 'pdf' | 'image' | 'video' | 'unknown'
  addMcpServer: (url: string) => void;
}

const defaultProviders: AIProvider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    isActive: false,
    models: [
      'openai/gpt-5-mini',
      'openai/gpt-4o',
      'anthropic/claude-sonnet-4',
      'anthropic/claude-opus-4.1',
      'google/gemini-2.5-flash',
      'google/gemini-2.5-pro',
    ],
    selectedModel: 'openai/gpt-5-mini',
    baseUrl: 'https://openrouter.ai/api/v1'
  }
]

const STORAGE_VERSION = 5 // Increment to force migration

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      providers: defaultProviders,
      activeProvider: null,
      isConnected: false,
      chatHistory: [],
      domainChats: {},
      currentDomain: null,
      isLoading: false,
      streamingMessageId: null,
      browserControlEnabled: true,
      mcpServers: [],
      
      addProvider: (provider) => {
        const newProvider = {
          ...provider,
          id: crypto.randomUUID()
        }
        
        set((state) => ({
          providers: [...state.providers, newProvider]
        }))
      },
      
      updateProvider: (id, updates) => {
        set((state) => ({
          providers: state.providers.map(provider =>
            provider.id === id 
              ? { ...provider, ...updates }
              : provider
          )
        }))
        
        // Test connection if API key was updated
        if (updates.apiKey) {
          get().testConnection(id)
        }
      },
      
      setActiveProvider: (id) => {
        const provider = get().providers.find(p => p.id === id)
        if (provider && provider.apiKey) {
          set({ 
            activeProvider: id,
            isConnected: true
          })
        }
      },
      
      testConnection: async (providerId) => {
        const provider = get().providers.find(p => p.id === providerId)
        if (!provider || !provider.apiKey) return false
        
        try {
          // For OpenRouter, we need to test with a different endpoint
          const testUrl = provider.id === 'openrouter' 
            ? `${provider.baseUrl}/models` 
            : `${provider.baseUrl}/models`
            
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          }
          
          // OpenRouter uses different auth header format
          if (provider.id === 'openrouter') {
            headers['Authorization'] = `Bearer ${provider.apiKey}`
            headers['HTTP-Referer'] = window.location.href
            headers['X-Title'] = 'NazareAI Browser'
          } else {
            headers['Authorization'] = `Bearer ${provider.apiKey}`
          }
          
          const response = await fetch(testUrl, { headers })
          
          const isConnected = response.ok
          
          get().updateProvider(providerId, { isActive: isConnected })
          
          // Automatically set as active provider if connected
          if (isConnected) {
            set({ 
              activeProvider: providerId,
              isConnected: true
            })
          } else if (get().activeProvider === providerId) {
            set({ 
              activeProvider: null,
              isConnected: false 
            })
          }
          
          return isConnected
        } catch (error) {
          console.error('Connection test failed:', error)
          get().updateProvider(providerId, { isActive: false })
          
          if (get().activeProvider === providerId) {
            set({ 
              activeProvider: null,
              isConnected: false 
            })
          }
          
          return false
        }
      },
      
      setBrowserControlEnabled: (enabled: boolean) => {
        set({ browserControlEnabled: enabled })
      },

      parseBrowserActions: async (message: string) => {
        if (!get().browserControlEnabled) return []

        console.log('AI Store parseBrowserActions called:', { message })

        const { activeProvider, providers } = get()
        const provider = providers.find(p => p.id === activeProvider)
        
        if (!provider || !provider.apiKey) {
          console.log('No AI provider configured, cannot parse actions')
          return []
        }

        try {
          const systemPrompt = `You are a browser action parser that analyzes user messages to detect browser control commands.

IMPORTANT: Distinguish between QUESTIONS about the current page and COMMANDS to perform actions.

Questions about current page (return empty array []):
- "what is this page about?"
- "what does this site do?"
- "explain this content"
- "what is it about?"
- "summarize this page"
- "what am I looking at?"
- Any question asking for information about the CURRENT page

Commands that need actions (parse these):
- "go to X" → navigate to X
- "open X" → navigate to X  
- "search for X" → web search for X
- "find information about X" → web search for X
- "click X" → click element X
- "scroll down/up" → scroll page
- "get all links" → extract links

Available action types:
- navigate: Go to a URL or website (requires a destination)
- search: Search the web (requires a search term, NOT for current page questions)
- findAndClick: Click on an element by description (for clicking buttons, links, etc.)
- scrollPage: Scroll the page
- extractContent: Extract specific content (links, images, etc.)

RULES:
1. If user is asking ABOUT the current page, return []
2. Only parse actions that require CHANGING something or NAVIGATING elsewhere
3. "What is X?" without specific site = question about current content, not search
4. "Search for X" or "Find X online" = search action
5. Single words like "youtube" = navigate action
6. For ANY click command, use "findAndClick" with elementDescription

Examples:
- "what is it about?" → [] (question about current page)
- "what does this site do?" → [] (question about current page)
- "go to google.com" → [{"type": "navigate", "url": "google.com"}]
- "search for weather" → [{"type": "search", "query": "weather"}]
- "find recipes online" → [{"type": "search", "query": "recipes"}]
- "click login" → [{"type": "findAndClick", "elementDescription": "login"}]
- "click on the submit button" → [{"type": "findAndClick", "elementDescription": "submit button"}]
- "click the search icon" → [{"type": "findAndClick", "elementDescription": "search icon"}]
- "press the next button" → [{"type": "findAndClick", "elementDescription": "next button"}]
- "tap on home" → [{"type": "findAndClick", "elementDescription": "home"}]

Return ONLY a valid JSON array. Empty array [] for questions about current content.`

          const model = provider.selectedModel || provider.models[0]
          
          const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json',
              ...(provider.id === 'openrouter' ? { 'HTTP-Referer': window.location.href } : {})
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Parse browser actions from this message: "${message}"` }
              ],
              temperature: 0.1, // Lower temperature for more consistent parsing
              max_tokens: 500
            })
          })
          
          if (!response.ok) {
            console.error('Failed to parse browser actions:', response.statusText)
            return []
          }
          
          const data = await response.json()
          const aiResponse = data.choices?.[0]?.message?.content || ''
          
          console.log('AI parsing response:', aiResponse)
          
          // Parse the JSON response
          try {
            const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
              const actions = JSON.parse(jsonMatch[0])
              console.log('Parsed actions from AI:', actions)
              return Array.isArray(actions) ? actions : []
            } else {
              console.log('No JSON array found in AI response')
            }
          } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', parseError, aiResponse)
          }
        } catch (error) {
          console.error('Error in AI action parsing:', error)
        }

        // Return empty array if parsing fails
        return []
      },

      executeBrowserActions: async (actions: BrowserAction[]) => {
        const results: BrowserActionResult[] = []
        
        // Import browser store dynamically to avoid circular dependency
        const { useBrowserStore } = await import('./browserStore')
        const { executeBrowserAction } = useBrowserStore.getState()

        for (const action of actions) {
          try {
            const result = await executeBrowserAction(action)
            results.push(result)
          } catch (error) {
            results.push({
              success: false,
              message: `Failed to execute ${action.type}: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
          }
        }

        return results
      },

      enhanceMessageWithActions: async (message: string) => {
        const actions = await get().parseBrowserActions(message)
        
        if (actions.length === 0) return message

        const actionResults = await get().executeBrowserActions(actions)
        
        let enhancedMessage = message
        
        // Add action results context to the message
        if (actionResults.some(r => r.success)) {
          enhancedMessage += '\n\n[Browser Actions Executed]:\n'
          actionResults.forEach((result, index) => {
            if (result.success) {
              enhancedMessage += `✅ ${actions[index].type}: ${result.message}\n`
              if (result.data) {
                enhancedMessage += `   Data: ${JSON.stringify(result.data).slice(0, 200)}...\n`
              }
            } else {
              enhancedMessage += `❌ ${actions[index].type}: ${result.message}\n`
            }
          })
        }

        return enhancedMessage
      },
      
      chat: async (message, context) => {
        const { activeProvider, providers, browserControlEnabled, currentDomain } = get()
        const provider = providers.find(p => p.id === activeProvider)
        
        if (!provider || !provider.apiKey) {
          throw new Error('No active AI provider configured')
        }

        // Get current domain chat
        const domainChat = get().getCurrentDomainChat()
        const isPDF = domainChat?.pageType === 'pdf'
        
        // Enhanced context handling for long documents and PDFs
        const enhanceContextForLongContent = (originalContext: string) => {
          if (!originalContext) return originalContext
          
          const contextLength = originalContext.length
          
          if (contextLength > 50000) {
            // For very long content, create a smart summary
            const lines = originalContext.split('\n')
            const summary = lines.slice(0, 20).join('\n') + 
                          '\n\n[CONTENT TRUNCATED - This is a very long document]\n\n' +
                          lines.slice(-10).join('\n')
            
            return summary + `\n\n[Note: Original content was ${contextLength} characters. This is a condensed version. Ask for specific sections if needed.]`
          } else if (contextLength > 20000) {
            // For moderately long content, include first and last parts
            const firstPart = originalContext.slice(0, 8000)
            const lastPart = originalContext.slice(-4000)
            
            return firstPart + '\n\n[MIDDLE CONTENT TRUNCATED]\n\n' + lastPart + 
                  `\n\n[Note: Document was ${contextLength} characters. Middle section truncated for efficiency.]`
          }
          
          return originalContext
        }
        
        // Parse and execute browser actions if enabled (allow for PDFs with navigation actions)
        let enhancedMessage = message
        let actions: BrowserAction[] = []
        let actionResults: BrowserActionResult[] = []

        if (browserControlEnabled) {
          actions = await get().parseBrowserActions(message)
          
          // For PDFs, filter to only allow navigation actions
          if (isPDF) {
            actions = actions.filter(action => 
              ['navigate', 'newTab', 'closeTab', 'switchTab', 'goBack', 'goForward', 'reload', 'search'].includes(action.type)
            )
          }
          
          if (actions.length > 0) {
            actionResults = await get().executeBrowserActions(actions)
            
            // Add successful action results to context
            const successfulResults = actionResults.filter(r => r.success)
            if (successfulResults.length > 0) {
              const actionContext = successfulResults.map((result, i) => 
                `${actions[i].type}: ${result.message}${result.data ? ` (Data: ${JSON.stringify(result.data).slice(0, 500)}...)` : ''}`
              ).join('\n')
              
              context = context ? `${context}\n\n[Recent Browser Actions]:\n${actionContext}` : `[Recent Browser Actions]:\n${actionContext}`
            }
          }
        }

        // Enhanced context processing
        if (context) {
          context = enhanceContextForLongContent(context)
        }

        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: message,
          timestamp: new Date(),
          actions: actions.length > 0 ? actions : undefined,
          actionResults: actionResults.length > 0 ? actionResults : undefined,
          domain: currentDomain || undefined,
          url: domainChat?.title
        }
        
        // Add to domain-specific chat history
        if (currentDomain && domainChat) {
          set((state) => ({
            domainChats: {
              ...state.domainChats,
              [currentDomain]: {
                ...domainChat,
                messages: [...domainChat.messages, userMessage],
                lastActivity: new Date()
              }
            }
          }))
        } else {
          // Fallback to global chat history for backward compatibility
          set((state) => ({
            chatHistory: [...state.chatHistory, userMessage]
          }))
        }
        
        try {
          // Use the selected model or fall back to first model
          const model = provider.selectedModel || provider.models[0]
          
          // Enhanced system prompt based on page type
          let systemPrompt = ''
          
          if (isPDF) {
            systemPrompt = `You are an AI assistant with full PDF document reading capabilities. The user is currently viewing a PDF file: "${domainChat?.title || 'PDF Document'}".

CRITICAL: You HAVE FULL ACCESS to PDF content. The browser automatically extracts and provides PDF text content in the context. You can read, analyze, and discuss any PDF content that appears in the context.

Your PDF capabilities include:
- Reading and analyzing the complete PDF text content provided
- Answering specific questions about the document content
- Summarizing any section or the entire document
- Finding and explaining specific information, quotes, or data
- Discussing concepts, arguments, and themes in the document
- Comparing information across different sections
- Providing detailed analysis of tables, lists, and structured data
- Explaining technical content and terminology

When PDF content is provided in the context (which happens automatically), treat it as fully readable text that you can analyze completely. Never claim you cannot read PDFs - you have full access to the extracted content.

If for some reason no PDF content appears in the context, then ask the user to describe what they see, but this should be rare as extraction is automatic.`
          } else if (browserControlEnabled) {
            systemPrompt = `You are an AI assistant that can control a web browser. ${currentDomain ? `The user is currently on the domain: ${currentDomain}.` : 'No tabs are currently open.'}

IMPORTANT: When the user gives browser commands, they are executed AUTOMATICALLY before you respond. You will see the results in [Recent Browser Actions] section.

Your capabilities:
- Navigate to websites (go to, visit, open URLs)
- Search the web (search for, find, look up)
- Click elements (click, press, tap)
- Scroll pages (scroll up/down/top/bottom)
- Extract content (get links, images, text)
- Fill forms and interact with page elements

When browser actions are executed:
- ✅ means SUCCESS: Acknowledge what was done: "I've navigated to..."
- ❌ means FAILURE: Explain the error and suggest alternatives
- Look for "Script error:" or "Failed to" messages
- NEVER claim success if you see ❌ or error messages

Examples:
- User: "go to google.com"
  [✅ navigate: Navigated to URL successfully] → "I've navigated to Google.com for you."
  
- User: "click the login button"
  [❌ findAndClick: Script error: Could not find element matching: login button] → "I couldn't find a login button on this page. Could you describe it differently, or perhaps it has a different label like 'Sign In' or 'Log In'?"
  
- User: "search for weather"
  [✅ search: Navigated to search results] → "I've searched for weather information. Here are the results."

CRITICAL: Always check the action results before responding. If you see an error, acknowledge it and help the user.

${!currentDomain ? 'Since no tabs are open, navigation commands will open new tabs.' : ''}

For long documents, content may be chunked. Ask for specific sections if needed.`
          } else {
            systemPrompt = `You are a helpful AI assistant for web browsing${currentDomain ? ` on the domain: ${currentDomain}` : ''}. ${!currentDomain ? 'No tabs are currently open. I can help you with general questions or open websites for you.' : ''}

For long documents, content may be presented in summary form. Ask for specific sections if you need more detail.`
          }

          const messages = [
            { role: 'system', content: systemPrompt },
            ...(context ? [{ role: 'system', content: `Context: ${context}` }] : []),
            { role: 'user', content: enhancedMessage }
          ]
          
          // Simplified chat implementation
          const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json',
              ...(provider.id === 'openrouter' ? { 'HTTP-Referer': window.location.href } : {})
            },
            body: JSON.stringify({
              model: model,
              messages: messages
            })
          })
          
          const data = await response.json()
          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.choices?.[0]?.message?.content || 'No response',
            timestamp: new Date(),
            domain: currentDomain || undefined,
            url: domainChat?.title
          }
          
          // Add to domain-specific chat history
          if (currentDomain && domainChat) {
            set((state) => ({
              domainChats: {
                ...state.domainChats,
                [currentDomain]: {
                  ...state.domainChats[currentDomain],
                  messages: [...state.domainChats[currentDomain].messages, assistantMessage],
                  lastActivity: new Date()
                }
              }
            }))
          } else {
            // Fallback to global chat history
            set((state) => ({
              chatHistory: [...state.chatHistory, assistantMessage]
            }))
          }
          
          return assistantMessage.content
        } catch (error) {
          console.error('Chat error:', error)
          throw error
        }
      },
      
      streamChat: async (message, context) => {
        console.log('🟡 streamChat called:', { message, contextLength: context?.length || 0 })
        
        const { activeProvider, providers, browserControlEnabled, currentDomain } = get()
        const provider = providers.find(p => p.id === activeProvider)
        
        console.log('🟡 AI Provider check:', { activeProvider, hasProvider: !!provider, hasApiKey: !!provider?.apiKey })
        
        if (!provider || !provider.apiKey) {
          console.error('❌ No active AI provider configured')
          throw new Error('No active AI provider configured')
        }

        // Get current domain chat
        const domainChat = get().getCurrentDomainChat()
        const isPDF = domainChat?.pageType === 'pdf'
        
        console.log('🟡 Domain chat info:', { currentDomain, isPDF, pageType: domainChat?.pageType })

        // Enhanced context handling for long documents and PDFs
        const enhanceContextForLongContent = (originalContext: string) => {
          if (!originalContext) return originalContext
          
          const contextLength = originalContext.length
          
          if (contextLength > 50000) {
            // For very long content, create a smart summary
            const lines = originalContext.split('\n')
            const summary = lines.slice(0, 20).join('\n') + 
                          '\n\n[CONTENT TRUNCATED - This is a very long document]\n\n' +
                          lines.slice(-10).join('\n')
            
            return summary + `\n\n[Note: Original content was ${contextLength} characters. This is a condensed version. Ask for specific sections if needed.]`
          } else if (contextLength > 20000) {
            // For moderately long content, include first and last parts
            const firstPart = originalContext.slice(0, 8000)
            const lastPart = originalContext.slice(-4000)
            
            return firstPart + '\n\n[MIDDLE CONTENT TRUNCATED]\n\n' + lastPart + 
                  `\n\n[Note: Document was ${contextLength} characters. Middle section truncated for efficiency.]`
          }
          
          return originalContext
        }

        // Parse and execute browser actions if enabled (allow for PDFs with navigation actions)
        let actions: BrowserAction[] = []
        let actionResults: BrowserActionResult[] = []

        if (browserControlEnabled) {
          actions = await get().parseBrowserActions(message)
          
          // For PDFs, filter to only allow navigation actions
          if (isPDF) {
            actions = actions.filter(action => 
              ['navigate', 'newTab', 'closeTab', 'switchTab', 'goBack', 'goForward', 'reload', 'search'].includes(action.type)
            )
          }
          
          if (actions.length > 0) {
            actionResults = await get().executeBrowserActions(actions)
            
            // Add successful action results to context
            const successfulResults = actionResults.filter(r => r.success)
            if (successfulResults.length > 0) {
              const actionContext = successfulResults.map((result, i) => 
                `${actions[i].type}: ${result.message}${result.data ? ` (Data: ${JSON.stringify(result.data).slice(0, 500)}...)` : ''}`
              ).join('\n')
              
              context = context ? `${context}\n\n[Recent Browser Actions]:\n${actionContext}` : `[Recent Browser Actions]:\n${actionContext}`
            }
          }
        }

        // Enhanced context processing
        if (context) {
          context = enhanceContextForLongContent(context)
        }
        
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: message,
          timestamp: new Date(),
          actions: actions.length > 0 ? actions : undefined,
          actionResults: actionResults.length > 0 ? actionResults : undefined,
          domain: currentDomain || undefined,
          url: domainChat?.title
        }
        
        // Create assistant message placeholder
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          domain: currentDomain || undefined,
          url: domainChat?.title
        }
        
        // Add to domain-specific chat history
        if (currentDomain && domainChat) {
          set((state) => ({
            domainChats: {
              ...state.domainChats,
              [currentDomain]: {
                ...domainChat,
                messages: [...domainChat.messages, userMessage, assistantMessage],
                lastActivity: new Date()
              }
            },
            isLoading: true,
            streamingMessageId: assistantMessage.id
          }))
        } else {
          // Fallback to global chat history
          set((state) => ({
            chatHistory: [...state.chatHistory, userMessage, assistantMessage],
            isLoading: true,
            streamingMessageId: assistantMessage.id
          }))
        }
        
        try {
          const model = provider.selectedModel || provider.models[0]
          
          console.log('🟡 Preparing API call:', { model, contextLength: context?.length || 0, isPDF })
          
          // Enhanced system prompt based on page type
          let systemPrompt = ''
          
          if (isPDF) {
            systemPrompt = `You are an AI assistant with full PDF document reading capabilities. The user is currently viewing a PDF file: "${domainChat?.title || 'PDF Document'}".

CRITICAL: You HAVE FULL ACCESS to PDF content. The browser automatically extracts and provides PDF text content in the context. You can read, analyze, and discuss any PDF content that appears in the context.

Your PDF capabilities include:
- Reading and analyzing the complete PDF text content provided
- Answering specific questions about the document content
- Summarizing any section or the entire document
- Finding and explaining specific information, quotes, or data
- Discussing concepts, arguments, and themes in the document
- Comparing information across different sections
- Providing detailed analysis of tables, lists, and structured data
- Explaining technical content and terminology

When PDF content is provided in the context (which happens automatically), treat it as fully readable text that you can analyze completely. Never claim you cannot read PDFs - you have full access to the extracted content.

If for some reason no PDF content appears in the context, then ask the user to describe what they see, but this should be rare as extraction is automatic.`
          } else if (browserControlEnabled) {
            systemPrompt = `You are an AI assistant that can control a web browser. ${currentDomain ? `The user is currently on the domain: ${currentDomain}.` : 'No tabs are currently open.'}

IMPORTANT: When the user gives browser commands, they are executed AUTOMATICALLY before you respond. You will see the results in [Recent Browser Actions] section.

Your capabilities:
- Navigate to websites (go to, visit, open URLs)
- Search the web (search for, find, look up)
- Click elements (click, press, tap)
- Scroll pages (scroll up/down/top/bottom)
- Extract content (get links, images, text)
- Fill forms and interact with page elements

When browser actions are executed:
- ✅ means SUCCESS: Acknowledge what was done: "I've navigated to..."
- ❌ means FAILURE: Explain the error and suggest alternatives
- Look for "Script error:" or "Failed to" messages
- NEVER claim success if you see ❌ or error messages

Examples:
- User: "go to google.com"
  [✅ navigate: Navigated to URL successfully] → "I've navigated to Google.com for you."
  
- User: "click the login button"
  [❌ findAndClick: Script error: Could not find element matching: login button] → "I couldn't find a login button on this page. Could you describe it differently, or perhaps it has a different label like 'Sign In' or 'Log In'?"
  
- User: "search for weather"
  [✅ search: Navigated to search results] → "I've searched for weather information. Here are the results."

CRITICAL: Always check the action results before responding. If you see an error, acknowledge it and help the user.

${!currentDomain ? 'Since no tabs are open, navigation commands will open new tabs.' : ''}

For long documents, content may be chunked. Ask for specific sections if needed.`
          } else {
            systemPrompt = `You are a helpful AI assistant for web browsing${currentDomain ? ` on the domain: ${currentDomain}` : ''}. ${!currentDomain ? 'No tabs are currently open. I can help you with general questions or open websites for you.' : ''}

For long documents, content may be presented in summary form. Ask for specific sections if you need more detail.`
          }

          const messages = [
            { role: 'system', content: systemPrompt },
            ...(context ? [{ role: 'system', content: `Context: ${context}` }] : []),
            { role: 'user', content: message }
          ]
          
          console.log('🟡 Making API call to:', provider.baseUrl, { messageCount: messages.length, model })
          
          const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json',
              ...(provider.id === 'openrouter' ? { 'HTTP-Referer': window.location.href } : {})
            },
            body: JSON.stringify({
              model: model,
              messages: messages,
              stream: true
            })
          })
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          
          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let accumulatedContent = ''
          
          if (!reader) {
            throw new Error('No response body')
          }
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')
            
            for (const line of lines) {
              if (line.trim() === '' || line.trim() === 'data: [DONE]') continue
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  const content = data.choices?.[0]?.delta?.content || ''
                  if (content) {
                    accumulatedContent += content
                    get().updateStreamingMessage(assistantMessage.id, accumulatedContent)
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
          
          set({
            isLoading: false,
            streamingMessageId: null
          })
          
        } catch (error) {
          console.error('❌ Stream chat error:', error)
          console.error('❌ Error details:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })
          set({
            isLoading: false,
            streamingMessageId: null
          })
          throw error
        }
      },
      
      updateStreamingMessage: (messageId, content) => {
        const { currentDomain, domainChats } = get()
        
        if (currentDomain && domainChats[currentDomain]) {
          // Update in domain-specific chat
          set((state) => ({
            domainChats: {
              ...state.domainChats,
              [currentDomain]: {
                ...state.domainChats[currentDomain],
                messages: state.domainChats[currentDomain].messages.map(msg =>
                  msg.id === messageId ? { ...msg, content } : msg
                )
              }
            }
          }))
        } else {
          // Fallback to global chat history
          set((state) => ({
            chatHistory: state.chatHistory.map(msg =>
              msg.id === messageId ? { ...msg, content } : msg
            )
          }))
        }
      },
      
      clearChatHistory: () => {
        const { currentDomain } = get()
        
        if (currentDomain) {
          // Clear current domain chat
          get().clearDomainChat(currentDomain)
        } else {
          // Clear global chat history
          set({ chatHistory: [] })
        }
      },
      
      initializeConnections: async () => {
        const { providers, testConnection, setActiveProvider } = get()
        
        // For the new setup, we only have OpenRouter
        const openRouter = providers.find(p => p.id === 'openrouter')
        if (openRouter?.apiKey) {
          const isConnected = await testConnection('openrouter')
          if (isConnected) {
            // This is already done in testConnection, but ensure it's set
            setActiveProvider('openrouter')
          }
        }
      },
      
      executeWorkflow: async (goal) => {
        const steps = await get().chat(`Break down this goal into browser actions: ${goal}`)
        const actions = JSON.parse(steps)
        for (const action of actions) {
          await get().executeBrowserActions([action])
        }
        return 'Workflow completed'
      },
      
      // Domain-specific chat actions
      switchToDomain: (domain, url, pageType) => {
        if (!domain) {
          // Clear current domain when empty domain is passed
          set({ currentDomain: null })
          return
        }
        
        set((state) => ({
          currentDomain: domain,
          domainChats: {
            ...state.domainChats,
            [domain]: state.domainChats[domain] || {
              domain,
              title: url,
              lastActivity: new Date(),
              messages: [],
              isPDF: false,
              pageType: pageType || 'unknown'
            }
          }
        }))
      },
      
      getCurrentDomainChat: () => {
        const { currentDomain, domainChats } = get()
        return currentDomain ? domainChats[currentDomain] : null
      },
      
      clearDomainChat: (domain) => {
        set((state) => {
          const { [domain]: removed, ...remainingChats } = state.domainChats
          const newCurrentDomain = state.currentDomain === domain ? null : state.currentDomain
          return {
            domainChats: remainingChats,
            currentDomain: newCurrentDomain
          }
        })
      },
      
      getAllDomainChats: () => {
        const { domainChats } = get()
        return Object.values(domainChats).filter(Boolean)
      },
      
      detectPageType: (url) => {
        if (!url || url === 'about:blank') return 'unknown'
        
        const lowerUrl = url.toLowerCase()
        if (lowerUrl.includes('.pdf') || lowerUrl.includes('application/pdf')) return 'pdf'
        if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image'
        if (lowerUrl.match(/\.(mp4|webm|mov|avi|mkv)$/)) return 'video'
        if (lowerUrl.startsWith('http')) return 'html'
        
        return 'unknown'
      },
      addMcpServer: (url) => {
        set((state) => ({
          mcpServers: [...state.mcpServers, url]
        }));
      }
    }),
    {
      name: 'ai-storage',
      version: STORAGE_VERSION,
      partialize: (state) => ({
        providers: state.providers.map(p => ({
          ...p,
          isActive: false // Reset active state on reload
        })),
        activeProvider: state.activeProvider,
        browserControlEnabled: state.browserControlEnabled,
        domainChats: state.domainChats,
        currentDomain: state.currentDomain
      }),
      migrate: (persistedState: any, version: number) => {
        // Force migration to use updated models
        if (version < STORAGE_VERSION) {
          const openRouterProvider = defaultProviders[0] // Get latest models
          const existingOpenRouter = persistedState.providers?.find(
            (p: AIProvider) => p.id === 'openrouter'
          )
          
          return {
            ...persistedState,
            providers: [{
              ...openRouterProvider, // This will include the latest models
              apiKey: existingOpenRouter?.apiKey || persistedState.providers?.find((p: AIProvider) => p.apiKey)?.apiKey || '',
              isActive: !!existingOpenRouter?.apiKey,
              selectedModel: openRouterProvider.selectedModel // Use the default selected model
            }],
            activeProvider: existingOpenRouter?.apiKey ? 'openrouter' : null,
            isConnected: !!existingOpenRouter?.apiKey,
            browserControlEnabled: persistedState.browserControlEnabled ?? true,
            domainChats: persistedState.domainChats || {},
            currentDomain: persistedState.currentDomain || null
          }
        }
        
        return persistedState
      }
    }
  )
) 