# ReadAloud

ReadAloud turns a public article URL into a polished audio-first learning session.

The current v1 flow is:

1. Paste a public article URL
2. Firecrawl scrapes and cleans the main content
3. The configured LLM splits the article into chunks
4. Each chunk becomes:
   narration
   a 2-sentence recap
   a short quiz-style reflection prompt
5. OpenAI text-to-speech generates spoken audio
6. The listener can pause and ask questions at any time
7. The experience ends with a final summary and ongoing conversation mode

## What You Need To Provide

You only need three things to run the app:

1. A Firecrawl API key
2. An OpenAI API key
3. One LLM provider key:
   `GEMINI_API_KEY` or `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

## Setup

Create a `.env.local` file in the project root:

```bash
LLM_PROVIDER=gemini

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514

OPENAI_API_KEY=
OPENAI_LLM_MODEL=gpt-4o-mini
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=nova

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

FIRECRAWL_API_KEY=
```

## Run Locally

Install dependencies with your preferred package manager, then start the app:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

If your machine does not already have a normal Node.js install, use the current Node.js LTS release from [nodejs.org](https://nodejs.org/en/download/current).

## Architecture

### Frontend

- `app/page.tsx`
  The main reading experience and playback coordinator.
- `components/*`
  Input, player, and chat UI pieces.
- `hooks/useAudioPlayer.ts`
  Handles browser audio playback and object-URL caching.

### Backend Routes

- `app/api/scrape/route.ts`
  Scrapes the article with Firecrawl.
- `app/api/chunk/route.ts`
  Splits the article into coherent listening chunks.
- `app/api/process-chunk/route.ts`
  Produces narration, recap, and a spoken quiz prompt for each chunk.
- `app/api/tts/route.ts`
  Converts text into speech with OpenAI TTS.
- `app/api/final-summary/route.ts`
  Produces the final article wrap-up.
- `app/api/chat/route.ts`
  Powers the post-article conversation mode.

### Shared Libraries

- `lib/firecrawl.ts`
  Firecrawl integration.
- `lib/article-chunker.ts`
  Deterministic local article chunking for reliability.
- `lib/async.ts`
  Concurrency helpers for safer chunk processing.
- `lib/llm.ts`
  Provider abstraction for Claude, OpenAI, and Gemini.
- `lib/prompts.ts`
  System prompts for chunking, processing, final summary, and chat.
- `lib/json.ts`
  Cleans and retries JSON model outputs.

## Important Product Decisions In This Build

- v1 supports public articles only.
- v1 uses a lightweight spoken quiz prompt instead of a visible quiz form.
- TTS uses `gpt-4o-mini-tts` because it supports voice instructions.
- Audio is prefetched progressively instead of generating every chunk upfront.
- Article chunking is local instead of LLM-driven to reduce prep failures.
- Chunk processing is concurrency-limited instead of firing all requests at once.
- Chat supports typed questions plus browser voice-note transcription.

## Cost Logic

- One default LLM does not automatically reduce cost by itself.
- What reduces cost is doing fewer and smaller model calls.
- This build is cost-aware because it:
  chunks locally first
  processes chunks separately
  limits concurrent model calls
  generates speech progressively

## Voice Roadmap

You asked whether voice conversation needs a separate voice-agent provider like ElevenLabs.

Short answer: no, not for v1.

You have two realistic options later:

1. Lower-complexity approach:
   browser speech recognition + text LLM + TTS
   This is the path used in the current app for voice-note capture.

2. Real voice-agent approach:
   OpenAI Realtime or a provider like ElevenLabs
   This gives lower latency and more natural back-and-forth conversation.

For this app, typed chat in v1 and voice chat in v2 is the most sensible path.
