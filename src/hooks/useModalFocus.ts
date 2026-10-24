import { useEffect, useRef, type RefObject } from "react";

const selector = "button,a[href],input,select,textarea,[tabindex]";
const stack: HTMLElement[] = [];

// Keep the existing dialog markup/styles and mutation locks. Callbacks stay
// current without refocusing the dialog whenever a request or language changes.
export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
  canClose: () => boolean,
  scope?: unknown,
) {
  const callbacks = useRef({ close, canClose });
  callbacks.current = { close, canClose };
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const candidates = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(
        (el) =>
          el.tabIndex >= 0 &&
          !el.matches(":disabled,[hidden]") &&
          !el.closest("[inert]") &&
          el.getClientRects().length > 0 &&
          getComputedStyle(el).visibility !== "hidden",
      );
    const focusFirst = () => {
      const items = candidates();
      (
        items.find((el) => el.hasAttribute("data-modal-initial-focus")) ??
        items[0] ??
        dialog
      ).focus();
    };
    const top = () => stack[stack.length - 1] === dialog;
    stack.push(dialog);
    focusFirst();
    const keydown = (event: KeyboardEvent) => {
      if (!top() || event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (callbacks.current.canClose()) callbacks.current.close();
      } else if (event.key === "Tab") {
        const items = candidates(),
          first = items[0],
          last = items[items.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (
          !dialog.contains(document.activeElement) ||
          document.activeElement === dialog ||
          (event.shiftKey ? document.activeElement === first : document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    const focusin = (event: FocusEvent) => {
      if (top() && event.target instanceof Node && !dialog.contains(event.target)) focusFirst();
    };
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("focusin", focusin);
    return () => {
      const wasTop = top();
      const index = stack.indexOf(dialog);
      if (index >= 0) stack.splice(index, 1);
      document.removeEventListener("keydown", keydown, true);
      document.removeEventListener("focusin", focusin);
      if (wasTop && opener?.isConnected && !opener.closest("[inert]")) opener.focus();
    };
  }, [open, ref, scope]);
}
