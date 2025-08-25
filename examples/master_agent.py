from typing import Dict, List, Any, Optional, Union, Set, Callable
import logging
import os
import sys
import json
from pathlib import Path
import importlib
import time
import re
import copy
import gc
import nest_asyncio
import asyncio
from typing import AsyncIterator

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from .module_interface import ModuleInterface
from .task_manager import TaskManager, TaskStatus
from ..integrations.manager import IntegrationManager
from .message_resolver import MessageReferenceResolver

# Configure logging to show only INFO and above
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)

# Import tiktoken for token counting
try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False
    logging.warning("tiktoken not available. Token counting will use approximation.")

class MasterAgent:
    def __init__(
        self,
        llm: BaseChatModel,
        modules_dir: Optional[str] = None,
        config_path: Optional[str] = None,
        progress_callback: Optional[callable] = None,
        enable_conversation_history: bool = True,  # New option to disable for speed
        max_conversation_tokens: int = 10000  # Reduced default for better performance
    ):
        """
        Initialize the Master Agent.
        
        Args:
            llm: Language model to use for task planning
            modules_dir: Directory containing module implementations
            config_path: Path to configuration file
            progress_callback: Optional callback function for progress updates
            enable_conversation_history: Whether to include conversation history in queries
            max_conversation_tokens: Maximum tokens to use for conversation history
        """
        self.llm = llm
        self.modules: Dict[str, ModuleInterface] = {}
        self.modules_dir = Path(modules_dir) if modules_dir else Path(__file__).parent.parent / "modules"
        self.progress_callback = progress_callback
        self.enable_conversation_history = enable_conversation_history
        self.max_conversation_tokens = max_conversation_tokens
        logger.info(f"Using modules directory: {self.modules_dir}")
        
        self.config = self._load_config(config_path) if config_path else {}
        
        # Initialize integration manager
        self.integration_manager = IntegrationManager()
        
        # Initialize task manager
        self.task_manager = TaskManager()
        
        # Initialize message reference resolver
        self.message_resolver = MessageReferenceResolver(llm)
        
        # Token count cache to avoid re-counting
        self._token_cache = {}
        self._token_cache_size = 1000
        
        # Load all modules
        self._load_modules()
        
        # Log loaded modules
        if self.modules:
            logger.info("Loaded modules:")
            for name, module in self.modules.items():
                caps = module.get_capabilities()
                logger.info(f"  - {name}: {caps['description']}")
        else:
            logger.warning("No modules were loaded!")
        
        # Initialize system prompt
        self.system_prompt = self._create_system_prompt()
        
        # Initialize step counter
        self.step_count = 0
        
        # Register command handler with integration manager
        self.integration_manager.register_command_handler(self.process_query)
    
    async def initialize(self) -> None:
        """Initialize the master agent and its integrations."""
        # Load integrations
        await self.integration_manager.load_integrations()
        
        # Log loaded integrations
        integrations = self.integration_manager.list_integrations()
        if integrations:
            logger.info("Loaded integrations:")
            for integration in integrations:
                logger.info(f"  - {integration['name']} v{integration['version']}: {integration['description']}")
        else:
            logger.warning("No integrations were loaded!")
        
        # Set up callbacks for modules that need them (like scheduling_agent)
        for module_name, module in self.modules.items():
            if module_name == "scheduling_agent" and hasattr(module, 'set_master_callback'):
                # Create a stable reference to the method
                # This binds self.process_query to 'self', creating a bound method
                # that will properly maintain the 'self' reference
                bound_callback = self.process_query
                logger.info(f"Setting callback for {module_name}: ID={id(bound_callback)}, Type={type(bound_callback).__name__}")
                
                # Provide the process_query callback to the scheduler
                logger.info(f"Providing process_query callback to {module_name}")
                # Pass the bound method directly
                callback_success = module.set_master_callback(bound_callback)
                if callback_success:
                    logger.info(f"Successfully registered callback with {module_name}")
                else:
                    logger.error(f"Failed to register callback with {module_name}")
            # Support other modules that might have this interface
            elif hasattr(module, 'set_master_callback'):
                # Provide the process_query callback to the module
                logger.info(f"Providing process_query callback to {module_name}")
                module.set_master_callback(self.process_query)
    
    async def cleanup(self) -> None:
        """Cleanup resources."""
        await self.integration_manager.cleanup()
    
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration from file."""
        with open(config_path) as f:
            return json.load(f)
    
    def _load_modules(self) -> None:
        """Dynamically load all modules from the modules directory."""
        if not self.modules_dir.exists():
            logger.warning(f"Modules directory {self.modules_dir} does not exist")
            return
            
        logger.info(f"Scanning for modules in: {self.modules_dir}")
        module_paths = list(self.modules_dir.glob("*/module.py"))
        logger.info(f"Found {len(module_paths)} potential modules")
        
        for module_path in module_paths:
            try:
                # Skip example_agent
                module_name = module_path.parent.name
                if module_name == "example_agent":
                    logger.info(f"Skipping example_agent module")
                    continue
                    
                logger.info(f"Attempting to load module: {module_name} from {module_path}")
                
                spec = importlib.util.spec_from_file_location(
                    module_name, str(module_path)
                )
                if spec is None or spec.loader is None:
                    logger.error(f"Failed to create module spec for {module_path}")
                    continue
                    
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                # Initialize module class
                if hasattr(module, 'Module'):
                    module_instance = module.Module()
                    self.modules[module_name] = module_instance
                    logger.info(f"Successfully loaded module: {module_name}")
                else:
                    logger.error(f"Module {module_name} does not have a Module class")
            except Exception as e:
                logger.error(f"Failed to load module {module_path}: {str(e)}")
    
    def _create_system_prompt(self) -> str:
        """Create system prompt including all module capabilities."""
        # Get module capabilities
        module_capabilities = []
        for name, module in self.modules.items():
            cap = module.get_capabilities()
            module_capabilities.append(f"\n{name}:\n" + 
                             f"Description: {cap['description']}\n" +
                             f"Capabilities: {', '.join(cap['capabilities'])}\n" +
                             f"Example queries: {', '.join(cap['example_queries'])}")
        
        # Get integration capabilities
        integration_capabilities = []
        for integration in self.integration_manager.list_integrations():
            integration_capabilities.append(f"\n{integration['name']} v{integration['version']}:\n" +
                                         f"Description: {integration['description']}")
        
        # Add message reference documentation
        message_reference_docs = """
IMPORTANT - PREVIOUS MESSAGE REFERENCES:
The system supports referencing previous messages in queries, such as:
1. "Take the previous message and send it to example@email.com"
2. "Use your last response to create a blog post"
3. "Summarize what you just told me"

When these references are detected, the content is automatically stored in the context with these patterns:
- [previous_message data] - Generic reference to previous message content
- [author_agent data] - For content that resembles articles or reports
- [browser_agent data] - For content from web searches
- [deepresearch_agent data] - For research content

When you see these placeholder patterns, especially in email-related tasks, DO NOT ASK THE USER for the content - it is ALREADY available in the context. These are valid module communication patterns that should be passed directly to the modules.

For example, if the query resolves to:
"send_email: to=user@example.com, subject=Test, body=[previous_message data]"

This indicates the email body should use content from a previous message, which is already stored in context. DO NOT treat this as missing information.
"""
        
        prompt = f"""You are a master agent that coordinates multiple specialized modules and integrations to complete tasks.

Available modules and their capabilities:
{''.join(module_capabilities)}

