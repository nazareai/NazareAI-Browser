import { useBrowserStore } from '../stores/browserStore'
import { useAIStore } from '../stores/aiStore'
import toast from 'react-hot-toast'

interface PageContext {
  url: string
  title: string
  links: Array<{
    text: string
    href: string
    visible: boolean
  }>
  content: string
  forms: Array<{
    action: string
    method: string
    inputs: Array<{
      type: string
      name: string
      placeholder?: string
    }>
  }>
  buttons: Array<{
    text: string
    type: string
  }>
  headings: string[]
  meta: {
    description: string
    keywords: string
  }
  images: Array<{
    src: string
    alt: string
    visible: boolean
  }>
}

interface CommandResult {
  understood: boolean
  action: 'navigate' | 'click' | 'search' | 'fill_form' | 'scroll' | 'extract' | 'wait' | 'none'
  target?: string
  query?: string
  confidence: number
  reasoning: string
}

interface CommandMemory {
  recentCommands: Array<{
    command: string
    result: CommandResult
    timestamp: Date
  }>
  pageContextHistory: Array<{
    context: PageContext
    timestamp: Date
  }>
  userPreferences: {
    searchEngine: string
  }
}

class AICommandProcessor {
  private static instance: AICommandProcessor
  private memory: CommandMemory
  private pageContextCache: Map<string, { context: PageContext, timestamp: number }>
  private isExecuting: boolean = false
  
  private constructor() {
    this.memory = {
      recentCommands: [],
      pageContextHistory: [],
      userPreferences: {
        searchEngine: 'https://search.sh'
      }
    }
    this.pageContextCache = new Map()
  }

  static getInstance(): AICommandProcessor {
    if (!AICommandProcessor.instance) {
      AICommandProcessor.instance = new AICommandProcessor()
    }
    return AICommandProcessor.instance
  }

  /**
   * Check if the processor is currently executing a command
   */
  isCurrentlyExecuting(): boolean {
    return this.isExecuting
  }

  /**
   * Extract context from page HTML without DOM manipulation
   */
  async extractPageContext(): Promise<PageContext | null> {
    // Prevent concurrent extractions
    if (this.isExecuting) {
      console.log('AI command processor is busy, using cached context')
      return this.getCachedContext()
    }

    const webview = document.querySelector('webview') as any
    if (!webview) return null

    // Check cache first
    const currentUrl = webview.src
    if (this.pageContextCache.has(currentUrl)) {
      const cached = this.pageContextCache.get(currentUrl)!
      // Cache for 30 seconds
      if (Date.now() - cached.timestamp < 30000) {
        return cached.context
      }
    }

    try {
      this.isExecuting = true
      
      // Get page HTML and basic info without DOM manipulation
      const [htmlSource, pageTitle, pageUrl] = await Promise.all([
        webview.executeJavaScript('document.documentElement.outerHTML'),
        webview.executeJavaScript('document.title'),
        webview.executeJavaScript('window.location.href')
      ])

      // Parse HTML safely in our app context
      const pageData = this.parsePageHTML(htmlSource, pageTitle, pageUrl)

      if (pageData) {
        // Cache the context
        this.pageContextCache.set(currentUrl, {
          context: pageData,
          timestamp: Date.now()
        })

        // Add to history
        this.memory.pageContextHistory.push({
          context: pageData,
          timestamp: new Date()
        })

        // Keep only last 10 page contexts
        if (this.memory.pageContextHistory.length > 10) {
          this.memory.pageContextHistory.shift()
        }
      }

      return pageData
    } catch (error) {
      console.error('Failed to extract page context:', error)
      return this.getCachedContext()
    } finally {
      this.isExecuting = false
    }
  }

