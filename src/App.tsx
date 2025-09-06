import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, MessageCircle, Settings, Zap } from 'lucide-react'
import { useBrowserStore } from './stores/browserStore'
import { useAIStore } from './stores/aiStore'
import TabBar from './components/TabBar'
import AddressBar from './components/AddressBar'
import WebView from './components/WebView'
import AIChat from './components/AIChat'
import CommandPalette from './components/CommandPalette'
import APIKeyManager from './components/APIKeyManager'
import HistoryView from './components/HistoryView'
import { Toaster } from 'react-hot-toast'
import Sidebar from './components/Sidebar'
import MCPManager from './components/MCPManager'

function App() {
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showAIChat, setShowAIChat] = useState(false)
  const [showAPIKeyManager, setShowAPIKeyManager] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showMCPManager, setShowMCPManager] = useState(false)
  const { currentTab, tabs, addTab, closeTab, switchTab, setSearchEngine } = useBrowserStore()
  const { isConnected, initializeConnections, browserControlEnabled } = useAIStore()

  // Initialize with a default tab if none exist
  useEffect(() => {
    if (tabs.length === 0) {
      addTab('https://search.sh')
    }
    // Ensure search engine is always search.sh
    setSearchEngine('https://search.sh')
  }, [tabs.length]) // Watch tabs.length to ensure we always have at least one tab

  // Initialize AI connections on startup
  useEffect(() => {
    initializeConnections()
  }, [initializeConnections])

  // Handle new tab requests from main process
  useEffect(() => {
    if (window.electronAPI && (window.electronAPI as any).onCreateNewTab) {
      (window.electronAPI as any).onCreateNewTab((url: string) => {
        addTab(url)
      })
    }
  }, [addTab])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        addTab('https://search.sh')
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault()
        if (currentTab) closeTab(currentTab.id)
      }
      // Add DevTools shortcut
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === 'i') {
        e.preventDefault()
        const webview = document.querySelector('webview') as any
        if (webview) {
          webview.openDevTools()
        }
      }
      // Add AI Chat shortcut
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setShowAIChat(!showAIChat)
      }
      // Add History shortcut
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault()
        setShowHistory(!showHistory)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTab, addTab, closeTab, showAIChat, showHistory])

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Main Browser Area */}
      <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
        {/* Tab Bar with padding for macOS window controls */}
        <div className="bg-gray-50/90 backdrop-blur-sm border-b border-gray-200 pt-8 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as any}>
          <TabBar 
            tabs={tabs}
            currentTab={currentTab}
            onSwitchTab={switchTab}
            onCloseTab={closeTab}
            onNewTab={() => addTab('about:blank')}
          />
        </div>
        
        {/* Address Bar */}
        <div className="px-4 py-2 bg-white/95 backdrop-blur-sm border-b border-gray-200 flex-shrink-0">
          <AddressBar />
        </div>
        
        {/* Web Content */}
        <div className="flex-1 relative min-h-0">
          <WebView tab={currentTab} />
          
          {/* AI Chat Overlay */}
          {showAIChat && (
            <div className="absolute top-0 right-0 w-96 h-full bg-white shadow-xl border-l border-gray-200 z-50">
              <AIChat onClose={() => setShowAIChat(false)} />
            </div>
          )}
          
          {/* History View Overlay */}
          {showHistory && (
            <div className="absolute top-0 right-0 w-96 h-full bg-white shadow-xl border-l border-gray-200 z-50">
              <HistoryView onClose={() => setShowHistory(false)} />
            </div>
          )}
        </div>
        
        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white/95 backdrop-blur-sm border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-md transition-all duration-200 font-medium"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Commands</span>
              <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-gray-100 border border-gray-200 rounded">⌘K</kbd>
            </button>
            
            {browserControlEnabled && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
                <Zap className="w-3 h-3" />
                <span>AI Control</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 ${
              isConnected 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
              <span>{isConnected ? 'AI Ready' : 'AI Offline'}</span>
            </div>
            
            <button
              onClick={() => setShowAIChat(!showAIChat)}
              className={`p-1.5 rounded-md transition-all duration-200 ${
                showAIChat 
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-200' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
              }`}
              title="AI Chat (Cmd+J)"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            
            <button 
              onClick={() => setShowAPIKeyManager(true)}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-md transition-all duration-200"
              title="Settings & API Keys"
            >
              <Settings className="w-4 h-4" />
            </button>
            
            <button 
              onClick={() => setShowMCPManager(true)}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-md transition-all duration-200"
              title="MCP Manager"
            >
              <Zap className="w-4 h-4" />
            </button>
            
            <button 
              onClick={() => {
                const webview = document.querySelector('webview') as any
                if (webview) {
                  webview.openDevTools()
                }
              }}
              className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-md transition-all duration-200"
              title="Developer Tools (Cmd+Option+I)"
            >
              <span className="text-xs font-mono">&lt;/&gt;</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Command Palette */}
      <CommandPalette 
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onOpenChat={() => {
          setShowCommandPalette(false)
          setShowAIChat(true)
        }}
        onOpenHistory={() => {
          setShowCommandPalette(false)
          setShowHistory(true)
        }}
      />
      
      {/* API Key Manager Modal */}
      {showAPIKeyManager && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-200"
          onClick={() => setShowAPIKeyManager(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[80vh] overflow-y-auto transform transition-all duration-200"
          >
            <APIKeyManager />
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowAPIKeyManager(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MCP Manager Modal */}
      {showMCPManager && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-200"
          onClick={() => setShowMCPManager(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[80vh] overflow-y-auto transform transition-all duration-200"
          >
            <MCPManager />
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowMCPManager(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <Toaster position="top-right" />
    </div>
  )
}

export default App 