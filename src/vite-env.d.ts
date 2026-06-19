/// <reference types="vite/client" />

interface PalantirWidgetApi {
  addEventListener(type: string, listener: (event: { detail: unknown }) => void): void;
  removeEventListener(type: string, listener: (event: { detail: unknown }) => void): void;
  sendMessage(message: { type: string; payload: Record<string, unknown> }): void;
}

interface Window {
  __PALANTIR_WIDGET_API__?: PalantirWidgetApi;
}
