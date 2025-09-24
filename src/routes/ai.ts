/**
 * AI API endpoints for tutorial assistance and code analysis
 */

import { AIService } from '../ai/service';
import type { StorageEnv } from '../storage';

export async function handleAIAssist(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const body = await request.json() as {
      tutorialId: string;
      stepNumber: number;
      question: string;
      context: {
        repo: string;
        step: any;
        tutorial: string;
        codebaseContext?: any;
        sessionId?: string;
      };
    };

    const { tutorialId, stepNumber, question, context } = body;

    if (!question) {
      return Response.json({
        success: false,
        error: 'Question is required'
      }, { status: 400 });
    }

    const aiService = new AIService(env as Env);
    
    // Get contextual help from AI with conversation memory
    const response = await aiService.getContextualHelp(question, {
      currentStep: context.step.title,
      selectedCode: undefined, // Could be added later
      fileName: undefined, // Could be added later
      repository: context.repo,
      codebaseContext: context.codebaseContext,
      sessionId: context.sessionId
    });

    return Response.json({
      success: true,
      response
    });

  } catch (error) {
    console.error('AI assist error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleAIHelp(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const body = await request.json() as {
      question: string;
      context: {
        currentStep: string;
        selectedCode?: string;
        fileName?: string;
        repository: string;
        codebaseContext?: any;
        sessionId?: string;
      };
    };

    const { question, context } = body;

    if (!question) {
      return Response.json({
        success: false,
        error: 'Question is required'
      }, { status: 400 });
    }

    const aiService = new AIService(env as Env);
    
    // Get contextual help from AI with codebase context and conversation memory
    const response = await aiService.getContextualHelp(question, context);

    return Response.json({
      success: true,
      response
    });

  } catch (error) {
    console.error('AI help error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleCodebaseAnalysis(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const body = await request.json() as {
      fileTree: any[];
      repository: any;
    };

    const { fileTree, repository } = body;

    if (!fileTree || !repository) {
      return Response.json({
        success: false,
        error: 'File tree and repository are required'
      }, { status: 400 });
    }

    const aiService = new AIService(env as Env);
    
    // Analyze codebase structure and patterns
    const codebaseContext = await aiService.analyzeCodebase(fileTree, repository);

    return Response.json({
      success: true,
      codebaseContext
    });

  } catch (error) {
    console.error('Codebase analysis error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleRelatedCodeExamples(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const body = await request.json() as {
      concept: string;
      codebaseContext: any;
      currentFile?: string;
    };

    const { concept, codebaseContext, currentFile } = body;

    if (!concept || !codebaseContext) {
      return Response.json({
        success: false,
        error: 'Concept and codebase context are required'
      }, { status: 400 });
    }

    const aiService = new AIService(env as Env);
    
    // Get related code examples from the codebase
    const examples = await aiService.getRelatedCodeExamples(concept, codebaseContext, currentFile);

    return Response.json({
      success: true,
      examples
    });

  } catch (error) {
    console.error('Related code examples error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleCodeAnalysis(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const body = await request.json() as {
      code: string;
      fileName: string;
      language: string;
      tutorialStep?: string;
      codebaseContext?: any;
    };

    const { code, fileName, language, tutorialStep, codebaseContext } = body;

    if (!code || !fileName || !language) {
      return Response.json({
        success: false,
        error: 'Code, fileName, and language are required'
      }, { status: 400 });
    }

    const aiService = new AIService(env as Env);
    
    // Analyze code with AI and codebase context
    const analysis = await aiService.analyzeCode(code, {
      fileName,
      language,
      tutorialStep,
      codebaseContext
    });

    return Response.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Code analysis error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function handleCodeExample(request: Request, env: StorageEnv): Promise<Response> {
  try {
    const body = await request.json() as {
      step: string;
      language: string;
      selectedCode?: string;
      repository: string;
    };

    const { step, language, selectedCode, repository } = body;

    if (!step || !language || !repository) {
      return Response.json({
        success: false,
        error: 'Step, language, and repository are required'
      }, { status: 400 });
    }

    const aiService = new AIService(env as Env);
    
    // Generate code example with AI
    const example = await aiService.generateCodeExample(step, {
      language,
      selectedCode,
      repository
    });

    return Response.json({
      success: true,
      example
    });

  } catch (error) {
    console.error('Code example error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
