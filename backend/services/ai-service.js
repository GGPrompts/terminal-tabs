/**
 * AI Service - Flexible LLM integration
 *
 * Supports multiple backends:
 * - OpenAI API
 * - Ollama (via OpenAI-compatible endpoint)
 * - vLLM (OpenAI-compatible)
 * - Any OpenAI-compatible API
 */

class AIService {
  constructor() {
    // Configuration from environment variables
    this.provider = process.env.AI_PROVIDER || 'openai-compatible';
    this.apiKey = process.env.AI_API_KEY || '';
    this.baseURL = process.env.AI_BASE_URL || 'http://localhost:11434/v1'; // Default to Ollama
    this.model = process.env.AI_MODEL || 'qwen2.5-coder:7b';
    this.temperature = parseFloat(process.env.AI_TEMPERATURE || '0.7');
    this.maxTokens = parseInt(process.env.AI_MAX_TOKENS || '500');

    console.log(`[AI Service] Initialized with provider: ${this.provider}, model: ${this.model}`);
  }

  /**
   * Generate command suggestion based on partial input and context
   */
  async suggestCommand(input, context = {}) {
    const prompt = this.buildCommandSuggestionPrompt(input, context);

    try {
      const response = await this.chat(prompt, {
        temperature: 0.3, // Lower temperature for more deterministic suggestions
        maxTokens: 200,
        format: 'json'
      });

      const suggestion = this.parseJSON(response);

      // Validate suggestion structure
      if (!suggestion.command) {
        throw new Error('Invalid suggestion format: missing command');
      }

      return {
        command: suggestion.command || input,
        confidence: suggestion.confidence || 50,
        explanation: suggestion.explanation || 'Command suggestion',
        source: 'ai'
      };
    } catch (error) {
      console.error('[AI Service] Suggestion error:', error);

      // Fallback to simple suggestion
      return {
        command: input,
        confidence: 0,
        explanation: 'AI service unavailable',
        source: 'fallback',
        error: error.message
      };
    }
  }

  /**
   * Convert natural language to shell command
   */
  async nlToCommand(naturalLanguage, context = {}) {
    const prompt = this.buildNLToCommandPrompt(naturalLanguage, context);

    try {
      const response = await this.chat(prompt, {
        temperature: 0.2,
        maxTokens: 300,
        format: 'json'
      });

      const result = this.parseJSON(response);

      return {
        command: result.command || '',
        explanation: result.explanation || '',
        destructive: result.destructive || false,
        confidence: result.confidence || 50
      };
    } catch (error) {
      console.error('[AI Service] NL to command error:', error);
      throw error;
    }
  }

  /**
   * Detect and explain errors from terminal output
   */
  async explainError(errorOutput, context = {}) {
    const prompt = this.buildErrorExplanationPrompt(errorOutput, context);

    try {
      const response = await this.chat(prompt, {
        temperature: 0.3,
        maxTokens: 400,
        format: 'json'
      });

      const result = this.parseJSON(response);

      return {
        type: result.type || 'unknown_error',
        severity: result.severity || 'error',
        message: result.message || errorOutput,
        explanation: result.explanation || 'Unknown error',
        suggestedFix: result.suggestedFix || '',
        docsUrl: result.docsUrl || null
      };
    } catch (error) {
      console.error('[AI Service] Error explanation failed:', error);
      return {
        type: 'unknown_error',
        severity: 'error',
        message: errorOutput,
        explanation: 'Could not analyze error',
        suggestedFix: '',
        docsUrl: null
      };
    }
  }

  /**
   * Core chat function - sends request to LLM API
   */
  async chat(prompt, options = {}) {
    const temperature = options.temperature ?? this.temperature;
    const maxTokens = options.maxTokens ?? this.maxTokens;
    const format = options.format; // 'json' or undefined

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful terminal assistant. Provide concise, accurate responses.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature,
      max_tokens: maxTokens,
    };

    // Add JSON format instruction if requested
    if (format === 'json') {
      requestBody.response_format = { type: 'json_object' };
      requestBody.messages[0].content += ' Always respond with valid JSON.';
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('[AI Service] Chat request failed:', error);
      throw error;
    }
  }

  /**
   * Build prompt for command suggestion
   */
  buildCommandSuggestionPrompt(input, context) {
    return `Given the following context about the user's terminal session:

Current directory: ${context.cwd || '/'}
Recent commands: ${context.recentCommands?.join(', ') || 'none'}
${context.gitStatus ? `Git status: ${context.gitStatus}` : ''}
${context.files?.length ? `Files in directory: ${context.files.slice(0, 20).join(', ')}` : ''}

The user is currently typing: "${input}"

Suggest a complete shell command that the user might want to run. Consider:
- Common command patterns
- The current directory context
- Recent command history
- Git repository status (if applicable)

Respond ONLY with valid JSON in this exact format:
{
  "command": "the complete suggested command",
  "confidence": 0-100 (how confident you are this is what they want),
  "explanation": "brief 1-sentence explanation of what this does"
}`;
  }

  /**
   * Build prompt for natural language to command conversion
   */
  buildNLToCommandPrompt(naturalLanguage, context) {
    return `Convert this natural language request into a shell command:

Request: "${naturalLanguage}"

Context:
- Current directory: ${context.cwd || '/'}
- Operating system: Linux
${context.gitRepo ? '- Git repository: yes' : ''}

Respond ONLY with valid JSON in this exact format:
{
  "command": "the shell command to run",
  "explanation": "what this command does",
  "destructive": true/false (does it delete/modify files?),
  "confidence": 0-100
}`;
  }

  /**
   * Build prompt for error explanation
   */
  buildErrorExplanationPrompt(errorOutput, context) {
    return `Analyze this terminal error and provide a fix:

Error output:
\`\`\`
${errorOutput}
\`\`\`

Context:
- Current directory: ${context.cwd || '/'}
- Recent command: ${context.lastCommand || 'unknown'}

Respond ONLY with valid JSON in this exact format:
{
  "type": "error type (command_not_found, npm_error, git_error, etc)",
  "severity": "warning, error, or critical",
  "message": "brief error message",
  "explanation": "what caused this error",
  "suggestedFix": "command to fix it",
  "docsUrl": "relevant documentation URL or null"
}`;
  }

  /**
   * Parse JSON response, handling potential formatting issues
   */
  parseJSON(response) {
    try {
      // Remove markdown code blocks if present
      const cleaned = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      return JSON.parse(cleaned);
    } catch (error) {
      console.error('[AI Service] JSON parse error:', error);
      console.error('[AI Service] Raw response:', response);

      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          // Give up
        }
      }

      throw new Error('Failed to parse AI response as JSON');
    }
  }

  /**
   * Check if AI service is available
   */
  async healthCheck() {
    try {
      await this.chat('Reply with "OK"', { maxTokens: 10 });
      return { status: 'ok', provider: this.provider, model: this.model };
    } catch (error) {
      return {
        status: 'error',
        provider: this.provider,
        model: this.model,
        error: error.message
      };
    }
  }
}

// Singleton instance
module.exports = new AIService();
