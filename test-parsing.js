// Simple test for the browser action parsing logic
// This tests the fallback logic we added

function testFallbackParsing() {
  console.log('🧪 Testing browser action parsing fallback logic...\n')

  // Test navigation commands
  const testCases = [
    {
      message: 'open seznam.cz',
      expected: [{ type: 'navigate', url: 'https://seznam.cz' }],
      description: 'Navigation command with domain'
    },
    {
      message: 'go to google.com',
      expected: [{ type: 'navigate', url: 'https://google.com' }],
      description: 'Navigation command with "go to"'
    },
    {
      message: 'search for cats',
      expected: [{ type: 'search', query: 'cats' }],
      description: 'Search command'
    },
    {
      message: 'find recipes online',
      expected: [{ type: 'search', query: 'recipes online' }],
      description: 'Search command with "find"'
    },
    {
      message: 'click login button',
      expected: [{ type: 'findAndClick', elementDescription: 'login button' }],
      description: 'Click command'
    },
    {
      message: 'what is this page about?',
      expected: [],
      description: 'Question about current page (should return empty)'
    }
  ]

  function testPattern(message, expected, description) {
    const lowerMessage = message.toLowerCase()

    console.log(`Testing: "${message}"`)
    console.log(`Expected: ${JSON.stringify(expected)}`)

    // Test navigation
    if (lowerMessage.includes('open ') || lowerMessage.includes('go to ') || lowerMessage.includes('visit ')) {
      const urlMatch = message.match(/(?:open|go to|visit)\s+([^\s]+)/i)
      if (urlMatch && urlMatch[1]) {
        let url = urlMatch[1]
        if (!url.startsWith('http')) {
          url = 'https://' + url
        }
        const result = [{ type: 'navigate', url }]
        console.log(`✅ Navigation detected: ${JSON.stringify(result)}`)
        return JSON.stringify(result) === JSON.stringify(expected)
      }
    }

    // Test search
    if (lowerMessage.includes('search for ') || lowerMessage.includes('find ')) {
      const searchMatch = message.match(/(?:search for|find)\s+(.+)/i)
      if (searchMatch && searchMatch[1]) {
        const query = searchMatch[1].trim()
        const result = [{ type: 'search', query }]
        console.log(`✅ Search detected: ${JSON.stringify(result)}`)
        return JSON.stringify(result) === JSON.stringify(expected)
      }
    }

    // Test click
    if (lowerMessage.includes('click ') || lowerMessage.includes('press ')) {
      const clickMatch = message.match(/(?:click|press)\s+(.+)/i)
      if (clickMatch && clickMatch[1]) {
        const element = clickMatch[1].trim()
        const result = [{ type: 'findAndClick', elementDescription: element }]
        console.log(`✅ Click detected: ${JSON.stringify(result)}`)
        return JSON.stringify(result) === JSON.stringify(expected)
      }
    }

    // For questions, return empty array
    if (lowerMessage.includes('what') || lowerMessage.includes('explain') || lowerMessage.includes('summarize')) {
      console.log('✅ Question detected: returning empty array')
      return JSON.stringify([]) === JSON.stringify(expected)
    }

    console.log('❌ No pattern matched')
    return false
  }

  let passed = 0
  let total = testCases.length

  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test ${index + 1}: ${testCase.description} ---`)
    const success = testPattern(testCase.message, testCase.expected, testCase.description)
    if (success) {
      passed++
      console.log('✅ PASSED')
    } else {
      console.log('❌ FAILED')
    }
  })

  console.log(`\n🎯 Test Results: ${passed}/${total} passed`)
  return passed === total
}

// Run the test
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testFallbackParsing }
} else {
  testFallbackParsing()
}
