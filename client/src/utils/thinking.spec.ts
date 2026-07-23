import { ContentTypes } from 'librechat-data-provider';
import type { TMessageContentParts } from 'librechat-data-provider';
import { parseThinkingContent, normalizeThinkParts } from './thinking';

describe('parseThinkingContent', () => {
  describe(':::thinking::: directive format', () => {
    it('extracts thinking and regular content', () => {
      const result = parseThinkingContent(':::thinking\nsome reasoning\n:::\nActual response');
      expect(result.thinkingContent).toBe('some reasoning');
      expect(result.regularContent).toBe('Actual response');
    });

    it('returns empty thinking when no match', () => {
      const result = parseThinkingContent('No thinking here');
      expect(result.thinkingContent).toBe('');
      expect(result.regularContent).toBe('No thinking here');
    });
  });

  describe('<think> tag format', () => {
    it('extracts full thinking and response when both tags present', () => {
      const result = parseThinkingContent('<think>reasoning text</think>\n\nActual response');
      expect(result.thinkingContent).toBe('reasoning text');
      expect(result.regularContent).toBe('Actual response');
    });

    it('treats all content as thinking when </think> has not arrived mid-stream', () => {
      const result = parseThinkingContent('<think>partial reasoning...');
      expect(result.thinkingContent).toBe('partial reasoning...');
      expect(result.regularContent).toBe('');
    });

    it('handles empty response after </think>', () => {
      const result = parseThinkingContent('<think>reasoning</think>');
      expect(result.thinkingContent).toBe('reasoning');
      expect(result.regularContent).toBe('');
    });

    it('is case-insensitive for tag matching', () => {
      const result = parseThinkingContent('<THINK>reasoning</THINK>\n\nResponse');
      expect(result.thinkingContent).toBe('reasoning');
      expect(result.regularContent).toBe('Response');
    });

    it('trims whitespace from thinking and response', () => {
      const result = parseThinkingContent('<think>\n  reasoning content  \n</think>\n\n  response  ');
      expect(result.thinkingContent).toBe('reasoning content');
      expect(result.regularContent).toBe('response');
    });

    it('does not match <think> in the middle of text', () => {
      const text = 'Regular text <think>not at start</think>';
      const result = parseThinkingContent(text);
      expect(result.thinkingContent).toBe('');
      expect(result.regularContent).toBe(text);
    });

    it('handles multiline reasoning content', () => {
      const result = parseThinkingContent('<think>\nLine one\nLine two\n</think>\n\nThe answer');
      expect(result.thinkingContent).toBe('Line one\nLine two');
      expect(result.regularContent).toBe('The answer');
    });
  });

  describe('plain text', () => {
    it('returns original text for plain content', () => {
      const result = parseThinkingContent('Just a plain response');
      expect(result.thinkingContent).toBe('');
      expect(result.regularContent).toBe('Just a plain response');
    });

    it('handles empty string', () => {
      const result = parseThinkingContent('');
      expect(result.thinkingContent).toBe('');
      expect(result.regularContent).toBe('');
    });
  });
});

describe('normalizeThinkParts', () => {
  const think = (value: string): TMessageContentParts =>
    ({ type: ContentTypes.THINK, think: value }) as TMessageContentParts;
  const text = (value: string): TMessageContentParts =>
    ({ type: ContentTypes.TEXT, text: value }) as TMessageContentParts;
  const getThink = (part?: TMessageContentParts): string =>
    (part as { think: string } | undefined)?.think ?? '';
  const getText = (part?: TMessageContentParts): string =>
    (part as { text: string } | undefined)?.text ?? '';

  it('returns the same reference when no part carries think tags', () => {
    const content = [think('clean reasoning'), text('clean answer')];
    expect(normalizeThinkParts(content)).toBe(content);
  });

  it('returns undefined for undefined content', () => {
    expect(normalizeThinkParts(undefined)).toBeUndefined();
  });

  it('splits duplicated raw think/text parts into reasoning and response', () => {
    const raw = '<think>\nthe reasoning\n</think>\n\nthe answer';
    const result = normalizeThinkParts([think(raw), text(raw)]);
    expect(getThink(result?.[0])).toBe('the reasoning');
    expect(getText(result?.[1])).toBe('the answer');
  });

  it('strips a stray leading </think> from a text part', () => {
    const result = normalizeThinkParts([text('</think>\n\\ui{abc123}')]);
    expect(getText(result?.[0])).toBe('\\ui{abc123}');
  });

  it('converts a lone inline-think text part into think + text parts', () => {
    const result = normalizeThinkParts([text('<think>why</think>\n\nanswer')]);
    expect(result).toHaveLength(2);
    expect(result?.[0]?.type).toBe(ContentTypes.THINK);
    expect(getThink(result?.[0])).toBe('why');
    expect(getText(result?.[1])).toBe('answer');
  });

  it('keeps mid-stream unclosed think content in the think part only', () => {
    const raw = '<think>\npartial reasoning';
    const result = normalizeThinkParts([think(raw), text(raw)]);
    expect(getThink(result?.[0])).toBe('partial reasoning');
    expect(getText(result?.[1])).toBe('');
  });

  it('leaves non-think parts and clean parts untouched', () => {
    const toolCall = {
      type: ContentTypes.TOOL_CALL,
      tool_call: { id: 'call_1', name: 'do_thing', args: '{}' },
    } as unknown as TMessageContentParts;
    const raw = '<think>r</think>\n\nanswer';
    const result = normalizeThinkParts([toolCall, think(raw), text(raw)]);
    expect(result?.[0]).toBe(toolCall);
    expect(getThink(result?.[1])).toBe('r');
    expect(getText(result?.[2])).toBe('answer');
  });

  it('does not treat <think> mid-text as reasoning', () => {
    const content = [text('mention of <think> in prose')];
    expect(normalizeThinkParts(content)).toBe(content);
  });
});
