import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { HistoryEntry, TabHistory, HistoryState } from '../types/history'
import { useAIStore } from './aiStore'

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      globalHistory: [],
      tabHistories: new Map(),
      searchQuery: '',

      addHistoryEntry: (tabId: string, url: string, title: string, favicon?: string) => {
        // Check if we already have this URL as the most recent entry for this tab
        const currentTabHistory = get().tabHistories.get(tabId)
        if (currentTabHistory && currentTabHistory.entries.length > 0) {
          const currentEntry = currentTabHistory.entries[currentTabHistory.currentIndex]
          if (currentEntry && currentEntry.url === url) {
            // Same URL, just update the title if it changed
            if (currentEntry.title !== title && title && title !== url) {
              console.log('[History] Updating title for existing entry:', { url, oldTitle: currentEntry.title, newTitle: title })
              get().updateHistoryEntry(currentEntry.id, { title })
            } else {
              console.log('[History] Skipping duplicate entry:', { url, title })
            }
            return // Don't add duplicate
          }
        }

        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          url,
          title: title || url,
          favicon,
          visitTime: new Date(),
          tabId,
          searchableText: `${title} ${url}`.toLowerCase()
        }
        
        console.log('[History] Adding entry:', { url, title, tabId })

        set((state) => {
          // Add to global history
          const newGlobalHistory = [...state.globalHistory, entry]
          
          // Update tab history
          const newTabHistories = new Map(state.tabHistories)
          const tabHistory = newTabHistories.get(tabId) || {
            tabId,
            entries: [],
            currentIndex: -1
          }

          // If we're not at the end of history (user went back then navigated somewhere new),
          // we need to clear forward history
          if (tabHistory.currentIndex < tabHistory.entries.length - 1) {
            tabHistory.entries = tabHistory.entries.slice(0, tabHistory.currentIndex + 1)
          }

          // Add new entry
          tabHistory.entries.push(entry)
          tabHistory.currentIndex = tabHistory.entries.length - 1
          newTabHistories.set(tabId, tabHistory)

          return {
            globalHistory: newGlobalHistory,
            tabHistories: newTabHistories
          }
        })
      },

      updateHistoryEntry: (id: string, updates: Partial<HistoryEntry>) => {
        set((state) => ({
          globalHistory: state.globalHistory.map(entry =>
            entry.id === id ? { ...entry, ...updates } : entry
          )
        }))
      },

      getTabHistory: (tabId: string) => {
        return get().tabHistories.get(tabId)
      },

      canGoBack: (tabId: string) => {
        const tabHistory = get().tabHistories.get(tabId)
        return tabHistory ? tabHistory.currentIndex > 0 : false
      },

      canGoForward: (tabId: string) => {
        const tabHistory = get().tabHistories.get(tabId)
        return tabHistory ? tabHistory.currentIndex < tabHistory.entries.length - 1 : false
      },

      goBack: (tabId: string) => {
        const tabHistory = get().tabHistories.get(tabId)
        if (!tabHistory || tabHistory.currentIndex <= 0) return undefined

        set((state) => {
          const newTabHistories = new Map(state.tabHistories)
          const updatedTabHistory = { ...tabHistory }
          updatedTabHistory.currentIndex -= 1
          newTabHistories.set(tabId, updatedTabHistory)
          
          return { tabHistories: newTabHistories }
        })

        return tabHistory.entries[tabHistory.currentIndex - 1]
      },

      goForward: (tabId: string) => {
        const tabHistory = get().tabHistories.get(tabId)
        if (!tabHistory || tabHistory.currentIndex >= tabHistory.entries.length - 1) return undefined

        set((state) => {
          const newTabHistories = new Map(state.tabHistories)
          const updatedTabHistory = { ...tabHistory }
          updatedTabHistory.currentIndex += 1
          newTabHistories.set(tabId, updatedTabHistory)
          
          return { tabHistories: newTabHistories }
        })

        return tabHistory.entries[tabHistory.currentIndex + 1]
      },

      searchHistory: (query: string) => {
        const { globalHistory } = get()
        if (!query) return globalHistory

        const searchLower = query.toLowerCase()
        return globalHistory.filter(entry =>
          entry.searchableText?.includes(searchLower) ||
          entry.title.toLowerCase().includes(searchLower) ||
          entry.url.toLowerCase().includes(searchLower)
        )
      },

      clearHistory: () => {
        set({ globalHistory: [], tabHistories: new Map() })
      },

      clearTabHistory: (tabId: string) => {
        set((state) => {
          const newTabHistories = new Map(state.tabHistories)
          newTabHistories.delete(tabId)
          
          // Also remove from global history
          const newGlobalHistory = state.globalHistory.filter(entry => entry.tabId !== tabId)
          
          return {
            globalHistory: newGlobalHistory,
            tabHistories: newTabHistories
          }
        })
      },

      getRecentHistory: (limit = 50) => {
        const { globalHistory } = get()
        return globalHistory
          .slice()
          .sort((a, b) => b.visitTime.getTime() - a.visitTime.getTime())
          .slice(0, limit)
      },

      getHistoryByDomain: (domain: string) => {
        const { globalHistory } = get()
        return globalHistory.filter(entry => {
          try {
            const url = new URL(entry.url)
            return url.hostname === domain || url.hostname.endsWith(`.${domain}`)
          } catch {
            return false
          }
        })
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query })
      },

      aiSearchHistory: async (query: string): Promise<HistoryEntry[]> => {
        const { chat } = useAIStore.getState()
        const results = await chat(`Search history for: ${query}, from entries: ${JSON.stringify(get().globalHistory)}`)
        return JSON.parse(results)
      }
    }),
    {
      name: 'browser-history',
      // Custom serialization to handle Map and Date objects
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          
          const { state } = JSON.parse(str)
          return {
            state: {
              ...state,
              // Convert array back to Map
              tabHistories: new Map(state.tabHistories || []),
              // Convert date strings back to Date objects
              globalHistory: state.globalHistory.map((entry: any) => ({
                ...entry,
                visitTime: new Date(entry.visitTime)
              }))
            }
          }
        },
        setItem: (name, value) => {
          const { state } = value as any
          const toStore = {
            state: {
              ...state,
              // Convert Map to array for serialization
              tabHistories: Array.from(state.tabHistories.entries()),
              // Dates will be automatically stringified
            }
          }
          localStorage.setItem(name, JSON.stringify(toStore))
        },
        removeItem: (name) => localStorage.removeItem(name)
      }
    }
  )
) 