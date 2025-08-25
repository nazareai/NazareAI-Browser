import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useHistoryStore } from './historyStore'
import { useAIStore } from './aiStore'

export interface Tab {
  id: string
  title: string
  url: string
  favicon?: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

// Browser actions that AI can perform
export interface BrowserAction {
  type: 'navigate' | 'newTab' | 'closeTab' | 'switchTab' | 'goBack' | 'goForward' | 'reload' | 'search' | 'extractContent' | 'scrollPage' | 'clickElement' | 'fillForm' | 'waitForElement' | 'screenshot' | 'analyzeContent' | 'executeWorkflow' | 'manageBookmarks' | 'monitorNetwork' | 'findAndClick' | 'smartFillForm' | 'extractTable' | 'waitAndExtract'
  tabId?: string
  url?: string
  query?: string
  selector?: string
  formData?: Record<string, string>
  scrollDirection?: 'up' | 'down' | 'top' | 'bottom'
  amount?: number
  timeout?: number
  text?: string
  elementDescription?: string
  analysisType?: 'summary' | 'structure' | 'forms' | 'tables' | 'links' | 'images' | 'all'
  workflowSteps?: BrowserAction[]
  waitCondition?: 'element' | 'text' | 'url' | 'timeout'
  bookmarkAction?: 'add' | 'remove' | 'list' | 'organize'
  networkFilter?: string
}

export interface BrowserActionResult {
  success: boolean
  message: string
  data?: any
}

interface TabGroup {
  id: string
  name: string
  tabs: string[]
}

interface BrowserState {
  tabs: Tab[]
  currentTab: Tab | null
  searchEngine: string
  tabGroups: TabGroup[]
  
  // Actions
  addTab: (url?: string) => void
  closeTab: (tabId: string) => void
  switchTab: (tabId: string) => void
  updateTab: (tabId: string, updates: Partial<Tab>) => void
  navigateTab: (tabId: string, url: string) => void
  setSearchEngine: (engine: string) => void
  getCurrentPageContent: () => Promise<string>
  hibernateTab: (tabId: string) => void
  
  // AI Browser Control Actions
  executeBrowserAction: (action: BrowserAction) => Promise<BrowserActionResult>
  navigateToUrl: (url: string, newTab?: boolean) => Promise<BrowserActionResult>
  searchWeb: (query: string, newTab?: boolean) => Promise<BrowserActionResult>
  extractPageData: (dataType?: 'text' | 'links' | 'images' | 'structured' | 'summary' | 'forms' | 'tables' | 'all') => Promise<BrowserActionResult>
  scrollPage: (direction: 'up' | 'down' | 'top' | 'bottom', amount?: number) => Promise<BrowserActionResult>
  executePageScript: (script: string) => Promise<BrowserActionResult>
  findOnPage: (searchTerm: string) => Promise<BrowserActionResult>
  getPageMetadata: () => Promise<BrowserActionResult>
  
