# Workflow Logging Test Guide

## How to Test the Enhanced Logging

### 1. Open the Browser Console
- Open your browser's Developer Tools (F12 or Cmd+Option+I)
- Go to the Console tab
- Clear the console for a fresh start

### 2. Run the Test Query
In the AI chat, type:
```
find me the cheapest flight from Prague to Paris on September 1st, one way, one adult
```

### 3. What You'll See in the Console

#### Phase 1: Workflow Planning
```
╔═══════════════════════════════════════════════════════
║ 🚀 STARTING AGENTIC WORKFLOW
╠═══════════════════════════════════════════════════════
║ Goal: find me the cheapest flight...
║ Provider: openrouter
║ Model: openai/gpt-5-mini
║ Workflow Enabled: true
╚═══════════════════════════════════════════════════════
```

#### Phase 2: Workflow Creation
```
╔═══════════════════════════════════════════════════════
║ 📋 WORKFLOW PLAN CREATED
╠═══════════════════════════════════════════════════════
║ Total Steps: 10
╚═══════════════════════════════════════════════════════

Step 1: Navigate to Google Flights
  Action: navigate
  Target: https://www.google.com/flights
  Parameters: {}

Step 2: Wait for departure city input field to be available
  Action: waitForElement
  Target: departure city input
  Parameters: {selector: "input[placeholder*='Where']..."}

[... more steps ...]
```

#### Phase 3: Step Validation
```
🔍 Validating workflow steps...
✅ Step 1 VALID: Navigate to Google Flights
✅ Step 2 VALID: Wait for departure city input field
✅ Step 3 VALID: Click departure city input field
[... more validation ...]
```

#### Phase 4: Execution Plan
```
╔═══════════════════════════════════════════════════════
║ 🎯 WORKFLOW READY FOR EXECUTION
╠═══════════════════════════════════════════════════════
║ Workflow ID: abc123...
║ Total Steps: 10
║ Status: executing
╚═══════════════════════════════════════════════════════

📋 EXECUTION PLAN:
1. Navigate to Google Flights [navigate]
2. Wait for departure city input [waitForElement]
3. Click departure city input field [findAndClick]
4. Enter Prague as departure city [fillForm]
[... more steps ...]
```

#### Phase 5: Step-by-Step Execution
For each step, you'll see:

```
═══════════════════════════════════════════════════════
📍 WORKFLOW STEP 3/10
═══════════════════════════════════════════════════════
📋 Step Details: {
  number: 3,
  description: "Click departure city input field",
  action: "findAndClick",
  status: "pending",
  parameters: {...}
}
═══════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────
│ 🔧 EXECUTING ACTION: findAndClick
├─────────────────────────────────────────────────────
│ Action Parameters: {
│   "type": "findAndClick",
│   "elementDescription": "departure city input field"
│ }
└─────────────────────────────────────────────────────

🎬 About to execute browser action...
📦 Enhanced action: {...}
🏁 Browser action execution returned: {success: true, ...}

┌─────────────────────────────────────────────────────
│ ✅ STEP 3 COMPLETED SUCCESSFULLY
├─────────────────────────────────────────────────────
│ Result: Clicked element using text strategy
│ Data: {found: true, strategy: "text", ...}
└─────────────────────────────────────────────────────
```

#### Phase 6: Error Reporting (if any)
If a step fails, you'll see:

```
╔═══════════════════════════════════════════════════════
║ 💥 CRITICAL ERROR AT STEP 3
╠═══════════════════════════════════════════════════════
║ Step: Click departure city input field
║ Action: findAndClick
║ Error: [Error object]
║ Error Message: Could not find element matching: ...
║ Stack: [Stack trace]
╚═══════════════════════════════════════════════════════
```

## Key Information to Look For

1. **Which step number failed** - Now clearly shown
2. **What action was being executed** - Type and parameters
3. **Exact error message** - Full details
4. **Stack trace** - For debugging

## Common Failure Points

Based on the logs, you can identify:
- **Step 1-2**: Navigation issues
- **Step 3-4**: Element finding problems
- **Step 5-6**: Input field issues
- **Step 7-8**: Date selection problems
- **Step 9-10**: Search button issues

## How to Report Issues

When reporting, include:
1. The step number that failed
2. The action type
3. The error message from the console
4. Any relevant browser errors

Example:
```
"Failed at Step 3 - findAndClick action
Error: Could not find element matching: departure city input field"
```
