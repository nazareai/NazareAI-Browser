import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useBrowserStore } from './browserStore'

// Helper function to get browser store state
const getBrowserStore = () => useBrowserStore.getState()

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

// Enhanced interfaces for agentic workflows
export interface WorkflowStep {
  id: string
  description: string
  action: BrowserAction
  status: 'pending' | 'executing' | 'completed' | 'failed'
  result?: BrowserActionResult
  timestamp: Date
}

export interface AgenticWorkflow {
  id: string
  goal: string
  steps: WorkflowStep[]
  currentStep: number
  status: 'planning' | 'executing' | 'completed' | 'failed'
  results: BrowserActionResult[]
  startTime: Date
  endTime?: Date
}

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

  // Agentic workflow state
  currentWorkflow: AgenticWorkflow | null
  workflowEnabled: boolean

  // Actions
  addProvider: (provider: Omit<AIProvider, 'id'>) => void
  updateProvider: (id: string, updates: Partial<AIProvider>) => void
  disconnectProvider: (id: string) => void
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

  // Agentic workflow actions
  startWorkflow: (goal: string) => Promise<void>
  executeWorkflowStep: () => Promise<void>
  cancelWorkflow: () => void
  setWorkflowEnabled: (enabled: boolean) => void

  // Domain-specific chat actions
  switchToDomain: (domain: string, url: string, pageType?: 'html' | 'pdf' | 'image' | 'video' | 'unknown') => void
  getCurrentDomainChat: () => DomainChat | null
  clearDomainChat: (domain: string) => void
  getAllDomainChats: () => DomainChat[]
  detectPageType: (url: string) => 'html' | 'pdf' | 'image' | 'video' | 'unknown'
  addMcpServer: (url: string) => void;
}

