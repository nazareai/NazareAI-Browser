import React, { useState, useEffect } from 'react'
import { Search, Globe, MessageSquare, Settings, Zap, ArrowLeft, ArrowRight, RotateCcw, Plus, X, ExternalLink, FileText, Mouse, Clock } from 'lucide-react'
import { useBrowserStore } from '../stores/browserStore'
import { useAIStore } from '../stores/aiStore'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onOpenChat: () => void
  onOpenHistory?: () => void
}

interface Command {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  action: () => void
  category: 'navigation' | 'ai' | 'browser' | 'page'
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onOpenChat, onOpenHistory }) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { currentTab, addTab, navigateTab, searchWeb, extractPageData, scrollPage, executeBrowserAction, getCurrentPageContent } = useBrowserStore()
  const { browserControlEnabled, setBrowserControlEnabled, streamChat, isConnected } = useAIStore()
  const [aiSuggestions, setAiSuggestions] = useState<Command[]>([])

  const baseCommands: Command[] = [
    {
      id: 'new-tab',
      title: 'New Tab',
      description: 'Create a new browser tab',
      icon: <Plus className="w-4 h-4" />,
      action: () => { addTab(); onClose() },
      category: 'navigation'
    },
    {
      id: 'search',
      title: 'Search Web',
      description: 'Search the web using your default search engine',
      icon: <Search className="w-4 h-4" />,
      action: () => {
        const searchQuery = prompt('Enter search query:')
        if (searchQuery) {
          searchWeb(searchQuery, true)
          onClose()
        }
      },
      category: 'navigation'
    },
    {
      id: 'go-back',
      title: 'Go Back',
      description: 'Navigate back in browser history',
      icon: <ArrowLeft className="w-4 h-4" />,
      action: () => {
        if (currentTab?.canGoBack) {
          executeBrowserAction({ type: 'goBack' })
        }
        onClose()
      },
      category: 'navigation'
    },
    {
      id: 'go-forward',
      title: 'Go Forward',
      description: 'Navigate forward in browser history',
      icon: <ArrowRight className="w-4 h-4" />,
      action: () => {
        if (currentTab?.canGoForward) {
          executeBrowserAction({ type: 'goForward' })
        }
        onClose()
      },
      category: 'navigation'
    },
    {
      id: 'reload',
      title: 'Reload Page',
      description: 'Refresh the current page',
      icon: <RotateCcw className="w-4 h-4" />,
      action: () => {
        if (currentTab) {
          executeBrowserAction({ type: 'reload' })
        }
        onClose()
      },
      category: 'navigation'
    },
    {
      id: 'history',
      title: 'View History',
      description: 'Browse your browsing history',
      icon: <Clock className="w-4 h-4" />,
      action: () => {
        if (onOpenHistory) {
          onOpenHistory()
        }
        onClose()
      },
      category: 'navigation'
    },
    {
      id: 'open-chat',
      title: 'Open AI Chat',
      description: 'Open the AI assistant chat panel',
      icon: <MessageSquare className="w-4 h-4" />,
      action: () => { onOpenChat(); onClose() },
      category: 'ai'
    },
    {
      id: 'toggle-browser-control',
      title: `${browserControlEnabled ? 'Disable' : 'Enable'} Browser Control`,
      description: `${browserControlEnabled ? 'Disable' : 'Enable'} AI browser control features`,
      icon: <Globe className="w-4 h-4" />,
      action: () => { setBrowserControlEnabled(!browserControlEnabled); onClose() },
      category: 'ai'
    }
  ]

  // Add AI browser control commands when enabled
  const aiCommands: Command[] = browserControlEnabled ? [
    {
      id: 'ai-navigate',
      title: 'AI Navigate',
      description: 'Ask AI to navigate to a specific website',
      icon: <Globe className="w-4 h-4" />,
      action: () => {
        const url = prompt('Where should I navigate? (e.g., "google.com", "search for cats")')
        if (url) {
          if (url.includes(' ') && !url.startsWith('http')) {
            searchWeb(url, false)
          } else {
            executeBrowserAction({ type: 'navigate', url })
          }
        }
        onClose()
      },
      category: 'ai'
    },
    {
      id: 'extract-links',
      title: 'Extract Links',
      description: 'Extract all links from the current page',
      icon: <ExternalLink className="w-4 h-4" />,
      action: async () => {
        try {
          const result = await extractPageData('links')
          if (result.success && result.data?.data) {
            console.log('Extracted links:', result.data.data)
            alert(`Found ${result.data.data.length} links. Check console for details.`)
          }
        } catch (error) {
          console.error('Failed to extract links:', error)
        }
        onClose()
      },
      category: 'page'
    },
    {
      id: 'extract-text',
      title: 'Extract Text',
      description: 'Extract main text content from the current page',
      icon: <FileText className="w-4 h-4" />,
      action: async () => {
        try {
          const result = await extractPageData('text')
          if (result.success && result.data?.content) {
            console.log('Extracted text:', result.data.content.slice(0, 500) + '...')
            alert('Text extracted successfully. Check console for details.')
          }
        } catch (error) {
          console.error('Failed to extract text:', error)
        }
        onClose()
      },
      category: 'page'
    },
    {
      id: 'extract-tables',
      title: 'Extract Tables',
      description: 'Extract all table data from the current page',
      icon: <FileText className="w-4 h-4" />,
      action: async () => {
        try {
          const result = await extractPageData('tables')
          if (result.success && result.data?.data) {
            console.log('Extracted tables:', result.data.data)
            alert(`Found ${result.data.data.length} tables. Check console for details.`)
          }
        } catch (error) {
          console.error('Failed to extract tables:', error)
        }
        onClose()
      },
      category: 'page'
    },
    {
      id: 'analyze-page',
      title: 'Analyze Page',
      description: 'Get comprehensive analysis of page structure',
      icon: <Search className="w-4 h-4" />,
      action: async () => {
        try {
          const result = await extractPageData('all')
          if (result.success && result.data?.data) {
            console.log('Page analysis:', result.data.data)
            alert('Page analyzed successfully. Check console for details.')
          }
        } catch (error) {
          console.error('Failed to analyze page:', error)
        }
        onClose()
      },
      category: 'page'
    },
    {
      id: 'find-forms',
      title: 'Find Forms',
      description: 'Find all forms on the current page',
      icon: <FileText className="w-4 h-4" />,
      action: async () => {
        try {
          const result = await extractPageData('forms')
          if (result.success && result.data?.data) {
            console.log('Found forms:', result.data.data)
            alert(`Found ${result.data.data.length} forms. Check console for details.`)
          }
        } catch (error) {
          console.error('Failed to find forms:', error)
        }
        onClose()
      },
      category: 'page'
    },
    {
      id: 'scroll-to-top',
      title: 'Scroll to Top',
      description: 'Scroll to the top of the current page',
      icon: <Mouse className="w-4 h-4" />,
      action: () => {
        scrollPage('top')
        onClose()
      },
      category: 'page'
    },
    {
      id: 'scroll-to-bottom',
      title: 'Scroll to Bottom',
      description: 'Scroll to the bottom of the current page',
      icon: <Mouse className="w-4 h-4" />,
      action: () => {
        scrollPage('bottom')
        onClose()
      },
      category: 'page'
    },
    {
      id: 'smart-click',
      title: 'Smart Click Element',
      description: 'Find and click an element by description',
      icon: <Mouse className="w-4 h-4" />,
      action: () => {
        const elementDesc = prompt('Describe the element to click (e.g., "submit button", "login link"):')
        if (elementDesc) {
          executeBrowserAction({ 
            type: 'findAndClick', 
            elementDescription: elementDesc 
          })
        }
        onClose()
      },
      category: 'ai'
    },
    {
      id: 'ai-help',
      title: 'AI Help',
      description: 'Get help with AI browser control commands',
      icon: <Zap className="w-4 h-4" />,
      action: () => {
        onOpenChat()
        onClose()
        // This would ideally trigger a help message in the chat
        setTimeout(() => {
          const aiStore = useAIStore.getState()
          if (aiStore.isConnected) {
            aiStore.streamChat('Help me understand what advanced browser control commands I can use with this AI assistant. Show me examples of form filling, page analysis, element interaction, and automation features.')
          }
        }, 500)
      },
      category: 'ai'
    }
  ] : []

  useEffect(() => {
    if (isOpen && isConnected) {
      const generateSuggestions = async () => {
        try {
          const context = await getCurrentPageContent()
          const response = await streamChat(`Based on this page context: ${context.slice(0, 1000)}, suggest 2-3 useful commands. Respond with JSON array: [{title: '...', description: '...', action: 'navigate|search|etc', target: 'optional url', query: 'optional query'}]`)
          interface Suggestion { title: string; description: string; action: string; target?: string; query?: string; }
          const suggestions = JSON.parse(response).map((sugg: Suggestion) => ({
            id: `ai-${sugg.title.toLowerCase()}`,
            title: sugg.title,
            description: sugg.description,
            icon: <Zap className="w-4 h-4" />,
            action: () => {
              if (sugg.action === 'navigate' && sugg.target && currentTab) {
                navigateTab(currentTab.id, sugg.target)
              } else if (sugg.action === 'search' && sugg.query) {
                searchWeb(sugg.query)
              }
              // Add more action handlers as needed
            },
            category: 'ai'
          }))
          setAiSuggestions(suggestions)
        } catch (error) {
          console.error('Failed to generate AI suggestions:', error)
        }
      }
      generateSuggestions()
    }
  }, [isOpen, isConnected, currentTab, navigateTab, searchWeb, getCurrentPageContent, streamChat])

  const allCommands = [...baseCommands, ...aiCommands, ...aiSuggestions]

  const filteredCommands = allCommands.filter(command =>
    command.title.toLowerCase().includes(query.toLowerCase()) ||
    command.description.toLowerCase().includes(query.toLowerCase())
  )

  const groupedCommands = filteredCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = []
    }
    acc[command.category].push(command)
    return acc
  }, {} as Record<string, Command[]>)

  const categoryLabels = {
    navigation: 'Navigation',
    ai: 'AI Assistant',
    browser: 'Browser',
    page: 'Page Actions'
  }

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20">
      <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-white/20">
        {/* Header */}
        <div className="p-4 border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search commands..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-gray-800 placeholder-gray-500 outline-none text-lg"
              autoFocus
            />
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Commands */}
        <div className="max-h-96 overflow-y-auto">
          {Object.entries(groupedCommands).map(([category, commands]) => (
            <div key={category} className="p-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                {categoryLabels[category as keyof typeof categoryLabels]}
              </h3>
              {commands.map((command, commandIndex) => {
                const globalIndex = filteredCommands.indexOf(command)
                return (
                  <button
                    key={command.id}
                    onClick={command.action}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      globalIndex === selectedIndex
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-gray-600">
                        {command.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 text-sm">
                          {command.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {command.description}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
          
          {filteredCommands.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm">No commands found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200/50 text-xs text-gray-500 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          {browserControlEnabled && (
            <div className="flex items-center gap-1 text-blue-600">
              <Zap className="w-3 h-3" />
              <span>AI Control Active</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CommandPalette 