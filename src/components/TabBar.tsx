import React from 'react'
import { X, Plus } from 'lucide-react'
import { Tab } from '../stores/browserStore'
import { useBrowserStore } from '../stores/browserStore'

interface TabBarProps {
  tabs: Tab[]
  currentTab: Tab | null
  onSwitchTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  onNewTab: () => void
}

const TabBar: React.FC<TabBarProps> = ({ tabs, currentTab, onSwitchTab, onCloseTab, onNewTab }) => {
  const { tabGroups } = useBrowserStore()

  return (
    <div className="flex items-center px-4 gap-2 overflow-x-auto border-t border-gray-200">
      {tabGroups.map(group => (
        <div key={group.id} className="p-2">
          <h3 className="text-xs font-semibold text-gray-500 mb-1">{group.name}</h3>
          {group.tabs.map(tabId => {
            const tab = tabs.find(t => t.id === tabId)
            if (!tab) return null
            return (
              <div
                key={tab.id}
                onClick={() => onSwitchTab(tab.id)}
                className={`group flex items-center px-3 py-1.5 rounded-md cursor-pointer transition-all duration-200 text-xs ${
                  currentTab?.id === tab.id
                    ? 'bg-white shadow-sm'
                    : 'hover:bg-gray-100/70'
                }`}
                style={{ WebkitAppRegion: 'no-drag' } as any}
              >
                <span className={`font-medium ${
                  currentTab?.id === tab.id ? 'text-gray-700' : 'text-gray-600'
                } max-w-[150px] truncate`}>
                  {tab.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseTab(tab.id)
                  }}
                  className="ml-1.5 p-0.5 rounded hover:bg-gray-200/70 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                  <X className="w-2.5 h-2.5 text-gray-500" />
                </button>
              </div>
            )
          })}
        </div>
      ))}
      {tabs.filter(tab => !tabGroups.some(g => g.tabs.includes(tab.id))).map(tab => (
        <div
          key={tab.id}
          onClick={() => onSwitchTab(tab.id)}
          className={`group flex items-center px-3 py-1.5 rounded-md cursor-pointer transition-all duration-200 text-xs ${
            currentTab?.id === tab.id
              ? 'bg-white shadow-sm'
              : 'hover:bg-gray-100/70'
          }`}
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <span className={`font-medium ${
            currentTab?.id === tab.id ? 'text-gray-700' : 'text-gray-600'
          } max-w-[150px] truncate`}>
            {tab.title}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCloseTab(tab.id)
            }}
            className="ml-1.5 p-0.5 rounded hover:bg-gray-200/70 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <X className="w-2.5 h-2.5 text-gray-500" />
          </button>
        </div>
      ))}
      <button onClick={onNewTab} className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100/70 rounded-md">+</button>
    </div>
  )
}

export default TabBar 