// Helper function to parse workflow steps from text when JSON parsing fails
function parseWorkflowFromText(text: string, goal: string): any[] {
  const steps: any[] = []
  const lines = text.split('\n').filter(line => line.trim().length > 0)

  console.log('🔍 Parsing text lines:', lines.length)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const lowerLine = line.toLowerCase()

    // Skip empty lines or comments
    if (!line || line.startsWith('//') || line.startsWith('#')) continue

    console.log(`📝 Processing line: "${line}"`)

    // Look for navigation patterns
    if (lowerLine.includes('navigate') || lowerLine.includes('go to') || lowerLine.includes('visit') || lowerLine.includes('open')) {
      const urlMatch = line.match(/https?:\/\/[^\s<>"{}()\[\]]+/i)
      if (urlMatch) {
        steps.push({
          action: 'navigate',
          target: urlMatch[0],
          description: `Navigate to ${urlMatch[0]}`,
          parameters: {},
          expectedResult: 'Page loads successfully'
        })
        console.log('✅ Added navigation step')
      }
    }

    // Look for search patterns
    if (lowerLine.includes('search') && !lowerLine.includes('navigate')) {
      const searchMatch = line.match(/(?:search for|find)\s+(.+?)(?:\s|$|[.,!])/i)
      const query = searchMatch ? searchMatch[1].trim() : goal.replace(/find|search|buy|get/i, '').trim()
      if (query && query.length > 2) {
        steps.push({
          action: 'search',
          target: query,
          description: `Search for "${query}"`,
          parameters: { query },
          expectedResult: 'Search results page loads'
        })
        console.log('✅ Added search step')
      }
    }

    // Look for click patterns
    if (lowerLine.includes('click') || lowerLine.includes('press') || lowerLine.includes('select') || lowerLine.includes('tap')) {
      const elementMatch = line.match(/(?:click|press|select|tap)\s+(?:on\s+)?(.+?)(?:\s|$|[.,!])/i)
      if (elementMatch) {
        const element = elementMatch[1].trim()
        // Skip if element contains malformed JSON fragments
        if (!element.includes('field') && !element.includes('}') && !element.includes('{')) {
          steps.push({
            action: 'findAndClick',
            target: element,
            description: `Click on ${element}`,
            parameters: { elementDescription: element },
            expectedResult: 'Element clicked successfully'
          })
          console.log('✅ Added click step')
        }
      }
    }

    // Look for input patterns
    if (lowerLine.includes('input') || lowerLine.includes('enter') || lowerLine.includes('type') || lowerLine.includes('fill')) {
      const inputMatch = line.match(/(?:input|enter|type|fill)\s+(.+?)(?:\s|$|[.,!])/i)
      if (inputMatch) {
        const text = inputMatch[1].trim()
        // Skip if text contains malformed JSON fragments
        if (!text.includes('field') && !text.includes('}') && !text.includes('{') && text.length > 1) {
          steps.push({
            action: 'fillForm',
            target: 'input field',
            description: `Enter "${text}"`,
            parameters: {
              text,
              selector: 'input[type="text"], input:not([type]), textarea, [contenteditable]'
            },
            expectedResult: 'Text entered successfully'
          })
          console.log('✅ Added input step')
        }
      }
    }

    // Look for scroll patterns
    if (lowerLine.includes('scroll')) {
      const direction = lowerLine.includes('up') ? 'up' : lowerLine.includes('top') ? 'top' : 'down'
      steps.push({
        action: 'scrollPage',
        target: direction,
        description: `Scroll ${direction}`,
        parameters: { scrollDirection: direction },
        expectedResult: 'Page scrolled successfully'
      })
      console.log('✅ Added scroll step')
    }
  }

  console.log(`📋 Text parsing found ${steps.length} valid steps`)
  return steps
}

// Helper function to create intelligent fallback workflows based on goal analysis
function createIntelligentFallbackWorkflow(goal: string): any[] {
  const lowerGoal = goal.toLowerCase()

  // Enhanced flight search workflow with smart parameter extraction
  if (lowerGoal.includes('flight') || lowerGoal.includes('ticket') || lowerGoal.includes('book')) {
    // Extract flight details from the goal
    const extractFlightDetails = (goal: string) => {
      const lower = goal.toLowerCase()

      // Extract cities using common patterns
      const cityPattern = /(?:from\s+)?([A-Za-z\s]+?)(?:\s+to\s+)([A-Za-z\s]+?)(?:\s+on|\s+for|\s*$)/i
      const cityMatch = goal.match(cityPattern)

      // Extract dates
      const datePattern = /(?:on\s+)?([A-Za-z]+\s+\d+|\d+\/\d+\/\d+|\d+-\d+-\d+)/i
      const dateMatch = goal.match(datePattern)

      // Extract passenger info
      const passengerPattern = /(\d+)\s+(?:adult|person|passenger)/i
      const passengerMatch = goal.match(passengerPattern)

      // Determine trip type
      const tripType = lower.includes('round trip') || lower.includes('return') ? 'round-trip' : 'one-way'

      return {
        from: cityMatch ? cityMatch[1].trim() : '',
        to: cityMatch ? cityMatch[2].trim() : '',
        date: dateMatch ? dateMatch[1].trim() : '',
        passengers: passengerMatch ? parseInt(passengerMatch[1]) : 1,
        tripType
      }
    }

    const details = extractFlightDetails(goal)

    console.log('✈️ Extracted flight details:', details)

    return [
      {
        action: 'navigate',
        target: 'https://www.google.com/flights',
        description: 'Navigate to Google Flights for comprehensive flight search',
        parameters: {},
        expectedResult: 'Google Flights page loads successfully'
      },
      {
        action: 'findAndClick',
        target: 'departure city field',
        description: 'Click on departure city input field',
        parameters: { elementDescription: 'departure city input field or button' },
        expectedResult: 'Departure field activated for input'
      },
      {
        action: 'fillForm',
        target: 'departure city',
        description: `Enter ${details.from} as departure city`,
        parameters: {
          text: details.from,
          selector: 'input[placeholder*="departure"], input[name*="from"], [data-testid*="departure"]'
        },
        expectedResult: `${details.from} entered successfully`
      },
      {
        action: 'findAndClick',
        target: 'destination city field',
        description: 'Click on destination city input field',
        parameters: { elementDescription: 'destination city input field or button' },
        expectedResult: 'Destination field activated for input'
      },
      {
        action: 'fillForm',
        target: 'destination city',
        description: `Enter ${details.to} as destination`,
        parameters: {
          text: details.to,
          selector: 'input[placeholder*="destination"], input[name*="to"], [data-testid*="destination"]'
        },
        expectedResult: `${details.to} entered successfully`
      },
      ...(details.date ? [{
        action: 'findAndClick',
        target: 'date field',
        description: 'Click on date selection field',
        parameters: { elementDescription: 'departure date input field' },
        expectedResult: 'Date field activated'
      },
      {
        action: 'fillForm',
        target: 'departure date',
        description: `Enter ${details.date} as travel date`,
        parameters: {
          text: details.date,
          selector: 'input[placeholder*="date"], input[name*="date"], [data-testid*="date"]'
        },
        expectedResult: `${details.date} entered successfully`
      }] : []),
      {
        action: 'findAndClick',
        target: 'search flights',
        description: 'Click search button to find flights',
        parameters: { elementDescription: 'search flights button or submit button' },
        expectedResult: 'Flight search initiated successfully'
      },
      {
        action: 'extractContent',
        target: 'flight results',
        description: 'Extract flight options and pricing information',
        parameters: { selector: '.flight-result, .flight-card, [data-flight], .result' },
        expectedResult: 'Flight information extracted successfully'
      }
    ].filter(step => step !== null)
  }

  // Hotel search workflow - improved with proper parameters
  if (lowerGoal.includes('hotel') || lowerGoal.includes('stay') || lowerGoal.includes('accommodation')) {
    return [
      {
        action: 'navigate',
        target: 'https://www.booking.com',
        description: 'Navigate to Booking.com for hotel search',
        parameters: {},
        expectedResult: 'Booking.com page loads successfully'
      },
      {
        action: 'findAndClick',
        target: 'search box',
        description: 'Click on hotel search input field',
        parameters: { elementDescription: 'hotel search input field or destination field' },
        expectedResult: 'Search field activated for input'
      },
      {
        action: 'fillForm',
        target: 'hotel destination',
        description: 'Enter hotel destination and dates',
        parameters: {
          text: 'Paris hotels',
          selector: 'input[placeholder*="destination"], input[name*="destination"], #ss'
        },
        expectedResult: 'Hotel destination entered successfully'
      },
      {
        action: 'findAndClick',
        target: 'search hotels',
        description: 'Click search button to find hotels',
        parameters: { elementDescription: 'search hotels button or submit button' },
        expectedResult: 'Hotel search initiated successfully'
      },
      {
        action: 'extractContent',
        target: 'hotel results',
        description: 'Extract hotel options and pricing information',
        parameters: { selector: '.hotel-card, .sr-hotel-card, [data-hotel], .result' },
        expectedResult: 'Hotel information extracted successfully'
      }
    ]
  }

  // Product shopping workflow - improved with proper parameters
  if (lowerGoal.includes('buy') || lowerGoal.includes('purchase') || lowerGoal.includes('price')) {
    return [
      {
        action: 'navigate',
        target: 'https://www.amazon.com',
        description: 'Navigate to Amazon for product search',
        parameters: {},
        expectedResult: 'Amazon page loads successfully'
      },
      {
        action: 'findAndClick',
        target: 'search box',
        description: 'Click on Amazon search input field',
        parameters: { elementDescription: 'Amazon search box or input field' },
        expectedResult: 'Search field activated for input'
      },
      {
        action: 'fillForm',
        target: 'product search',
        description: 'Enter product search terms',
        parameters: {
          text: goal.replace(/buy|purchase|price/gi, '').trim(),
          selector: 'input[placeholder*="search"], #twotabsearchtextbox'
        },
        expectedResult: 'Product search terms entered successfully'
      },
      {
        action: 'findAndClick',
        target: 'search button',
        description: 'Click Amazon search button',
        parameters: { elementDescription: 'Amazon search button or submit button' },
        expectedResult: 'Product search initiated successfully'
      },
      {
        action: 'extractContent',
        target: 'product results',
        description: 'Extract product information and pricing',
        parameters: { selector: '.s-result-item, .product-card, [data-product], .result' },
        expectedResult: 'Product information extracted successfully'
      }
    ]
  }

  // Research workflow - improved with proper parameters
  if (lowerGoal.includes('research') || lowerGoal.includes('study') || lowerGoal.includes('learn')) {
    return [
      {
        action: 'navigate',
        target: 'https://www.google.com',
        description: 'Navigate to Google for research',
        parameters: {},
        expectedResult: 'Google page loads successfully'
      },
      {
        action: 'findAndClick',
        target: 'search box',
        description: 'Click on Google search input field',
        parameters: { elementDescription: 'Google search box or input field' },
        expectedResult: 'Search field activated for input'
      },
      {
        action: 'fillForm',
        target: 'research query',
        description: 'Enter research query',
        parameters: {
          text: goal,
          selector: 'input[name="q"], [data-testid*="search"]'
        },
        expectedResult: 'Research query entered successfully'
      },
      {
        action: 'findAndClick',
        target: 'search button',
        description: 'Click Google search button',
        parameters: { elementDescription: 'Google search button or submit button' },
        expectedResult: 'Research search initiated successfully'
      },
      {
        action: 'extractContent',
        target: 'research results',
        description: 'Extract key research information from results',
        parameters: { selector: '.result, .g, article, .content' },
        expectedResult: 'Research information extracted successfully'
      }
    ]
  }

  // Default intelligent workflow - improved with proper parameters
  return [
    {
      action: 'navigate',
      target: 'https://www.google.com',
      description: 'Navigate to Google for comprehensive search',
      parameters: {},
      expectedResult: 'Google page loads successfully'
    },
    {
      action: 'findAndClick',
      target: 'search box',
      description: 'Click on Google search input field',
      parameters: { elementDescription: 'Google search box or input field' },
      expectedResult: 'Search field activated for input'
    },
    {
      action: 'fillForm',
      target: 'search query',
      description: 'Enter search query',
      parameters: {
        text: goal,
        selector: 'input[name="q"], [data-testid*="search"]'
      },
      expectedResult: 'Search query entered successfully'
    },
    {
      action: 'findAndClick',
      target: 'search button',
      description: 'Click Google search button',
      parameters: { elementDescription: 'Google search button or submit button' },
      expectedResult: 'Search initiated successfully'
    },
    {
      action: 'extractContent',
      target: 'search results',
      description: 'Extract relevant information from search results',
      parameters: { selector: '.result, .g, .content, article' },
      expectedResult: 'Search results extracted successfully'
    }
  ]
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

const STORAGE_VERSION = 6 // Increment to force migration and update models

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

      // Agentic workflow state
      currentWorkflow: null,
      workflowEnabled: true,
      
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

      disconnectProvider: (id) => {
        set((state) => ({
          providers: state.providers.map(provider =>
            provider.id === id
              ? { ...provider, apiKey: '', isActive: false }
              : provider
          )
        }))

        // If this was the active provider, clear it
        if (get().activeProvider === id) {
          set({
            activeProvider: null,
            isConnected: false
          })
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

          if (response.status === 401) {
            console.error(`401 Unauthorized for ${providerId} - API key may be invalid or blocked`)
            get().updateProvider(providerId, { isActive: false })

            if (get().activeProvider === providerId) {
              set({
                activeProvider: null,
                isConnected: false
              })
            }

            return false
          }

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

      setWorkflowEnabled: (enabled: boolean) => {
        set({ workflowEnabled: enabled })
      },

      // Agentic workflow implementation
      startWorkflow: async (goal: string) => {
        const { activeProvider, providers, workflowEnabled } = get()
        const provider = providers.find(p => p.id === activeProvider)

        if (!provider || !provider.apiKey || !workflowEnabled) {
          throw new Error('No active AI provider configured or workflows disabled')
        }

        console.log('╔═══════════════════════════════════════════════════════')
        console.log('║ 🚀 STARTING AGENTIC WORKFLOW')
        console.log('╠═══════════════════════════════════════════════════════')
        console.log('║ Goal:', goal)
        console.log('║ Provider:', provider.id)
        console.log('║ Model:', provider.selectedModel || provider.models[0])
        console.log('║ Workflow Enabled:', workflowEnabled)
        console.log('╚═══════════════════════════════════════════════════════')

        // Enhanced workflow planning with specific detail extraction
        const planningPrompt = `Create a detailed browser automation workflow for this complex task: "${goal}"

First, extract key details from the request:
- For flights: departure city, destination, dates, passengers, trip type (one-way/round-trip)
- For hotels: location, check-in/out dates, guests, preferences
- For shopping: product type, budget, preferences, quantity

Then create a JSON array of specific, actionable steps:

Available actions and their required parameters:
- navigate: {"action": "navigate", "target": "https://url.com", "description": "...", "parameters": {}, "expectedResult": "..."}
- search: {"action": "search", "target": "search query", "description": "...", "parameters": {"query": "query"}, "expectedResult": "..."}
- findAndClick: {"action": "findAndClick", "target": "element", "description": "...", "parameters": {"elementDescription": "description"}, "expectedResult": "..."}
- fillForm: {"action": "fillForm", "target": "field", "description": "...", "parameters": {"text": "text", "selector": "css selector"}, "expectedResult": "..."}
- extractContent: {"action": "extractContent", "target": "content", "description": "...", "parameters": {"selector": "css selector"}, "expectedResult": "..."}

FLIGHT BOOKING WORKFLOW EXAMPLE:
For "find me the cheapest flight from Prague to Paris on September 1st, one way, one adult":
[
  {
    "action": "navigate",
    "target": "https://www.google.com/flights",
    "description": "Navigate to Google Flights for comprehensive search",
    "parameters": {},
    "expectedResult": "Flights search page loads successfully"
  },
  {
    "action": "waitForElement",
    "target": "departure city input",
    "description": "Wait for departure city input field to be available",
    "parameters": {"selector": "input[placeholder*='Where'], input[aria-label*='departure'], [data-testid*='departure']"},
    "expectedResult": "Departure input field is ready for interaction"
  },
  {
    "action": "findAndClick",
    "target": "departure city field",
    "description": "Click departure city input field",
    "parameters": {"elementDescription": "departure city input field or button"},
    "expectedResult": "Departure field activated for input"
  },
  {
    "action": "fillForm",
    "target": "departure city",
    "description": "Enter Prague as departure city",
    "parameters": {"text": "Prague", "selector": "input[placeholder*='Where'], input[aria-label*='departure'], [data-testid*='departure']"},
    "expectedResult": "Prague entered successfully"
  },
  {
    "action": "findAndClick",
    "target": "destination city field",
    "description": "Click destination city input field",
    "parameters": {"elementDescription": "destination city input field or button"},
    "expectedResult": "Destination field activated for input"
  },
  {
    "action": "fillForm",
    "target": "destination city",
    "description": "Enter Paris as destination",
    "parameters": {"text": "Paris", "selector": "input[placeholder*='Where'], input[aria-label*='destination'], [data-testid*='destination']"},
    "expectedResult": "Paris entered successfully"
  },
  {
    "action": "findAndClick",
    "target": "departure date field",
    "description": "Click departure date field",
    "parameters": {"elementDescription": "departure date input or button"},
    "expectedResult": "Date picker opens"
  },
  {
    "action": "fillForm",
    "target": "departure date",
    "description": "Enter September 1st as departure date",
    "parameters": {"text": "Sep 1", "selector": "input[type='date'], input[placeholder*='date'], [data-testid*='date']"},
    "expectedResult": "September 1st selected"
  },
  {
    "action": "findAndClick",
    "target": "search flights button",
    "description": "Click search button to find flights",
    "parameters": {"elementDescription": "Search flights button or submit button"},
    "expectedResult": "Flight search initiated"
  },
  {
    "action": "extractContent",
    "target": "search results",
    "description": "Extract flight search results and pricing",
    "parameters": {"selector": ".flight-results, .search-results, [data-testid*='results']"},
    "expectedResult": "Flight results extracted successfully"
  }
]

IMPORTANT: For modern web apps like Google Flights, Kayak, Expedia:
- Always include waitForElement steps after navigation to ensure page loads
- Use specific selectors like [data-testid], [aria-label], input[placeholder*='...']
- Add delays between interactions to let the page respond
- For complex forms, break down into smaller, focused steps

Return ONLY the JSON array with all required parameters filled in for: ${goal}`

        try {
          const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json',
              ...(provider.id === 'openrouter' ? { 'HTTP-Referer': window.location.href } : {})
            },
            body: JSON.stringify({
              model: provider.selectedModel || provider.models[0],
              messages: [
                { role: 'system', content: planningPrompt },
                { role: 'user', content: `Create a step-by-step plan to: ${goal}` }
              ],
              temperature: 0.3, // Lower temperature for more structured planning
              max_tokens: 100000 // Increased for comprehensive planning
            })
          })

          if (response.status === 401) {
            console.error(`401 Unauthorized - API key may be invalid or blocked for ${provider.name}`)
            get().disconnectProvider(provider.id)
            throw new Error('API key is invalid or blocked. Please check your API key or disconnect and reconnect with a new one.')
          }

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`)
          }

          const data = await response.json()
          const planText = data.choices?.[0]?.message?.content || ''

          console.log('📋 Generated workflow plan:', planText)

          // Parse the JSON plan with robust error handling
          let steps: any[] = []

          console.log('📋 Raw plan text:', planText)

          // Strategy 1: Clean and parse JSON
          try {
            // Clean the text to remove markdown and extra content
            let cleanText = planText.trim()

            // Remove markdown code blocks if present
            cleanText = cleanText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')

            // Find and extract JSON array
            const jsonMatch = cleanText.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
              const jsonString = jsonMatch[0]
              console.log('🔍 Extracted JSON string:', jsonString)

              steps = JSON.parse(jsonString)
              if (Array.isArray(steps) && steps.length > 0) {
                console.log('✅ Successfully parsed', steps.length, 'workflow steps')

                // Validate and clean steps
                const validSteps = steps.filter(step =>
                  step && typeof step === 'object' &&
                  step.action && step.description &&
                  typeof step.parameters === 'object'
                ).map(step => ({
                  action: step.action,
                  target: step.target || '',
                  description: step.description || `Step with ${step.action}`,
                  parameters: step.parameters || {},
                  expectedResult: step.expectedResult || 'Step completed'
                }))

                if (validSteps.length > 0) {
                  console.log('✅ Valid workflow steps:', validSteps.length)
                  steps = validSteps
                } else {
                  console.log('❌ No valid steps found in JSON')
                  steps = []
                }
              }
            }
          } catch (parseError) {
            console.log('❌ JSON parsing failed:', parseError instanceof Error ? parseError.message : String(parseError))
            steps = []
          }

          // Strategy 2: Text parsing fallback
          if (!steps || steps.length === 0) {
            console.log('🔄 No valid JSON found, attempting text parsing...')
            steps = parseWorkflowFromText(planText, goal)
          }

          // Strategy 3: Intelligent fallback
          if (!steps || steps.length === 0) {
            console.log('🎯 Creating intelligent fallback workflow...')
            steps = createIntelligentFallbackWorkflow(goal)
          }

          // Ensure we have at least one step
          if (!steps || steps.length === 0) {
            steps = [{
              action: 'search',
              target: goal,
              description: `Search for "${goal}"`,
              parameters: { query: goal },
              expectedResult: 'Search results page loads'
            }]
          }

          console.log('╔═══════════════════════════════════════════════════════')
          console.log('║ 📋 WORKFLOW PLAN CREATED')
          console.log('╠═══════════════════════════════════════════════════════')
          console.log('║ Total Steps:', steps.length)
          console.log('╚═══════════════════════════════════════════════════════')
          
          steps.forEach((step, index) => {
            console.log(`\nStep ${index + 1}: ${step.description}`)
            console.log(`  Action: ${step.action}`)
            console.log(`  Target: ${step.target}`)
            if (step.parameters) {
              console.log(`  Parameters:`, step.parameters)
            }
          })

          // Validate and create workflow steps with proper parameters
          const validateStepParameters = (step: any): boolean => {
            const requiredParams: Record<string, string[]> = {
              'navigate': ['target'], // URL is required
              'search': ['query'], // Search query is required
              'findAndClick': ['elementDescription'], // Element description is required
              'fillForm': ['text'], // Text is required, selector is optional
              'scrollPage': [], // No required params, has defaults
              'extractContent': [], // No required params
              'newTab': [], // URL optional, defaults to about:blank
              'closeTab': [], // tabId optional, uses current tab
              'switchTab': ['tabId'], // tabId is required
              'goBack': [], // No params needed
              'goForward': [], // No params needed
              'reload': [], // No params needed
              'clickElement': ['selector'], // Selector is required
              'waitForElement': ['selector'], // Selector is required
              'screenshot': [], // Optional description
              'analyzeContent': [], // No params needed
              'smartFillForm': [], // Optional parameters
              'extractTable': [], // Optional selector
              'waitAndExtract': [] // No params needed
            }

            const actionType = step.action
            const params = step.parameters || {}
            const target = step.target

            // Check if action type is supported
            if (!requiredParams[actionType]) {
              console.error(`Unsupported action type: ${actionType}`)
              return false
            }

            // Check required parameters
            const required = requiredParams[actionType]
            for (const param of required) {
              if (param === 'target' && !target) {
                console.error(`Missing required target for ${actionType}`)
                return false
              }
              if (param !== 'target' && !params[param]) {
                console.error(`Missing required parameter '${param}' for ${actionType}`)
                return false
              }
            }

            // Special validation for URLs
            if (actionType === 'navigate' && target) {
              if (!target.startsWith('http://') && !target.startsWith('https://')) {
                console.error(`Invalid URL format: ${target}`)
                return false
              }
            }

            return true
          }

          // Filter and validate steps
          console.log('\n🔍 Validating workflow steps...')
          const validSteps = steps.filter((step, index) => {
            const isValid = validateStepParameters(step)
            if (!isValid) {
              console.log(`❌ Step ${index + 1} INVALID: ${step.description}`)
              console.log(`   Action: ${step.action}`)
              console.log(`   Parameters:`, step.parameters || 'none')
            } else {
              console.log(`✅ Step ${index + 1} VALID: ${step.description}`)
            }
            return isValid
          })

          if (validSteps.length === 0) {
            console.log('💥 FATAL: No valid workflow steps could be created!')
            throw new Error('No valid workflow steps could be created. All steps are missing required parameters.')
          }

          if (validSteps.length < steps.length) {
            console.log(`⚠️ WARNING: Filtered out ${steps.length - validSteps.length} invalid steps`)
          }

          // Create workflow steps with proper BrowserAction format
          const workflowSteps: WorkflowStep[] = validSteps.map((step, index) => {
            // Map workflow action to BrowserAction format
            const browserAction: BrowserAction = {
              type: step.action as any,
              ...(step.target && step.action === 'navigate' ? { url: step.target } : {}),
              ...(step.parameters?.query ? { query: step.parameters.query } : {}),
              ...(step.parameters?.elementDescription ? { elementDescription: step.parameters.elementDescription } : {}),
              ...(step.parameters?.text ? { text: step.parameters.text } : {}),
              ...(step.parameters?.selector ? { selector: step.parameters.selector } : {}),
              ...(step.parameters?.scrollDirection ? { scrollDirection: step.parameters.scrollDirection } : {}),
              ...(step.parameters?.tabId ? { tabId: step.parameters.tabId } : {}),
              ...(step.parameters?.formData ? { formData: step.parameters.formData } : {})
            }
            
            console.log(`📝 Created browser action for step ${index + 1}:`, browserAction)
            
            return {
              id: crypto.randomUUID(),
              description: step.description || `Step ${index + 1}`,
              action: browserAction,
              status: 'pending',
              timestamp: new Date()
            }
          })

          const workflow: AgenticWorkflow = {
            id: crypto.randomUUID(),
            goal,
            steps: workflowSteps,
            currentStep: 0,
            status: 'executing',
            results: [],
            startTime: new Date()
          }

          set({ currentWorkflow: workflow })
          
          console.log('\n╔═══════════════════════════════════════════════════════')
          console.log('║ 🎯 WORKFLOW READY FOR EXECUTION')
          console.log('╠═══════════════════════════════════════════════════════')
          console.log('║ Workflow ID:', workflow.id)
          console.log('║ Total Steps:', workflowSteps.length)
          console.log('║ Status:', workflow.status)
          console.log('╚═══════════════════════════════════════════════════════')
          
          console.log('\n📋 EXECUTION PLAN:')
          workflowSteps.forEach((step, index) => {
            console.log(`${index + 1}. ${step.description} [${step.action.type}]`)
          })

          // Auto-execute first step after a small delay to ensure UI updates
          console.log('⚡ Starting workflow execution...')
          setTimeout(async () => {
            try {
              await get().executeWorkflowStep()
            } catch (execError) {
              console.error('❌ Failed to execute first workflow step:', execError)
              // Update workflow status to failed
              set((state) => ({
                ...state,
                currentWorkflow: state.currentWorkflow ? {
                  ...state.currentWorkflow,
                  status: 'failed',
                  endTime: new Date()
                } : null
              }))
            }
          }, 500)

        } catch (error) {
          console.error('❌ Failed to create workflow:', error)
          // Update workflow status to failed
          set({ currentWorkflow: null })
          throw error
        }
      },

      executeWorkflowStep: async () => {
        const { currentWorkflow } = get()
        console.log('🔍 Checking workflow execution:', {
          hasWorkflow: !!currentWorkflow,
          status: currentWorkflow?.status,
          currentStep: currentWorkflow?.currentStep,
          totalSteps: currentWorkflow?.steps.length
        })

        if (!currentWorkflow || currentWorkflow.status !== 'executing') {
          console.log('❌ Workflow not ready for execution')
          return
        }

        const currentStep = currentWorkflow.steps[currentWorkflow.currentStep]
        const stepNumber = currentWorkflow.currentStep + 1
        
        console.log('═══════════════════════════════════════════════════════')
        console.log(`📍 WORKFLOW STEP ${stepNumber}/${currentWorkflow.steps.length}`)
        console.log('═══════════════════════════════════════════════════════')
        console.log('📋 Step Details:', {
          number: stepNumber,
          description: currentStep.description,
          action: currentStep.action.type,
          status: currentStep.status,
          parameters: currentStep.action
        })
        console.log('═══════════════════════════════════════════════════════')
        
        if (!currentStep || currentStep.status !== 'pending') {
          console.log('❌ Current step not ready for execution')
          return
        }

        console.log(`⚡ STARTING EXECUTION: Step ${stepNumber} - ${currentStep.description}`)

        // Mark step as executing
        set((state) => {
          if (state.currentWorkflow) {
            return {
              ...state,
              currentWorkflow: {
                ...state.currentWorkflow,
                steps: state.currentWorkflow.steps.map((step, index) =>
                  index === currentWorkflow.currentStep
                    ? { ...step, status: 'executing' as const }
                    : step
                )
              }
            }
          }
          return state
        })

        try {
          console.log('┌─────────────────────────────────────────────────────')
          console.log(`│ 🔧 EXECUTING ACTION: ${currentStep.action.type}`)
          console.log('├─────────────────────────────────────────────────────')
          console.log('│ Action Parameters:', JSON.stringify(currentStep.action, null, 2))
          console.log('└─────────────────────────────────────────────────────')

          // For findAndClick and fillForm actions, enhance with page context
          let enhancedAction = currentStep.action

          if (currentStep.action.type === 'findAndClick' || currentStep.action.type === 'fillForm') {
            console.log('🔍 Enhancing action with page context...')

            // Extract page elements for intelligent decision making
            const pageElements = await useBrowserStore.getState().getPageElements()
            console.log('🔍 Page elements extracted:', pageElements.length, 'characters')

            // For findAndClick, find the best element selector
            if (currentStep.action.type === 'findAndClick') {
              const elementDescription = currentStep.action.elementDescription
              console.log('🎯 Finding element:', elementDescription)

              // Use AI to find the best selector based on page elements
              const { activeProvider, providers } = get()
              const provider = providers.find(p => p.id === activeProvider)

              if (provider && provider.apiKey && pageElements.length > 100) {
                const selectorPrompt = `Given this page elements analysis, find the best CSS selector or element description for: "${elementDescription}"

PAGE ELEMENTS:
${pageElements}

Return only a JSON object with the best selector strategy:
{
  "selector": "CSS selector or element description",
  "strategy": "css|text|id|class|attribute",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation"
}`

                try {
                  const selectorResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${provider.apiKey}`,
                      'Content-Type': 'application/json',
                      ...(provider.id === 'openrouter' ? { 'HTTP-Referer': window.location.href } : {})
                    },
                    body: JSON.stringify({
                      model: provider.selectedModel || provider.models[0],
                      messages: [{ role: 'user', content: selectorPrompt }],
                      temperature: 0.1,
                      max_tokens: 500
                    })
                  })

                  if (selectorResponse.ok) {
                    const selectorData = await selectorResponse.json()
                    const selectorResult = JSON.parse(selectorData.choices?.[0]?.message?.content || '{}')

                    if (selectorResult.selector) {
                      console.log('🎯 AI-suggested selector:', selectorResult)
                      enhancedAction = {
                        ...currentStep.action,
                        elementDescription: selectorResult.selector
                      }
                    }
                  }
                } catch (error) {
                  console.log('❌ Selector enhancement failed, using original:', error)
                }
              }
            }

            // For fillForm, find the best input selector
            else if (currentStep.action.type === 'fillForm') {
              const text = currentStep.action.text
              const selector = currentStep.action.selector
              console.log('⌨️ Enhancing input action for:', text)

              // Use page context to find better selector if current one is generic
              if (selector && (selector.includes('*') || selector.includes('[type="text"]'))) {
                const { activeProvider, providers } = get()
                const provider = providers.find(p => p.id === activeProvider)

                if (provider && provider.apiKey && pageElements.length > 100) {
                  const inputPrompt = `Given this page elements analysis, find the best input field selector for entering: "${text}"

PAGE ELEMENTS:
${pageElements}

Common input field patterns to look for:
- Departure/destination city fields for flights
- Origin/destination fields for travel
- Name, email, phone fields for forms
- Search input fields
- Quantity or amount fields

Return only a JSON object with the best input selector:
{
  "selector": "CSS selector for the input field",
  "strategy": "specific|placeholder|id|name|class",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation"
}`

                  try {
                    const inputResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${provider.apiKey}`,
                        'Content-Type': 'application/json',
                        ...(provider.id === 'openrouter' ? { 'HTTP-Referer': window.location.href } : {})
                      },
                      body: JSON.stringify({
                        model: provider.selectedModel || provider.models[0],
                        messages: [{ role: 'user', content: inputPrompt }],
                        temperature: 0.1,
                        max_tokens: 500
                      })
                    })

                    if (inputResponse.ok) {
                      const inputData = await inputResponse.json()
                      const inputResult = JSON.parse(inputData.choices?.[0]?.message?.content || '{}')

                      if (inputResult.selector) {
                        console.log('⌨️ AI-suggested input selector:', inputResult)
                        enhancedAction = {
                          ...currentStep.action,
                          selector: inputResult.selector
                        }
                      }
                    }
                  } catch (error) {
                    console.log('❌ Input selector enhancement failed, using original:', error)
                  }
                }
              }
            }
          }

          // Execute the enhanced browser action
          console.log('🎬 About to execute browser action...')
          console.log('📦 Enhanced action:', JSON.stringify(enhancedAction, null, 2))
          
          const result = await get().executeBrowserActions([enhancedAction])
          const actionResult = result[0]
          
          console.log('🏁 Browser action execution returned:', actionResult)

          // If this was a navigation action, wait for page to load and elements to be available
          if (enhancedAction.type === 'navigate' && actionResult.success) {
            console.log('⏳ Navigation completed, waiting for page elements to load...')

            // Wait for page to be ready and extract elements
            await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds for SPA to load

            // Try to extract page elements to confirm page is loaded
            try {
              const pageElements = await getBrowserStore().getPageElements()
              console.log('📄 Page loaded successfully, elements extracted:', pageElements.length, 'characters')

              // If we got meaningful page content, the page is likely loaded
              if (pageElements.length > 200 && !pageElements.includes('Error extracting')) {
                console.log('✅ Page elements detected, proceeding with workflow')
              } else {
                console.log('⚠️ Limited page elements, but continuing workflow')
              }
            } catch (error) {
              console.log('⚠️ Could not extract page elements, but continuing workflow:', error)
            }
          }

          // For findAndClick and fillForm actions, add small delay to let UI update
          if (enhancedAction.type === 'findAndClick' || enhancedAction.type === 'fillForm' || enhancedAction.type === 'clickElement') {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }

          console.log('┌─────────────────────────────────────────────────────')
          if (actionResult.success) {
            console.log(`│ ✅ STEP ${stepNumber} COMPLETED SUCCESSFULLY`)
          } else {
            console.log(`│ ❌ STEP ${stepNumber} FAILED`)
          }
          console.log('├─────────────────────────────────────────────────────')
          console.log('│ Result:', actionResult.message)
          if (actionResult.data) {
            console.log('│ Data:', JSON.stringify(actionResult.data, null, 2))
          }
          console.log('└─────────────────────────────────────────────────────')

          // Update step with result
          set((state) => {
            if (state.currentWorkflow) {
              const updatedSteps = state.currentWorkflow.steps.map((step, index) =>
                index === currentWorkflow.currentStep
                  ? {
                      ...step,
                      status: actionResult.success ? 'completed' as const : 'failed' as const,
                      result: actionResult
                    }
                  : step
              )

              let newCurrentStep = state.currentWorkflow.currentStep
              let newStatus = state.currentWorkflow.status

              // Move to next step or complete workflow
              if (actionResult.success && currentWorkflow.currentStep < currentWorkflow.steps.length - 1) {
                newCurrentStep++
              } else {
                newStatus = actionResult.success ? 'completed' : 'failed'
              }

              return {
                ...state,
                currentWorkflow: {
                  ...state.currentWorkflow,
                  steps: updatedSteps,
                  currentStep: newCurrentStep,
                  status: newStatus,
                  results: [...state.currentWorkflow.results, actionResult],
                  endTime: newStatus !== 'executing' ? new Date() : undefined
                }
              }
            }
            return state
          })

          console.log(`✅ Step ${currentWorkflow.currentStep + 1} ${actionResult.success ? 'completed' : 'failed'}:`, actionResult.message)

          // Auto-execute next step if successful and more steps remain
          const updatedWorkflow = get().currentWorkflow
          console.log('🔄 Checking for next step:', {
            hasWorkflow: !!updatedWorkflow,
            status: updatedWorkflow?.status,
            currentStep: updatedWorkflow?.currentStep,
            totalSteps: updatedWorkflow?.steps.length,
            shouldContinue: updatedWorkflow?.status === 'executing' && 
                          updatedWorkflow?.currentStep < updatedWorkflow?.steps.length
          })
          
          if (updatedWorkflow &&
              updatedWorkflow.status === 'executing' &&
              updatedWorkflow.currentStep < updatedWorkflow.steps.length) {
            console.log('⏭️ Scheduling next step execution in 1 second...')
            setTimeout(() => {
              console.log('🚀 Executing next workflow step...')
              get().executeWorkflowStep()
            }, 1000) // Small delay between steps
          } else {
            console.log('✅ Workflow completed or stopped')
          }

        } catch (error) {
          console.log('╔═══════════════════════════════════════════════════════')
          console.log(`║ 💥 CRITICAL ERROR AT STEP ${stepNumber}`)
          console.log('╠═══════════════════════════════════════════════════════')
          console.log('║ Step:', currentStep.description)
          console.log('║ Action:', currentStep.action.type)
          console.log('║ Error:', error)
          console.log('║ Error Message:', error instanceof Error ? error.message : String(error))
          console.log('║ Stack:', error instanceof Error ? error.stack : 'No stack trace')
          console.log('╚═══════════════════════════════════════════════════════')
          console.error('Full error object:', error)

          // Mark step as failed
          set((state) => {
            if (state.currentWorkflow) {
              const updatedSteps = state.currentWorkflow.steps.map((step, index) =>
                index === currentWorkflow.currentStep
                  ? { ...step, status: 'failed' as const }
                  : step
              )

              return {
                ...state,
                currentWorkflow: {
                  ...state.currentWorkflow,
                  steps: updatedSteps,
                  status: 'failed',
                  endTime: new Date()
                }
              }
            }
            return state
          })
        }
      },

      cancelWorkflow: () => {
        set((state) => {
          if (state.currentWorkflow) {
            return {
              ...state,
              currentWorkflow: {
                ...state.currentWorkflow,
                status: 'failed',
                endTime: new Date()
              }
            }
          }
          return state
        })
        console.log('🛑 Workflow cancelled')
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
          const systemPrompt = `You are a browser action parser. Your job is to analyze user messages and return browser actions as JSON.

CRITICAL RULES:
1. If the user is ASKING ABOUT the current page content, return []
2. If the user is GIVING A COMMAND to do something, return the appropriate action
3. Always return a valid JSON array, never text explanations

COMMAND PATTERNS (return actions):
- "go to [site]" or "open [site]" or "visit [site]" → navigate
- "search for [term]" or "find [term]" → search
- "click [element]" or "press [element]" → findAndClick
- "scroll [direction]" → scrollPage
- "get [content]" → extractContent

QUESTION PATTERNS (return []):
- "what is this?"
- "what does this do?"
- "explain this"
- "what am I looking at?"
- "summarize this page"

EXPLICIT EXAMPLES:
- "open google.com" → [{"type": "navigate", "url": "google.com"}]
- "go to seznam.cz" → [{"type": "navigate", "url": "seznam.cz"}]
- "search for cats" → [{"type": "search", "query": "cats"}]
- "click login button" → [{"type": "findAndClick", "elementDescription": "login button"}]
- "what is this page?" → []
- "explain this content" → []

Return ONLY JSON array, no other text.`

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
          
          // Parse the JSON response with multiple fallback strategies
          let actions: any[] = []

          // Strategy 1: Direct JSON parsing
          try {
            const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/)
            if (jsonMatch) {
              actions = JSON.parse(jsonMatch[0])
              if (Array.isArray(actions)) {
                console.log('✅ Parsed actions from JSON:', actions)
                return actions
              }
            }
          } catch (parseError) {
            console.log('JSON parsing failed, trying fallback strategies...')
          }

          // Strategy 2: Pattern-based parsing for common commands
          const lowerMessage = message.toLowerCase()
          const cleanResponse = aiResponse.toLowerCase().trim()

          // Check for navigation commands
          if (lowerMessage.includes('open ') || lowerMessage.includes('go to ') || lowerMessage.includes('visit ')) {
            const urlMatch = message.match(/(?:open|go to|visit)\s+([^\s]+)/i)
            if (urlMatch && urlMatch[1]) {
              let url = urlMatch[1]
              // Add protocol if missing
              if (!url.startsWith('http')) {
                url = 'https://' + url
              }
              console.log('🔄 Fallback: Detected navigation command:', url)
              return [{ type: 'navigate', url }]
            }
          }

          // Check for search commands
          if (lowerMessage.includes('search for ') || lowerMessage.includes('find ')) {
            const searchMatch = message.match(/(?:search for|find)\s+(.+)/i)
            if (searchMatch && searchMatch[1]) {
              const query = searchMatch[1].trim()
              console.log('🔄 Fallback: Detected search command:', query)
              return [{ type: 'search', query }]
            }
          }

          // Check for click commands
          if (lowerMessage.includes('click ') || lowerMessage.includes('press ')) {
            const clickMatch = message.match(/(?:click|press)\s+(.+)/i)
            if (clickMatch && clickMatch[1]) {
              const element = clickMatch[1].trim()
              console.log('🔄 Fallback: Detected click command:', element)
              return [{ type: 'findAndClick', elementDescription: element }]
            }
          }

          // Strategy 3: Look for action keywords in the response itself
          if (cleanResponse.includes('navigate') || cleanResponse.includes('search') || cleanResponse.includes('click')) {
            console.log('🔄 Fallback: Found action keywords in response')
            // Return empty array to avoid false positives
            return []
          }

          console.log('❌ All parsing strategies failed, returning empty array')
          console.log('Original message:', message)
          console.log('AI response:', aiResponse)
        } catch (error) {
          console.error('Error in AI action parsing:', error)
        }

        // Return empty array if parsing fails
        return []
      },

      executeBrowserActions: async (actions: BrowserAction[]) => {
        console.log('🎯 Executing browser actions:', actions)
        const results: BrowserActionResult[] = []

        // Import browser store dynamically to avoid circular dependency
        const { useBrowserStore } = await import('./browserStore')
        const { executeBrowserAction } = useBrowserStore.getState()
        console.log('🔧 Browser store loaded, executing actions...')

        for (const action of actions) {
          try {
            console.log('⚙️ Executing action:', action)
            const result = await executeBrowserAction(action)
            console.log('✅ Action result:', result)
            results.push(result)
          } catch (error) {
            console.error('❌ Action execution failed:', error)
            results.push({
              success: false,
              message: `Failed to execute ${action.type}: ${error instanceof Error ? error.message : 'Unknown error'}`
            })
          }
        }

        console.log('🎯 Browser actions execution complete:', results)
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

          if (response.status === 401) {
            console.error(`401 Unauthorized - API key may be invalid or blocked for ${provider.name}`)
            get().disconnectProvider(provider.id)
            throw new Error('API key is invalid or blocked. Please check your API key or disconnect and reconnect with a new one.')
          }

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`)
          }

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

          if (response.status === 401) {
            console.error(`401 Unauthorized - API key may be invalid or blocked for ${provider.name}`)
            get().disconnectProvider(provider.id)
            throw new Error('API key is invalid or blocked. Please check your API key or disconnect and reconnect with a new one.')
          }

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
        currentDomain: state.currentDomain,
        // Persist workflow state
        currentWorkflow: state.currentWorkflow,
        workflowEnabled: state.workflowEnabled
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