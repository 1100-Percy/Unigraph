import { NextResponse } from 'next/server';
import OpenAI from 'openai';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParseModule = require('pdf-parse') as typeof import('pdf-parse');
const PDFParse = pdfParseModule.PDFParse;

// Force Node.js runtime to support pdf-parse
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
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
    if (!PDFParse) {
      throw new Error('pdf-parse library not loaded correctly');
    }

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

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('PDF processing failed:', error);
    return NextResponse.json(
      { success: false, message: `Failed to process PDF: ${error}` },
      { status: 500 }
    );
  }
}
