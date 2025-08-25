import React, { useEffect, useRef, useState } from 'react'
import { Tab } from '../stores/browserStore'
import { useBrowserStore } from '../stores/browserStore'
import { useHistoryStore } from '../stores/historyStore'

interface WebViewProps {
  tab: Tab | null
}

const WebView: React.FC<WebViewProps> = ({ tab }) => {
  const webviewRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastNavigationRef = useRef<{ url: string; time: number }>({ url: '', time: 0 })
  const performanceRef = useRef<{ startTime: number; resourcesLoaded: number }>({ startTime: 0, resourcesLoaded: 0 })
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState<{ message: string; details: string } | null>(null)
  const [isCloudflareChallenge, setIsCloudflareChallenge] = useState(false)
  const { updateTab } = useBrowserStore()
  const { addHistoryEntry, canGoBack: historyCanGoBack, canGoForward: historyCanGoForward } = useHistoryStore()

  // Monitor container dimensions and update webview size
  useEffect(() => {
    if (!containerRef.current || !webviewRef.current) return

    const updateWebviewSize = () => {
      if (containerRef.current && webviewRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const width = Math.floor(rect.width)
        const height = Math.floor(rect.height)
        
        // Update webview size directly
        webviewRef.current.style.width = `${width}px`
        webviewRef.current.style.height = `${height}px`
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      updateWebviewSize()
    })

    resizeObserver.observe(containerRef.current)

    // Initial size update
    updateWebviewSize()

    return () => {
      resizeObserver.disconnect()
    }
  }, [tab])

  // Add window resize listener as backup
  useEffect(() => {
    const handleWindowResize = () => {
      if (containerRef.current && webviewRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        webviewRef.current.style.width = `${rect.width}px`
        webviewRef.current.style.height = `${rect.height}px`
      }
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [])

  // Listen for Cloudflare challenge events
  useEffect(() => {
    if (window.electronAPI) {
      const handleCloudflareChallenge = (isActive: boolean) => {
        setIsCloudflareChallenge(isActive)
        if (isActive) {
          setLoadingProgress(50)
        } else {
          setLoadingProgress(100)
          setTimeout(() => setLoadingProgress(0), 500)
        }
      }

      window.electronAPI.onCloudflareChallenge(handleCloudflareChallenge)

      return () => {
        // Cleanup if needed
      }
    }
  }, [])

  // Add keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when WebView is focused and no form elements are active
      if (!webviewRef.current) return

      const target = event.target as HTMLElement
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true'

      if (isInputFocused) return

      // Handle common browser shortcuts
      if (event.metaKey || event.ctrlKey) {
        switch (event.key.toLowerCase()) {
          case 'r':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.reload()
            }
            break
          case 'f':
            event.preventDefault()
            // Focus address bar (would need to be implemented in parent component)
            break
          case '+':
          case '=':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.executeJavaScript(`document.body.style.zoom = (parseFloat(document.body.style.zoom) || 1) * 1.1`)
            }
            break
          case '-':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.executeJavaScript(`document.body.style.zoom = (parseFloat(document.body.style.zoom) || 1) * 0.9`)
            }
            break
          case '0':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.executeJavaScript(`document.body.style.zoom = 1`)
            }
            break
        }
      }

      // Handle arrow keys for scrolling
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        switch (event.key) {
          case 'ArrowUp':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.executeJavaScript(`window.scrollBy(0, -50)`)
            }
            break
          case 'ArrowDown':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.executeJavaScript(`window.scrollBy(0, 50)`)
            }
            break
          case 'ArrowLeft':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.executeJavaScript(`window.scrollBy(-50, 0)`)
            }
            break
          case 'ArrowRight':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.executeJavaScript(`window.scrollBy(50, 0)`)
            }
            break
          case 'Home':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.executeJavaScript(`window.scrollTo(0, 0)`)
            }
            break
          case 'End':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.executeJavaScript(`window.scrollTo(0, document.body.scrollHeight)`)
            }
            break
          case 'PageUp':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.executeJavaScript(`window.scrollBy(0, -window.innerHeight)`)
            }
            break
          case 'PageDown':
            event.preventDefault()
            if (webviewRef.current) {
              webviewRef.current.executeJavaScript(`window.scrollBy(0, window.innerHeight)`)
            }
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])



  useEffect(() => {
    if (!tab || !webviewRef.current) return

    const webview = webviewRef.current
    const isProduction = process.env.NODE_ENV === 'production'

    // Handle DOM ready to ensure webview is fully initialized
    const handleDomReady = () => {
      // Force size update after DOM is ready
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        webview.style.width = `${rect.width}px`
        webview.style.height = `${rect.height}px`
      }
      
      // Only inject JavaScript if not in production or if absolutely necessary
      if (!isProduction) {
        // Inject minimal link handling for better navigation
        webview.executeJavaScript(`
          (function() {
            // Simple _blank link handler
            document.addEventListener('click', function(e) {
              let linkElement = e.target;
              while (linkElement && linkElement.tagName !== 'A' && linkElement !== document.body) {
                linkElement = linkElement.parentElement;
              }
              
              if (linkElement && linkElement.tagName === 'A' && linkElement.target === '_blank') {
                const href = linkElement.href;
                if (href && href !== '#' && !href.startsWith('javascript:') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Simulate Cmd+click for new tab
                  const newEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    detail: e.detail,
                    screenX: e.screenX,
                    screenY: e.screenY,
                    clientX: e.clientX,
                    clientY: e.clientY,
                    ctrlKey: e.ctrlKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey,
                    metaKey: true, // This simulates Cmd+click
                    button: e.button,
                    buttons: e.buttons,
                    relatedTarget: e.relatedTarget
                  });
                  
                  setTimeout(() => {
                    linkElement.dispatchEvent(newEvent);
                  }, 0);
                }
              }
            }, true);
            
            // Simple window.open override for new tabs
            const originalWindowOpen = window.open;
            window.open = function(url, target, features) {
              if (!target || target === '_blank' || target === '_new') {
                return originalWindowOpen.call(window, url, target || '_blank', features);
              } else if (target === '_self' || target === '_parent' || target === '_top') {
                window.location.href = url;
                return window;
              }
              return originalWindowOpen.call(window, url, target, features);
            };
          })();
        `).catch((err: Error) => console.error('Failed to inject navigation code:', err))
      }
    }

    // Handle navigation events
    const handleDidStartLoading = () => {
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }

      // Set a timeout to detect stuck pages (30 seconds)
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('Page loading timeout - forcing stop and reload')
        if (webviewRef.current) {
          updateTab(tab.id, { isLoading: false })
          setLoadingProgress(0)
          setError({
            message: 'Page load timeout',
            details: 'The page took too long to load. This may be due to network issues or server problems.'
          })
        }
      }, 30000) // 30 second timeout

      updateTab(tab.id, { isLoading: true })
      performanceRef.current.startTime = Date.now()
      performanceRef.current.resourcesLoaded = 0
      setLoadingProgress(10)
      setError(null) // Clear any previous errors
      setIsCloudflareChallenge(false) // Reset challenge state
    }

    const handleDidStopLoading = () => {
      // Clear the loading timeout since loading stopped
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }

      updateTab(tab.id, { isLoading: false })
      setLoadingProgress(100)
      // Keep progress at 100% briefly for visual feedback
      setTimeout(() => setLoadingProgress(0), 300)
    }

    const handleDidFinishLoad = () => {
      // Clear the loading timeout since page finished loading successfully
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }

      const title = webview.getTitle() || tab.title
      const loadTime = Date.now() - performanceRef.current.startTime

      // Update tab state
      updateTab(tab.id, {
        title,
        canGoBack: historyCanGoBack(tab.id),
        canGoForward: historyCanGoForward(tab.id)
      })

      // Update the title in the most recent history entry if it's more descriptive
      const { getTabHistory, updateHistoryEntry } = useHistoryStore.getState()
      const tabHistory = getTabHistory(tab.id)
      if (tabHistory && tabHistory.entries.length > 0) {
        const currentEntry = tabHistory.entries[tabHistory.currentIndex]
        if (currentEntry && currentEntry.url === tab.url && title !== currentEntry.title) {
          updateHistoryEntry(currentEntry.id, { title })
        }
      }

      // Performance optimization: Preload critical resources
      if (!isProduction) {
        webview.executeJavaScript(`
          (function() {
            // Preload critical resources for better performance
            const preloadResources = () => {
              // Preload images that are likely to be viewed soon
              const images = document.querySelectorAll('img[data-src], img[loading="lazy"]');
              images.forEach(img => {
                if (img.dataset.src) {
                  const preloadImg = new Image();
                  preloadImg.src = img.dataset.src;
                }
              });

              // Preload critical CSS and JS
              const criticalResources = document.querySelectorAll('link[rel="preload"], link[rel="prefetch"]');
              criticalResources.forEach(link => {
                if (link.href) {
                  fetch(link.href, { priority: 'high' }).catch(() => {});
                }
              });
            };

            // Memory optimization: Clean up unused resources
            const optimizeMemory = () => {
              // Clear unused images from memory
              const images = document.querySelectorAll('img');
              images.forEach(img => {
                if (img.complete && !img.src.includes('data:')) {
                  // Keep only visible images
                  const rect = img.getBoundingClientRect();
                  if (rect.bottom < 0 || rect.top > window.innerHeight) {
                    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                  }
                }
              });
            };

            // Run optimizations
            preloadResources();
            setTimeout(optimizeMemory, 5000); // Run memory optimization after 5 seconds
          })()
        `).catch(() => {})
      }

      console.log(`Page loaded in ${loadTime}ms: ${title}`)
    }

    const handleDidNavigate = (event: any) => {
      // Add to history when navigation completes, but prevent rapid duplicates
      if (event.url && event.url !== 'about:blank') {
        const now = Date.now()
        const isDuplicate = lastNavigationRef.current.url === event.url && 
                           (now - lastNavigationRef.current.time) < 500 // 500ms threshold
        
        if (!isDuplicate) {
          const title = webview.getTitle() || event.url
          const favicon = tab.favicon
          addHistoryEntry(tab.id, event.url, title, favicon)
          lastNavigationRef.current = { url: event.url, time: now }
        }
      }
      
      // Update tab state with history-aware navigation status
      updateTab(tab.id, { 
        url: event.url,
        canGoBack: historyCanGoBack(tab.id),
        canGoForward: historyCanGoForward(tab.id)
      })
    }

    const handleDidNavigateInPage = (event: any) => {
      // Only add to history for in-page navigation if it's a different URL
      if (event.url && event.url !== 'about:blank' && event.isMainFrame && event.url !== tab.url) {
        const title = webview.getTitle() || event.url
        const favicon = tab.favicon
        addHistoryEntry(tab.id, event.url, title, favicon)
      }
      
      updateTab(tab.id, { 
        url: event.url,
        canGoBack: historyCanGoBack(tab.id),
        canGoForward: historyCanGoForward(tab.id)
      })
    }

    // Handle navigation events
    const handleWillNavigate = (event: any) => {
      // Navigation is handled naturally by the webview now
      // No special intervention needed
    }

    const handleDidFailLoad = (event: any) => {
      // Clear the loading timeout since loading failed
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }

      // ERR_ABORTED (-3) can happen for several reasons including Cloudflare challenges
      if (event.errorCode === -3) {
        // Check if this is a Cloudflare challenge
        if (event.validatedURL && (event.validatedURL.includes('__cf_chl') || event.validatedURL.includes('cloudflare'))) {
          console.log('Cloudflare challenge in progress, allowing to continue...')
          setIsCloudflareChallenge(true)
          setLoadingProgress(30)
          // Don't update loading state, let the challenge complete
          return
        }
        // For other aborted loads (like new tab creation), just return
        return
      }

      console.log('Failed to load:', event.errorDescription, 'for URL:', event.validatedURL)
      updateTab(tab.id, { isLoading: false })
      setLoadingProgress(0)

      // Set appropriate error message based on error code
      let errorMessage = 'Failed to load page'
      let errorDetails = event.errorDescription || 'Unknown error occurred'

      if (event.errorCode === -105) {
        errorMessage = 'Network connection failed'
        errorDetails = 'Please check your internet connection and try again'
      } else if (event.errorCode === -106) {
        errorMessage = 'DNS resolution failed'
        errorDetails = 'The domain name could not be resolved. Please check the URL'
      } else if (event.errorCode === -107) {
        errorMessage = 'Connection refused'
        errorDetails = 'The server refused the connection. The site may be temporarily unavailable'
      } else if (event.errorCode === -109) {
        errorMessage = 'Connection timed out'
        errorDetails = 'The connection to the server timed out. Please try again'
      }

      setError({ message: errorMessage, details: errorDetails })
    }
    
    // Handle provisional load failures (happens before did-fail-load)
    const handleDidFailProvisionalLoad = (event: any) => {
      // ERR_ABORTED (-3) can happen for several reasons including Cloudflare challenges
      if (event.errorCode === -3) {
        // Check if this is a Cloudflare challenge
        if (event.validatedURL && (event.validatedURL.includes('__cf_chl') || event.validatedURL.includes('cloudflare'))) {
          console.log('Cloudflare challenge detected, allowing to proceed...')
          // Don't update loading state, let the challenge complete
          return
        }

        // For other aborted loads, check if it's a legitimate abort or a real error
        console.log('Provisional load aborted for URL:', event.validatedURL, 'Reason:', event.errorDescription)

        // Only treat as error if it's not a common abort scenario
        const isLegitimateAbort = event.errorDescription?.includes('aborted') ||
                                event.errorDescription?.includes('cancelled') ||
                                event.errorDescription?.includes('redirect')

        if (!isLegitimateAbort) {
          console.warn('Unexpected abort error:', event.errorDescription)
          updateTab(tab.id, { isLoading: false })
          setLoadingProgress(0)
        }
        return
      }

      console.log('Failed provisional load:', event.errorDescription, 'for URL:', event.validatedURL, 'errorCode:', event.errorCode)
    }

    const handlePageTitleUpdated = (event: any) => {
      updateTab(tab.id, { title: event.title })
    }

    const handlePageFaviconUpdated = (event: any) => {
      updateTab(tab.id, { favicon: event.favicons[0] })
    }

    // Handle new window requests from the webview
    const handleNewWindow = (event: any) => {
      event.preventDefault()
      
      const { addTab } = useBrowserStore.getState()
      
      // Open all new window requests in a new tab
      if (event.url) {
        addTab(event.url)
      }
    }
    
    // Handle console messages from the webview (only show errors and warnings)
    const handleConsoleMessage = (event: any) => {
      if (!isProduction && event.level >= 2) { // Only show warnings (2) and errors (3) in dev
        console.log(`[Webview ${tab.id}]:`, event.message)
      }
    }

    // Add event listeners
    webview.addEventListener('dom-ready', handleDomReady)
    webview.addEventListener('did-start-loading', handleDidStartLoading)
    webview.addEventListener('did-stop-loading', handleDidStopLoading)
    webview.addEventListener('did-finish-load', handleDidFinishLoad)
    webview.addEventListener('did-navigate', handleDidNavigate)
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
    webview.addEventListener('will-navigate', handleWillNavigate)
    webview.addEventListener('did-fail-load', handleDidFailLoad)
    webview.addEventListener('did-fail-provisional-load', handleDidFailProvisionalLoad)
    webview.addEventListener('page-title-updated', handlePageTitleUpdated)
    webview.addEventListener('page-favicon-updated', handlePageFaviconUpdated)
    webview.addEventListener('new-window', handleNewWindow)
    webview.addEventListener('console-message', handleConsoleMessage)

    // Memory management and cleanup
    const handleBeforeUnload = () => {
      // Clear any cached resources
      webview.executeJavaScript(`
        (function() {
          // Clear image cache for non-visible images
          const images = document.querySelectorAll('img');
          images.forEach(img => {
            if (img.complete && !img.src.includes('data:')) {
              const rect = img.getBoundingClientRect();
              if (rect.bottom < -1000 || rect.top > window.innerHeight + 1000) {
                img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
              }
            }
          });

          // Clear any event listeners that might cause memory leaks
          if (window.performanceObserver) {
            window.performanceObserver.disconnect();
          }
        })()
      `).catch(() => {})
    }

    // Add beforeunload event listener for cleanup
    webview.addEventListener('beforeunload', handleBeforeUnload)

    // Cleanup
    return () => {
      // Clear any pending loading timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }

      // Run cleanup before removing listeners
      handleBeforeUnload()

      webview.removeEventListener('dom-ready', handleDomReady)
      webview.removeEventListener('did-start-loading', handleDidStartLoading)
      webview.removeEventListener('did-stop-loading', handleDidStopLoading)
      webview.removeEventListener('did-finish-load', handleDidFinishLoad)
      webview.removeEventListener('did-navigate', handleDidNavigate)
      webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage)
      webview.removeEventListener('will-navigate', handleWillNavigate)
      webview.removeEventListener('did-fail-load', handleDidFailLoad)
      webview.removeEventListener('did-fail-provisional-load', handleDidFailProvisionalLoad)
      webview.removeEventListener('page-title-updated', handlePageTitleUpdated)
      webview.removeEventListener('page-favicon-updated', handlePageFaviconUpdated)
      webview.removeEventListener('new-window', handleNewWindow)
      webview.removeEventListener('console-message', handleConsoleMessage)
      webview.removeEventListener('beforeunload', handleBeforeUnload)

      // Force garbage collection hint
      if (webview && typeof webview.clearCache === 'function') {
        webview.clearCache()
      }
    }
  }, [tab?.id, updateTab])

  if (!tab) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 h-full">
        <div className="text-center">
          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl max-w-sm mx-auto shadow-xl border border-gray-100">
            <h2
              className="text-2xl font-semibold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
              id="welcome-title"
            >
              Welcome to NazareAI Browser
            </h2>
            <p
              className="text-gray-600 mb-6 text-sm leading-relaxed"
              id="welcome-description"
            >
              Your intelligent browsing companion with AI-powered features
            </p>
            <div
              className="inline-flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-lg text-gray-700 text-xs font-medium"
              role="note"
              aria-labelledby="welcome-title"
              aria-describedby="welcome-description"
            >
              <kbd
                className="px-2 py-1 bg-white rounded shadow-sm text-xs border border-gray-200"
                aria-label="Command key"
              >
                ⌘
              </kbd>
              <span aria-hidden="true">+</span>
              <kbd
                className="px-2 py-1 bg-white rounded shadow-sm text-xs border border-gray-200"
                aria-label="T key"
              >
                T
              </kbd>
              <span className="ml-1" aria-label="to create a new tab">to create a new tab</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'grid',
        gridTemplateRows: '1fr',
        gridTemplateColumns: '1fr'
      }}
    >
      
      {/* @ts-ignore */}
      <webview
        ref={webviewRef}
        src={tab.url}
        partition="persist:main"
        // @ts-ignore - webview attributes are strings in HTML
        allowpopups="true"
        // @ts-ignore
        plugins="true"
        // @ts-ignore
        nodeintegration="false"
        webpreferences="contextIsolation=true,javascript=true,webgl=true,accelerated2dCanvas=true,backgroundThrottling=false,experimentalFeatures=true,nativeWindowOpen=true,enableBlinkFeatures=CSSColorSchemeUARendering,offscreen=true"
        // @ts-ignore
        disablewebsecurity="false"
        // @ts-ignore
        autosize="on"
        // @ts-ignore
        preload="file://"
        style={{
          width: '100%',
          height: '100%',
          display: 'inline-flex'
        }}
      />

      {/* Enhanced Loading Progress Bar */}
      {(tab.isLoading || loadingProgress > 0) && (
        <div
          className="absolute top-0 left-0 w-full h-1 bg-gray-200 z-10 pointer-events-none"
          role="progressbar"
          aria-label="Page loading progress"
          aria-valuenow={loadingProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
            style={{
              width: `${Math.max(loadingProgress, 10)}%`,
              transform: loadingProgress === 100 ? 'scaleX(0)' : 'scaleX(1)',
              transformOrigin: 'left'
            }}
          />
        </div>
      )}

      {/* Cloudflare Challenge Indicator */}
      {isCloudflareChallenge && (
        <div
          className="absolute top-4 right-4 bg-orange-100 border border-orange-300 rounded-lg px-4 py-2 shadow-lg z-20 flex items-center gap-2"
          role="status"
          aria-live="polite"
          aria-label="Security challenge in progress"
        >
          <div
            className="animate-spin rounded-full h-4 w-4 border-2 border-orange-500 border-t-transparent"
            aria-hidden="true"
          ></div>
          <span className="text-sm text-orange-700 font-medium">Solving security challenge...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          className="absolute inset-0 bg-white flex items-center justify-center z-10"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-md mx-auto p-6 text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
              <div className="text-red-600 text-4xl mb-4" aria-hidden="true">⚠️</div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">{error.message}</h3>
              <p className="text-red-700 text-sm">{error.details}</p>
            </div>
            <button
              onClick={() => {
                setError(null)
                if (webviewRef.current) {
                  webviewRef.current.reload()
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              aria-label="Retry loading the page"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WebView 