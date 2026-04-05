# auto-commit

`auto-commit` generates Conventional Commit messages from staged git changes using Gemma 4 31B through the Gemini API.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file from the example and add your Gemini API key:

   ```bash
   cp .env.example .env
   ```

   ```dotenv
   GEMINI_API_KEY=your-gemini-api-key
   ```

That is the only required `.env` value.

## Usage

Build the CLI:

```bash
npm run build
```

Generate a commit message without committing:

```bash
node dist/cli.js generate --cwd /path/to/git/repo
```

Generate a message and create the commit from already staged changes:

```bash
node dist/cli.js commit --cwd /path/to/git/repo
```

Stage everything first, then generate and commit:

```bash
node dist/cli.js commit --cwd /path/to/git/repo --add
```

During development you can run the TypeScript entrypoint directly:

```bash
npm run start -- generate --cwd /path/to/git/repo
```

## Conventional Commit Enforcement

The model does not emit raw commit text directly. Instead, the CLI sends the full Conventional Commits 1.0.0 specification to Gemini verbatim, requests structured JSON, validates the payload locally, and formats the final message itself. That keeps generated messages aligned with the specification’s structure:

```text
<type>[optional scope]: <description>

[optional body]
[optional footer(s)]
```

Breaking changes may be rendered with `!`, with a `BREAKING CHANGE:` footer, or with both, as allowed by the specification. The staged diff is passed through without truncation; if the repository state exceeds model or transport limits, the CLI fails instead of silently shortening the input.

## Development

Run the test suite:

```bash
npm test
```

Run the type-check:

```bash
npm run check
```
