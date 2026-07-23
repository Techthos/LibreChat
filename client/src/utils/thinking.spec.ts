import { parseThinkingContent } from './thinking';

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
