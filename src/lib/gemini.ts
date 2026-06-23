import { GoogleGenAI } from '@google/genai';
import { ScriptAnalysis, RecoveryInfo, CoachingNote } from '@/types';
import { GEMINI_PROMPTS } from './constants';
import { generateId as utilsGenerateId } from './utils';

// We initialize the client if API key exists. If not, we'll throw when called.
// This allows the app to build even without an API key initially.
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export async function analyzeScript(scriptText: string, title: string): Promise<ScriptAnalysis> {
  if (!ai) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  try {
    const prompt = GEMINI_PROMPTS.analysisPrompt.replace('{{SCRIPT_TEXT}}', scriptText);
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction: GEMINI_PROMPTS.systemPrompt,
        temperature: 0.2,
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from AI');
    }

    // Parse the JSON. We assume Gemini followed our JSON schema instructions
    const result = JSON.parse(text);
    
    // Assign IDs to chunks
    const chunksWithIds = result.chunks.map((chunk: any) => ({
      ...chunk,
      id: utilsGenerateId()
    }));

    return {
      id: utilsGenerateId(),
      title,
      originalText: scriptText,
      chunks: chunksWithIds,
      totalEstimatedDuration: chunksWithIds.reduce((sum: number, c: any) => sum + (c.estimatedDuration || 0), 0),
      createdAt: new Date(),
      topicHierarchy: result.topicHierarchy || [],
      coachingNotes: result.coachingNotes || []
    };
  } catch (error: any) {
    console.error('Error analyzing script:', error);
    throw new Error(error.message || 'Failed to analyze script with AI');
  }
}

export async function getRecoverySuggestion(
  currentChunkText: string,
  surroundingContext: string,
  spokenText: string
): Promise<RecoveryInfo> {
  if (!ai) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  try {
    let prompt = GEMINI_PROMPTS.recoveryPrompt
      .replace('{{CURRENT_CHUNK}}', currentChunkText)
      .replace('{{SURROUNDING_CONTEXT}}', surroundingContext)
      .replace('{{SPOKEN_TEXT}}', spokenText);

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        systemInstruction: GEMINI_PROMPTS.systemPrompt,
        temperature: 0.4,
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) return { currentTopic: 'Unknown', keywords: [], nextPoint: '', suggestedText: 'Just keep going.' };

    return JSON.parse(text);
  } catch (error) {
    console.error('Error getting recovery info:', error);
    return {
      currentTopic: 'Connection Lost',
      keywords: [],
      nextPoint: 'Resume from your last remembered point',
      suggestedText: 'Take a breath and continue when ready.'
    };
  }
}
