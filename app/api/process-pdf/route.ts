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
          content: `You are a course architect organizing lecture material into a clear knowledge tree for an English-language learning app.
All output must be in English, regardless of the language of the lecture. This applies to courseName, lectureTitle, every module title, every concept name, and every description. Translate non-English terms into standard English terminology while preserving course codes, API identifiers, formulas, and proper names.
1. Identify the course and the lecture topic.
2. Group the material into 3-5 meaningful core modules based on its structure and meaning. Use specific titles, not "Other" or "Miscellaneous". Preserve the meaning of the original headings.
3. Extract the atomic concepts, algorithms, and formulas taught in each module. Prefer the original English technical terms or their standard English translations; do not invent concepts.
4. For each concept, write a clear explanation of 2-4 connected English sentences grounded in the supplied lecture. Explain its meaning and relevant knowledge covered by the slides, such as its principles, purpose, use, relationships, or an example. Do not add claims that the lecture does not support. If the slides only mention a concept without explaining it, explicitly say that the lecture does not explain it in detail. Do not substitute a table of contents, a learning objective such as "To distinguish...", or disconnected quotations for an explanation.
Return only valid JSON with this structure:
{
  "courseName": "Course name in English",
  "lectureTitle": "Lecture topic in English",
  "modules": [{
    "title": "Module title in English",
    "concepts": [{
      "name": "Concept name in English",
      "description": "An explanation of 2-4 English sentences based on the lecture."
    }]
  }]
}`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      model: 'deepseek-flash',
      reasoning_effort: 'none',
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
    if (!result.courseName) result.courseName = "Untitled Course";
    if (!result.lectureTitle) result.lectureTitle = "Untitled Lecture";
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

        (concept as Record<string, unknown>).definition = {
          text: description,
          source: 'ai',
          ...(evidence ? {
            sourceQuote: evidence.quote,
            sourceLocation: { start: evidence.start, end: evidence.end },
          } : {}),
        };
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
