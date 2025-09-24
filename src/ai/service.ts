/**
 * AI Service - Connects to Cloudflare Workers AI for code analysis and generation
 */

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CodeAnalysis {
  explanation: string;
  suggestions: string[];
  improvements: string[];
  patterns: string[];
}

export interface TutorialStep {
  title: string;
  description: string;
  instructions: string;
  codeExample?: string;
  hints: string[];
}

export interface CodebaseContext {
  repository: {
    name: string;
    owner: string;
    language: string;
    framework?: string;
    architecture?: string;
  };
  fileStructure: {
    mainFiles: string[];
    configFiles: string[];
    testFiles: string[];
    documentationFiles: string[];
  };
  codePatterns: {
    imports: string[];
    functions: string[];
    classes: string[];
    patterns: string[];
  };
  relatedFiles: {
    path: string;
    content: string;
    relevance: string;
  }[];
}

export interface ConversationMemory {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    context?: any;
  }>;
  codebaseContext?: CodebaseContext;
  currentStep?: string;
  lastUpdated: Date;
}

export class AIService {
  constructor(private env: Env) {}

  /**
   * Get conversation memory for a session
   */
  async getConversationMemory(sessionId: string): Promise<ConversationMemory | null> {
    try {
      const stored = await this.env.STATUS_KV.get(`conversation:${sessionId}`);
      if (stored) {
        const memory = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        memory.messages = memory.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        memory.lastUpdated = new Date(memory.lastUpdated);
        return memory;
      }
    } catch (error) {
      console.warn('Failed to load conversation memory:', error);
    }
    return null;
  }

  /**
   * Save conversation memory for a session
   */
  async saveConversationMemory(memory: ConversationMemory): Promise<void> {
    try {
      await this.env.STATUS_KV.put(`conversation:${memory.sessionId}`, JSON.stringify(memory));
    } catch (error) {
      console.warn('Failed to save conversation memory:', error);
    }
  }

  /**
   * Add a message to conversation memory
   */
  async addToConversationMemory(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    context?: any
  ): Promise<void> {
    let memory = await this.getConversationMemory(sessionId);
    
    if (!memory) {
      memory = {
        sessionId,
        messages: [],
        lastUpdated: new Date()
      };
    }

    memory.messages.push({
      role,
      content,
      timestamp: new Date(),
      context
    });

    // Keep only last 20 messages to avoid memory bloat
    if (memory.messages.length > 20) {
      memory.messages = memory.messages.slice(-20);
    }

    memory.lastUpdated = new Date();
    await this.saveConversationMemory(memory);
  }

