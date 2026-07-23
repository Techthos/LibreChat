const THINK_OPEN_TAG = '<think>';
const THINK_CLOSE_TAG = '</think>';

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
