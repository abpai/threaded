import { GoogleGenAI } from "@google/genai";
import { Message, AppSettings } from "../types";

export const generateThreadResponse = async (
  context: string,
  fullDocument: string,
  history: Message[],
  newMessage: string,
  settings: AppSettings
): Promise<string> => {
  try {
    // 1. Construct the System Prompt
    let systemInstruction = '';
    const isGeneral = context === 'Entire Document';

    if (isGeneral) {
        systemInstruction = `You are a helpful reading assistant. 
        The user is reading a document and has some general questions about it.
        
        FULL DOCUMENT CONTENT:
        """
        ${fullDocument.substring(0, 30000)} ... (truncated if too long)
        """

        Answer the user's questions based on the document above. Be concise, insightful, and conversational.
        `;
    } else {
        systemInstruction = `You are a helpful reading assistant. 
        The user is reading a document and has highlighted a specific section to discuss with you.
        
        FULL DOCUMENT CONTEXT (Use for background knowledge only):
        """
        ${fullDocument.substring(0, 20000)} ... (truncated if too long)
        """

        SPECIFIC HIGHLIGHTED CONTEXT (Focus your answer on this):
        """
        ${context}
        """

        Answer the user's questions specifically about the highlighted context. Be concise, insightful, and conversational.
        `;
    }

    // 2. Prepare History
    // Filter out the last message if it's the same as the new one (UI optimism handling)
    const historyForChat = history.filter((msg, index) => {
        if (index === history.length - 1 && msg.role === 'user' && msg.text === newMessage) {
            return false;
        }
        return true;
    });

    // --- GOOGLE GEMINI ---
    if (settings.provider === 'google') {
        const ai = new GoogleGenAI({ apiKey: settings.apiKey });
        const model = ai.models.getGenerativeModel({ 
            model: settings.modelId || 'gemini-1.5-flash',
            systemInstruction
        });

        const chat = model.startChat({
            history: historyForChat.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }))
        });

        const result = await chat.sendMessage(newMessage);
        return result.response.text();
    }

    // --- OPENAI ---
    if (settings.provider === 'openai') {
        const messages = [
            { role: 'system', content: systemInstruction },
            ...historyForChat.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.text
            })),
            { role: 'user', content: newMessage }
        ];

        const response = await fetch(`${settings.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: settings.modelId || 'gpt-4o',
                messages: messages
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'OpenAI API Error');
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "No response content.";
    }

    // --- ANTHROPIC ---
    if (settings.provider === 'anthropic') {
        // Note: Anthropic calls from browser often require a proxy due to CORS. 
        // We will attempt a direct call, but this may fail depending on browser policies and Anthropic settings.
        const messages = [
            ...historyForChat.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.text
            })),
            { role: 'user', content: newMessage }
        ];

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': settings.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
                'anthropic-dangerous-direct-browser-access': 'true' // Required for browser calls
            },
            body: JSON.stringify({
                model: settings.modelId || 'claude-3-haiku-20240307',
                max_tokens: 1024,
                system: systemInstruction,
                messages: messages
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Anthropic API Error');
        }

        const data = await response.json();
        return data.content[0]?.text || "No response content.";
    }

    return "Provider not supported.";

  } catch (error) {
    console.error("AI Service Error:", error);
    if (error instanceof Error) {
        return `Error: ${error.message}`;
    }
    return "Sorry, I encountered an error while communicating with the AI.";
  }
};