Available integrations:
{''.join(integration_capabilities)}
{message_reference_docs}
Your job is to:
1. Analyze the user's query
2. Break it down into sequential steps
3. For each step, identify the appropriate module or integration
4. Pass queries to modules/integrations in the correct order
5. Let each component's output inform the next step
6. Provide a clear response to the user

MODULE SELECTION GUIDELINES:
- Base module selection on the CURRENT QUERY CONTENT, not just conversation history
- Be careful not to assume the current query is related to previous messages unless explicitly connected
- For example: "nazareai" (likely a company/project) is different from "$NAZARE" (a token) - don't confuse them
- Only use specialized modules when the query contains specific relevant terms:
  * solana_agent: ONLY when query mentions Solana addresses, program IDs, or specific blockchain operations
  * github_agent: ONLY when query mentions GitHub repos, issues, or pull requests
  * scheduling_agent: ONLY when query involves calendar/scheduling operations
- For general research queries about companies/projects/topics, use:
  * deepresearch_agent: For comprehensive research
  * browser_agent: For quick web searches
  * generic_agent: For general questions
- When in doubt, prefer general-purpose modules over specialized ones

CRITICAL RULES FOR CONVERSATIONAL QUERIES:
- For simple conversational queries (greetings, how are you, thanks, etc.), ALWAYS use generic_agent
- NEVER leave module_calls empty - you MUST always use at least one module to generate a response
- If you're unsure which module to use, default to generic_agent

IMPORTANT RULES:
1. Break complex tasks into clear sequential steps
2. Each step should build on the results of previous steps
3. Keep queries simple and focused for each step
4. For document operations, preserve exact file names and paths
5. For URLs, pass them exactly as provided
6. Trust modules and integrations to handle their specific formats
7. When a module returns information that needs to be used by another module:
   - Extract the specific information from the previous module's response
   - Use that exact information in the query for the next module
   - DO NOT use generic placeholders like "[extracted_data]"
   - ALWAYS use specific placeholders that identify the source, like "[author_agent data]" or "[browser_agent results]"
   - For content from author_agent being sent via email, use "[author_agent data]" as the body parameter
   - For multiple items (like company names), create separate module calls for each
8. For visualization commands:
   - If the query contains words like "visualize", "plot", "graph", "chart", use the visualize operation
   - Do not analyze data before visualization unless specifically requested
   - Pass the visualization command directly to the data_agent
9. For browser_agent tasks:
   - If multiple steps involve browsing (like "find X and then find Y"), combine them into a single query
   - Use "and then" or similar sequential indicators in the query to let browser_agent handle the sequence
   - Only split browser tasks if they require input from other modules in between steps
10. For sequential operations within the same module:
    - Combine related steps into a single module call when possible
    - Use natural language to indicate sequence (e.g., "first... then...")
    - Only split into separate module calls if intermediate processing by other modules is required
11. For podcast-related tasks:
    - ALWAYS use podcast_agent for ALL podcast-related queries, including podcast scripts, show notes, episode planning, etc.
    - NEVER use author_agent for podcast-related content, even if the task involves content generation
    - Podcast-related keywords include: podcast, episode, script, show notes, interview questions, transcribe
12. For email sending operations:
    - When sending emails that include content generated by another module (like author_agent), ALWAYS use a placeholder that references the specific module
    - Use the format "[module_name data]" as the body parameter (e.g., "body=[author_agent data]")
    - NEVER use generic placeholders like "[Insert content here]" or static text in place of dynamic content
    - When you see patterns like "[previous_message data]" in email tasks, DO NOT request the content from the user - this is a valid reference to content already in the context

IMPORTANT: You must ALWAYS respond with a valid JSON object. Do not include any text outside the JSON structure.
The JSON response must strictly follow this format:
{{
    "thought_process": "Your reasoning about how to handle the query",
    "plan": ["Step 1", "Step 2", ...],
    "module_calls": [
        {{
            "module": "module_name",
            "query": "specific query for this module",
            "reason": "why you're using this module"
        }},
        {{
            "integration": "integration_name",
            "command": "specific command for this integration",
            "reason": "why you're using this integration"
        }}
    ]
}}

CRITICAL: The module_calls array MUST NOT be empty. You must always use at least one module.

Example of handling simple conversational query:
{{
    "thought_process": "User is greeting me, I'll use generic_agent to provide a friendly response",
    "plan": [
        "Respond to the user's greeting"
    ],
    "module_calls": [
        {{
            "module": "generic_agent",
            "query": "how are you?",
            "reason": "To provide a conversational response to the user's greeting"
        }}
    ]
}}

Example of sequential processing with data passing:
{{
    "thought_process": "Need to find company info from a document and then search for details",
    "plan": [
        "Extract company names from the document",
        "Search for details about each company"
    ],
    "module_calls": [
        {{
            "module": "documents_agent",
            "query": "What companies are mentioned in report.pdf?",
            "reason": "To extract company names from the document"
        }},
        {{
            "module": "browser_agent",
            "query": "Find contact details for WHG International Limited",
            "reason": "To search for details about the first company"
        }},
        {{
            "module": "browser_agent",
            "query": "Find contact details for BloomReach B.V.",
            "reason": "To search for details about the second company"
        }}
    ]
}}

Example of visualization command:
{{
    "thought_process": "User wants to visualize data from a CSV file",
    "plan": [
        "Create visualizations from the data file"
    ],
    "module_calls": [
        {{
            "module": "data_agent",
            "query": "visualize data.csv",
            "reason": "To create visualizations from the data"
        }}
    ]
}}

Example of blog post writing and email sending:
{{
    "thought_process": "User wants to create a blog post about AI and send it via email",
    "plan": [
        "Write a blog post about AI",
        "Send the blog post via email"
    ],
    "module_calls": [
        {{
            "module": "author_agent",
            "query": "Write a blog post about artificial intelligence trends",
            "reason": "To create a blog post about AI"
        }},
        {{
            "module": "communication_agent",
            "query": "send_email: to=user@example.com, subject=Blog Post About AI, body=[author_agent data]",
            "reason": "To send the blog post via email"
        }}
    ]
}}

Example of podcast-related task:
{{
    "thought_process": "User wants to create a podcast script",
    "plan": [
        "Generate a podcast script on the requested topic"
    ],
    "module_calls": [
        {{
            "module": "podcast_agent",
            "query": "Generate a podcast script about artificial intelligence",
            "reason": "To create a podcast script on AI"
        }}
    ]
}}

