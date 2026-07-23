import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';

const THINK_OPEN_TAG = '<think>';
const THINK_CLOSE_TAG = '</think>';

type MessageContentList = Array<TMessageContentParts | undefined>;

const getPartString = (value: string | { value?: string } | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }
  return value?.value ?? '';
};

const extractThinkInner = (raw: string): string => {
  const lower = raw.toLowerCase();
  const start = lower.startsWith(THINK_OPEN_TAG) ? THINK_OPEN_TAG.length : 0;
  const close = lower.indexOf(THINK_CLOSE_TAG, start);
  return raw.slice(start, close === -1 ? raw.length : close).trim();
};

/**
 * Normalizes content parts polluted by inline `<think>` tags from providers that embed
 * reasoning in the content stream (MiniMax, QwQ). Handles the stream-parser failure modes
 * of upstream #13360:
 * - `think` parts carrying raw tags (and sometimes the visible response after `</think>`)
 * - `text` parts duplicating the full raw string, tags included
 * - stray leading `</think>` deltas on thinking→text transitions
 *
 * Returns the original array untouched (same reference) when no part carries think tags.
 */
export function normalizeThinkParts(
  content: MessageContentList | undefined,
): MessageContentList | undefined {
  if (!content) {
    return content;
  }

  let needsNormalization = false;
  let hasThinkPart = false;
  for (const part of content) {
    if (!part) {
      continue;
    }
    if (part.type === ContentTypes.THINK) {
      hasThinkPart = true;
      const lower = getPartString(part.think).toLowerCase();
      needsNormalization =
        needsNormalization || lower.includes(THINK_OPEN_TAG) || lower.includes(THINK_CLOSE_TAG);
    } else if (part.type === ContentTypes.TEXT) {
      const lower = getPartString(part.text).toLowerCase();
      needsNormalization =
        needsNormalization || lower.startsWith(THINK_OPEN_TAG) || lower.startsWith(THINK_CLOSE_TAG);
    }
  }
  if (!needsNormalization) {
    return content;
  }

  const result: MessageContentList = [];
  for (const part of content) {
    if (!part) {
      result.push(part);
      continue;
    }
    if (part.type === ContentTypes.THINK) {
      const raw = getPartString(part.think);
      result.push({ ...part, think: extractThinkInner(raw) });
      continue;
    }
    if (part.type !== ContentTypes.TEXT) {
      result.push(part);
      continue;
    }
    const raw = getPartString(part.text);
    const lower = raw.toLowerCase();
    if (lower.startsWith(THINK_CLOSE_TAG)) {
      result.push({ ...part, text: raw.slice(THINK_CLOSE_TAG.length).trimStart() });
      continue;
    }
    if (!lower.startsWith(THINK_OPEN_TAG)) {
      result.push(part);
      continue;
    }
    const closeIndex = lower.indexOf(THINK_CLOSE_TAG);
    const remainder =
      closeIndex === -1 ? '' : raw.slice(closeIndex + THINK_CLOSE_TAG.length).trimStart();
    if (!hasThinkPart) {
      result.push({ type: ContentTypes.THINK, think: extractThinkInner(raw) });
    }
    result.push({ ...part, text: remainder });
  }
  return result;
}

/**
 * Parses thinking/reasoning content embedded in message text.
 *
 * Supports two formats:
 * - `:::thinking\ncontent\n:::` — directive format used for `reasoning_content` streams
 * - `<think>content</think>` — inline tag format emitted by models like MiniMax and QwQ
 *
 * During streaming, if `</think>` has not yet arrived, all text after `<think>`
 * is returned as `thinkingContent` with an empty `regularContent`.
 */
export const parseThinkingContent = (
  text: string,
): { thinkingContent: string; regularContent: string } => {
  const directiveMatch = text.match(/:::thinking([\s\S]*?):::/);
  if (directiveMatch) {
    return {
      thinkingContent: directiveMatch[1].trim(),
      regularContent: text.replace(/:::thinking[\s\S]*?:::/, '').trim(),
    };
  }

  if (!text.slice(0, THINK_OPEN_TAG.length).toLowerCase().startsWith(THINK_OPEN_TAG)) {
    return { thinkingContent: '', regularContent: text };
  }

  const afterOpen = text.slice(THINK_OPEN_TAG.length);
  const closeIndex = afterOpen.toLowerCase().indexOf(THINK_CLOSE_TAG);
  if (closeIndex === -1) {
    return { thinkingContent: afterOpen, regularContent: '' };
  }

  return {
    thinkingContent: afterOpen.slice(0, closeIndex).trim(),
    regularContent: afterOpen.slice(closeIndex + THINK_CLOSE_TAG.length).trim(),
  };
};
