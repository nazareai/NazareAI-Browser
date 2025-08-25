export interface HistoryEntry {
  id: string
  url: string
  title: string
  favicon?: string
  visitTime: Date
  tabId: string
  // For tracking how long user spent on the page
  duration?: number
  // For search functionality
  searchableText?: string
}

export interface TabHistory {
  tabId: string
  entries: HistoryEntry[]
  currentIndex: number
}

export interface HistoryState {
  // Global history across all tabs
  globalHistory: HistoryEntry[]
  
  // Per-tab navigation history for back/forward
  tabHistories: Map<string, TabHistory>
  
  // Search query for filtering history
  searchQuery: string
  
  // Actions
  addHistoryEntry: (tabId: string, url: string, title: string, favicon?: string) => void
  updateHistoryEntry: (id: string, updates: Partial<HistoryEntry>) => void
  getTabHistory: (tabId: string) => TabHistory | undefined
  canGoBack: (tabId: string) => boolean
  canGoForward: (tabId: string) => boolean
  goBack: (tabId: string) => HistoryEntry | undefined
  goForward: (tabId: string) => HistoryEntry | undefined
  searchHistory: (query: string) => HistoryEntry[]
  clearHistory: () => void
  clearTabHistory: (tabId: string) => void
  getRecentHistory: (limit?: number) => HistoryEntry[]
  getHistoryByDomain: (domain: string) => HistoryEntry[]
  setSearchQuery: (query: string) => void
} 