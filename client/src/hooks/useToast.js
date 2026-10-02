import { createContext, createElement, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(() => {});

// toast("Saved", { tone: "good", action: { label: "Undo", onClick } })
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const id = useRef(0);
  const dismiss = useCallback((tid) => setToasts((t) => t.filter((x) => x.id !== tid)), []);
  const show = useCallback(
    (message, { tone = "info", duration = 3600, action } = {}) => {
      const tid = ++id.current;
      setToasts((t) => [...t.slice(-2), { id: tid, message, tone, action }]);
      setTimeout(() => dismiss(tid), action ? Math.max(duration, 6000) : duration);
    },
    [dismiss]
  );
  const value = useMemo(() => show, [show]);
  return createElement(
    ToastContext.Provider,
    { value },
    children,
    createElement(
      "div",
      { className: "toasts", role: "status", "aria-live": "polite" },
      toasts.map((t) =>
        createElement(
          "div",
          { key: t.id, className: `toast toast-${t.tone}` },
          createElement("span", null, t.message),
          t.action &&
            createElement(
              "button",
              {
                type: "button",
                className: "toast-action",
                onClick: () => {
                  t.action.onClick();
                  dismiss(t.id);
                },
              },
              t.action.label
            ),
          createElement("button", { type: "button", className: "toast-close", "aria-label": "Dismiss", onClick: () => dismiss(t.id) }, "×")
        )
      )
    )
  );
}

export const useToast = () => useContext(ToastContext);