  /**
   * Generate tutorial content from commit analysis with codebase context
   */
  async generateTutorialContent(
    commit: any,
    files: any[],
    repository: any,
    codebaseContext?: CodebaseContext
  ): Promise<{
    title: string;
    description: string;
    steps: TutorialStep[];
  }> {
    const prompt = this.buildTutorialPrompt(commit, files, repository, codebaseContext);
    
    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: `You are an expert coding instructor with deep knowledge of codebases. Create step-by-step tutorials for developers to learn from real commits. Focus on teaching patterns, concepts, and best practices. Use the codebase context to provide relevant, specific guidance.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      return this.parseTutorialResponse(response.response || '');
    } catch (error) {
      console.error('AI tutorial generation failed:', error);
      return this.generateFallbackTutorial(commit, files);
    }
  }

  /**
   * Analyze code and provide suggestions with codebase context
   */
  async analyzeCode(
    code: string,
    context: {
      fileName: string;
      language: string;
      tutorialStep?: string;
      codebaseContext?: CodebaseContext;
    }
  ): Promise<CodeAnalysis> {
    const prompt = this.buildCodeAnalysisPrompt(code, context);

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are an expert code reviewer with deep knowledge of codebases. Provide constructive feedback in JSON format, considering the broader codebase context and patterns.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      return this.parseCodeAnalysis(response.response || '');
    } catch (error) {
      console.error('AI code analysis failed:', error);
      return this.generateFallbackAnalysis(code, context);
    }
  }

  /**
   * Generate code examples for a tutorial step
   */
  async generateCodeExample(
    step: string,
    context: {
      language: string;
      selectedCode?: string;
      repository: string;
    }
  ): Promise<string> {
    const prompt = `Generate a code example for this tutorial step:

Step: ${step}
Language: ${context.language}
Repository: ${context.repository}
${context.selectedCode ? `Selected Code Context:\n\`\`\`${context.language}\n${context.selectedCode}\n\`\`\`` : ''}

Provide a practical, well-commented code example that demonstrates the concept. Include:
- Clear variable names
- Helpful comments
- Error handling where appropriate
- Best practices for the language

Format as a code block with proper syntax highlighting.`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are an expert developer. Generate clear, educational code examples.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.5
      });

      return response.response || '';
    } catch (error) {
      console.error('AI code example generation failed:', error);
      return this.generateFallbackExample(step, context);
    }
  }

  /**
   * Provide contextual help and hints with codebase memory and conversation history
   */
  async getContextualHelp(
    question: string,
    context: {
      currentStep: string;
      selectedCode?: string;
      fileName?: string;
      repository: string;
      codebaseContext?: CodebaseContext;
      sessionId?: string;
    }
  ): Promise<string> {
    // Get conversation memory if sessionId is provided
    let conversationHistory: any[] = [];
    if (context.sessionId) {
      const memory = await this.getConversationMemory(context.sessionId);
      if (memory) {
        conversationHistory = memory.messages.slice(-10); // Last 10 messages for context
      }
    }

    const prompt = this.buildContextualHelpPrompt(question, context, conversationHistory);

    try {
      const messages = [
        {
          role: 'system' as const,
          content: 'You are a helpful coding mentor with deep knowledge of the codebase. Provide clear, encouraging guidance that considers the broader context and patterns in the repository. Remember previous conversations to provide consistent, helpful responses.'
        }
      ];

      // Add conversation history
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });

      // Add current question
      messages.push({
        role: 'user' as const,
        content: prompt
      });

      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages,
        max_tokens: 600,
        temperature: 0.6
      });

      const responseText = response.response || '';
      
      // Save to conversation memory
      if (context.sessionId) {
        await this.addToConversationMemory(context.sessionId, 'user', question, context);
        await this.addToConversationMemory(context.sessionId, 'assistant', responseText, context);
      }

      return responseText;
    } catch (error) {
      console.error('AI contextual help failed:', error);
      return this.generateFallbackHelp(question, context);
    }
  }

  /**
   * Analyze codebase structure and patterns
   */
  async analyzeCodebase(
    fileTree: any[],
    repository: any
  ): Promise<CodebaseContext> {
    const prompt = `Analyze this codebase structure and provide context:

REPOSITORY: ${repository.name}
FILES: ${fileTree.length} files

FILE STRUCTURE:
${fileTree.map(f => `- ${f.path} (${f.type})`).join('\n')}

Analyze and provide:
1. Primary programming language and framework
2. Architecture patterns (MVC, microservices, etc.)
3. Key files and their purposes
4. Common code patterns and imports
5. Related files that work together

Format as JSON with keys: repository, fileStructure, codePatterns, relatedFiles.`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are an expert codebase analyst. Analyze repository structure and provide detailed context about patterns, architecture, and relationships.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.4
      });

      return this.parseCodebaseContext(response.response || '');
    } catch (error) {
      console.error('AI codebase analysis failed:', error);
      return this.generateFallbackCodebaseContext(fileTree, repository);
    }
  }

  /**
   * Get related code examples from the codebase
   */
  async getRelatedCodeExamples(
    concept: string,
    codebaseContext: CodebaseContext,
    currentFile?: string
  ): Promise<string[]> {
    const prompt = `Find related code examples in this codebase:

CONCEPT: ${concept}
CURRENT FILE: ${currentFile || 'Not specified'}

CODEBASE CONTEXT:
- Repository: ${codebaseContext.repository.name}
- Language: ${codebaseContext.repository.language}
- Framework: ${codebaseContext.repository.framework || 'Not specified'}

RELATED FILES:
${codebaseContext.relatedFiles.map(f => `- ${f.path}: ${f.relevance}`).join('\n')}

Provide 3-5 specific code examples from the codebase that demonstrate ${concept}.
Include file paths and brief explanations of how each example relates to the concept.

Format as a list of examples with file paths and explanations.`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are an expert at finding relevant code examples within codebases. Provide specific, actionable examples that help learners understand concepts.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.5
      });

      return this.parseCodeExamples(response.response || '');
    } catch (error) {
      console.error('AI code example search failed:', error);
      return [`// Example for ${concept} in ${currentFile || 'the codebase'}`];
    }
  }

  /**
   * Build tutorial generation prompt with codebase context
   */
  private buildTutorialPrompt(commit: any, files: any[], repository: any, codebaseContext?: CodebaseContext): string {
    const fileChanges = files.map(f => 
      `- ${f.filename} (${f.status}): +${f.additions} -${f.deletions}`
    ).join('\n');

    let contextSection = '';
    if (codebaseContext) {
      contextSection = `

CODEBASE CONTEXT:
- Language: ${codebaseContext.repository.language}
- Framework: ${codebaseContext.repository.framework || 'Not specified'}
- Architecture: ${codebaseContext.repository.architecture || 'Not specified'}

KEY FILES:
${codebaseContext.fileStructure.mainFiles.map(f => `- ${f}`).join('\n')}

CODE PATTERNS:
${codebaseContext.codePatterns.patterns.map(p => `- ${p}`).join('\n')}

RELATED FILES:
${codebaseContext.relatedFiles.map(f => `- ${f.path}: ${f.relevance}`).join('\n')}`;
    }

    return `Create a step-by-step tutorial for this commit:

COMMIT DETAILS:
- Message: ${commit.message}
- Author: ${commit.author}
- Repository: ${repository.name}
- Files changed: ${files.length}
- Lines changed: ${files.reduce((sum, f) => sum + f.additions + f.deletions, 0)}

FILES CHANGED:
${fileChanges}${contextSection}

Create a tutorial with:
1. A clear, engaging title (max 60 chars)
2. A brief description of what the learner will build (max 150 chars)
3. 3-5 step-by-step instructions that guide implementation
4. Each step should include:
   - Clear title (max 40 chars)
   - Description of what to do (max 100 chars)
   - Detailed instructions (max 300 chars)
   - Code example if applicable
   - Helpful hints

Focus on teaching the patterns and concepts, not just copying code.
Use the codebase context to provide relevant, specific guidance.
Make it beginner-friendly but educational.

Format as JSON:
{
  "title": "...",
  "description": "...",
  "steps": [
    {
      "title": "...",
      "description": "...",
      "instructions": "...",
      "codeExample": "...",
      "hints": ["...", "..."]
    }
  ]
}`;
  }

  /**
   * Build code analysis prompt with codebase context
   */
  private buildCodeAnalysisPrompt(code: string, context: any): string {
    let contextSection = '';
    if (context.codebaseContext) {
      contextSection = `

CODEBASE CONTEXT:
- Repository: ${context.codebaseContext.repository.name}
- Language: ${context.codebaseContext.repository.language}
- Framework: ${context.codebaseContext.repository.framework || 'Not specified'}

RELATED PATTERNS:
${context.codebaseContext.codePatterns.patterns.map((p: string) => `- ${p}`).join('\n')}

RELATED FILES:
${context.codebaseContext.relatedFiles.map((f: any) => `- ${f.path}: ${f.relevance}`).join('\n')}`;
    }

    return `Analyze this ${context.language} code and provide helpful feedback:

File: ${context.fileName}
Context: ${context.tutorialStep || 'General code review'}${contextSection}

Code:
\`\`\`${context.language}
${code}
\`\`\`

Please provide:
1. A clear explanation of what this code does
2. Specific suggestions for improvement
3. Code patterns and best practices demonstrated
4. Any potential issues or optimizations
5. How it relates to the broader codebase patterns

Format your response as JSON with keys: explanation, suggestions, improvements, patterns.`;
  }

  /**
   * Build contextual help prompt with codebase memory and conversation history
   */
  private buildContextualHelpPrompt(question: string, context: any, conversationHistory: any[] = []): string {
    let contextSection = '';
    if (context.codebaseContext) {
      contextSection = `

CODEBASE CONTEXT:
- Repository: ${context.codebaseContext.repository.name}
- Language: ${context.codebaseContext.repository.language}
- Framework: ${context.codebaseContext.repository.framework || 'Not specified'}

RELATED FILES:
${context.codebaseContext.relatedFiles.map((f: any) => `- ${f.path}: ${f.relevance}`).join('\n')}`;
    }

    let conversationSection = '';
    if (conversationHistory.length > 0) {
      conversationSection = `

RECENT CONVERSATION HISTORY:
${conversationHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}

Use this conversation history to provide context-aware responses and avoid repeating information.`;
    }

    return `Answer this question in the context of a coding tutorial:

Question: ${question}

Context:
- Current Step: ${context.currentStep}
- File: ${context.fileName || 'Not specified'}
- Repository: ${context.repository}${contextSection}${conversationSection}
${context.selectedCode ? `- Selected Code:\n\`\`\`\n${context.selectedCode}\n\`\`\`` : ''}

