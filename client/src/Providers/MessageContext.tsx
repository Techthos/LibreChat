import { createContext, useContext } from 'react';

type MessageContext = {
  messageId: string;
  nextType?: string;
  partIndex?: number;
  isExpanded: boolean;
  conversationId?: string | null;
  /** Submission state for cursor display - only true for latest message when submitting */
  isSubmitting?: boolean;
  /** Whether this is the latest message in the conversation */
  isLatestMessage?: boolean;
  /**
   * Resource ids the assistant placed inline via `\ui{...}` markers in this message's text.
   * The tool-call render skips these so a marker-referenced widget is not drawn twice.
   */
  markerResourceIds?: ReadonlySet<string>;
};

export const MessageContext = createContext<MessageContext>({} as MessageContext);
export const useMessageContext = () => useContext(MessageContext);
