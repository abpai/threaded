# Welcome to Threaded

## The Problem with Linear Chat

Turn-by-turn chat interfaces fundamentally limit how we work with AI. Real planning, learning, and decision-making isn't linear—it requires exploring multiple paths, comparing options, and revising conclusions. Standard chat forces you into a single timeline where context gets buried and alternative approaches are lost.

Think about how you actually think. When you're learning something new, do you follow one straight path? No. You branch off into tangents. You wonder "but what about...?" You circle back to earlier ideas with new understanding. You hold multiple possibilities in your mind simultaneously.

Traditional AI chat makes this impossible. Every message marches forward in a single file. Want to explore an alternative? You either lose your current thread or start an entirely new conversation, orphaning all that context.

## The Solution: Threaded

**Threaded** treats conversations as explorable graphs, not linear threads. Branch discussions at any point. Explore tangents without losing your place. Keep multiple lines of inquiry alive simultaneously.

This is how humans actually think—and how AI collaboration should work.

![Start View - Where every journey begins](/guide-start-view.jpg)

---

## Getting Started

### Load Your Content

Threaded works with any text-based content. You have three ways to get started:

**Paste directly** — Copy markdown, plain text, or any content and paste it into the text area. Great for quick explorations of articles, documentation, or your own writing.

**Upload a file** — Drag and drop or click to upload. Threaded handles:

- Markdown (`.md`) and plain text (`.txt`)
- PDFs (`.pdf`)
- Word documents (`.docx`)
- Spreadsheets (`.xlsx`, `.csv`)

**Fetch from URL** — Paste a link and Threaded will extract the content. Perfect for diving deep into online articles or documentation.

Once your content is loaded, you'll see it beautifully rendered in a clean reading view. But this is where the magic begins...

![Reading View - Your document, ready for exploration](/guide-reading-view.jpg)

---

## The Core Loop: Select → Discuss → Learn

Here's where Threaded diverges from everything else.

### Highlight Any Text

See something interesting? Confusing? Worth exploring further? Just highlight it. A small tooltip appears with your options:

![Selection Tooltip - Your gateway to deeper understanding](/guide-selection-tooltip.jpg)

### Your Options

**Discuss** — Opens a new thread about that specific passage. The AI knows both the full document context AND that you're focused on this particular section. Ask follow-up questions, challenge assumptions, explore implications.

**Explain** — Sometimes you just need clarity. This automatically asks the AI to explain the highlighted section in simple terms. One click, instant understanding.

**Save** — Bookmark important passages for later. Build a collection of key quotes as you read.

**Copy** — Just copies the text. Sometimes the classics are all you need.

### Try It Right Now

Go ahead—highlight the sentence below and click "Explain":

> _The epistemological implications of distributed cognition suggest that knowledge isn't merely stored but actively constructed through interactions between agents and their environment._

See? You just created your first thread. The AI response appears in the sidebar, and you can continue that conversation as deep as you want to go.

---

## Branching: The Real Power

Here's where it gets interesting. You're not limited to one thread.

Highlight another passage. Create another thread. Now you have two parallel conversations, each with its own context and history. Create a third. A fourth. Each thread remembers exactly what text spawned it and maintains its own conversation history.

![Thread Panel - Deep dive into any topic](/guide-thread-panel.jpg)

### The Thread List

Click the threads button in the header to see all your active discussions. They're sorted by most recent activity, so your current train of thought stays at the top.

![Thread List - All your explorations at a glance](/guide-thread-list.jpg)

Each thread shows:

- The text that started it (or "General Discussion" for document-wide questions)
- A preview of the last message
- How long ago it was active

Click any thread to jump back into that conversation. Your context is preserved. Your train of thought continues.

### General Discussion

What if you have a question about the whole document, not a specific section? Use the floating input at the bottom of the reading view. Type your question and hit enter—it creates a thread about the entire document.

---

## Save the Good Stuff

As you read and discuss, you'll encounter passages worth remembering. Click **Save** in the tooltip to bookmark any highlight.

![Quotes View - Your curated collection](/guide-quotes-view.jpg)

Access your saved quotes anytime via the bookmark icon in the header. Each quote shows when you saved it, and you can delete ones you no longer need.

When you export your session, all your saved quotes come with it—perfect for research, note-taking, or building a personal knowledge base.

---

## Configure Your AI

Threaded works with multiple AI providers. Open settings with `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux).

![Settings - Choose your AI companion](/guide-settings.jpg)

### Supported Providers

**Google Gemini** — Fast and capable, great for most use cases.

**OpenAI** — GPT-4 and friends. You know the drill.

**Anthropic Claude** — If you're reading this, you might appreciate the meta irony.

**Ollama** — Run models locally. Private, fast, free after setup. Perfect for sensitive content or offline work.

### Setting Up

1. Choose your provider
2. Enter your API key (stored locally in your browser—never sent anywhere)
3. Select a model from the dropdown
4. Start threading

For Ollama users: run `OLLAMA_ORIGINS=* ollama serve` to enable browser access.

---

## Dark Mode

Your eyes will thank you. Toggle dark mode with the sun/moon icon in the header. Your preference persists across sessions.

---

## Share and Export

### Share Your Session

Click the share icon to generate a link. Anyone with the link can view your document and threads (read-only). Perfect for:

- Sharing annotated research with colleagues
- Showing your analysis process
- Collaborative document review

### Export Everything

The three-dot menu (⋮) → Export downloads a markdown file containing:

- Your original document
- All saved quotes
- Every thread with full conversation history

Take your work anywhere. Nothing is locked in. You can attach the exported file to any LLM to bootstrap a new conversation with all your context, quotes, and discussion history already in place.

---

## Pro Tips

### Keyboard Shortcuts

| Shortcut       | Action                   |
| -------------- | ------------------------ |
| `Cmd/Ctrl + K` | Open Settings            |
| `Escape`       | Close tooltip or sidebar |

### Session History

Click the history icon in the header to view your session history. Previous documents you've explored are just a click away. Each session preserves all its threads and quotes.

### The Meta Moment

You're reading this guide in Threaded right now. Which means...

1. You can highlight any confusing part of this guide and ask for clarification
2. You can create threads discussing features as you read about them
3. You can save quotes from this guide for reference
4. You can export this entire session with your notes

Go ahead. Try highlighting "The Meta Moment" above and clicking Discuss. Ask the AI what makes this approach different from traditional documentation.

---

## Philosophy

Threaded isn't trying to be another chat interface. It's a thinking tool.

Reading is active, not passive. Understanding comes from questioning, connecting, and exploring. Traditional chat treats AI as an oracle to query. Threaded treats AI as a thinking partner to explore with.

Every highlight is a potential branch point. Every thread is a line of inquiry. Your document becomes a map of your understanding—complete with the paths you took to get there.

---

## Start Exploring

You've got the basics. Now make it yours.

Load something you're trying to understand—documentation, a research paper, a complex email chain, your own draft that needs refinement. Start highlighting. Start asking. Let your curiosity branch.

The best way to learn Threaded is to use Threaded. And if you get stuck?

Well, you know what to do. Just highlight it.

---

_Built for humans who think in branches, not lines._
