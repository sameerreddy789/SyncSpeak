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
    
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('too many requests') || msg.includes('429') || msg.includes('rate') || msg.includes('quota')) {
      return NextResponse.json(
        { error: 'The AI service is currently receiving too many requests. Please try again in a moment.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to analyze script' },
      { status: 500 }
    );
  }
}
