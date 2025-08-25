import React, { useState, useEffect } from 'react'
import { Search, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import { useBrowserStore } from '../stores/browserStore'
import { useHistoryStore } from '../stores/historyStore'
import { useAIStore } from '../stores/aiStore'
import AICommandProcessor from './AICommandProcessor'
import { ChevronDown } from 'lucide-react'

const AddressBar: React.FC = () => {
  const { currentTab, navigateTab, searchEngine, addTab } = useBrowserStore()
  const { goBack, goForward } = useHistoryStore()
  const { isConnected, activeProvider } = useAIStore()
  const [inputValue, setInputValue] = useState(currentTab?.url || '')
  const [isFocused, setIsFocused] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const { getRecentHistory } = useHistoryStore()
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    let url = inputValue.trim()
    if (!url) return
    
    // If no current tab, handle differently
    if (!currentTab) {
      // For AI commands when no tab is open, we still need to process them
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
        const shouldUseAI = isConnected && (!url.includes('.') || url.includes(' '))
        
        if (shouldUseAI) {
          setIsProcessing(true)
          
          try {
            const commandProcessor = AICommandProcessor.getInstance()
            const result = await commandProcessor.processCommand(url, null)
            
            console.log('AI Command Processing (no tab):', {
              command: url,
              result: result,
              confidence: result.confidence,
              reasoning: result.reasoning
            })
            
            // For navigation commands, create new tab with the URL
            if (result.understood && result.action === 'navigate' && result.target) {
              let targetUrl = result.target
              if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
                if (targetUrl.includes('.')) {
                  targetUrl = `https://${targetUrl}`
                }
              }
              addTab(targetUrl)
              setInputValue('')
              setIsProcessing(false)
              return
            }
            
            // For search commands, create new tab with search
            if (result.understood && result.action === 'search' && result.query) {
              const searchUrl = `${searchEngine}/?q=${encodeURIComponent(result.query)}`
              addTab(searchUrl)
              setInputValue('')
              setIsProcessing(false)
              return
            }
            
            // For other commands, we need a tab first, so create one and then execute
            if (result.understood && result.confidence > 0.1) {
              // Create a new tab first
              addTab('about:blank')
              // Wait a bit for tab to be created
              setTimeout(async () => {
                await commandProcessor.executeCommand(result)
              }, 100)
              setInputValue('')
              setIsProcessing(false)
              return
            }
          } catch (error) {
            console.error('Error processing AI command:', error)
          }
          
          setIsProcessing(false)
        }
        
        // Process the URL normally if not an AI command
        if (url.includes('.') && !url.includes(' ') && !url.includes('?')) {
          url = `https://${url}`
        } else {
          url = `${searchEngine}/?q=${encodeURIComponent(url)}`
        }
      }
      
      // Create new tab with the URL
      addTab(url)
      setInputValue('')
      return
    }

    // Rest of the existing logic for when there IS a current tab
    // If the input looks like a natural language command, process it with AI
    if (url && !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      const commandProcessor = AICommandProcessor.getInstance()
      
      // For connected AI, process anything that's not obviously a direct URL
      // Multi-word inputs or inputs without dots are likely commands
      const shouldUseAI = isConnected && (!url.includes('.') || url.includes(' '))
      
      if (shouldUseAI) {
        setIsProcessing(true)
        
        try {
          // Extract page context safely (no DOM manipulation)
          const pageContext = await commandProcessor.extractPageContext()
          
          // Process the command
          const result = await commandProcessor.processCommand(url, pageContext)
          
          console.log('AI Command Processing:', {
            command: url,
            result: result,
            confidence: result.confidence,
            reasoning: result.reasoning,
            aiConnected: isConnected,
            currentPage: pageContext?.url || 'no context',
            pageTitle: pageContext?.title || 'no title'
          })
          
          // If AI understood the command with any confidence, execute it
          if (result.understood && result.confidence > 0.1) {
            const success = await commandProcessor.executeCommand(result)
            if (success) {
              console.log('✅ AI Command executed successfully:', result.reasoning)
              // Clear the input and blur if navigation happened
              if (result.action === 'navigate' || result.action === 'click') {
                setInputValue('')
                ;(e.target as HTMLFormElement).querySelector('input')?.blur()
              }
              setIsProcessing(false)
              return
            }
          }
          
          // If AI didn't understand or execution failed, fall back to traditional logic
          console.log('⚠️ AI processing unsuccessful, falling back to traditional logic')
          
        } catch (error) {
          console.error('Error processing AI command:', error)
          // Fall back to traditional logic
        }
        
        setIsProcessing(false)
      }
    }
    
    // Traditional URL/search logic (fallback or for direct URLs)
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      // Check if it looks like a URL (contains dot and no spaces)
      if (url.includes('.') && !url.includes(' ') && !url.includes('?')) {
        url = `https://${url}`
      } else {
        // Search query - use the configured search engine
        url = `${searchEngine}/?q=${encodeURIComponent(url)}`
      }
    }
    
    console.log('Traditional navigation:', { original: inputValue, processed: url })
    navigateTab(currentTab.id, url)
    
    // Blur the input after navigation
    ;(e.target as HTMLFormElement).querySelector('input')?.blur()
  }

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Select all text when clicking on the input
    const input = e.currentTarget
    input.select()
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    // Also select all text when focusing (e.g., via keyboard)
    e.currentTarget.select()
  }

  const handleBack = () => {
    if (!currentTab) return
    
    const historyEntry = goBack(currentTab.id)
    if (historyEntry) {
      navigateTab(currentTab.id, historyEntry.url)
    }
  }

  const handleForward = () => {
    if (!currentTab) return
    
    const historyEntry = goForward(currentTab.id)
    if (historyEntry) {
      navigateTab(currentTab.id, historyEntry.url)
    }
  }

  const handleReload = () => {
    const webview = document.querySelector('webview') as any
    if (webview) {
      webview.reload()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    if (value.length > 0) {
      const history = getRecentHistory(50).map(entry => entry.url)
      const filtered = history.filter(url => url.toLowerCase().includes(value.toLowerCase())).slice(0, 5)
      setSuggestions(filtered)
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleSelectSuggestion = (url: string) => {
    setInputValue(url)
    setShowSuggestions(false)
    // Trigger navigation
    if (currentTab) {
      navigateTab(currentTab.id, url)
    }
  }

  // Update input value when the current tab's URL changes
  useEffect(() => {
    const url = currentTab?.url || ''
    if (url && url !== 'about:blank') {
      setInputValue(url)
    } else {
      setInputValue('')
    }
  }, [currentTab?.id, currentTab?.url]) // Watch both tab ID and URL changes

  // Get appropriate placeholder text
  const getPlaceholder = () => {
    if (isConnected && activeProvider) {
      return "Search, enter URL, or command: 'click login', 'go to youtube', 'find all links'..."
    }
    return "Search with search.sh or enter URL..."
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          onClick={handleBack}
          disabled={!currentTab?.canGoBack}
          className="bg-white/70 backdrop-blur-sm border border-gray-200 hover:bg-white hover:shadow-sm hover:border-gray-300 transition-all duration-200 p-1.5 text-gray-600 rounded-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/70 disabled:hover:shadow-none"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleForward}
          disabled={!currentTab?.canGoForward}
          className="bg-white/70 backdrop-blur-sm border border-gray-200 hover:bg-white hover:shadow-sm hover:border-gray-300 transition-all duration-200 p-1.5 text-gray-600 rounded-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/70 disabled:hover:shadow-none"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={handleReload}
          className="bg-white/70 backdrop-blur-sm border border-gray-200 hover:bg-white hover:shadow-sm hover:border-gray-300 transition-all duration-200 p-1.5 text-gray-600 rounded-md"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="flex-1">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onClick={handleInputClick}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}  // Delay to allow click
            placeholder={getPlaceholder()}
            disabled={isProcessing}
            className={`w-full px-4 py-2 pl-10 text-sm text-gray-700 placeholder-gray-400 rounded-lg transition-all duration-200 bg-white/90 border ${
              isFocused 
                ? 'border-blue-400 shadow-md shadow-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            } ${isProcessing ? 'opacity-70 cursor-wait' : ''}`}
          />
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
            isProcessing ? 'text-blue-500 animate-spin' : 
            isFocused ? 'text-blue-500' : 'text-gray-400'
          }`} />
          {isConnected && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="AI Connected" />
            </div>
          )}
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 bg-white border border-gray-200 rounded-md shadow-lg mt-10 w-[calc(100%-2rem)] max-h-48 overflow-y-auto">
            {suggestions.map((sugg, index) => (
              <div
                key={index}
                onClick={() => handleSelectSuggestion(sugg)}
                className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer truncate"
              >
                {sugg}
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  )
}

export default AddressBar 