import { useEffect } from 'react';
import type { RefObject } from 'react';
import { UI_SIZE_CHANGE_MESSAGE } from '~/utils/mcpApps';

type UISizeMessage = {
  type?: string;
  payload?: { height?: number; width?: number };
};

/**
 * Listens for mcp-ui `ui-size-change` messages posted from a raw `ui://` HTML iframe and
 * reports the content height, so the host can grow the frame instead of clipping it.
 */
export default function useUISizeMessage(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  onHeightChange: (height: number) => void,
) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) {
        return;
      }
      const data = event.data as UISizeMessage | undefined;
      if (data?.type !== UI_SIZE_CHANGE_MESSAGE) {
        return;
      }
      const height = data.payload?.height;
      if (typeof height === 'number' && height > 0) {
        onHeightChange(height);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeRef, onHeightChange]);
}