  // Advanced AI Browser Control Actions
  waitForElement: (selector: string, timeout?: number) => Promise<BrowserActionResult>
  smartFillForm: (formDescription: string, userData?: Record<string, string>) => Promise<BrowserActionResult>
  findAndClick: (elementDescription: string) => Promise<BrowserActionResult>
  takeScreenshot: (description: string) => Promise<BrowserActionResult>
  executeWorkflow: (steps: BrowserAction[]) => Promise<BrowserActionResult>
  analyzePageStructure: () => Promise<BrowserActionResult>
  extractTableData: (tableSelector?: string) => Promise<BrowserActionResult>
  monitorPageChanges: (duration: number) => Promise<BrowserActionResult>
  intelligentScroll: (target: string) => Promise<BrowserActionResult>
  autoFillCredentials: (site: string) => Promise<BrowserActionResult>
  addTabToGroup: (tabId: string, groupName: string) => void
  classifyTab: (tabId: string) => Promise<void>
}

export const useBrowserStore = create<BrowserState>()(
  persist(
    (set, get) => ({
      tabs: [],
      currentTab: null,
      searchEngine: 'https://search.sh',
      tabGroups: [],

      addTab: (url = 'about:blank') => {
        const newTab: Tab = {
          id: crypto.randomUUID(),
          title: 'New Tab',
          url,
          favicon: undefined,
          isLoading: true,
          canGoBack: false,
          canGoForward: false
        }
        
        set((state) => ({
          tabs: [...state.tabs, newTab],
          currentTab: newTab
        }))
      },
      
      closeTab: (tabId: string) => {
        const { tabs, currentTab } = get()
        const tabIndex = tabs.findIndex(tab => tab.id === tabId)
        
        if (tabIndex === -1) return
        
        const newTabs = tabs.filter(tab => tab.id !== tabId)
        let newCurrentTab = currentTab
        
        // If closing current tab, switch to adjacent tab
        if (currentTab?.id === tabId) {
          if (newTabs.length > 0) {
            const nextIndex = Math.min(tabIndex, newTabs.length - 1)
            newCurrentTab = newTabs[nextIndex]
          } else {
            newCurrentTab = null
          }
        }
        
        set({ tabs: newTabs, currentTab: newCurrentTab })
        
        // Clear tab history
        useHistoryStore.getState().clearTabHistory(tabId)
        
        // Close tab in Electron
        if (window.electronAPI) {
          window.electronAPI.closeTab(tabId)
        }
      },
      
      switchTab: (tabId: string) => {
        const { tabs } = get()
        const tab = tabs.find(t => t.id === tabId)
        
        if (tab) {
          set({ currentTab: tab })
          
          // Switch tab in Electron
          if (window.electronAPI) {
            window.electronAPI.switchTab(tabId)
          }
        }
      },
      
      updateTab: (tabId: string, updates: Partial<Tab>) => {
        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId ? { ...tab, ...updates } : tab
          ),
          currentTab: state.currentTab?.id === tabId 
            ? { ...state.currentTab, ...updates }
            : state.currentTab
        }))
      },
      
      navigateTab: (tabId: string, url: string) => {
        const { updateTab } = get()
        updateTab(tabId, { url, isLoading: true })
        
        // Don't use IPC for navigation - let the webview handle it
      },
      
      setSearchEngine: (engine: string) => {
        set({ searchEngine: engine })
      },
      
