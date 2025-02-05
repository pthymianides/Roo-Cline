import { ApiHandler } from "../"
import { ApiHandlerOptions, ModelInfo } from "../../shared/api"
import { ApiStream } from "../transform/stream"
import OpenAI from "openai"

export class AzureOpenAIHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: OpenAI

	constructor(options: ApiHandlerOptions) {
		if (!options.azureApiKey || !options.azureEndpoint) {
			throw new Error("Azure API key and endpoint are required")
		}

		this.options = options
		this.client = new OpenAI({
			apiKey: options.azureApiKey,
			baseURL: `${options.azureEndpoint}/openai/deployments/${options.apiModelId}`,
			defaultQuery: { 'api-version': '2023-05-15' },
			defaultHeaders: { 'api-key': options.azureApiKey }
		})
	}

	async *createMessage(systemPrompt: string, messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): ApiStream {
		const stream = await this.client.chat.completions.create({
			messages: [{ role: "system", content: systemPrompt }, ...messages],
			model: this.getModel().id,
			stream: true,
			temperature: 0,
			max_tokens: this.getModel().info.maxTokens
		})

		let outputTokens = 0
		for await (const chunk of stream) {
			const content = chunk.choices[0]?.delta?.content || ""
			outputTokens += content.split(/\s+/).length // Approximate token count
			yield { type: "text", text: content }
		}

		yield {
			type: "usage",
			inputTokens: 0, // Azure doesn't return prompt tokens in streaming
			outputTokens
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.apiModelId || "gpt-35-turbo",
			info: {
				maxTokens: 4096,
				supportsSystemPrompt: true,
				supportsStreaming: true
			}
		}
	}
}