import { NextResponse } from 'next/server';
import { getRecoverySuggestion } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { currentChunkText, surroundingContext, spokenText } = body;

    if (!currentChunkText || !spokenText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const suggestion = await getRecoverySuggestion(
      currentChunkText,
      surroundingContext || '',
      spokenText
    );
    
    return NextResponse.json(suggestion);
  } catch (error: any) {
    console.error('API Error /api/recovery:', error);
    const msg = error.message?.toLowerCase() || '';
    if (msg.includes('too many requests') || msg.includes('429') || msg.includes('rate') || msg.includes('quota')) {
      return NextResponse.json(
        { error: 'The AI service is currently receiving too many requests.' },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to generate recovery suggestion' },
      { status: 500 }
    );
  }
}