Provide a helpful, specific answer that guides the learner. Include:
- Direct answers to the question
- Relevant code examples from the codebase
- Next steps or suggestions
- Links to related concepts and files
- Reference previous conversation context when relevant

Be encouraging and educational.`;
  }

  /**
   * Parse AI tutorial response
   */
  private parseTutorialResponse(response: string): {
    title: string;
    description: string;
    steps: TutorialStep[];
  } {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || 'Learn from this commit',
          description: parsed.description || 'Step-by-step implementation guide',
          steps: parsed.steps || []
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI tutorial response as JSON:', error);
    }

    // Fallback parsing
    return this.generateFallbackTutorial(null, []);
  }

  /**
   * Parse code analysis response
   */
  private parseCodeAnalysis(response: string): CodeAnalysis {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          explanation: parsed.explanation || 'Code analysis',
          suggestions: parsed.suggestions || [],
          improvements: parsed.improvements || [],
          patterns: parsed.patterns || []
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI code analysis as JSON:', error);
    }

    return {
      explanation: 'This code appears to be functional.',
      suggestions: ['Consider adding comments for clarity'],
      improvements: ['Add error handling'],
      patterns: ['Standard implementation pattern']
    };
  }

  /**
   * Generate fallback tutorial when AI fails
   */
  private generateFallbackTutorial(commit: any, files: any[]): {
    title: string;
    description: string;
    steps: TutorialStep[];
  } {
    return {
      title: commit ? `Learn: ${commit.message.split('\n')[0]}` : 'Learn from this commit',
      description: 'Step-by-step implementation guide based on the commit changes.',
      steps: [
        {
          title: 'Understand the Changes',
          description: 'Review what was modified',
          instructions: 'Study the commit message and file changes to understand the goal.',
          hints: ['Look at the commit message for context', 'Check which files were modified']
        },
        {
          title: 'Plan Your Implementation',
          description: 'Break down the approach',
          instructions: 'Think about the implementation strategy and required changes.',
          hints: ['Start with the main functionality', 'Consider edge cases']
        },
        {
          title: 'Implement the Changes',
          description: 'Write the code',
          instructions: 'Implement the feature following the same patterns as the original commit.',
          hints: ['Follow existing code patterns', 'Add proper error handling']
        }
      ]
    };
  }

  /**
   * Generate fallback code analysis
   */
  private generateFallbackAnalysis(code: string, context: any): CodeAnalysis {
    return {
      explanation: `This ${context.language} code in ${context.fileName} appears to be well-structured.`,
      suggestions: ['Add comments for complex logic', 'Consider error handling'],
      improvements: ['Optimize performance if needed', 'Add input validation'],
      patterns: ['Standard implementation pattern']
    };
  }

  /**
   * Generate fallback code example
   */
  private generateFallbackExample(step: string, context: any): string {
    return `// Example for: ${step}