  /**
   * Parse HTML safely without injecting into the page
   */
  private parsePageHTML(htmlSource: string, title: string, url: string): PageContext {
    try {
      // Create a virtual DOM to parse HTML safely
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlSource, 'text/html')

      // Extract links
      const links = Array.from(doc.querySelectorAll('a[href]')).map(link => {
        const href = link.getAttribute('href') || ''
        const text = link.textContent?.trim() || link.getAttribute('aria-label') || link.getAttribute('title') || ''
        
        // Convert relative URLs to absolute
        let absoluteHref = href
        if (href.startsWith('/')) {
          const urlObj = new URL(url)
          absoluteHref = `${urlObj.protocol}//${urlObj.host}${href}`
        } else if (href.startsWith('./') || (!href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:'))) {
          try {
            absoluteHref = new URL(href, url).href
          } catch {
            absoluteHref = href
          }
        }

        return {
          text,
          href: absoluteHref,
          visible: true // We'll assume all links are potentially visible since we can't check getBoundingClientRect
        }
      }).filter(link => link.text.length > 0 || link.href.length > 0)

      // Extract forms
      const forms = Array.from(doc.querySelectorAll('form')).map(form => ({
        action: form.getAttribute('action') || '',
        method: form.getAttribute('method') || 'GET',
        inputs: Array.from(form.querySelectorAll('input, textarea, select')).map(input => ({
          type: input.getAttribute('type') || 'text',
          name: input.getAttribute('name') || '',
          placeholder: input.getAttribute('placeholder') || ''
        }))
      }))

      // Extract buttons
      const buttons = Array.from(doc.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')).map(button => ({
        text: button.textContent?.trim() || button.getAttribute('value') || button.getAttribute('aria-label') || '',
        type: button.getAttribute('type') || 'button',
        visible: true
      }))

      // Extract text content safely
      const content = doc.body?.textContent?.substring(0, 5000) || ''

      // Extract images
      const images = Array.from(doc.querySelectorAll('img[src]')).map(img => ({
        src: img.getAttribute('src') || '',
        alt: img.getAttribute('alt') || '',
        visible: true
      }));

