// A scripted OpenAI Responses API for driving a real `codex app-server` without a login or
// tokens. The model always runs one command, then answers with what the command printed.
import { createServer, type Server } from 'node:http'

type Json = Record<string, unknown>
const usage = {
  input_tokens: 1,
  input_tokens_details: null,
  output_tokens: 1,
  output_tokens_details: null,
  total_tokens: 2,
}

function commandFor(question: string) {
  if (question.includes('write')) return 'touch written-by-agent.txt'
  if (question.includes('slow')) return 'sleep 30'
  return 'cat notes.md'
}

export function startFakeResponses(): Promise<{ server: Server; url: string }> {
  let count = 0
  const server = createServer((request, response) => {
    let body = ''
    request.on('data', chunk => (body += chunk))
    request.on('end', () => {
      const n = ++count
      const input = ((JSON.parse(body || '{}') as Json).input ?? []) as Json[]
      const output = input.filter(item => item.type === 'function_call_output').at(-1)
      const question = String(
        ((input.filter(item => item.role === 'user').at(-1)?.content as Json[])?.[0] as Json)
          ?.text ?? ''
      )
      const text = output ? `Command output: ${String(output.output)}` : ''
      const events: Json[] = output
        ? [
            {
              type: 'response.output_item.added',
              item: { type: 'message', role: 'assistant', id: `m${n}`, content: [] },
            },
            { type: 'response.output_text.delta', item_id: `m${n}`, content_index: 0, delta: text },
            {
              type: 'response.output_item.done',
              item: {
                type: 'message',
                role: 'assistant',
                id: `m${n}`,
                content: [{ type: 'output_text', text }],
              },
            },
          ]
        : [
            {
              type: 'response.output_item.done',
              item: {
                type: 'function_call',
                id: `f${n}`,
                call_id: `c${n}`,
                name: 'exec_command',
                arguments: JSON.stringify({ cmd: commandFor(question) }),
              },
            },
          ]
      response.writeHead(200, { 'Content-Type': 'text/event-stream' })
      for (const event of [
        { type: 'response.created', response: { id: `r${n}` } },
        ...events,
        { type: 'response.completed', response: { id: `r${n}`, usage } },
      ])
        response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      response.end()
    })
  })
  return new Promise(resolve =>
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({ server, url: `http://127.0.0.1:${port}/v1` })
    })
  )
}
