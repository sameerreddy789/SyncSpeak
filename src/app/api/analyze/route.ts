import { NextResponse } from 'next/server';
import { analyzeScript } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, title } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Script text is required' },
        { status: 400 }
      );
    }

    const analysis = await analyzeScript(text, title || 'Untitled Presentation');
    return NextResponse.json(analysis);
  } catch (error: any) {
    console.error('API Error /api/analyze:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze script' },
      { status: 500 }
    );
  }
}
