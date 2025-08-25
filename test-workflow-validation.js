// Test for workflow parameter validation logic

function testParameterValidation() {
  console.log('🧪 Testing workflow parameter validation...\n')

  // Simulate the validateStepParameters function logic
  function validateStepParameters(step) {
    const requiredParams = {
      'navigate': ['target'],
      'search': ['query'],
      'findAndClick': ['elementDescription'],
      'inputText': ['text', 'selector'],
      'scrollPage': [],
      'extractContent': [],
      'newTab': [],
      'closeTab': [],
      'switchTab': ['tabId'],
      'goBack': [],
      'goForward': [],
      'reload': [],
      'clickElement': ['selector'],
      'fillForm': ['formData', 'selector'],
      'waitForElement': ['selector'],
      'screenshot': [],
      'analyzeContent': [],
      'smartFillForm': [],
      'extractTable': [],
      'waitAndExtract': []
    }

    const actionType = step.action
    const params = step.parameters || {}
    const target = step.target

    // Check if action type is supported
    if (!requiredParams[actionType]) {
      console.error(`Unsupported action type: ${actionType}`)
      return false
    }

    // Check required parameters
    const required = requiredParams[actionType]
    for (const param of required) {
      if (param === 'target' && !target) {
        console.error(`Missing required target for ${actionType}`)
        return false
      }
      if (param !== 'target' && !params[param]) {
        console.error(`Missing required parameter '${param}' for ${actionType}`)
        return false
      }
    }

    // Special validation for URLs
    if (actionType === 'navigate' && target) {
      if (!target.startsWith('http://') && !target.startsWith('https://')) {
        console.error(`Invalid URL format: ${target}`)
        return false
      }
    }

    return true
  }

  // Test cases
  const testCases = [
    {
      step: {
        action: 'navigate',
        target: 'https://www.google.com/flights',
        description: 'Navigate to Google Flights',
        parameters: {},
        expectedResult: 'Page loads successfully'
      },
      expected: true,
      description: 'Valid navigation with URL'
    },
    {
      step: {
        action: 'navigate',
        target: 'invalid-url',
        description: 'Navigate to invalid URL',
        parameters: {},
        expectedResult: 'Page loads successfully'
      },
      expected: false,
      description: 'Invalid navigation URL format'
    },
    {
      step: {
        action: 'search',
        target: 'flights',
        description: 'Search for flights',
        parameters: { query: 'cheap flights to Paris' },
        expectedResult: 'Search results appear'
      },
      expected: true,
      description: 'Valid search with query'
    },
    {
      step: {
        action: 'search',
        target: 'flights',
        description: 'Search without query',
        parameters: {},
        expectedResult: 'Search results appear'
      },
      expected: false,
      description: 'Search missing query parameter'
    },
    {
      step: {
        action: 'findAndClick',
        target: 'departure field',
        description: 'Click departure field',
        parameters: { elementDescription: 'departure city input field' },
        expectedResult: 'Field activated'
      },
      expected: true,
      description: 'Valid findAndClick with elementDescription'
    },
    {
      step: {
        action: 'inputText',
        target: 'departure',
        description: 'Enter departure city',
        parameters: {
          text: 'New York',
          selector: 'input[name="departure"]'
        },
        expectedResult: 'City entered'
      },
      expected: true,
      description: 'Valid inputText with text and selector'
    },
    {
      step: {
        action: 'inputText',
        target: 'departure',
        description: 'Enter without text',
        parameters: { selector: 'input[name="departure"]' },
        expectedResult: 'City entered'
      },
      expected: false,
      description: 'inputText missing text parameter'
    },
    {
      step: {
        action: 'scrollPage',
        target: 'down',
        description: 'Scroll down',
        parameters: { scrollDirection: 'down' },
        expectedResult: 'Page scrolled'
      },
      expected: true,
      description: 'Valid scrollPage (no required params)'
    }
  ]

  let passed = 0
  let total = testCases.length

  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test ${index + 1}: ${testCase.description} ---`)
    console.log(`Step: ${JSON.stringify(testCase.step, null, 2)}`)
    console.log(`Expected: ${testCase.expected}`)

    const result = validateStepParameters(testCase.step)
    console.log(`Result: ${result}`)

    if (result === testCase.expected) {
      passed++
      console.log('✅ PASSED')
    } else {
      console.log('❌ FAILED')
    }
  })

  console.log(`\n🎯 Parameter Validation Test Results: ${passed}/${total} passed`)

  // Test workflow filtering
  console.log('\n🔄 Testing workflow step filtering...')

  const mixedWorkflow = [
    {
      action: 'navigate',
      target: 'https://www.google.com/flights',
      description: 'Valid navigation',
      parameters: {},
      expectedResult: 'Page loads'
    },
    {
      action: 'search',
      target: 'flights',
      description: 'Invalid search - missing query',
      parameters: {},
      expectedResult: 'Search results'
    },
    {
      action: 'findAndClick',
      target: 'button',
      description: 'Valid click',
      parameters: { elementDescription: 'search button' },
      expectedResult: 'Button clicked'
    },
    {
      action: 'inputText',
      target: 'field',
      description: 'Invalid input - missing text',
      parameters: { selector: 'input' },
      expectedResult: 'Text entered'
    }
  ]

  const validSteps = mixedWorkflow.filter(validateStepParameters)
  console.log(`Original steps: ${mixedWorkflow.length}`)
  console.log(`Valid steps: ${validSteps.length}`)
  console.log(`Filtered out: ${mixedWorkflow.length - validSteps.length} invalid steps`)

  if (validSteps.length === 2) {
    console.log('✅ Workflow filtering test PASSED')
  } else {
    console.log('❌ Workflow filtering test FAILED')
  }

  return passed === total && validSteps.length === 2
}

// Run the test
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testParameterValidation }
} else {
  testParameterValidation()
}
