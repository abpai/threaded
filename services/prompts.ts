import dedent from 'dedent'

export interface PromptContext {
  fullDocument: string
  highlightedContext?: string
  maxDocumentLength?: number
}

const MAX_DOCUMENT_LENGTH = 30000

function truncate(text: string, maxLength: number = MAX_DOCUMENT_LENGTH): string {
  if (text.length <= maxLength) return text
  return `${text.substring(0, maxLength)}... (truncated)`
}

export const PROMPTS = {
  general: (ctx: PromptContext) => dedent`
    You are a helpful reading assistant.
    The user is reading a document and has some general questions about it.

    FULL DOCUMENT CONTENT:
    """
    ${truncate(ctx.fullDocument, ctx.maxDocumentLength)}
    """

    Answer the user's questions based on the document above.
    Be concise, insightful, and conversational.
  `,

  discuss: (ctx: PromptContext) => dedent`
    You are a helpful reading assistant.
    The user is reading a document and has highlighted a specific section to discuss.

    FULL DOCUMENT CONTEXT (Use for background knowledge only):
    """
    ${truncate(ctx.fullDocument, ctx.maxDocumentLength)}
    """

    SPECIFIC HIGHLIGHTED CONTEXT (Focus your answer on this):
    """
    ${ctx.highlightedContext || ''}
    """

    Answer the user's questions specifically about the highlighted context.
    Be concise, insightful, and conversational.
  `,

  explain: (ctx: PromptContext) => dedent`
    You are a helpful reading assistant.
    The user is reading a document and has highlighted a specific section they want explained.

    FULL DOCUMENT CONTEXT (Use for background knowledge only):
    """
    ${truncate(ctx.fullDocument, ctx.maxDocumentLength)}
    """

    SPECIFIC HIGHLIGHTED CONTEXT (Focus your explanation on this):
    """
    ${ctx.highlightedContext || ''}
    """

    Your task is to EXPLAIN this highlighted section clearly and accessibly:
    - Break down complex ideas into simple parts
    - Use analogies and examples where helpful
    - Define any jargon or technical terms
    - Be concise but thorough
  `,
}

export function getSummaryPrompt(document: string): string {
  return dedent`
    Summarize this document in one sentence (max 80 characters).
    Focus on the main topic or purpose. Output ONLY the summary, no preamble.

    Document:
    """
    ${truncate(document, 3000)}
    """
  `
}

export type PromptMode = 'discuss' | 'explain'

export function getSystemPrompt(context: string, fullDocument: string, mode: PromptMode): string {
  const isGeneral = context === 'Entire Document'

  if (isGeneral) {
    return PROMPTS.general({ fullDocument })
  }

  const promptContext: PromptContext = {
    fullDocument,
    highlightedContext: context,
  }

  return PROMPTS[mode](promptContext)
}