// Language: ${context.language}

// TODO: Implement this step
// Add your code here following the tutorial instructions

console.log('Hello from ${context.repository}!');`;
  }

  /**
   * Generate fallback help
   */
  private generateFallbackHelp(question: string, context: any): string {
    return `I'd be happy to help with "${question}"! 

For the current step "${context.currentStep}", I recommend:
- Review the tutorial instructions carefully
- Check the existing code patterns in the repository
- Start with a simple implementation and iterate

Feel free to ask more specific questions!`;
  }

  /**
   * Parse codebase context response
   */
  private parseCodebaseContext(response: string): CodebaseContext {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          repository: {
            name: parsed.repository?.name || 'Unknown',
            owner: parsed.repository?.owner || 'Unknown',
            language: parsed.repository?.language || 'JavaScript',
            framework: parsed.repository?.framework,
            architecture: parsed.repository?.architecture
          },
          fileStructure: {
            mainFiles: parsed.fileStructure?.mainFiles || [],
            configFiles: parsed.fileStructure?.configFiles || [],
            testFiles: parsed.fileStructure?.testFiles || [],
            documentationFiles: parsed.fileStructure?.documentationFiles || []
          },
          codePatterns: {
            imports: parsed.codePatterns?.imports || [],
            functions: parsed.codePatterns?.functions || [],
            classes: parsed.codePatterns?.classes || [],
            patterns: parsed.codePatterns?.patterns || []
          },
          relatedFiles: parsed.relatedFiles || []
        };
      }
    } catch (error) {
      console.warn('Failed to parse codebase context as JSON:', error);
    }

    return this.generateFallbackCodebaseContext([], { name: 'Unknown' });
  }

  /**
   * Parse code examples response
   */
  private parseCodeExamples(response: string): string[] {
    try {
      // Extract examples from response
      const lines = response.split('\n').filter(line => 
        line.trim().startsWith('-') || 
        line.trim().startsWith('*') || 
        line.includes('//') ||
        line.includes('function') ||
        line.includes('class')
      );
      
      return lines.slice(0, 5); // Limit to 5 examples
    } catch (error) {
      console.warn('Failed to parse code examples:', error);
      return ['// Code example not available'];
    }
  }

  /**
   * Generate fallback codebase context
   */
  private generateFallbackCodebaseContext(fileTree: any[], repository: any): CodebaseContext {
    const mainFiles = fileTree
      .filter(f => f.type === 'blob' && (
        f.path.includes('index.') ||
        f.path.includes('main.') ||
        f.path.includes('app.') ||
        f.path.endsWith('.js') ||
        f.path.endsWith('.ts')
      ))
      .slice(0, 5)
      .map(f => f.path);

    return {
      repository: {
        name: repository.name || 'Unknown',
        owner: 'Unknown',
        language: 'JavaScript',
        framework: 'Unknown',
        architecture: 'Unknown'
      },
      fileStructure: {
        mainFiles,
        configFiles: fileTree.filter(f => f.path.includes('config') || f.path.includes('package.json')).map(f => f.path),
        testFiles: fileTree.filter(f => f.path.includes('test') || f.path.includes('spec')).map(f => f.path),
        documentationFiles: fileTree.filter(f => f.path.includes('README') || f.path.includes('.md')).map(f => f.path)
      },
      codePatterns: {
        imports: [],
        functions: [],
        classes: [],
        patterns: ['Standard JavaScript patterns']
      },
      relatedFiles: []
    };
  }
}