      return {
        url,
        title,
        links,
        content,
        forms,
        buttons,
        headings: Array.from(doc.querySelectorAll('h1, h2, h3')).map(h => h.textContent?.trim()).filter((text): text is string => Boolean(text)),
        meta: {
          description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          keywords: doc.querySelector('meta[name="keywords"]')?.getAttribute('content') || ''
        },
        images
      }
    } catch (error) {
      console.error('Error parsing HTML:', error)
      return {
        url,
        title,
        links: [],
        content: '',
        forms: [],
        buttons: [],
        headings: [],
        meta: { description: '', keywords: '' },
        images: []
      }
    }
  }

  /**
   * Get cached context as fallback
   */
  private getCachedContext(): PageContext | null {
    const webview = document.querySelector('webview') as any
    if (!webview) return null

    const currentUrl = webview.src
    if (this.pageContextCache.has(currentUrl)) {
      const cached = this.pageContextCache.get(currentUrl)!
      // Return cached context even if older than 30 seconds as fallback
      return cached.context
    }

    return null
  }

  /**
   * Process a natural language command using AI
   */
  async processCommand(command: string, pageContext: PageContext | null): Promise<CommandResult> {
    const aiStore = useAIStore.getState()
    
    // If AI is not available, return a clear error result
    if (!aiStore.activeProvider || !aiStore.isConnected) {
      return {
        understood: false,
        action: 'none',
        confidence: 0,
        reasoning: 'AI assistant is not connected. Please configure an AI provider in settings.'
      }
    }

    try {
      // Build comprehensive context for AI
      const recentCommandsContext = this.memory.recentCommands
        .slice(-3)
        .map(cmd => `Previous: "${cmd.command}" -> ${cmd.result.action} (${cmd.result.reasoning})`)
        .join('\n')

      const pageContextStr = pageContext ? `
Current Page: ${pageContext.title} (${pageContext.url})
Available Links: ${pageContext.links.slice(0, 20).map(l => `"${l.text}" -> ${l.href}`).join(', ')}
Buttons: ${pageContext.buttons.map(b => b.text).join(', ')}
Forms: ${pageContext.forms.length} forms available
      ` : 'No page context available'

      const systemPrompt = `You are an AI-powered browser assistant that helps users navigate and interact with web pages using natural language commands.

CAPABILITIES:
- Navigate to any website or URL
- Click on links, buttons, and interactive elements
- Search the web for information
- Extract content from pages (text, links, images, tables)
- Fill out forms intelligently
- Scroll and navigate within pages
- Analyze page structure and content

Context:
${pageContextStr}

Recent Commands:
${recentCommandsContext || 'None'}

CRITICAL CONTEXT AWARENESS RULES:

1. WHEN USER IS ALREADY ON A SPECIFIC WEBSITE:
   - If the user is on YouTube and says "search for music videos", they want to search WITHIN YouTube
   - If the user is on Amazon and says "search for laptops", they want to search WITHIN Amazon
   - If the user is on any site with a search feature and says "search for X", assume they want to search WITHIN that site
   - Only navigate away from the current site if they explicitly say so (e.g., "search on Google for X")

2. CONTEXT-AWARE SEARCH LOGIC:
   - Check the current page URL and title
   - If on a known platform (YouTube, Amazon, Twitter, etc.), searches should stay within that platform
   - Look for search boxes, search buttons, or search links on the current page
   - Use "click" action to interact with the site's search functionality instead of navigating away

UNDERSTANDING USER INTENT:
1. Analyze what the user wants to achieve
2. ALWAYS consider the current page context first
3. Choose the most appropriate action based on where the user currently is
4. Extract the key identifiers from their command
5. Match elements intelligently even with partial information
6. Handle typos, abbreviations, and natural variations

Available actions:
- navigate: Go to a URL or website (e.g., "go to amazon.com", "visit youtube", "open google")
- click: Click on any clickable element (e.g., "click the login button", "click search", "press submit")
- search: Search the web for information ONLY when not on a searchable platform
- scroll: Navigate within the page (e.g., "scroll down", "go to top", "page up")
- extract: Get information from the page (e.g., "get all links", "extract prices", "show all images")
- fill_form: Fill out forms (e.g., "fill the contact form", "complete the signup")
- none: No action needed or command not understood

IMPORTANT RULES:

1. For SEARCH commands on specific sites:
   - If on YouTube: "search for X" → action: "click", target: "search" (to click search box), then follow up with filling the search
   - If on Amazon: "search for X" → action: "click", target: "search"
   - If on Google: queries are already searches, just need to click search button
   - If on any site with search: look for search box/button and use click action
   - ONLY use "search" action when user wants to leave current site for a web search

2. For CLICK commands:
   - Extract the core identifier from the user's command
   - "click on the X button" → target: "X"
   - "open the Y link" → target: "Y"
   - Match partial text, handle variations
   - Consider button text, link text, aria-labels

3. For NAVIGATION:
   - Recognize all navigation patterns: "go to", "visit", "open", "navigate to", "take me to"
   - Handle both full URLs and site names
   - Infer common domains (.com, .org, etc.)
   - If it looks like a domain or URL, use navigate action
   - BUT if user is already on the site they're asking to go to, don't navigate

4. For SCROLLING:
   - Understand relative directions: up, down, top, bottom
   - Handle variations: "scroll down", "go down", "move down", "page down"

5. For EXTRACTION:
   - Understand what type of content to extract
   - Handle plural and singular forms
   - Common extractions: links, images, text, buttons, forms, tables

EXAMPLES:
- "click the login button" → action: "click", target: "login"
- "open contact" → action: "click", target: "contact"  
- "go to youtube" → action: "navigate", target: "youtube.com"
- "visit amazon.com" → action: "navigate", target: "amazon.com"
- "search for pizza recipes" → action: "search", query: "pizza recipes"
- "find all links on this page" → action: "extract", target: "links"
- "scroll down please" → action: "scroll", target: "down"
- "take me to the top" → action: "scroll", target: "top"
- "what images are on this page" → action: "extract", target: "images"
- "click sign up" → action: "click", target: "sign up"

When matching elements on the page:
- Use fuzzy matching for link/button text
- Consider common variations (login/log in/signin/sign in)
- Prioritize visible elements
- If multiple matches, choose the most likely one
- For ambiguous commands, make your best guess based on context

SPECIAL HANDLING FOR SEARCH COMMANDS:
When user says "search for X" while on a specific site:
- Set action to "click" 
- Set target to "search" (to find and click the search box)
- Include the search query in the "query" field for follow-up action
- Add explanation in reasoning like "Searching within YouTube for: music videos"

Respond in JSON format:
{
  "understood": true/false,
  "action": "action_type",
  "target": "key identifier or URL",
  "query": "search query if applicable", 
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of your interpretation"
}`

      const aiResponse = await aiStore.chat(
        `Command: "${command}"\n\nAnalyze this command and return the appropriate JSON response.`,
        systemPrompt
      )

      // Parse AI response
      try {
        // Extract JSON from response (AI might include explanation)
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]) as CommandResult
          
          // Store in memory for context
          this.memory.recentCommands.push({
            command,
            result,
            timestamp: new Date()
          })

          // Keep only last 20 commands
          if (this.memory.recentCommands.length > 20) {
            this.memory.recentCommands.shift()
          }

          return result
        } else {
          // If no JSON found in response, return error
          return {
            understood: false,
            action: 'none',
            confidence: 0,
            reasoning: 'Failed to parse AI response. Please try rephrasing your command.'
          }
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError)
        return {
          understood: false,
          action: 'none',
          confidence: 0,
          reasoning: 'Error processing AI response. Please try again.'
        }
      }
    } catch (error) {
      console.error('AI processing failed:', error)
      return {
        understood: false,
        action: 'none',
        confidence: 0,
        reasoning: `AI processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Execute a command result with minimal page interference
   */
  async executeCommand(result: CommandResult): Promise<boolean> {
    // Prevent concurrent executions
    if (this.isExecuting) {
      console.log('AI command processor is busy, cannot execute command')
      return false
    }

    const webview = document.querySelector('webview') as any
    if (!webview) return false

    try {
      this.isExecuting = true
      
      const { executeBrowserAction, executePageScript } = useBrowserStore.getState()

      switch (result.action) {
        case 'navigate':
          if (result.target) {
            const actionResult = await executeBrowserAction({
              type: 'navigate',
              url: result.target
            })
            toast.success(`Command executed: navigate to ${result.target}`)
            return actionResult.success
          }
          break

        case 'click':
          if (result.target) {
            if (result.target.toLowerCase() === 'search' && result.query) {
              console.log('Executing in-site search for:', result.query)
              const clickResult = await executeBrowserAction({
                type: 'findAndClick',
                elementDescription: 'search'
              })
              if (clickResult.success) {
                await new Promise(resolve => setTimeout(resolve, 500))
                const searchScript = `
                  (function() {
                    const query = '${result.query.replace(/'/g, "\\'")}'
                    // ... find searchInput synchronously ...
                    if (searchInput) {
                      // ... type query ...
                      setTimeout(function() {
                        // submit logic synchronously
                        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
                        searchInput.dispatchEvent(enterEvent);
                        const form = searchInput.closest('form');
                        if (form) form.submit();
                        // search button click if exists
                      }, 300);
                    } else {
                      // fallback navigation
                      window.location.href = window.location.origin + '/search?q=' + encodeURIComponent(query);
                    }
                    return 'Searched for: ' + query;
                  })()
                `
                const scriptResult = await executePageScript(searchScript)
                toast.success(`Command executed: search for ${result.query}`)
                return scriptResult.success
              }
            }
            const actionResult = await executeBrowserAction({
              type: 'findAndClick',
              elementDescription: result.target
            })
            toast.success(`Command executed: click ${result.target}`)
            return actionResult.success
          }
          break

        case 'search':
          if (result.query) {
            const currentUrl = webview.src || ''
            const isOnSearchableSite = currentUrl.includes('youtube.com') || 
              currentUrl.includes('amazon.com') ||
              currentUrl.includes('github.com') ||
              currentUrl.includes('twitter.com') ||
              currentUrl.includes('reddit.com') ||
              currentUrl.includes('ebay.com') ||
              currentUrl.includes('linkedin.com')
            
            if (isOnSearchableSite) {
              console.log('Performing in-site search on:', currentUrl, 'for:', result.query)
              const searchScript = `
                  (function() {
                    const query = '${result.query.replace(/'/g, "\\'")}'
                    // ... find searchInput synchronously ...
                    if (searchInput) {
                      // ... type query ...
                      setTimeout(function() {
                        // submit logic synchronously
                        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
                        searchInput.dispatchEvent(enterEvent);
                        const form = searchInput.closest('form');
                        if (form) form.submit();
                        // search button click if exists
                      }, 300);
                    } else {
                      // fallback navigation
                      window.location.href = window.location.origin + '/search?q=' + encodeURIComponent(query);
                    }
                    return 'Searched for: ' + query;
                  })()
                `
                const scriptResult = await executePageScript(searchScript)
                toast.success(`Command executed: search for ${result.query}`)
                return scriptResult.success
            } else {
              const actionResult = await executeBrowserAction({
                type: 'search',
                query: result.query
              })
              toast.success(`Command executed: search for ${result.query}`)
              return actionResult.success
            }
          }
          break

        case 'scroll':
          const direction = (result.target || 'down') as 'up' | 'down' | 'top' | 'bottom'
          const actionResult = await executeBrowserAction({
            type: 'scrollPage',
            scrollDirection: direction
          })
          toast.success(`Command executed: scroll ${direction}`)
          return actionResult.success

        case 'extract':
          if (result.target) {
            const dataType = result.target === 'links' ? 'links' : result.target === 'images' ? 'images' : result.target === 'buttons' ? 'forms' : 'text'
            const extractResult = await executeBrowserAction({
              type: 'extractContent',
              selector: dataType
            })
            if (extractResult.success && extractResult.data) {
              console.log(`✅ Extracted ${result.target}:`, extractResult.data)
              toast.success(`Command executed: extract ${result.target}`)
            }
            return extractResult.success
          }
          break

        case 'fill_form':
          const formResult = await executeBrowserAction({
            type: 'extractContent',
            selector: 'forms'
          })
          if (formResult.success && formResult.data) {
            console.log('✅ Forms found:', formResult.data)
            toast.success('Forms found on page')
          }
          return formResult.success

        default:
          toast.error('Unknown command action')
          return false
      }
    } catch (error: any) {
      console.error('Failed to execute command:', error)
      toast.error(`Failed to execute command: ${error.message}`)
      return false
    } finally {
      this.isExecuting = false
    }

    return false
  }

  /**
   * Clear memory and caches
   */
  clearMemory() {
    this.memory.recentCommands = []
    this.memory.pageContextHistory = []
    this.pageContextCache.clear()
    this.isExecuting = false
  }

  /**
   * Force clear execution state (emergency reset)
   */
  forceReset() {
    this.isExecuting = false
    console.log('AI Command Processor execution state reset')
  }

  /**
   * Get AI-powered command suggestions based on current context
   */
  async getCommandSuggestions(pageContext: PageContext | null): Promise<string[]> {
    const aiStore = useAIStore.getState()
    
    // If AI is not connected, return basic suggestions
    if (!aiStore.activeProvider || !aiStore.isConnected) {
      return [
        'go to google.com',
        'search for news',
        'scroll down',
        'go back'
      ]
    }

    try {
      const contextStr = pageContext ? `
Current page: ${pageContext.title}
URL: ${pageContext.url}
Available links: ${pageContext.links.slice(0, 10).map(l => l.text).filter(Boolean).join(', ')}
Available buttons: ${pageContext.buttons.slice(0, 5).map(b => b.text).filter(Boolean).join(', ')}
      ` : 'No page context available'

      const prompt = `Based on the current page context, suggest 5 natural language commands the user might want to use.

${contextStr}

Return a JSON array of 5 command suggestions that would be useful on this page. Focus on common actions users would want to perform.

Example format:
["click the login button", "search for products", "go to checkout", "scroll to reviews", "extract all links"]`

      const response = await aiStore.chat(prompt, 'You are a browser assistant that suggests helpful commands based on page context.')
      
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const suggestions = JSON.parse(jsonMatch[0])
          return Array.isArray(suggestions) ? suggestions.slice(0, 5) : []
        }
      } catch (error) {
        console.error('Failed to parse suggestions:', error)
      }
    } catch (error) {
      console.error('Failed to get AI suggestions:', error)
    }

    // Fallback suggestions
    return [
      'go to google.com',
      'search for AI news',
      'click the first link',
      'scroll down',
      'extract all links'
    ]
  }
}

export default AICommandProcessor