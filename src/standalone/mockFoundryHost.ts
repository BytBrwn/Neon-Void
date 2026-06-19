type WidgetHostMessage = {
  type: string;
  payload: Record<string, unknown>;
};

type WidgetHostListener = (event: { detail: WidgetHostMessage }) => void;

type AsyncParameter = {
  type: string;
  value: { type: "loaded"; value: unknown };
};

const listeners = new Set<WidgetHostListener>();

const parameters: Record<string, AsyncParameter> = {
  headerText: {
    type: "string",
    value: { type: "loaded", value: "catalyx-widgets (standalone)" },
  },
  todoItems: {
    type: "array",
    value: { type: "loaded", value: ["Example todo item"] },
  },
};

function dispatchToWidget(message: WidgetHostMessage): void {
  for (const listener of listeners) {
    listener({ detail: message });
  }
}

function sendParameters(): void {
  dispatchToWidget({
    type: "host.update-parameters",
    payload: { parameters },
  });
}

export function installMockFoundryHost(): void {
  if ("__PALANTIR_WIDGET_API__" in window) {
    return;
  }

  window.__PALANTIR_WIDGET_API__ = {
    addEventListener(_type: string, listener: WidgetHostListener) {
      listeners.add(listener);
    },
    removeEventListener(_type: string, listener: WidgetHostListener) {
      listeners.delete(listener);
    },
    sendMessage(message: WidgetHostMessage) {
      switch (message.type) {
        case "widget.ready":
          sendParameters();
          break;
        case "widget.emit-event": {
          const { eventId, parameterUpdates } = message.payload;
          console.log("[standalone dev]", eventId, parameterUpdates);
          if (parameterUpdates != null && typeof parameterUpdates === "object") {
            for (const [key, value] of Object.entries(parameterUpdates)) {
              const parameter = parameters[key];
              if (parameter != null) {
                parameter.value = { type: "loaded", value };
              }
            }
            sendParameters();
          }
          break;
        }
        default:
          console.log("[standalone dev]", message.type, message.payload);
      }
    },
  };
}