      getCurrentPageContent: async () => {
        const { currentTab } = get()
        console.log('🟢 getCurrentPageContent called:', { currentTab: currentTab?.url })
        
        if (!currentTab || currentTab.url === 'about:blank') {
          console.log('🟢 No current tab or about:blank')
          return ''
        }
        
        try {
          // Get the webview element
          const webview = document.querySelector('webview') as any
          if (!webview) {
            console.log('❌ No webview found')
            return ''
          }
          
          // Check if it's a PDF
          const isPDF = currentTab.url.toLowerCase().includes('.pdf') || 
                       currentTab.url.toLowerCase().includes('application/pdf')
          
          console.log('🟢 Content extraction info:', { isPDF, url: currentTab.url })
          
          if (isPDF) {
            // For PDFs, try to get text content with minimal JavaScript
            const result = await webview.executeJavaScript(`
              (() => {
                try {
                  let extractedText = '';
                  
                  // Method 1: PDF.js text layer (most common)
                  const textLayers = document.querySelectorAll('.textLayer');
                  if (textLayers.length > 0) {
                    extractedText = Array.from(textLayers).map(layer => {
                      const spans = layer.querySelectorAll('span');
                      return Array.from(spans).map(span => span.textContent || '').join(' ').trim();
                    }).filter(text => text).join('\\n\\n');
                  }
                  
                  // Method 2: Try general text content if no PDF.js layers
                  if (!extractedText) {
                    extractedText = document.body.textContent || document.body.innerText || '';
                  }
                  
                  return {
                    title: document.title || 'PDF Document',
                    url: window.location.href,
                    isPDF: true,
                    content: extractedText || 'This PDF requires manual description.',
                    contentLength: extractedText.length
                  };
                } catch (error) {
                  return {
                    title: document.title || 'PDF Document',
                    url: window.location.href,
                    isPDF: true,
                    content: 'PDF content extraction encountered an error.',
                    error: error.message || String(error)
                  };
                }
              })()
            `)
            
            console.log('PDF Content Extraction Result:', result)
            
            let contentOutput = `PDF Document: ${result.title}
URL: ${result.url}
Content Length: ${result.contentLength || 0} characters`

            if (result.error) {
              contentOutput += `\nExtraction Error: ${result.error}`
            }

            contentOutput += '\n\n' + result.content

            return contentOutput
          } else {
            // For regular web pages, get HTML source and parse it safely
            const [htmlSource, title, url] = await Promise.all([
              webview.executeJavaScript('document.documentElement.outerHTML'),
              webview.executeJavaScript('document.title'),
              webview.executeJavaScript('window.location.href')
            ])

            // Parse HTML safely without DOM manipulation
            const parser = new DOMParser()
            const doc = parser.parseFromString(htmlSource, 'text/html')
            
            // Extract content safely
            const getCleanText = (element: Document | Element) => {
              if (!element) return '';
              
              // Remove script and style elements from our parsed copy
              const scripts = element.querySelectorAll('script, style, noscript');
              scripts.forEach(el => el.remove());
              
              // Get main content areas
              const contentSelectors = [
                'article', 'main', '[role="main"]', '.content', '#content',
                '.post-content', '.entry-content', '.article-content',
                '.story-body', '.article-body', '.post-body'
              ];
              
              let mainContent = null;
              for (const selector of contentSelectors) {
                mainContent = element.querySelector(selector);
                if (mainContent) break;
              }
              
              const targetElement = mainContent || (element instanceof Document ? element.body : element);
              return targetElement?.textContent || '';
            };
            
            const fullContent = getCleanText(doc);
            const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
              .map(h => h.textContent?.trim()).filter(Boolean).slice(0, 20);
            
            // Smart content chunking for long content
            const chunkContent = (text: string, maxChunkSize = 8000) => {
              if (text.length <= maxChunkSize) return [text];
              
              const chunks = [];
              const sentences = text.split(/[.!?]+/);
              let currentChunk = '';
              
              for (const sentence of sentences) {
                if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
                  chunks.push(currentChunk.trim());
                  currentChunk = sentence;
                } else {
                  currentChunk += (currentChunk ? '. ' : '') + sentence;
                }
              }
              
              if (currentChunk) chunks.push(currentChunk.trim());
              return chunks;
            };
            
            const contentChunks = chunkContent(fullContent);
            
            // Return structured content for long documents
            if (fullContent.length > 8000) {
              return `Title: ${title}
URL: ${url}
Description: ${description}
Content Length: ${fullContent.length} characters (${contentChunks.length} chunks)

Headings:
${headings.join('\n')}

Content Summary (First 1000 chars):
${fullContent.slice(0, 1000) + (fullContent.length > 1000 ? '...' : '')}

[Note: This is a long document with ${fullContent.length} characters. The AI can process it in chunks for detailed analysis.]`
            } else {
              return `Title: ${title}
URL: ${url}
Description: ${description}

Headings:
${headings.join('\n')}

Full Content:
${fullContent}`
            }
          }
        } catch (error) {
          console.error('Failed to get page content:', error)
          return `Error extracting content: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      },

      hibernateTab: (tabId: string) => {
        set((state) => {
          const tab = state.tabs.find(t => t.id === tabId)
          if (tab) tab.url = 'about:blank' // Or suspend
          return { tabs: [...state.tabs] }
        })
      },

      // AI Browser Control Actions
      executeBrowserAction: async (action: BrowserAction) => {
        try {
          switch (action.type) {
            case 'navigate':
              if (!action.url) throw new Error('URL required for navigation')
              return await get().navigateToUrl(action.url, false)
            case 'newTab':
              return await get().navigateToUrl(action.url || 'about:blank', true)
            case 'closeTab':
              const tabToClose = action.tabId || get().currentTab?.id
              if (!tabToClose) throw new Error('No tab to close')
              get().closeTab(tabToClose)
              return { success: true, message: 'Tab closed successfully' }
            case 'switchTab':
              if (!action.tabId) throw new Error('Tab ID required')
              get().switchTab(action.tabId)
              return { success: true, message: 'Switched to tab successfully' }
            case 'goBack':
              return await get().executePageScript('history.back()')
            case 'goForward':
              return await get().executePageScript('history.forward()')
            case 'reload':
              return await get().executePageScript('location.reload()')
            case 'search':
              if (!action.query) throw new Error('Search query required')
              return await get().searchWeb(action.query, action.tabId ? false : true)
            case 'extractContent':
              return await get().extractPageData('text')
            case 'scrollPage':
              return await get().scrollPage(action.scrollDirection || 'down', action.amount)
            case 'clickElement':
              if (!action.selector) throw new Error('Selector required for clickElement')
              return await get().executePageScript(`document.querySelector('${action.selector}').click()`)
            case 'fillForm':
              if (!action.formData || !action.selector) throw new Error('Form data and selector required')
              const fillScript = Object.entries(action.formData).map(([key, value]) =>
                `document.querySelector('[name="${key}"]').value = '${value}';`
              ).join('')
              return await get().executePageScript(fillScript)
            case 'waitForElement':
              return await get().waitForElement(action.selector || '', action.timeout)
            case 'findAndClick':
              return await get().findAndClick(action.elementDescription || '')
            case 'screenshot':
              return await get().takeScreenshot(action.text || 'Screenshot')
            case 'analyzeContent':
              return await get().analyzePageStructure()
            case 'smartFillForm':
              return await get().smartFillForm(action.text || '', action.formData)
            case 'extractTable':
              return await get().extractTableData(action.selector)
            case 'waitAndExtract':
              return await get().extractPageData('all')
            case 'executeWorkflow':
              if (!action.workflowSteps) throw new Error('Workflow steps required')
              return await get().executeBrowserAction(action.workflowSteps[0])
            case 'manageBookmarks':
              if (!action.bookmarkAction) throw new Error('Bookmark action required')
              return await get().executeBrowserAction({
                type: 'manageBookmarks',
                bookmarkAction: action.bookmarkAction
              })
            case 'monitorNetwork':
              if (!action.networkFilter) throw new Error('Network filter required')
              return await get().executeBrowserAction({
                type: 'monitorNetwork',
                networkFilter: action.networkFilter
              })
            default:
              throw new Error(`Unknown action type: ${action.type}`)
          }
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error occurred'
          }
        }
      },

      navigateToUrl: async (url: string, newTab = false) => {
        try {
          console.log('BrowserStore navigateToUrl called:', { url, newTab })
          
          let processedUrl = url
          
          // Handle search queries
          if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
            if (url.includes('.') && !url.includes(' ') && !url.includes('?')) {
              // Looks like a domain
              processedUrl = 'https://' + url
            } else {
              // Treat as search query
              processedUrl = `${get().searchEngine}/?q=${encodeURIComponent(url)}`
            }
          }

          console.log('BrowserStore URL processing:', { original: url, processed: processedUrl })

          if (newTab) {
            get().addTab(processedUrl)
            return { success: true, message: `Opened new tab with ${processedUrl}`, data: { url: processedUrl } }
          } else {
            const currentTab = get().currentTab
            if (currentTab) {
              get().navigateTab(currentTab.id, processedUrl)
              return { success: true, message: `Navigated to ${processedUrl}`, data: { url: processedUrl } }
            } else {
              get().addTab(processedUrl)
              return { success: true, message: `Created new tab and navigated to ${processedUrl}`, data: { url: processedUrl } }
            }
          }
        } catch (error) {
          return {
            success: false,
            message: `Failed to navigate: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },

