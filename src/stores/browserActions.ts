import { BrowserAction, BrowserActionResult } from './browserStore'
import { useHistoryStore } from './historyStore'
import { useAIStore } from './aiStore'

// Action handlers for better code organization
export const createBrowserActions = (get: any) => ({
  // Navigation actions
  handleNavigate: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.url) throw new Error('URL required for navigation')
    return await get().navigateToUrl(action.url, false)
  },

  handleNewTab: async (action: BrowserAction): Promise<BrowserActionResult> => {
    return await get().navigateToUrl(action.url || 'about:blank', true)
  },

  handleCloseTab: async (action: BrowserAction): Promise<BrowserActionResult> => {
    const tabToClose = action.tabId || get().currentTab?.id
    if (!tabToClose) throw new Error('No tab to close')
    get().closeTab(tabToClose)
    return { success: true, message: 'Tab closed successfully' }
  },

  handleSwitchTab: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.tabId) throw new Error('Tab ID required')
    get().switchTab(action.tabId)
    return { success: true, message: 'Switched to tab successfully' }
  },

  // Browser control actions
  handleGoBack: async (): Promise<BrowserActionResult> => {
    return await get().executePageScript('history.back()')
  },

  handleGoForward: async (): Promise<BrowserActionResult> => {
    return await get().executePageScript('history.forward()')
  },

  handleReload: async (): Promise<BrowserActionResult> => {
    return await get().executePageScript('location.reload()')
  },

  handleSearch: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.query) throw new Error('Search query required')
    return await get().searchWeb(action.query, action.tabId ? false : true)
  },

  // Content extraction actions
  handleExtractContent: async (action: BrowserAction): Promise<BrowserActionResult> => {
    return await get().extractPageData(action.selector as any)
  },

  handleScrollPage: async (action: BrowserAction): Promise<BrowserActionResult> => {
    return await get().scrollPage(
      action.scrollDirection || 'down',
      action.amount
    )
  },

  // Form and interaction actions
  handleClickElement: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.selector) throw new Error('Element selector required')
    return await get().executePageScript(`
      const searchTerm = '${action.selector.toLowerCase().replace(/'/g, "\\'")}';

      // First try as a CSS selector
      let element = document.querySelector('${action.selector.replace(/'/g, "\\'")}');

      // If not found, search by text content
      if (!element) {
        // Search for clickable elements containing the text
        const clickableElements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"], [role="button"], [onclick]'));

        // Find best match
        element = clickableElements.find(el => {
          const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase().trim();
          return text === searchTerm || text.includes(searchTerm);
        });
      }

      if (element) {
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Wait a bit for scroll
        await new Promise(resolve => setTimeout(resolve, 300));
        // Click
        element.click();
        'Element clicked successfully';
      } else {
        throw new Error('Element not found: ${action.selector}');
      }
    `)
  },

  handleFillForm: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.formData) throw new Error('Form data required')
    const formScript = Object.entries(action.formData)
      .map(([selector, value]) => `
        const field = document.querySelector('${selector}');
        if (field) field.value = '${value.replace(/'/g, "\\'")}';
      `).join('\n')
    return await get().executePageScript(formScript + '; "Form filled successfully";')
  },

  // Advanced AI actions
  handleWaitForElement: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.elementDescription) throw new Error('Element description required')
    return await get().findOnPage(action.elementDescription)
  },

  handleFindAndClick: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.elementDescription) throw new Error('Element description required')
    return await get().executePageScript(`
      const searchTerm = '${action.elementDescription.toLowerCase().replace(/'/g, "\\'")}';
      console.log('[AI Click] Universal DOM search for:', searchTerm);

      // Function to check if element is actually clickable/interactive
      function isInteractive(element) {
        // Check if element has click handlers
        const hasClickHandler = element.onclick !== null ||
                              element.hasAttribute('onclick') ||
                              element.matches('[role="button"], [role="link"], [role="tab"], [role="menuitem"]');

        // Check if it's a naturally interactive element
        const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'VIDEO', 'AUDIO'];
        const isInteractiveTag = interactiveTags.includes(element.tagName);

        // Check if element has pointer cursor
        const computedStyle = window.getComputedStyle(element);
        const hasPointerCursor = computedStyle.cursor === 'pointer';

        // Check if element is focusable
        const isFocusable = element.tabIndex >= 0;

        return hasClickHandler || isInteractiveTag || hasPointerCursor || isFocusable;
      }

      // Get all clickable elements
      const allElements = Array.from(document.querySelectorAll('*')).filter(isInteractive);
      console.log('[AI Click] Found', allElements.length, 'interactive elements');

      // Score each element based on text matching
      const scoredElements = allElements.map(element => {
        const elementTexts = [
          element.textContent?.trim() || '',
          element.getAttribute('aria-label') || '',
          element.getAttribute('title') || '',
          element.getAttribute('placeholder') || ''
        ].filter(text => text);

        let maxScore = 0;
        let matchedText = '';

        // Check each text source
        for (const text of elementTexts) {
          if (!text) continue;

          let score = 0;

          // Exact match
          if (text.toLowerCase() === searchTerm) {
            score = 100;
          }
          // Contains search term
          else if (text.toLowerCase().includes(searchTerm)) {
            score = 80 + (searchTerm.length / text.length) * 20;
          }
          // Fuzzy word matching
          else {
            const searchWords = searchTerm.split(/\\s+/).filter(w => w.length > 1);
            const textWords = text.toLowerCase().split(/\\s+/);

            // Count matching words
            let matchedWords = 0;
            for (const searchWord of searchWords) {
              if (textWords.some(textWord => textWord.includes(searchWord))) {
                matchedWords++;
              }
            }

            if (matchedWords > 0) {
              score = 40 + (matchedWords / searchWords.length) * 40;
            }
          }

          if (score > maxScore) {
            maxScore = score;
            matchedText = text;
          }
        }

        // Bonus points for certain factors
        const rect = element.getBoundingClientRect();

        // Prefer elements near the center of viewport
        const centerY = rect.top + rect.height / 2;
        const viewportCenterY = window.innerHeight / 2;
        const distanceFromCenter = Math.abs(centerY - viewportCenterY);
        const centerBonus = Math.max(0, 10 - (distanceFromCenter / window.innerHeight) * 10);

        // Prefer larger clickable areas
        const area = rect.width * rect.height;
        const areaBonus = Math.min(5, area / 10000);

        const finalScore = maxScore + centerBonus + areaBonus;

        return {
          element,
          score: finalScore,
          matchedText,
          rect
        };
      }).filter(item => item.score > 30)
        .sort((a, b) => b.score - a.score);

      console.log('[AI Click] Top matches:', scoredElements.slice(0, 3));

      if (scoredElements.length > 0) {
        const bestMatch = scoredElements[0];
        const element = bestMatch.element;

        console.log('[AI Click] Best match found with score:', bestMatch.score);

        // Ensure element is in viewport
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function() {
          // Focus and click logic
          if (typeof element.focus === 'function') element.focus();
          // Try clicks
          element.click();
        }, 500);

        const elementDesc = element.tagName +
          (bestMatch.matchedText ? ': "' + bestMatch.matchedText.substring(0, 50) + '"' : '');

        return 'Clicked ' + elementDesc + ' (confidence: ' + bestMatch.score.toFixed(0) + '%)';
      } else {
        console.log('[AI Click] No matching elements found');

        // Provide helpful feedback about what was found
        const sampleTexts = allElements.slice(0, 10)
          .map(el => el.textContent?.trim() || el.getAttribute('aria-label') || '')
          .filter(t => t && t.length > 0)
          .map(t => '"' + t.substring(0, 30) + '"');

        throw new Error(
          'Could not find element matching: "' + searchTerm + '"\\n' +
          'Available clickable elements include: ' + sampleTexts.join(', ') + '...'
        );
      }
    `)
  },

  // Utility functions
  handleScreenshot: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.text) throw new Error('Text description required')
    return await get().extractPageData('images')
  },

  handleAnalyzeContent: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.analysisType) throw new Error('Analysis type required')
    return await get().extractPageData(action.analysisType === 'structure' ? 'structured' : action.analysisType)
  },

  handleSmartFillForm: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.elementDescription) throw new Error('Element description required')
    return await get().executeBrowserAction({
      type: 'smartFillForm',
      elementDescription: action.elementDescription
    })
  },

  handleExtractTable: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.text) throw new Error('Text description required')
    return await get().extractPageData('tables')
  },

  handleWaitAndExtract: async (action: BrowserAction): Promise<BrowserActionResult> => {
    if (!action.waitCondition) throw new Error('Wait condition required')
    return await get().executeBrowserAction({
      type: 'waitAndExtract',
      waitCondition: action.waitCondition
    })
  }
})
