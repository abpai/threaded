import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message } from "../types";

// Initialize the API client
// Ideally, check if key exists, but per instructions we assume process.env.API_KEY is available
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_NAME = 'gemini-2.5-flash';

export const generateThreadResponse = async (
  context: string,
  fullDocument: string,
  history: Message[],
  newMessage: string
): Promise<string> => {
  
  try {
    let systemInstruction = '';

    if (context === 'Entire Document') {
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

    // Remove the last message from history if it matches the current message to avoid duplication
    // (Since the UI adds the message to the history state before calling this service)
    const historyForChat = [...history];
    const lastMsg = historyForChat[historyForChat.length - 1];
    
    if (lastMsg && lastMsg.role === 'user' && lastMsg.text === newMessage) {
        historyForChat.pop();
    }

    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction,
      },
      history: historyForChat.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }))
    });

    const result: GenerateContentResponse = await chat.sendMessage({
      message: newMessage
    });

    return result.text || "I couldn't generate a response.";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error while communicating with the AI.";
  }
};