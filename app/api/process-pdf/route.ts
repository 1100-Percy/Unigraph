import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@clerk/nextjs/server';
import { PDFParse } from 'pdf-parse';

// Force Node.js runtime to support pdf-parse
export const runtime = 'nodejs';

type AiConcept = {
  name?: unknown;
  description?: unknown;
  definition?: unknown;
};

type AiModule = {
  title?: unknown;
  concepts?: unknown;
};

const normalizeTerm = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const extractQuoteEvidence = (
  fullText: string,
  termRaw: string,
): { quote: string; start: number; end: number } | null => {
  const term = termRaw.trim();
  if (!term || term.length < 2) return null;

  const lowerText = fullText.toLowerCase();

  const findByNeedle = (needle: string) => {
    const lowerNeedle = needle.toLowerCase();
    const index = lowerText.indexOf(lowerNeedle);
    if (index < 0) return null;

    const contextBefore = 240;
    const contextAfter = 260;
    let start = Math.max(0, index - contextBefore);
    let end = Math.min(fullText.length, index + needle.length + contextAfter);

    const lastNewline = fullText.lastIndexOf('\n', index);
    if (lastNewline >= start && lastNewline < index) start = lastNewline + 1;

    const nextNewline = fullText.indexOf('\n', index + needle.length);
    if (nextNewline > index && nextNewline <= end) end = nextNewline;

    let quote = fullText.slice(start, end).trim();

    const maxLen = 600;
    if (quote.length > maxLen) {
      const tighterBefore = 180;
      const tighterAfter = 220;
      start = Math.max(0, index - tighterBefore);
      end = Math.min(fullText.length, index + needle.length + tighterAfter);
      quote = fullText.slice(start, end).trim();
      if (quote.length > maxLen) quote = quote.slice(0, maxLen).trim();
    }

    if (!quote) return null;
    return { quote, start, end };
  };

  const direct = findByNeedle(term);
  if (direct) return direct;

  const tokens = term
    .split(/[\s，,;；、:：()（）\-\u2013\u2014\/]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  for (const token of tokens) {
    const hit = findByNeedle(token);
    if (hit) return hit;
  }

  return null;
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Check file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, message: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF text
    const parser = new PDFParse({ data: buffer });
    let text = '';
    try {
      const textResult = await parser.getText();
      text = textResult?.text ?? '';
    } finally {
      await parser.destroy().catch(() => {});
    }

    // Truncate text to 15,000 characters to avoid token limits
    if (text.length > 15000) {
      text = text.substring(0, 15000);
    }

    // Initialize OpenAI client for DeepSeek
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    });

    // Call DeepSeek AI
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `你是一位专业的课程架构师。你的任务是从杂乱的讲义文本中重构出清晰的知识树。
第一步：（提取层级）首先识别课程名和当前讲座主题。
第二步：（归纳模块）分析文本的逻辑流。如果没有明确的章节标题，请根据内容语义，将知识点归类到 3-5 个“核心模块”中。不要创建“其他”或“杂项”这种模块，必须赋予有意义的概括性标题。
第三步：（提取概念）在第二步创建的每个模块下，提取 文件中的原子知识点（Concepts/algorithms/formula and so on）。
注意：保持原意：模块标题最好引用原文，如果原文没有，则进行高层次的总结。
注意：Concept 的 name 尽量使用原文中出现过的术语/短语（能逐字对应最好），避免自己发明新词。
你必须返回严格的 **JSON** 格式（JSON Format）格式如下：{
  "courseName": string, // 课程名称（如“计算机组成原理”）
  "lectureTitle": string, // 本次课的主题（如“Lecture 3: 流水线技术”）
  "modules": [ // 核心模块（如果文中没有显式标题，请 AI 归纳总结）
    {
      "title": string, // 模块名（如“流水线冒险处理”）
      "concepts": [ // 该模块下的具体知识点
        {
          "name": string, // 概念名（如“数据冒险”）
          "description": string // 一句话解释
        }
      ]
    }
  ]
}`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
    });

    // Parse AI response with error handling and fallback
    let result;
    try {
      result = JSON.parse(completion.choices[0].message.content || '{}');
    } catch (e) {
      console.error("AI JSON parse failed", e);
      result = {}; // Fallback
    }

    // Structure fallback to prevent frontend crashes
    if (!result.courseName) result.courseName = "未命名课程";
    if (!result.lectureTitle) result.lectureTitle = "未命名主题";
    if (!Array.isArray(result.modules)) result.modules = [];

    const modules = result.modules as AiModule[];
    for (const mod of modules) {
      const conceptsUnknown = (mod as AiModule).concepts;
      const concepts = Array.isArray(conceptsUnknown) ? (conceptsUnknown as AiConcept[]) : [];

      for (const concept of concepts) {
        const name = normalizeTerm(concept.name);
        const description =
          typeof concept.description === 'string' ? concept.description : normalizeTerm(concept.description);
        const evidence = name ? extractQuoteEvidence(text, name) : null;

        if (evidence) {
          (concept as Record<string, unknown>).definition = {
            text: evidence.quote,
            source: 'pdf',
            sourceQuote: evidence.quote,
            sourceLocation: { start: evidence.start, end: evidence.end },
          };
        } else {
          (concept as Record<string, unknown>).definition = {
            text: description,
            source: 'ai',
          };
        }
      }

      (mod as Record<string, unknown>).concepts = concepts;
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('PDF processing failed:', error);
    return NextResponse.json(
      { success: false, message: `Failed to process PDF: ${error}` },
      { status: 500 }
    );
  }
}
