import React, { useState } from 'react'
import { X, Search, Clock, Globe, Trash2 } from 'lucide-react'
import { useHistoryStore } from '../stores/historyStore'
import { useBrowserStore } from '../stores/browserStore'
import { motion } from 'framer-motion'

interface HistoryViewProps {
  onClose: () => void
}

const HistoryView: React.FC<HistoryViewProps> = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const { globalHistory, aiSearchHistory, clearHistory } = useHistoryStore()
  const { addTab } = useBrowserStore()
  const [results, setResults] = useState(globalHistory)

  const handleSearch = async () => {
    const res = await aiSearchHistory(searchQuery)
    setResults(res)
  }

  // Group history by date
  const groupedHistory = results.reduce((groups: Record<string, HistoryEntry[]>, entry: HistoryEntry) => {
    const date = new Date(entry.visitTime).toDateString()
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(entry)
    return groups
  }, {} as Record<string, typeof globalHistory>)

  const handleOpenInNewTab = (url: string) => {
    addTab(url)
    onClose()
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getDomainFromUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname
      return domain.replace('www.', '')
    } catch {
      return url
    }
  }

  return (
    <div className="absolute inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5" />
          History
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (confirm('Clear all browsing history?')) {
                clearHistory()
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Clear history"
          >
            <Trash2 className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(groupedHistory).length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>{searchQuery ? 'No history found' : 'No browsing history yet'}</p>
          </div>
        ) : (
          Object.entries(groupedHistory).map(([date, entries]) => (
            <div key={date} className="border-b border-gray-100">
              <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-600 sticky top-0">
                {date === new Date().toDateString() ? 'Today' : date}
              </div>
              <div className="divide-y divide-gray-50">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors group"
                    onClick={() => handleOpenInNewTab(entry.url)}
                  >
                    <div className="flex items-start gap-3">
                      {entry.favicon ? (
                        <img 
                          src={entry.favicon} 
                          alt=""
                          className="w-4 h-4 mt-0.5 rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <Globe className="w-4 h-4 mt-0.5 text-gray-400" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {entry.title}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {getDomainFromUrl(entry.url)} • {formatTime(entry.visitTime)}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(entry.url)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default HistoryView 