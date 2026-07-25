import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IPolyMindComparison } from './schemas/comparison.schema';
import { PolyMindProvider, PolyMindQueryDto, PolyMindResponse } from './polymind.dto';

/**
 * PolyMindService — proxies a single prompt to whichever provider the
 * caller asked for. Unlike src/modules/ai/ai.service.ts (which only wires
 * up openai/gemini/groq/cloudflare/ollama for internal PlanAI features),
 * PolyMind additionally needs Anthropic + Mistral, so provider calls are
 * made directly here rather than routed through AiService. API keys are
 * read from the same env-var convention used by ai/providers/*.provider.ts.
 *
 * All five providers return the identical PolyMindResponse shape so the
 * Chrome extension can render them uniformly (see products.ts prod_114).
 */
@Injectable()
export class PolymindService {
  private readonly logger = new Logger(PolymindService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectModel('PolyMindComparison')
    private readonly comparisonModel: Model<IPolyMindComparison>,
  ) {}

  async query(
    provider: PolyMindProvider,
    dto: PolyMindQueryDto,
    userId: string,
    source: 'extension' | 'web' | 'api' = 'api',
  ): Promise<PolyMindResponse> {
    const started = Date.now();
    let result: PolyMindResponse;

    try {
      result = await this.dispatch(provider, dto);
    } catch (err) {
      result = {
        content: '',
        model: provider,
        tokensUsed: 0,
        latencyMs: Date.now() - started,
        error: (err as Error).message,
      };
    }

    await this.comparisonModel.create({
      userId,
      prompt: dto.prompt,
      systemPrompt: dto.systemPrompt,
      responses: [
        {
          modelId: result.model,
          content: result.content,
          tokensUsed: result.tokensUsed,
          latencyMs: result.latencyMs,
          error: result.error,
        },
      ],
      source,
    });

    if (result.error) {
      this.logger.warn(`PolyMind ${provider} call failed: ${result.error}`);
    }
    return result;
  }

  async history(userId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.comparisonModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
      this.comparisonModel.countDocuments({ userId }),
    ]);
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: skip + data.length < total,
      hasPrev: page > 1,
    };
  }

  // ── Provider dispatch ─────────────────────────────────────────────────────

  private async dispatch(provider: PolyMindProvider, dto: PolyMindQueryDto): Promise<PolyMindResponse> {
    switch (provider) {
      case 'openai':
        return this.callOpenAI(dto);
      case 'claude':
        return this.callAnthropic(dto);
      case 'gemini':
        return this.callGemini(dto);
      case 'groq':
        return this.callGroq(dto);
      case 'mistral':
        return this.callMistral(dto);
      default:
        throw new BadRequestException(`Unsupported provider: ${provider}`);
    }
  }

  private async callOpenAI(dto: PolyMindQueryDto): Promise<PolyMindResponse> {
    const apiKey = this.config.getOrThrow<string>('OPENAI_API_KEY');
    const started = Date.now();
    const model = 'gpt-4o';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          ...(dto.systemPrompt ? [{ role: 'system', content: dto.systemPrompt }] : []),
          { role: 'user', content: dto.prompt },
        ],
        max_tokens: dto.maxTokens ?? 1024,
        temperature: dto.temperature ?? 0.7,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model,
      tokensUsed: data.usage?.total_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  }

  private async callAnthropic(dto: PolyMindQueryDto): Promise<PolyMindResponse> {
    const apiKey = this.config.getOrThrow<string>('ANTHROPIC_API_KEY');
    const started = Date.now();
    const model = 'claude-sonnet-4-6';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: dto.maxTokens ?? 1024,
        system: dto.systemPrompt,
        messages: [{ role: 'user', content: dto.prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = (data.content ?? []).map((b: { text?: string }) => b.text ?? '').join('');
    return {
      content: text,
      model,
      tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      latencyMs: Date.now() - started,
    };
  }

  private async callGemini(dto: PolyMindQueryDto): Promise<PolyMindResponse> {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    const started = Date.now();
    const model = 'gemini-2.0-pro';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: dto.prompt }] }],
          systemInstruction: dto.systemPrompt ? { parts: [{ text: dto.systemPrompt }] } : undefined,
          generationConfig: { maxOutputTokens: dto.maxTokens ?? 1024, temperature: dto.temperature ?? 0.7 },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    return {
      content: text,
      model,
      tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
      latencyMs: Date.now() - started,
    };
  }

  private async callGroq(dto: PolyMindQueryDto): Promise<PolyMindResponse> {
    const apiKey = this.config.getOrThrow<string>('GROQ_API_KEY');
    const started = Date.now();
    const model = 'llama-3.1-70b-versatile';
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          ...(dto.systemPrompt ? [{ role: 'system', content: dto.systemPrompt }] : []),
          { role: 'user', content: dto.prompt },
        ],
        max_tokens: dto.maxTokens ?? 1024,
        temperature: dto.temperature ?? 0.7,
      }),
    });
    if (!res.ok) throw new Error(`Groq error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model,
      tokensUsed: data.usage?.total_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  }

  private async callMistral(dto: PolyMindQueryDto): Promise<PolyMindResponse> {
    const apiKey = this.config.getOrThrow<string>('MISTRAL_API_KEY');
    const started = Date.now();
    const model = 'mistral-large-latest';
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          ...(dto.systemPrompt ? [{ role: 'system', content: dto.systemPrompt }] : []),
          { role: 'user', content: dto.prompt },
        ],
        max_tokens: dto.maxTokens ?? 1024,
        temperature: dto.temperature ?? 0.7,
      }),
    });
    if (!res.ok) throw new Error(`Mistral error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model,
      tokensUsed: data.usage?.total_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
  }
}