Example of handling message references:
{{
    "thought_process": "User wants to send previous message content via email",
    "plan": [
        "Send the content from the previous message via email"
    ],
    "module_calls": [
        {{
            "module": "communication_agent",
            "query": "send_email: to=user@example.com, subject=Info You Requested, body=[previous_message data]",
            "reason": "To send the previous message content via email"
        }}
    ]
}}"""
        
        logger.info("Created system prompt with the following components:")
        for name in self.modules:
            logger.info(f"  - Module: {name}")
        for integration in self.integration_manager.list_integrations():
            logger.info(f"  - Integration: {integration['name']}")
        
        return prompt
    
    async def _send_progress(self, message: Dict[str, Any]):
        """Send progress update via callback if available."""
        if self.progress_callback:
            try:
                await self.progress_callback(message)
            except Exception as cb_err:
                # Swallow progress-delivery errors so they don't abort the main task (e.g. websocket closed)
                logger.warning(f"Progress callback failure suppressed: {cb_err}")
    
    def _module_supports_streaming(self, module_name: str) -> bool:
        """Check if a module supports streaming responses."""
        module = self.modules.get(module_name)
        if not module:
            return False
        
        # Check if module has supports_streaming method
        if hasattr(module, 'supports_streaming'):
            return module.supports_streaming()
        
        # Check if module has stream_process method
        return hasattr(module, 'stream_process')
    
    async def _execute_module_streaming(
        self, 
        module_name: str, 
        query: str, 
        context: Dict[str, Any],
        stream_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Execute a module with streaming support."""
        module = self.modules.get(module_name)
        if not module:
            logger.error(f"Module {module_name} not found")
            return {
                "status": "error",
                "message": f"Module {module_name} not found"
            }
        
        # Check if module supports streaming
        if not hasattr(module, 'stream_process'):
            logger.warning(f"Module {module_name} does not support streaming, falling back to normal process")
            return await self._execute_module_call({"module": module_name, "query": query}, context)
        
        try:
            logger.info(f"🔄 Executing {module_name} with streaming support")
            
            # Collect all streamed content
            full_content = ""
            final_result = None
            
            async for chunk in module.stream_process(query, context):
                if chunk["type"] == "stream_chunk":
                    full_content += chunk.get("content", "")
                    
                    # Send streaming update via callback
                    if stream_callback:
                        await stream_callback({
                            "type": "stream",
                            "module": module_name,
                            "content": chunk.get("content", ""),
                            "metadata": chunk.get("metadata", {})
                        })
                
                elif chunk["type"] == "stream_complete":
                    # Final result with metadata
                    final_result = chunk
                    full_content = chunk.get("content", full_content)
                    
                elif chunk["type"] == "stream_error":
                    logger.error(f"Streaming error from {module_name}: {chunk.get('content', 'Unknown error')}")
                    return {
                        "status": "error",
                        "message": chunk.get("content", "Streaming error occurred"),
                        "module": module_name
                    }
            
            # Construct the final result in the expected format
            if final_result:
                # Use metadata from stream_complete if available
                metadata = final_result.get("metadata", {})
                
                result = {
                    "status": "success",
                    "message": f"Content generated successfully via streaming",
                    "module": module_name,
                    "data": {
                        "content": full_content,
                        "answer": full_content,  # For compatibility
                        "streamed": True,
                        **metadata  # Include any additional metadata from the module
                    }
                }
            else:
                # Fallback if no stream_complete was sent
                result = {
                    "status": "success",
                    "message": "Content generated successfully via streaming",
                    "module": module_name,
                    "data": {
                        "content": full_content,
                        "answer": full_content,
                        "streamed": True
                    }
                }
            
            return result
            
        except Exception as e:
            logger.error(f"Error during streaming execution of {module_name}: {str(e)}", exc_info=True)
            return {
                "status": "error",
                "message": f"Streaming error: {str(e)}",
                "module": module_name
            }
    
    async def process_query(self, query: str, context: Optional[Dict[str, Any]] = None, is_background: bool = False) -> Dict[str, Any]:
        """Process a user query by planning and executing module/integration calls."""
        # Validate inputs to prevent NoneType errors
        if query is None:
            logger.error("Query is None in process_query call")
            return {
                "status": "error", 
                "message": "Invalid query format",
                "data": {"error": "Query cannot be None"}
            }
            
        if not isinstance(query, str):
            logger.error(f"Query is not a string: {type(query)}")
            try:
                # Attempt to convert to string
                query = str(query)
                logger.warning(f"Converted non-string query to string: {query}")
            except:
                return {
                    "status": "error", 
                    "message": "Invalid query format",
                    "data": {"error": f"Query must be string, got {type(query)}"}
                }
            
        logger.info(f"🚀 Processing query: {query}")
        self.step_count += 1
        logger.info(f"📍 Step {self.step_count}")
        
        # Initialize shared context
        shared_context = context.copy() if context else {}
        
        # Add progress callback to context
        shared_context["progress_callback"] = self.progress_callback
        
        # ALWAYS add process_query_callback to context to ensure it's available to modules like scheduling_agent
        # Pass a direct reference to our own process_query method
        if "process_query_callback" not in shared_context:
            logger.info("Adding process_query_callback to shared context")
            shared_context["process_query_callback"] = self.process_query
        
        # Extract user_id from context if available
        user_id = shared_context.get("user_id", "default_user")
        
        # Set user file context for modules that need file access
        if user_id and user_id != "default_user":
            try:
                from master_agent.common import set_user_file_context
                set_user_file_context(user_id)
                logger.info(f"Set user file context for modules: {user_id}")
            except Exception as e:
                logger.warning(f"Failed to set user file context: {str(e)}")
        
        # Generate a message ID for this query
        message_id = f"msg_{int(time.time())}"
        
        # Store the original query in message history
        self.message_resolver.store_message(
            user_id=user_id,
            message_id=message_id,
            content=query,
            message_type="user"
        )
        
        # Quick check if we need to resolve message references (for performance)
        # Only call the resolver if there are potential reference patterns
        reference_indicators = [
            "previous", "last", "earlier", "before", "just said", "just told",
            "response", "answer", "result", "that", "send it", "send this",
            "use it", "use what", "[", "]"  # Placeholders
        ]
        
        needs_reference_resolution = any(indicator in query.lower() for indicator in reference_indicators)
        
        # Try to resolve any references to previous messages
        if needs_reference_resolution:
            try:
                resolved_query, was_modified, referenced_context = await self.message_resolver.resolve_message_references(query, user_id)
                
                if was_modified:
                    logger.info(f"Resolved message references: '{query}' -> '{resolved_query}'")
                    query = resolved_query
                    
                    # Update the message in history with the resolved reference
                    self.message_resolver.store_message(
                        user_id=user_id,
                        message_id=message_id,
                        content=query,
                        message_type="user",
                        references={
                            "original_query": query,
                            "was_resolved": True
                        }
                    )
                    
                    # Store referenced content in shared context if provided
                    if referenced_context:
                        logger.info(f"Adding referenced content to context: {referenced_context.keys()}")
                        referenced_content = referenced_context.get("referenced_content", "")
                        source_module = referenced_context.get("source_module", "previous_message_agent")
                        
                        # If this is module communication, we need to match the exact structure the modules expect
                        # Look at how communication_agent's _extract_from_specific_agent works
                        
                        # First, ensure the source module exists in context
                        if source_module not in shared_context:
                            # Initialize with standard result structure that modules expect
                            shared_context[source_module] = {
                                "status": "success", 
                                "message": "Content from previous message",
                                "data": {
                                    "answer": referenced_content,
                                    "content": referenced_content
                                }
                            }
                        elif isinstance(shared_context[source_module], dict):
                            # If it exists but doesn't have data field, add it
                            if "data" not in shared_context[source_module]:
                                shared_context[source_module]["data"] = {}
                            
                            # Add content to the standard locations that modules check
                            shared_context[source_module]["data"]["answer"] = referenced_content
                            shared_context[source_module]["data"]["content"] = referenced_content
                            
                            # Also add content to top level for modules that check there
                            shared_context[source_module]["answer"] = referenced_content
                            shared_context[source_module]["content"] = referenced_content
                        else:
                            # If it exists but isn't a dict, convert it to a dict with proper structure
                            original_value = shared_context[source_module]
                            shared_context[source_module] = {
                                "status": "success",
                                "message": "Content from previous message",
                                "data": {
                                    "answer": referenced_content,
                                    "content": referenced_content,
                                    "original": original_value
                                },
                                "answer": referenced_content,
                                "content": referenced_content
                            }
                        
                        # Special handling for author_agent 
                        if source_module == "author_agent" or "author" in source_module:
                            if isinstance(shared_context[source_module], dict):
                                shared_context[source_module]["data"]["blog_post"] = referenced_content
                                shared_context[source_module]["data"]["article"] = referenced_content
                                shared_context[source_module]["blog_post"] = referenced_content
                                
                        # Special handling for browser_agent
                        if source_module == "browser_agent" or "browser" in source_module:
                            if isinstance(shared_context[source_module], dict):
                                shared_context[source_module]["data"]["search_results"] = referenced_content
                                shared_context[source_module]["data"]["result"] = referenced_content
                                shared_context[source_module]["search_results"] = referenced_content
                                
                        # Special handling for deepresearch_agent
                        if source_module == "deepresearch_agent" or "research" in source_module:
                            if isinstance(shared_context[source_module], dict):
                                shared_context[source_module]["data"]["research"] = referenced_content
                                shared_context[source_module]["data"]["summary"] = referenced_content
                                shared_context[source_module]["research"] = referenced_content
                                
                        # Also add to latest_result as many modules check there
                        shared_context["latest_result"] = {
                            "answer": referenced_content,
                            "content": referenced_content
                        }
                        
                        # Fallback mechanism - add directly to context
                        # This covers direct context reference extraction that some modules do
                        shared_context["referenced_content"] = referenced_content
                        shared_context["content"] = referenced_content
                        shared_context["answer"] = referenced_content
                        
                        # Log what we're done
                        logger.info(f"Added referenced content to context with source module: {source_module}")
                        logger.info(f"Using placeholder pattern found in query: {referenced_context.get('placeholder', 'none')}")
            except Exception as e:
                logger.warning(f"Error resolving message references: {str(e)}")
        
        # Send initial planning state
        await self._send_progress({
            "type": "progress",
            "status": "planning",
            "message": "Planning task execution..."
        })
        
        # Build conversation messages including history
        messages = [SystemMessage(content=self.system_prompt)]
        
        # Add conversation history if available and enabled
        conversation_history = shared_context.get("conversation_history", []) if self.enable_conversation_history else []
        if conversation_history:
            # Use smart truncation to handle long conversations
            truncated_history = self._prepare_conversation_context(
                conversation_history, 
                query,
                max_tokens=self.max_conversation_tokens  # Use configured max tokens
            )
            
            logger.info(f"Including {len(truncated_history)} messages from conversation history (truncated from {len(conversation_history)})")
            
            for msg in truncated_history:
                if msg.get("role") == "user":
                    messages.append(HumanMessage(content=msg.get("content", "")))
                elif msg.get("role") == "assistant":
                    messages.append(AIMessage(content=msg.get("content", "")))
        else:
            if not self.enable_conversation_history:
                logger.info("Conversation history disabled for performance")
            else:
                logger.info("No conversation history available")
        
        # Add the current query
        messages.append(HumanMessage(content=query))
        
        # Add a final system reminder about JSON format when we have conversation history
        if conversation_history:
            messages.append(SystemMessage(content="""
CRITICAL REMINDER: 

1. WHEN REFERENCING PREVIOUS MESSAGES:
   - If the user says "send the email" or "send this email", look for the most recent email-like content in the conversation history
   - Email content typically contains "Subject:" or starts with greetings like "Hi", "Dear", etc.
   - Use the EXACT content from the conversation history - DO NOT generate new content
   - If a message has been edited (check for "edited": true flag), use the edited version
   - Include the FULL content in your module_calls query parameter

2. You MUST respond with a valid JSON object following this exact format:
{
    "thought_process": "Your reasoning about how to handle the query",
    "plan": ["Step 1", "Step 2", ...],
    "module_calls": [
        {
            "module": "module_name",
            "query": "specific query for this module (include FULL content when sending emails)",
            "reason": "why you're using this module"
        }
    ]
}

3. For email sending specifically:
   - Extract the COMPLETE email content from conversation history
   - Format: "send_email: to=recipient@email.com, subject=Subject Line, body=FULL EMAIL CONTENT HERE"
   - DO NOT use placeholders like [previous content] - include the actual content

DO NOT provide conversational responses. ONLY return the JSON object."""))
        
        logger.info("🤔 Planning task execution...")
        try:
            # --- Robust retry logic for transient LLM connection issues ---
            response = None
            max_llm_retries = 2  # first attempt + one retry after refresh
            for attempt in range(max_llm_retries):
                try:
                    response = await self.llm.ainvoke(messages)
                    break  # success, exit retry loop
                except Exception as llm_err:
                    # Detect connection-related errors (httpx / OpenAI)
                    if any(term in str(llm_err).lower() for term in ["connection", "timeout", "connecterror", "pooltimeout"]):
                        logger.warning(f"LLM connection error on attempt {attempt+1}/{max_llm_retries}: {llm_err}")

                        # Attempt to refresh the ChatOpenAI client once
                        try:
                            from master_agent.core.llm_registry import refresh_llm
                            model_name = getattr(self.llm, "model", "gpt-4o") or getattr(self.llm, "model_name", "gpt-4o")
                            temperature = getattr(self.llm, "temperature", 0)

                            self.llm = await refresh_llm(model=model_name, temperature=temperature)
                            if hasattr(self, "message_resolver"):
                                self.message_resolver.llm = self.llm
                            logger.info("Shared ChatOpenAI instance refreshed after connection error")
                        except Exception as refresh_err:
                            logger.error(f"Failed to refresh shared ChatOpenAI instance: {refresh_err}")

                        # Brief back-off before retrying
                        await asyncio.sleep(1.5)
                        continue  # retry
                    # For non-connection related errors, propagate immediately
                    raise

            if response is None:
                # All retries failed – escalate to outer handler
                raise Exception("Connection error: all retries to LLM failed")

            # -----------------------------------------------------------------
            response_content = response.content.strip()
            
            # Try to extract JSON if response contains other text
            if not response_content.startswith("{"):
                import re
                json_match = re.search(r'({.*})', response_content, re.DOTALL)
                if json_match:
                    response_content = json_match.group(1)
                else:
                    raise ValueError("Could not find JSON in LLM response")
            
            plan = json.loads(response_content)
            
            # CRITICAL FIX: Ensure we always have at least one module call
            if "module_calls" not in plan or not plan["module_calls"]:
                logger.warning("No module_calls provided by LLM, defaulting to generic_agent")
                # Check if generic_agent is available
                if "generic_agent" not in self.modules:
                    logger.error("generic_agent not found in loaded modules!")
                    logger.error(f"Available modules: {list(self.modules.keys())}")
                    # Try to use any available module as fallback
                    fallback_module = list(self.modules.keys())[0] if self.modules else None
                    if fallback_module:
                        logger.warning(f"Using {fallback_module} as fallback")
                        plan["module_calls"] = [{
                            "module": fallback_module,
                            "query": query,
                            "reason": f"generic_agent not available, using {fallback_module} as fallback"
                        }]
                    else:
                        # No modules available at all
                        return {
                            "status": "error",
                            "message": "No modules available to process the query",
                            "data": {
                                "thought_process": plan.get("thought_process", ""),
                                "plan": plan.get("plan", []),
                                "error": "No modules loaded"
                            }
                        }
                else:
                    # Default to generic_agent for conversational response
                    plan["module_calls"] = [{
                        "module": "generic_agent",
                        "query": query,
                        "reason": "No specific module was selected, using generic_agent for conversational response"
                    }]
                # Update the plan to reflect this
                if not plan.get("plan"):
                    plan["plan"] = ["Provide a conversational response"]
            
            # Send plan update
            await self._send_progress({
                "type": "progress",
                "status": "plan_ready",
                "plan": plan["plan"],
                "thought_process": plan["thought_process"]
            })
            
            logger.info("📋 Task breakdown:")
            for i, step in enumerate(plan["plan"], 1):
                logger.info(f"  {i}. {step}")
                print(f"\n🔍 Step {i}/{len(plan['plan'])}: {step}")
            
            # Execute plan
            results = []
            for i, call in enumerate(plan["module_calls"], 1):
                if "module" in call:
                    # Send module start update
                    await self._send_progress({
                        "type": "progress",
                        "status": "module_start",
                        "step": i,
                        "total_steps": len(plan["module_calls"]),
                        "module": call["module"],
                        "message": call["reason"]
                    })
                    
                    # Handle module call
                    module_name = call["module"]
                    print(f"\n→ Step {i}/{len(plan['module_calls'])}: Using {module_name}")
                    print(f"  Reason: {call['reason']}")
                    
                    logger.info(f"🔄 Executing module {i}/{len(plan['module_calls'])}: {module_name}")
                    
                    if module_name not in self.modules:
                        error_msg = f"Module {module_name} not found"
                        logger.error(f"❌ {error_msg}")
                        print(f"  ❌ Error: {error_msg}")
                        results.append({
                            "status": "error",
                            "message": error_msg,
                            "data": None
                        })
                        continue
                    
                    module = self.modules[module_name]
                    logger.info(f"📤 Sending query to {module_name}")
                    print(f"  📤 Sending query: {call['query']}")
                    
                    try:
                        # Check if module supports streaming and we have a streaming callback
                        if (self._module_supports_streaming(module_name) and 
                            shared_context.get("enable_streaming", False) and
                            self.progress_callback):
                            
                            logger.info(f"🔄 Using streaming for {module_name}")
                            
                            # Create a streaming callback that sends progress updates
                            async def stream_callback(chunk):
                                await self._send_progress({
                                    "type": "stream",
                                    "module": module_name,
                                    "content": chunk.get("content", ""),
                                    "metadata": chunk.get("metadata", {})
                                })
                            
                            # Execute with streaming
                            result = await self._execute_module_streaming(
                                module_name,
                                call["query"],
                                shared_context,
                                stream_callback
                            )
                            
                            # Send stream completion
                            if result.get("status") == "success" and result.get("data", {}).get("streamed", False):
                                await self._send_progress({
                                    "type": "stream_complete",
                                    "module": module_name,
                                    "content": result.get("data", {}).get("content", ""),
                                    "metadata": result.get("data", {})
                                })
                        
                        # Check if it's browser_agent and has process_async
                        elif module_name == "browser_agent" and hasattr(module, "process_async"):
                            # Use the async version for browser agent
                            result = await module.process_async(call["query"], shared_context)
                        else:
                            # Run synchronous module.process() in a thread pool to avoid blocking
                            # This prevents blocking the event loop when modules do heavy computation
                            # or have internal async operations
                            
                            # Create a wrapper function that sets user context in the executor thread
                            def module_wrapper(query, context):
                                # Set user file context in this thread
                                user_id = context.get("user_id") if context else None
                                if user_id and user_id != "default_user":
                                    try:
                                        from master_agent.common import set_user_file_context
                                        set_user_file_context(user_id)
                                        logger.info(f"Set user file context in executor thread: {user_id}")
                                    except Exception as e:
                                        logger.warning(f"Failed to set user file context in executor: {str(e)}")
                                
                                # Call the actual module
                                return module.process(query, context)
                            
                            loop = asyncio.get_event_loop()
                            result = await loop.run_in_executor(
                                None,  # Use default thread pool executor
                                module_wrapper,
                                call["query"],
                                shared_context
                            )
                        
                        logger.info(f"📥 Received response from {module_name}")
                        
                        # Update shared context with module's results
                        if result["status"] == "success" and "data" in result:
                            # Store module-specific results in context
                            shared_context[module_name] = result["data"]
                            # Also store the latest result for easy access
                            shared_context["latest_result"] = result["data"]
                            
                            print(f"  ✅ Success: {result['message']}")
                            if "answer" in result["data"]:
                                print(f"  📋 {result['data']['answer']}")
                                
                                # Store the module response in the message history
                                response_id = f"resp_{int(time.time())}"
                                self.message_resolver.store_message(
                                    user_id=user_id,
                                    message_id=response_id,
                                    content=result["data"]["answer"],
                                    message_type="agent"
                                )
                            elif "demo_result" in result["data"]:
                                print(f"  📋 {result['data']['demo_result']}")
                                
                                # Store the module response in the message history
                                response_id = f"resp_{int(time.time())}"
                                self.message_resolver.store_message(
                                    user_id=user_id,
                                    message_id=response_id,
                                    content=result["data"]["demo_result"],
                                    message_type="agent"
                                )
                        else:
                            print(f"  ❌ Error: {result['message']}")
                        
                        # Store the result
                        results.append(result)
                        
                        # Handle errors with recovery attempts
                        if result["status"] == "error":
                            error_handled = await self._handle_module_error(
                                module_name, 
                                result, 
                                call, 
                                shared_context,
                                user_id
                            )
                            
                            # If error was handled with a recovery, update the result
                            if error_handled and error_handled["status"] == "success":
                                results[-1] = error_handled  # Replace the error result
                                print(f"  ✅ Recovered: {error_handled['message']}")
                        
                        # Send module completion update
                        await self._send_progress({
                            "type": "progress",
                            "status": "module_complete",
                            "step": i,
                            "total_steps": len(plan["module_calls"]),
                            "module": call["module"],
                            "result": result
                        })
                    except Exception as e:
                        error_msg = f"Error in {module_name}: {str(e)}"
                        logger.error(f"❌ {error_msg}")
                        print(f"  ❌ Error: {error_msg}")
                        results.append({
                            "status": "error",
                            "message": error_msg,
                            "data": None
                        })
                
                elif "integration" in call:
                    # Send integration start update
                    await self._send_progress({
                        "type": "progress",
                        "status": "integration_start",
                        "step": i,
                        "total_steps": len(plan["module_calls"]),
                        "integration": call["integration"],
                        "message": call["reason"]
                    })
                    
                    # Handle integration call
                    integration_name = call["integration"]
                    print(f"\n→ Step {i}/{len(plan['module_calls'])}: Using {integration_name} integration")
                    print(f"  Reason: {call['reason']}")
                    
                    logger.info(f"🔄 Executing integration {i}/{len(plan['module_calls'])}: {integration_name}")
                    
                    try:
                        result = await self.integration_manager.process_command(
                            integration_name,
                            call["command"],
                            shared_context
                        )
                        logger.info(f"📥 Received response from {integration_name}")
                        
                        # Update shared context with integration's results
                        if result["status"] == "success" and "data" in result:
                            shared_context[integration_name] = result["data"]
                            shared_context["latest_result"] = result["data"]
                            
                            print(f"  ✅ Success: {result['message']}")
                            
                            # Store the integration response in the message history if it has answer data
                            if "data" in result and "answer" in result["data"]:
                                response_id = f"resp_{int(time.time())}"
                                self.message_resolver.store_message(
                                    user_id=user_id,
                                    message_id=response_id,
                                    content=result["data"]["answer"],
                                    message_type="agent"
                                )
                        else:
                            print(f"  ❌ Error: {result['message']}")
                        
                        # Store the result
                        results.append(result)
                        
                        # Handle errors with recovery attempts
                        if result["status"] == "error":
                            error_handled = await self._handle_module_error(
                                integration_name, 
                                result, 
                                call, 
                                shared_context,
                                user_id
                            )
                            
                            # If error was handled with a recovery, update the result
                            if error_handled and error_handled["status"] == "success":
                                results[-1] = error_handled  # Replace the error result
                                print(f"  ✅ Recovered: {error_handled['message']}")
                        
                        # Send integration completion update
                        await self._send_progress({
                            "type": "progress",
                            "status": "integration_complete",
                            "step": i,
                            "total_steps": len(plan["module_calls"]),
                            "integration": call["integration"],
                            "result": result
                        })
                    except Exception as e:
                        error_msg = f"Error in {integration_name}: {str(e)}"
                        logger.error(f"❌ {error_msg}")
                        print(f"  ❌ Error: {error_msg}")
                        results.append({
                            "status": "error",
                            "message": error_msg,
                            "data": None
                        })
                
                # Add a visual separator between steps
                print("  " + "-" * 50)
            
            logger.info("✅ Query processing complete")
            print("\n✅ All steps completed!")
            
            # Clean up the shared context to prevent circular references
            clean_context = {}
            for key, data in shared_context.items():
                if key == "latest_result":
                    continue
                clean_context[key] = data
            
            # Prepare the final response
            final_response = {
                "status": "success",
                "message": "Completed processing query",
                "data": {
                    "thought_process": plan["thought_process"],
                    "plan": plan["plan"],
                    "results": results,
                    "final_context": clean_context
                }
            }
            
            # Store the final combined result as an agent message
            final_response_id = f"resp_final_{int(time.time())}"
            
            # Extract the most relevant content from the results
            final_answer = ""
            for result in results:
                if result.get("status") == "success" and "data" in result:
                    if "answer" in result["data"]:
                        final_answer += result["data"]["answer"] + "\n\n"
                    elif "demo_result" in result["data"]:
                        final_answer += result["data"]["demo_result"] + "\n\n"
            
            if final_answer:
                self.message_resolver.store_message(
                    user_id=user_id,
                    message_id=final_response_id,
                    content=final_answer.strip(),
                    message_type="agent"
                )
            
            return final_response
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse LLM response as JSON: {str(e)}")
            logger.error(f"Raw response: {response.content}")
            
            # When conversation history causes non-JSON responses, handle it gracefully
            if conversation_history and "I" in response.content[:50]:  # Likely a conversational response
                logger.warning("LLM provided conversational response instead of JSON. Attempting direct response.")
                
                # Create a direct response without using modules
                return {
                    "status": "success",
                    "message": "Direct response",
                    "data": {
                        "thought_process": "Direct conversational response",
                        "plan": ["Provide direct answer"],
                        "results": [{
                            "status": "success",
                            "message": "Direct response",
                            "data": {
                                "answer": response.content,
                                "module": "direct_response"
                            }
                        }],
                        "final_context": {}
                    }
                }
            
            return {
                "status": "error",
                "message": f"Failed to parse LLM response as JSON: {str(e)}",
                "data": None
            }
        except Exception as e:
            logger.error(f"❌ Error during planning: {str(e)}")
            return {
                "status": "error",
                "message": f"Error during planning: {str(e)}",
                "data": None
            }
    
    def list_modules(self) -> List[Dict[str, Any]]:
        """Return list of available modules and their capabilities."""
        components = []
        
        # Add modules
        for name, module in self.modules.items():
            components.append({
                "type": "module",
                "name": name,
                "capabilities": module.get_capabilities()
            })
        
        # Add integrations
        for integration in self.integration_manager.list_integrations():
            components.append({
                "type": "integration",
                "name": integration["name"],
                "capabilities": {
                    "description": integration["description"],
                    "version": integration["version"]
                }
            })
        
        return components 

    def _estimate_tokens(self, text: str, model: str = "gpt-4o") -> int:
        """Estimate token count for a given text with caching."""
        # Check cache first
        cache_key = hash(text[:100])  # Use first 100 chars for cache key
        if cache_key in self._token_cache:
            # Verify text length is similar (within 10%)
            cached_len, cached_tokens = self._token_cache[cache_key]
            if abs(len(text) - cached_len) / cached_len < 0.1:
                # Adjust token count proportionally
                return int(cached_tokens * len(text) / cached_len)
        
        # Calculate tokens
        if TIKTOKEN_AVAILABLE:
            try:
                # Use tiktoken for accurate counting
                # For gpt-4o, we need to use the cl100k_base encoding
                if "gpt-4o" in model:
                    encoding = tiktoken.get_encoding("cl100k_base")
                else:
                    encoding = tiktoken.encoding_for_model(model)
                token_count = len(encoding.encode(text))
                
                # Cache the result
                self._token_cache[cache_key] = (len(text), token_count)
                
                # Limit cache size
                if len(self._token_cache) > self._token_cache_size:
                    # Remove oldest entries (simple FIFO)
                    for _ in range(len(self._token_cache) // 2):
                        self._token_cache.pop(next(iter(self._token_cache)))
                
                return token_count
            except Exception as e:
                logger.warning(f"Error using tiktoken: {e}. Falling back to approximation.")
        
        # Fallback: rough approximation (1 token ≈ 4 characters)
        token_count = len(text) // 4
        self._token_cache[cache_key] = (len(text), token_count)
        return token_count
    
    def _prepare_conversation_context(self, conversation_history: List[Dict], current_query: str, max_tokens: int = 4000) -> List[Dict]:
        """
        Prepare conversation history with token limits in mind.
        
        Args:
            conversation_history: List of previous messages
            current_query: The current user query
            max_tokens: Maximum tokens to allocate for conversation history
        
        Returns:
            Truncated conversation history that fits within token limits
        """
        if not conversation_history:
            return []
        
        # Estimate tokens for system prompt and current query
        system_prompt_tokens = self._estimate_tokens(self.system_prompt)
        current_query_tokens = self._estimate_tokens(current_query)
        
        # Reserve tokens for response and safety margin
        reserved_tokens = system_prompt_tokens + current_query_tokens + 2000  # 2000 for response
        available_tokens = max_tokens - reserved_tokens
        
        if available_tokens <= 0:
            logger.warning("No tokens available for conversation history after system prompt and query")
            return []
        
        # Extract keywords from current query for relevance scoring
        query_keywords = set(current_query.lower().split())
        # Remove common words
        common_words = {"the", "a", "an", "is", "are", "was", "were", "be", "been", "being", 
                       "have", "has", "had", "do", "does", "did", "will", "would", "could", 
                       "should", "may", "might", "must", "can", "to", "of", "in", "for", 
                       "on", "at", "from", "up", "about", "into", "through", "during", 
                       "before", "after", "above", "below", "between", "under", "again", 
                       "further", "then", "once", "here", "there", "when", "where", "why", 
                       "how", "all", "both", "each", "few", "more", "most", "other", "some", 
                       "such", "no", "nor", "not", "only", "own", "same", "so", "than", 
                       "too", "very", "and", "but", "if", "or", "because", "as", "until", 
                       "while", "with", "by", "it", "its", "itself", "they", "them", "their", 
                       "what", "which", "who", "whom", "this", "that", "these", "those", 
                       "i", "you", "he", "she", "we", "me", "him", "her", "us", "my", 
                       "your", "his", "her", "our", "mine", "yours", "ours"}
        query_keywords = query_keywords - common_words
        
        # Score messages by relevance and recency
        scored_messages = []
        for i, msg in enumerate(conversation_history):
            msg_content = msg.get("content", "").lower()
            msg_keywords = set(msg_content.split()) - common_words
            
            # Calculate relevance score (0-1)
            if query_keywords:
                relevance = len(query_keywords & msg_keywords) / len(query_keywords)
            else:
                relevance = 0
            
            # Calculate recency score (0-1)
            recency = (i + 1) / len(conversation_history)
            
            # Combined score (weighted: 70% recency, 30% relevance)
            score = (0.7 * recency) + (0.3 * relevance)
            
            scored_messages.append({
                "message": msg,
                "score": score,
                "index": i,
                "tokens": self._estimate_tokens(msg_content)
            })
        
        # Sort by score (highest first)
        scored_messages.sort(key=lambda x: x["score"], reverse=True)
        
        # Select messages that fit within token limit
        selected_messages = []
        current_tokens = 0
        
        # Always try to include the last 2 messages for context continuity
        last_messages = conversation_history[-2:] if len(conversation_history) >= 2 else conversation_history[:]
        for msg in last_messages:
            msg_tokens = self._estimate_tokens(msg.get("content", ""))
            if current_tokens + msg_tokens <= available_tokens:
                selected_messages.append(msg)
                current_tokens += msg_tokens
        
        # Add more relevant messages if there's room
        for scored_msg in scored_messages:
            if scored_msg["message"] in selected_messages:
                continue
                
            if current_tokens + scored_msg["tokens"] > available_tokens:
                # Try to truncate very long messages
                if scored_msg["tokens"] > 500 and len(selected_messages) < 3:
                    # Truncate to fit
                    content = scored_msg["message"].get("content", "")
                    truncated_content = content[:1000] + "... [truncated]"
                    msg_copy = scored_msg["message"].copy()
                    msg_copy["content"] = truncated_content
                    truncated_tokens = self._estimate_tokens(truncated_content)
                    
                    if current_tokens + truncated_tokens <= available_tokens:
                        selected_messages.append(msg_copy)
                        current_tokens += truncated_tokens
                continue
            
            selected_messages.append(scored_msg["message"])
            current_tokens += scored_msg["tokens"]
        
        # Sort selected messages back to chronological order
        selected_messages.sort(key=lambda msg: conversation_history.index(msg) if msg in conversation_history else -1)
        
        # Log token usage
        logger.info(f"Conversation context: {len(selected_messages)} messages, ~{current_tokens} tokens")
        logger.info(f"Total estimated tokens: ~{reserved_tokens + current_tokens}")
        
        return selected_messages

    async def _handle_module_error(
        self, 
        module_name: str, 
        error_result: Dict[str, Any], 
        original_call: Dict[str, Any],
        context: Dict[str, Any],
        user_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Handle module errors with intelligent recovery attempts.
        
        Args:
            module_name: Name of the module that failed
            error_result: The error result from the module
            original_call: The original module call that failed
            context: Shared context
            user_id: User ID
            
        Returns:
            Optional recovery result if successful, None otherwise
        """
        error_message = error_result.get("message", "").lower()
        
        # Handle communication_agent email errors
        if module_name == "communication_agent" and "invalid `to` field" in error_message:
            # Extract the problematic email address
            import re
            email_match = re.search(r'to=([^,\s]+)', original_call.get("query", ""))
            problematic_email = email_match.group(1) if email_match else "the email address"
            
            # Provide helpful guidance
            guidance_message = f"""I notice the email address ({problematic_email}) was rejected by the system. 

For security reasons, our email system only allows sending to pre-approved email addresses. You can:

1. Use a test email address (e.g., test@wavehq.ai)
2. Send to your own registered email address
3. Contact support to add approved recipients

Would you like me to help you update the email with a valid recipient address?"""
            
            # Send a helpful message to the user
            await self._send_progress({
                "type": "progress",
                "status": "error_guidance",
                "module": module_name,
                "message": guidance_message
            })
            
            # Return a modified result that includes the guidance
            return {
                "status": "error",
                "message": "Email address validation failed",
                "data": {
                    "answer": guidance_message,
                    "error_type": "email_validation",
                    "suggestions": [
                        "Use test@wavehq.ai for testing",
                        "Update the recipient to your registered email",
                        "Contact support to add approved domains"
                    ]
                },
                "module": module_name
            }
        
        # Handle missing API key errors
        elif "api key" in error_message or "authentication" in error_message:
            guidance_message = f"""It looks like {module_name} is missing required authentication credentials.

This might be because:
1. API keys haven't been configured for this module
2. Your account doesn't have access to this feature
3. The service is temporarily unavailable

You can try:
- Using a different module for this task
- Checking your account settings
- Contacting support if this feature should be available"""
            
            await self._send_progress({
                "type": "progress",
                "status": "error_guidance",
                "module": module_name,
                "message": guidance_message
            })
            
            return {
                "status": "error",
                "message": "Authentication required",
                "data": {
                    "answer": guidance_message,
                    "error_type": "authentication",
                    "module": module_name
                },
                "module": module_name
            }
        
        # Handle rate limit errors
        elif "rate limit" in error_message or "too many requests" in error_message:
            # Attempt retry with backoff
            logger.info(f"Rate limit hit for {module_name}, attempting retry after delay")
            await asyncio.sleep(2)  # Wait 2 seconds
            
            # Retry the module call
            try:
                module = self.modules.get(module_name)
                if module:
                    # Retry with the same query and context
                    retry_result = module.process(original_call["query"], context)
                    if retry_result["status"] == "success":
                        logger.info(f"Successfully recovered from rate limit for {module_name}")
                        return retry_result
            except Exception as e:
                logger.error(f"Retry failed for {module_name}: {e}")
            
            # If retry failed, provide guidance
            guidance_message = f"""The service is currently rate-limited. This usually happens when:
- Too many requests have been made in a short time
- The service is experiencing high load

Please wait a moment and try again, or I can help you with an alternative approach."""
            
            return {
                "status": "error",
                "message": "Service temporarily unavailable",
                "data": {
                    "answer": guidance_message,
                    "error_type": "rate_limit",
                    "module": module_name
                },
                "module": module_name
            }
        
        # Handle file not found errors
        elif "file not found" in error_message or "no such file" in error_message:
            # Try to extract filename
            file_match = re.search(r'["\']([^"\']+\.[a-zA-Z]+)["\']', error_result.get("message", ""))
            filename = file_match.group(1) if file_match else "the requested file"
            
            guidance_message = f"""I couldn't find {filename}. This might be because:
- The file hasn't been uploaded yet
- The filename was misspelled
- The file was moved or deleted

You can:
1. Upload the file using the file upload feature
2. Check the filename and try again
3. Use the file browser to see available files"""
            
            return {
                "status": "error",
                "message": "File not found",
                "data": {
                    "answer": guidance_message,
                    "error_type": "file_not_found",
                    "filename": filename,
                    "module": module_name
                },
                "module": module_name
            }
        
        # Handle generic module not available errors
        elif "not available" in error_message or "not implemented" in error_message:
            # Try to suggest alternative modules
            alternative_modules = self._suggest_alternative_modules(module_name, original_call["query"])
            
            suggestions = "\n".join([f"- {alt['name']}: {alt['reason']}" for alt in alternative_modules])
            
            guidance_message = f"""The {module_name} module encountered an issue. 

Here are some alternatives that might help:
{suggestions}

Would you like me to try one of these alternatives?"""
            
            # If we have alternatives, automatically try the first one
            if alternative_modules:
                first_alternative = alternative_modules[0]
                logger.info(f"Automatically trying alternative module: {first_alternative['name']}")
                
                try:
                    alt_module = self.modules.get(first_alternative['name'])
                    if alt_module:
                        alt_result = alt_module.process(original_call["query"], context)
                        if alt_result["status"] == "success":
                            alt_result["message"] = f"Used {first_alternative['name']} as alternative"
                            return alt_result
                except Exception as e:
                    logger.error(f"Alternative module {first_alternative['name']} also failed: {e}")
            
            return {
                "status": "error", 
                "message": "Module unavailable",
                "data": {
                    "answer": guidance_message,
                    "error_type": "module_unavailable",
                    "alternatives": alternative_modules,
                    "module": module_name
                },
                "module": module_name
            }
        
        # Handle solana_agent specific errors
        elif module_name == "solana_agent" and ("no valid solana program id" in error_message or "invalid contract address" in error_message):
            # Automatically fallback to research modules for general queries
            logger.info(f"Solana agent failed - falling back to research modules for: {original_call.get('query', '')}")
            
            # Try deepresearch_agent first
            if "deepresearch_agent" in self.modules:
                try:
                    research_module = self.modules["deepresearch_agent"]
                    # Run in executor if synchronous
                    loop = asyncio.get_event_loop()
                    research_result = await loop.run_in_executor(None, research_module.process, original_call["query"], context)
                    if research_result["status"] == "success":
                        logger.info("Successfully recovered using deepresearch_agent")
                        research_result["message"] = "Used deepresearch_agent for general research"
                        return research_result
                except Exception as e:
                    logger.error(f"Deepresearch fallback failed: {e}")
            
            # Try browser_agent as second fallback
            if "browser_agent" in self.modules:
                try:
                    browser_module = self.modules["browser_agent"]
                    browser_result = await browser_module.process_async(original_call["query"], context) if hasattr(browser_module, "process_async") else browser_module.process(original_call["query"], context)
                    if browser_result["status"] == "success":
                        logger.info("Successfully recovered using browser_agent")
                        browser_result["message"] = "Used browser_agent for web search"
                        return browser_result
                except Exception as e:
                    logger.error(f"Browser fallback failed: {e}")
            
            # Final fallback to generic_agent
            if "generic_agent" in self.modules:
                try:
                    generic_module = self.modules["generic_agent"]
                    # Run in executor if synchronous
                    loop = asyncio.get_event_loop()
                    generic_result = await loop.run_in_executor(None, generic_module.process, original_call["query"], context)
                    if generic_result["status"] == "success":
                        logger.info("Successfully recovered using generic_agent")
                        generic_result["message"] = "Used generic_agent for general assistance"
                        return generic_result
                except Exception as e:
                    logger.error(f"Generic fallback failed: {e}")
            
            # If all fallbacks fail, provide helpful message
            return {
                "status": "success",  # Mark as success to provide response
                "message": "Handled query with fallback",
                "data": {
                    "answer": f"I'll help you find information about {original_call.get('query', 'your query')}. While I couldn't access blockchain-specific data, I can provide general information.\n\nBased on your query, it seems you're looking for information about a project or service. Could you provide more context about what specifically you'd like to know? For example:\n- Company information\n- Product features\n- Website details\n- General research\n\nThis will help me provide more accurate information.",
                    "module": "fallback_handler"
                },
                "module": module_name
            }
        
        # For all other errors, check if the module provided a user-friendly message
        else:
            logger.warning(f"Module error for {module_name}: {error_message}")
            
            # Check if the error result already contains a user-friendly answer
            error_data = error_result.get("data", {})
            if error_data and isinstance(error_data, dict):
                # If the module provided an answer/guidance, use it
                existing_answer = error_data.get("answer") or error_data.get("guidance") or error_data.get("user_message")
                if existing_answer:
                    # Module provided user-friendly message, send it
                    await self._send_progress({
                        "type": "progress",
                        "status": "error",
                        "module": module_name,
                        "message": existing_answer
                    })
                    
                    return error_result  # Return the module's error as-is
            
            # If no user-friendly message provided, generate one
            try:
                # Try to make the error message more user-friendly
                error_analysis_prompt = f"""Convert this technical error into a helpful user message:
Module: {module_name}
Error: {error_result.get('message', 'Unknown error')}
Original request: {original_call.get('query', '')}

Provide a brief, friendly explanation and suggest what the user can do to fix it.
Keep it concise and actionable."""

                response = await self.llm.ainvoke(error_analysis_prompt)
                guidance_message = response.content
                
            except Exception as e:
                logger.error(f"Failed to analyze error with LLM: {e}")
                # Fallback to a generic but helpful message
                guidance_message = f"""The {module_name} encountered an issue: {error_result.get('message', 'Unknown error')}

Please try:
1. Checking your input for any missing information
2. Rephrasing your request
3. Using a different approach

If the problem persists, please contact support."""
            
            # Send error to user
            await self._send_progress({
                "type": "progress",
                "status": "error",
                "module": module_name,
                "message": guidance_message
            })
            
            # Return enhanced error result
            return {
                "status": "error",
                "message": error_result.get("message", "Module error"),
                "data": {
                    "answer": guidance_message,
                    "error_type": error_data.get("error_type", "module_error"),
                    "original_error": error_result.get("message"),
                    "module": module_name,
                    **error_data  # Include any other data from the module
                },
                "module": module_name
            }
    
    def _suggest_alternative_modules(self, failed_module: str, query: str) -> List[Dict[str, str]]:
        """Suggest alternative modules based on the failed module and query."""
        alternatives = []
        
        # Module alternatives mapping
        module_alternatives = {
            "communication_agent": [
                {"name": "author_agent", "reason": "Create email drafts without sending"},
                {"name": "generic_agent", "reason": "Get help with email content"}
            ],
            "browser_agent": [
                {"name": "deepresearch_agent", "reason": "Research information online"},
                {"name": "generic_agent", "reason": "Answer questions without browsing"}
            ],
            "github_agent": [
                {"name": "generic_agent", "reason": "Get coding help without GitHub access"},
                {"name": "documents_agent", "reason": "Work with local code files"}
            ],
            "scheduling_agent": [
                {"name": "generic_agent", "reason": "Get scheduling advice"},
                {"name": "author_agent", "reason": "Create calendar event descriptions"}
            ],
            "solana_agent": [
                {"name": "deepresearch_agent", "reason": "Research blockchain projects and tokens"},
                {"name": "browser_agent", "reason": "Search for project information online"},
                {"name": "generic_agent", "reason": "Get general information about the topic"}
            ]
        }
        
        # Get alternatives for the failed module
        if failed_module in module_alternatives:
            for alt in module_alternatives[failed_module]:
                # Check if the alternative module is available
                if alt["name"] in self.modules:
                    alternatives.append(alt)
        
        # If no specific alternatives, suggest generic_agent if available
        if not alternatives and "generic_agent" in self.modules:
            alternatives.append({
                "name": "generic_agent",
                "reason": "Provide general assistance with your request"
            })
        
        return alternatives 