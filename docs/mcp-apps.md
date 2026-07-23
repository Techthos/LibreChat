# MCP Apps host support

LibreChat implements the **MCP Apps** extension (`io.modelcontextprotocol/ui`, spec version
`2026-01-26`) as a host: MCP servers may embed self-contained interactive HTML widgets in
their tool results, and LibreChat renders them inline in the assistant turn and wires their
interactions back through the standard **App Bridge**
(`@modelcontextprotocol/ext-apps`). This document states what of the standard is
implemented, so a server author knows what they can rely on.

Spec references: <https://modelcontextprotocol.io/extensions/apps/overview> and
<https://github.com/modelcontextprotocol/ext-apps>.

## What identifies a renderable widget

A tool-result content block of `type: "resource"` whose resource carries:

- a `ui://` URI, and
- `mimeType: "text/html;profile=mcp-app"` (the constant `RESOURCE_MIME_TYPE` in
  `packages/api/src/mcp/apps.ts`).

The `profile=mcp-app` token is the sole discriminator. A `ui://` resource with a plain
`text/html` mime type is not an App: it renders as a static, script-less `srcDoc` iframe with
no bridge, and none of the guarantees below apply to it.

The parser (`packages/api/src/mcp/parsers.ts`) classifies server-side and the client
(`isMcpAppResource` in `client/src/utils/mcpApps.ts`) classifies identically, so the App
Bridge payload is only ever attached to genuine app-profile resources.

## Capability advertisement

LibreChat advertises the extension to every MCP server at initialize
(`packages/api/src/mcp/connection.ts`):

```jsonc
{
  "capabilities": {
    "extensions": {
      "io.modelcontextprotocol/ui": { "mimeTypes": ["text/html;profile=mcp-app"] }
    }
  }
}
```

This is a per-session host capability — LibreChat can always render MCP UI — so a server may
attach `_meta.ui` unconditionally; the host ignores it when a resource is not app-profile.

On the client, the App Bridge is constructed advertising these host capabilities to the
widget: `openLinks`, `logging`, and — in interactive (non-read-only) views only —
`serverTools`, `serverResources`, and `message.text`. Read-only surfaces (shared transcripts,
`/search`) deliberately omit the action capabilities so a widget cannot proxy tool calls or
resource reads against the viewer's servers with the viewer's auth.

## Rendering guarantees

- **Sandboxed iframe.** App widgets render with `sandbox="allow-scripts allow-forms"` — never
  `allow-same-origin`, popups, or downloads. The document executes its own JS inside that
  opaque-origin boundary.
- **Keyed by URI.** Each render is keyed by a `resourceId` derived per render from the
  resource text/URI, so two calls to the same tool produce two distinct widgets. Servers that
  give every render a unique URI (e.g. `ui://<app>/<kind>/<unixnano>`) get one widget per
  call; the host never dedupes or caches by URI prefix.
- **Rendered once, in place.** The widget renders in the assistant turn that carried it. A
  later tool call that embeds a refreshed widget is a new render with a new URI; the host does
  not patch data into a prior iframe.
- **Auto-resize.** The widget's `ui/notifications/size-changed` height is applied to the
  iframe (`sizechange` event → height state in `useAppBridge`); the host never fixes the
  height and lets the widget's responsive CSS own the width. Width is not applied.
- **Theming.** The host injects `hostContext.styles.variables` (mapped from LibreChat's theme
  tokens) and pushes theme changes via `ui/notifications/host-context-changed`; widgets keep
  their own fallbacks, so injection is additive.

## Implemented method surface

The App Bridge (`@modelcontextprotocol/ext-apps@1.7.4`, wired in
`client/src/hooks/MCP/useAppBridge.ts`) handles the following.

| Direction | Method | Behavior in LibreChat |
|---|---|---|
| widget → host | `ui/initialize` | capability handshake (SDK) |
| widget → host | `tools/call` | runs the named tool on the same MCP server (`POST /api/mcp/app-tool-call`), returns the result to the widget |
| widget → host | `resources/read` | reads a resource from the server |
| widget → host | `resources/list` / `resources/templates/list` | lists server resources / templates |
| widget → host | `ui/open-link` | opens the URL in a new browser tab (`window.open(_, '_blank', 'noopener,noreferrer')`), http/https only; other schemes blocked |
| widget → host | `ui/message` | appends the text content as a new conversation message |
| host → widget | `ui/notifications/tool-input` (+ partial) | tool input delivered once before the result |
| host → widget | `ui/notifications/tool-result` | tool result pushed to the widget |
| host → widget | `ui/notifications/size-changed` | consumed to size the iframe |
| host → widget | `ui/notifications/host-context-changed` | theme / host state |

Interactive-only methods (`tools/call`, `resources/read`, `resources/list`,
`resources/templates/list`, `ui/message`) are wired only when the view is not read-only.
Unknown methods and unknown content-block types are ignored (unknown content falls through to
JSON), per the spec's forward-compatibility rule.

## Model-context separation

The JSON text block of a tool result always stands alone and stays in the model's context; the
UI resource is split into a separate attachment. The model reasons over the JSON, and the
widget is presentation only. This matches the spec's rule that a host rendering no UI can
ignore the resource block and lose nothing.

## The refresh loop

There is no in-place data push to a live widget. A widget action calls `tools/call`; if that
tool returns `structuredContent` containing the table's rows key, the widget re-renders with
those rows and clears its selection. Otherwise the refreshed widget arrives as the next
embedded tool result, which the host renders as a new widget (new URI) while the old one
remains as a historical snapshot.

## Tool visibility

A tool's `_meta.ui` may declare `resourceUri` (the widget it renders) and
`visibility: ["model" | "app"]`. `app`-only tools are callable from a widget's `tools/call`
but hidden from the model; `model` tools are the normal, model-callable tools. The host reads
`_meta.ui.resourceUri` (or the legacy `ui/resourceUri` key) to synthesize the declared app for
a call when the result did not already return that exact resource.

## Security boundary

- The sandbox (no same-origin, no top-navigation, no popups, no downloads) is the trust
  boundary; every bridge message is treated as untrusted and shape-validated by the SDK.
- A widget `tools/call` can have side effects; it runs against the same server that produced
  the widget, scoped to the authenticated user, and only from interactive (non-read-only)
  views.
- Widgets need no network egress; the iframe's locked-down CSP is expected. Servers may
  request specific external origins via the resource's `_meta.ui.csp`, which the host forwards
  to the sandbox.

## Not covered here

`ui/request-display-mode` and `ui/update-model-context` from the spec's widget→host surface
are not currently wired; the host advertises only `inline` display mode. A widget that issues
them gets no effect (the host ignores unknown/unhandled methods rather than erroring).
