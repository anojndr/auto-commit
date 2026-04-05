const HEADER_PATTERN = /^(?<type>[A-Za-z][A-Za-z0-9-]*)(?:\((?<scope>[^()\r\n:]+)\))?(?<breaking>!)?: (?<description>[^\r\n]+)$/;
const FOOTER_START_PATTERN =
  /^(?<token>BREAKING CHANGE|BREAKING-CHANGE|[A-Za-z][A-Za-z0-9-]*)(?<separator>: | #)(?<value>.+)$/;
const TYPE_PATTERN = /^[A-Za-z][A-Za-z0-9-]*$/;
const SCOPE_PATTERN = /^[^()\r\n:]+$/;
const FOOTER_TOKEN_PATTERN = /^(BREAKING CHANGE|BREAKING-CHANGE|[A-Za-z][A-Za-z0-9-]*)$/;

export interface CommitFooter {
  token: string;
  value: string;
}

export interface CommitDraft {
  type: string;
  scope?: string | null;
  description: string;
  breaking?: boolean | null;
  body?: string | null;
  footers?: CommitFooter[] | null;
  breakingChange?: string | null;
}

interface ParsedFooterStart {
  token: string;
  value: string;
}

function normalizeLineEndings(value: string): string {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function normalizeOptionalText(value?: string | null): string | undefined {
  if (value == null) {
    return undefined;
  }

  const normalized = normalizeLineEndings(value).trim();

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeType(type: string): string {
  const normalized = type.trim();

  if (!TYPE_PATTERN.test(normalized)) {
    throw new Error(`Invalid Conventional Commit type: "${type}".`);
  }

  return normalized;
}

function normalizeScope(scope?: string | null): string | undefined {
  const normalized = normalizeOptionalText(scope);

  if (!normalized) {
    return undefined;
  }

  if (!SCOPE_PATTERN.test(normalized)) {
    throw new Error(`Invalid Conventional Commit scope: "${scope}".`);
  }

  return normalized;
}

function normalizeDescription(description: string): string {
  const normalized = normalizeLineEndings(description).trim();

  if (!normalized || normalized.includes("\n")) {
    throw new Error("Commit description must be a single non-empty line.");
  }

  return normalized;
}

function canonicalizeFooterToken(token: string): string {
  return token === "BREAKING-CHANGE" ? "BREAKING CHANGE" : token;
}

function normalizeFooter(footer: CommitFooter): CommitFooter {
  const token = normalizeLineEndings(footer.token).trim();
  const value = normalizeLineEndings(footer.value).trim();

  if (!FOOTER_TOKEN_PATTERN.test(token)) {
    throw new Error(`Invalid footer token: "${footer.token}".`);
  }

  if (!value) {
    throw new Error(`Invalid footer value for token "${footer.token}".`);
  }

  return {
    token: canonicalizeFooterToken(token),
    value,
  };
}

function parseFooterStartLine(line: string): ParsedFooterStart | null {
  const match = FOOTER_START_PATTERN.exec(line);

  if (!match?.groups) {
    return null;
  }

  const token = match.groups.token;
  const value = match.groups.value;

  if (!token || value == null) {
    return null;
  }

  return {
    token: canonicalizeFooterToken(token),
    value,
  };
}

function parseFooterSection(lines: string[]): CommitFooter[] | null {
  if (lines.length === 0) {
    return null;
  }

  const footers: CommitFooter[] = [];
  let index = 0;

  while (index < lines.length) {
    const currentLine = lines[index];

    if (currentLine == null) {
      return null;
    }

    const footerStart = parseFooterStartLine(currentLine);

    if (!footerStart) {
      return null;
    }

    const valueLines = [footerStart.value];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index];

      if (nextLine == null) {
        return null;
      }

      const nextFooterStart = parseFooterStartLine(nextLine);

      if (nextFooterStart) {
        break;
      }

      valueLines.push(nextLine);
      index += 1;
    }

    const value = valueLines.join("\n");

    if (!value) {
      return null;
    }

    footers.push({
      token: footerStart.token,
      value,
    });
  }

  return footers;
}

function findFooterStartIndex(contentLines: string[]): number | null {
  for (let index = 0; index < contentLines.length; index += 1) {
    const currentLine = contentLines[index];

    if (currentLine == null || !parseFooterStartLine(currentLine)) {
      continue;
    }

    if (index === 0) {
      return parseFooterSection(contentLines) ? 0 : null;
    }

    if (contentLines[index - 1] !== "") {
      continue;
    }

    if (index === 1 || contentLines[index - 2] === "") {
      continue;
    }

    if (!contentLines.slice(0, index - 1).some((line) => line !== "")) {
      continue;
    }

    if (parseFooterSection(contentLines.slice(index))) {
      return index;
    }
  }

  return null;
}

export function formatConventionalCommit(draft: CommitDraft): string {
  const type = normalizeType(draft.type);
  const scope = normalizeScope(draft.scope);
  const description = normalizeDescription(draft.description);
  const breaking = draft.breaking === true;
  const body = normalizeOptionalText(draft.body);
  const explicitBreakingChange = normalizeOptionalText(draft.breakingChange);
  const normalizedFooters = (draft.footers ?? []).map(normalizeFooter);
  const breakingFooters = normalizedFooters.filter((footer) => footer.token === "BREAKING CHANGE");
  const footers = normalizedFooters.filter((footer) => footer.token !== "BREAKING CHANGE");

  if (breakingFooters.length > 1) {
    throw new Error("Only one BREAKING CHANGE footer may be provided.");
  }

  if (explicitBreakingChange && breakingFooters.length > 0) {
    throw new Error("Provide BREAKING CHANGE details either via breakingChange or a BREAKING CHANGE footer, not both.");
  }

  const breakingChange = explicitBreakingChange ?? breakingFooters[0]?.value;
  const header = `${type}${scope ? `(${scope})` : ""}${breaking ? "!" : ""}: ${description}`;
  const sections = [header];

  if (body) {
    sections.push(body);
  }

  const renderedFooters = [
    ...(breakingChange ? [{ token: "BREAKING CHANGE", value: breakingChange }] : []),
    ...footers,
  ].map((footer) => `${footer.token}: ${footer.value}`);

  if (renderedFooters.length > 0) {
    sections.push(renderedFooters.join("\n"));
  }

  const message = sections.join("\n\n");

  if (!isConventionalCommitMessage(message)) {
    throw new Error("Generated commit message did not satisfy Conventional Commits formatting.");
  }

  return message;
}

export function isConventionalCommitMessage(message: string): boolean {
  const normalized = normalizeLineEndings(message).trimEnd();

  if (!normalized) {
    return false;
  }

  const [header = "", ...remainingLines] = normalized.split("\n");

  if (!HEADER_PATTERN.test(header)) {
    return false;
  }

  if (remainingLines.length === 0) {
    return true;
  }

  if (remainingLines[0] !== "") {
    return false;
  }

  const contentLines = remainingLines.slice(1);

  if (contentLines.length === 0) {
    return true;
  }

  if (contentLines[0] === "") {
    return false;
  }

  const footerStart = findFooterStartIndex(contentLines);

  if (footerStart === null) {
    return true;
  }

  return parseFooterSection(contentLines.slice(footerStart)) !== null;
}
