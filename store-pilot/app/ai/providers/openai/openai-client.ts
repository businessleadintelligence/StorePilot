import OpenAI from "openai";

import { AIPlatformError } from "../../core/ai-errors";

export type OpenAIClientConfig = {
  apiKey: string;
  timeoutMs: number;
};

export type OpenAIChatRequest = {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature: number;
  maxTokens: number;
  responseFormat?: "text" | "json_object";
};

export type OpenAIChatResponse = {
  content: string;
  model: string;
  finishReason: string | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export interface OpenAIClient {
  chat(request: OpenAIChatRequest): Promise<OpenAIChatResponse>;
  ping(model: string): Promise<void>;
}

export function createOpenAIClient(config: OpenAIClientConfig): OpenAIClient {
  const client = new OpenAI({
    apiKey: config.apiKey,
    timeout: config.timeoutMs,
  });

  return {
    async chat(request: OpenAIChatRequest): Promise<OpenAIChatResponse> {
      const response = await client.chat.completions.create({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        response_format:
          request.responseFormat === "json_object"
            ? { type: "json_object" }
            : undefined,
      });

      const choice = response.choices[0];
      const content = choice?.message?.content;

      if (!content) {
        throw AIPlatformError.invalidResponse("OpenAI response did not include content");
      }

      return {
        content,
        model: response.model,
        finishReason: choice.finish_reason ?? null,
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
      };
    },

    async ping(model: string): Promise<void> {
      await client.models.retrieve(model);
    },
  };
}

export type MockOpenAIClient = {
  chat: OpenAIClient["chat"];
  ping: OpenAIClient["ping"];
};

export function createMockOpenAIClient(
  handlers: Partial<Pick<OpenAIClient, "chat" | "ping">> = {},
): OpenAIClient {
  return {
    chat:
      handlers.chat ??
      (async () => ({
        content: "{}",
        model: "mock-model",
        finishReason: "stop",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      })),
    ping: handlers.ping ?? (async () => undefined),
  };
}