      searchWeb: async (query: string, newTab = false) => {
        const searchUrl = `${get().searchEngine}/?q=${encodeURIComponent(query)}`
        return await get().navigateToUrl(searchUrl, newTab)
      },

      extractPageData: async (dataType = 'text') => {
        try {
          const webview = document.querySelector('webview') as any
          if (!webview) throw new Error('No active webview')

          let script = ''
          switch (dataType) {
            case 'text':
              script = `
                const article = document.querySelector('article, main, .content, #content');
                const content = article ? article.innerText : document.body.innerText;
                ({ type: 'text', content: content.slice(0, 8000) })
              `
              break
            case 'links':
              script = `
                const links = Array.from(document.querySelectorAll('a[href]')).map(link => ({
                  text: link.textContent.trim(),
                  href: link.href,
                  title: link.title
                })).filter(link => link.text && link.href);
                ({ type: 'links', data: links.slice(0, 50) })
              `
              break
            case 'images':
              script = `
                const images = Array.from(document.querySelectorAll('img[src]')).map(img => ({
                  src: img.src,
                  alt: img.alt,
                  title: img.title
                }));
                ({ type: 'images', data: images.slice(0, 20) })
              `
              break
            case 'structured':
              script = `
                ({
                  type: 'structured',
                  data: {
                    title: document.title,
                    description: document.querySelector('meta[name="description"]')?.content || '',
                    headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
                      level: h.tagName,
                      text: h.textContent.trim()
                    })).slice(0, 20),
                    links: Array.from(document.querySelectorAll('a[href]')).map(link => ({
                      text: link.textContent.trim(),
                      href: link.href
                    })).filter(link => link.text).slice(0, 20),
                    forms: Array.from(document.querySelectorAll('form')).map(form => ({
                      action: form.action,
                      method: form.method,
                      fields: Array.from(form.querySelectorAll('input, textarea, select')).map(field => ({
                        name: field.name,
                        type: field.type,
                        placeholder: field.placeholder
                      }))
                    }))
                  }
                })
              `
              break
            case 'summary':
              script = `
                const article = document.querySelector('article, main, .content, #content');
                const content = article ? article.innerText : document.body.innerText;
                const title = document.title;
                const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim());
                ({ 
                  type: 'summary', 
                  data: {
                    title: title,
                    headings: headings.slice(0, 10),
                    contentPreview: content.slice(0, 1000),
                    wordCount: content.split(' ').length
                  }
                })
              `
              break
            case 'forms':
              script = `
                const forms = Array.from(document.querySelectorAll('form')).map((form, index) => ({
                  id: form.id || 'form-' + index,
                  action: form.action,
                  method: form.method,
                  fields: Array.from(form.querySelectorAll('input, textarea, select')).map(field => ({
                    name: field.name,
                    type: field.type,
                    placeholder: field.placeholder,
                    required: field.required,
                    value: field.value
                  }))
                }));
                ({ type: 'forms', data: forms })
              `
              break
            case 'tables':
              script = `
                const tables = Array.from(document.querySelectorAll('table')).map((table, index) => {
                  const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
                  const rows = Array.from(table.querySelectorAll('tr')).slice(1).map(row => 
                    Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim())
                  );
                  return {
                    id: table.id || 'table-' + index,
                    headers: headers,
                    rows: rows.slice(0, 10), // Limit rows for performance
                    rowCount: rows.length
                  };
                });
                ({ type: 'tables', data: tables })
              `
              break
            case 'all':
              script = `
                const article = document.querySelector('article, main, .content, #content');
                const content = article ? article.innerText : document.body.innerText;
                
                ({
                  type: 'all',
                  data: {
                    title: document.title,
                    description: document.querySelector('meta[name="description"]')?.content || '',
                    content: content.slice(0, 3000),
                    links: Array.from(document.querySelectorAll('a[href]')).map(link => ({
                      text: link.textContent.trim(),
                      href: link.href
                    })).filter(link => link.text).slice(0, 20),
                    images: Array.from(document.querySelectorAll('img[src]')).map(img => ({
                      src: img.src,
                      alt: img.alt
                    })).slice(0, 10),
                    forms: Array.from(document.querySelectorAll('form')).length,
                    tables: Array.from(document.querySelectorAll('table')).length
                  }
                })
              `
              break
            default:
              throw new Error(`Unknown data type: ${dataType}`)
          }

          const result = await webview.executeJavaScript(`(${script})`)
          return { success: true, message: `Extracted ${dataType} data successfully`, data: result }
        } catch (error) {
          return {
            success: false,
            message: `Failed to extract data: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },

      scrollPage: async (direction: 'up' | 'down' | 'top' | 'bottom', amount = 500) => {
        try {
          let script = ''
          switch (direction) {
            case 'up':
              script = `window.scrollBy(0, -${amount}); 'Scrolled up'`
              break
            case 'down':
              script = `window.scrollBy(0, ${amount}); 'Scrolled down'`
              break
            case 'top':
              script = `window.scrollTo(0, 0); 'Scrolled to top'`
              break
            case 'bottom':
              script = `window.scrollTo(0, document.body.scrollHeight); 'Scrolled to bottom'`
              break
          }
          
          const result = await get().executePageScript(script)
          return result
        } catch (error) {
          return {
            success: false,
            message: `Failed to scroll: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },

      executePageScript: (script: string) => {
        return new Promise((resolve) => {
          const webview = document.querySelector('webview') as any
          if (!webview) {
            resolve({ success: false, message: 'No active webview' })
            return
          }

          webview.executeJavaScript(`(function() { try { const result = (function() { ${script} })(); return { success: true, result }; } catch (e) { return { success: false, error: e.message }; } })()`).then((result: any) => {
            resolve(result)
          }).catch((error: Error) => {
            resolve({ success: false, message: error.message })
          })
        })
      },

      findOnPage: async (searchTerm: string) => {
        try {
          const script = `
            const searchTerm = '${searchTerm.replace(/'/g, "\\'")}';
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );
            
            const matches = [];
            let node;
            while (node = walker.nextNode()) {
              if (node.textContent.toLowerCase().includes(searchTerm.toLowerCase())) {
                matches.push({
                  text: node.textContent.trim(),
                  element: node.parentElement.tagName
                });
              }
            }
            
            matches.slice(0, 10)
          `
          
          const result = await get().executePageScript(script)
          return {
            success: true,
            message: `Found ${result.data?.length || 0} matches for "${searchTerm}"`,
            data: result.data
          }
        } catch (error) {
          return {
            success: false,
            message: `Failed to search page: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },

      getPageMetadata: async () => {
        try {
          const script = `
            ({
              title: document.title,
              url: window.location.href,
              description: document.querySelector('meta[name="description"]')?.content || '',
              keywords: document.querySelector('meta[name="keywords"]')?.content || '',
              author: document.querySelector('meta[name="author"]')?.content || '',
              canonical: document.querySelector('link[rel="canonical"]')?.href || '',
              ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
              ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
              ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
              lang: document.documentElement.lang || '',
              lastModified: document.lastModified
            })
          `
          
          const result = await get().executePageScript(script)
          return {
            success: true,
            message: 'Retrieved page metadata successfully',
            data: result.data
          }
        } catch (error) {
          return {
            success: false,
            message: `Failed to get metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },

      // Advanced AI Browser Control Actions
      waitForElement: async (selector: string, timeout?: number) => {
        try {
          const script = `
            const selector = '${selector.replace(/'/g, "\\'")}';
            const timeout = ${timeout || 'undefined'};
            const result = (() => {
              const element = document.querySelector(selector);
              if (element) {
                return { success: true, message: 'Element found', data: element };
              } else {
                throw new Error('Element not found');
              }
            })();
            result
          `
          
          const result = await get().executePageScript(script)
          return result
        } catch (error) {
          return {
            success: false,
            message: `Failed to wait for element: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },
      smartFillForm: async (formDescription: string, userData?: Record<string, string>) => {
        try {
          const script = `
            const formDescription = '${formDescription.replace(/'/g, "\\'")}';
            const userData = ${JSON.stringify(userData)};
            const result = (() => {
              const form = document.querySelector(formDescription);
              if (form) {
                const fields = Array.from(form.querySelectorAll('input, textarea, select'));
                fields.forEach(field => {
                  const name = field.name;
                  const type = field.type;
                  const placeholder = field.placeholder;
                  const value = userData[name] || userData[type] || userData[placeholder] || '';
                  if (field) {
                    field.value = value;
                  }
                });
                return { success: true, message: 'Form filled successfully', data: { filledForm: form } };
              } else {
                throw new Error('Form not found');
              }
            })();
            result
          `
          
          const result = await get().executePageScript(script)
          return result
        } catch (error) {
          return {
            success: false,
            message: `Failed to smart fill form: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },
      findAndClick: async (elementDescription: string) => {
        try {
          const script = `
            const elementDescription = '${elementDescription.replace(/'/g, "\\'")}';
            const result = (() => {
              const element = document.querySelector(elementDescription);
              if (element) {
                element.click();
                return { success: true, message: 'Element clicked successfully' };
              } else {
                throw new Error('Element not found');
              }
            })();
            result
          `
          
          const result = await get().executePageScript(script)
          return result
        } catch (error) {
          return {
            success: false,
            message: `Failed to find and click element: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },
      takeScreenshot: async (description: string) => {
        try {
          const script = `
            const description = '${description.replace(/'/g, "\\'")}';
            const result = (() => {
              const canvas = document.createElement('canvas');
              canvas.width = document.documentElement.clientWidth;
              canvas.height = document.documentElement.clientHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(document.documentElement, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/png');
              return { success: true, message: 'Screenshot taken', data: { description, dataUrl } };
            })();
            result
          `
          
          const result = await get().executePageScript(script)
          return result
        } catch (error) {
          return {
            success: false,
            message: `Failed to take screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },
      executeWorkflow: async (steps: BrowserAction[]) => {
        try {
          const script = `
            const steps = ${JSON.stringify(steps)};
            const result = (() => {
              const executeStep = async (step: BrowserAction) => {
                const actionResult = await executeBrowserAction(step);
                if (!actionResult.success) throw new Error(actionResult.message);
                return actionResult;
              };
              const results = await Promise.all(steps.map(executeStep));
              return { success: true, message: 'Workflow executed successfully', data: results };
            })();
            result
          `
          
          const result = await get().executePageScript(script)
          return result
        } catch (error) {
          return {
            success: false,
            message: `Failed to execute workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },
      analyzePageStructure: async () => {
        try {
          const script = `
            const result = (() => {
              const structure = {
                title: document.title,
                description: document.querySelector('meta[name="description"]')?.content || '',
                headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
                  level: h.tagName,
                  text: h.textContent.trim()
                })).slice(0, 20),
                links: Array.from(document.querySelectorAll('a[href]')).map(link => ({
                  text: link.textContent.trim(),
                  href: link.href
                })).filter(link => link.text).slice(0, 20),
                forms: Array.from(document.querySelectorAll('form')).map(form => ({
                  action: form.action,
                  method: form.method,
                  fields: Array.from(form.querySelectorAll('input, textarea, select')).map(field => ({
                    name: field.name,
                    type: field.type,
                    placeholder: field.placeholder
                  }))
                })),
                tables: Array.from(document.querySelectorAll('table')).map((table, index) => ({
                  id: table.id || 'table-' + index,
                  headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim()),
                  rows: Array.from(table.querySelectorAll('tr')).slice(1).map(row => 
                    Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim())
                  ),
                  rowCount: Array.from(table.querySelectorAll('tr')).length - 1
                }))
              };
              return { success: true, message: 'Page structure analyzed successfully', data: structure };
            })();
            result
          `
          
          const result = await get().executePageScript(script)
          return result
        } catch (error) {
          return {
            success: false,
            message: `Failed to analyze page structure: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },
      extractTableData: async (tableSelector?: string) => {
        try {
          const script = `
            const tableSelector = '${tableSelector || ''}';
            const result = (() => {
              const tables = Array.from(document.querySelectorAll(tableSelector)).map((table, index) => ({
                id: table.id || 'table-' + index,
                headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim()),
                rows: Array.from(table.querySelectorAll('tr')).slice(1).map(row => 
                  Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim())
                ),
                rowCount: Array.from(table.querySelectorAll('tr')).length - 1
              }));
              return { success: true, message: 'Table data extracted successfully', data: tables };
            })();
            result
          `
          
          const result = await get().executePageScript(script)
          return result
        } catch (error) {
          return {
            success: false,
            message: `Failed to extract table data: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },
      monitorPageChanges: async (duration: number) => {
        try {
          const script = `
            const duration = ${duration || 'undefined'};
            const result = (() => {
              const observer = new MutationObserver(() => {
                // Implementation of monitoring page changes
              });
              observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
              return { success: true, message: 'Page change monitoring started' };
            })();
            result
          `
          
          const result = await get().executePageScript(script)
          return result
        } catch (error) {
          return {
            success: false,
            message: `Failed to monitor page changes: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },
      intelligentScroll: async (target: string) => {
        try {
          const script = `
            const target = '${target.replace(/'/g, "\\'")}';
            const result = (() => {
              // Implementation of intelligent scrolling logic
            })();
            result
          `
          
          const result = await get().executePageScript(script)
          return result
        } catch (error) {
          return {
            success: false,
            message: `Failed to intelligent scroll: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },
      autoFillCredentials: async (site: string) => {
        try {
          const script = `
            const site = '${site.replace(/'/g, "\\'")}';
            const result = (() => {
              // Implementation of auto-filling credentials logic
            })();
            result
          `
          
          const result = await get().executePageScript(script)
          return result
        } catch (error) {
          return {
            success: false,
            message: `Failed to auto-fill credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },
      addTabToGroup: (tabId: string, groupName: string) => {
        set((state) => {
          const group = state.tabGroups.find(g => g.name === groupName)
          if (group) {
            group.tabs.push(tabId)
          } else {
            state.tabGroups.push({ id: crypto.randomUUID(), name: groupName, tabs: [tabId] })
          }
          return { tabGroups: [...state.tabGroups] }
        })
      },
      classifyTab: async (tabId: string) => {
        const tab = get().tabs.find(t => t.id === tabId)
        if (tab) {
          const { chat } = useAIStore.getState()
          const category = await chat(`Classify this URL into a group: ${tab.url}`)
          get().addTabToGroup(tabId, category)
        }
      }
    }),
    {
      name: 'browser-storage',
      partialize: (state: BrowserState) => ({
        searchEngine: state.searchEngine,
        tabs: state.tabs.map((tab: Tab) => ({
          ...tab,
          isLoading: false // Don't persist loading state
        })),
        tabGroups: state.tabGroups
      })
    }
  )
) 