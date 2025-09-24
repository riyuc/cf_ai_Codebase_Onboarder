import { routeAgentRequest, type Schedule } from "agents";

import { getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { createWorkersAI } from 'workers-ai-provider';
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
import { env } from "cloudflare:workers";
import type { StorageEnv } from "./storage";

const workersai = createWorkersAI({ binding: env.AI });
const model = workersai('@cf/meta/llama-3.1-8b-instruct', {
  // additional settings
  safePrompt: true,
});
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // const mcpConnection = await this.mcp.connect(
    //   "https://path-to-mcp-server/sse"
    // );

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

        const result = streamText({
          system: `You are a helpful assistant that can do various tasks... 

${getSchedulePrompt({ date: new Date() })}

If the user asks to schedule a task, use the schedule tool to schedule the task.
`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Test endpoints for GitHub integration
    if (url.pathname === "/test/ingest") {
      const { handleTestIngest } = await import("./routes/test");
      return handleTestIngest(request, env);
    }

    if (url.pathname === "/test/status") {
      const { handleTestStatus } = await import("./routes/test");
      return handleTestStatus(request, env);
    }

    if (url.pathname === "/test/tutorials") {
      const { handleTestTutorials } = await import("./routes/test");
      return handleTestTutorials(request, env);
    }

    // Debug endpoints
    if (url.pathname === "/debug/repos") {
      const { handleDebugRepos } = await import("./routes/debug");
      return handleDebugRepos(request, env);
    }

    if (url.pathname === "/debug/commits") {
      const { handleDebugCommits } = await import("./routes/debug");
      return handleDebugCommits(request, env);
    }

    if (url.pathname === "/debug/clear") {
      const { handleDebugClearRepo } = await import("./routes/debug");
      return handleDebugClearRepo(request, env);
    }

    // Tutorial endpoints
    if (url.pathname === "/tutorials" && request.method === "GET") {
      const { handleGetTutorials } = await import("./routes/tutorials");
      return handleGetTutorials(request, env);
    }

    if (url.pathname === "/tutorials" && request.method === "POST") {
      const { handleCreateTutorial } = await import("./routes/tutorials");
      return handleCreateTutorial(request, env);
    }

    if (url.pathname.startsWith("/tutorials/") && request.method === "GET") {
      const { handleGetTutorial } = await import("./routes/tutorials");
      return handleGetTutorial(request, env);
    }

    if (url.pathname === "/sessions" && request.method === "POST") {
      const { handleStartSession } = await import("./routes/tutorials");
      return handleStartSession(request, env);
    }

    if (url.pathname.match(/^\/sessions\/[^\/]+\/action$/) && request.method === "POST") {
      const { handleSessionAction } = await import("./routes/tutorials");
      return handleSessionAction(request, env);
    }

    if (url.pathname === "/generate-tutorials" && request.method === "POST") {
      const { handleGenerateTutorials } = await import("./routes/tutorials");
      return handleGenerateTutorials(request, env);
    }

    // API endpoints
    if (url.pathname === "/api/file-content" && request.method === "POST") {
      const { handleGetFileContent } = await import("./routes/tutorials");
      return handleGetFileContent(request, env);
    }

    // Workspace endpoints
    if (url.pathname.startsWith("/api/workspace/") && request.method === "GET") {
      const { handleGetWorkspace } = await import("./routes/workspace");
      return handleGetWorkspace(request, env);
    }

    if (url.pathname === "/api/workspace" && request.method === "POST") {
      const { handleCreateWorkspace } = await import("./routes/workspace");
      return handleCreateWorkspace(request, env);
    }

    if (url.pathname === "/check-open-ai-key") {
      const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
      return Response.json({
        success: hasOpenAIKey
      });
    }
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
    }
    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
