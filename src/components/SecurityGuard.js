"use client";
import { useEffect } from "react";

/**
 * Client-side hardening for the whole app. Mounted once at the root so it
 * applies to every page in real time.
 *
 * Policy:
 *  - Right-click / context menu is fully disabled everywhere.
 *  - Dev-tools & view-source keyboard shortcuts are blocked (best effort).
 *  - Page content cannot be selected, copied, cut or dragged out — so nothing
 *    displayed by the system can be copied back out.
 *  - PASTE is always allowed, and copy/cut ARE allowed inside input fields, so
 *    users can still paste credentials and copy values they typed themselves.
 *
 * NOTE: browsers cannot be fully prevented from opening DevTools by page JS —
 * true enforcement needs a managed-browser policy (e.g. Chrome
 * `DeveloperToolsAvailability`) or kiosk mode. This layer is the in-app
 * deterrent; pair it with that policy for hard enforcement.
 */
export default function SecurityGuard() {
  useEffect(() => {
    // Is the event happening inside an editable field? Those keep copy/cut/paste.
    const isEditable = (el) => {
      const node = el instanceof Element ? el : null;
      const focus = document.activeElement;
      const check = (n) =>
        !!n &&
        (n.tagName === "INPUT" ||
          n.tagName === "TEXTAREA" ||
          n.tagName === "SELECT" ||
          n.isContentEditable ||
          (typeof n.closest === "function" && n.closest('input, textarea, [contenteditable="true"]')));
      return check(node) || check(focus);
    };

    // 1) Right-click / context menu — fully disabled.
    const onContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    // 2) Dev-tools & view-source shortcuts (best effort, cross-platform).
    const onKeyDown = (e) => {
      const k = (e.key || "").toLowerCase();
      const mod = e.ctrlKey || e.metaKey; // Ctrl (Win/Linux) or Cmd (Mac)
      // F12 → DevTools
      if (k === "f12") return block(e);
      // Ctrl/Cmd+Shift+I/J/C/K → DevTools / console / inspector
      if (mod && e.shiftKey && ["i", "j", "c", "k"].includes(k)) return block(e);
      // Ctrl/Cmd+U → view source
      if (mod && k === "u") return block(e);
      // Ctrl/Cmd+S → save page (an exfiltration path)
      if (mod && k === "s") return block(e);
      // Ctrl/Cmd+C or X outside an editable field → block copying page content
      if (mod && (k === "c" || k === "x") && !isEditable(e.target)) return block(e);
    };
    const block = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // 3) Copy / cut — allowed only from editable fields; blocked elsewhere so
    //    displayed data (notes, credentials, tables) cannot be copied out.
    const onCopyOrCut = (e) => {
      if (!isEditable(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 4) Block drag-out of text/images (another copy path). Editable fields keep
    //    their normal behaviour.
    const onDragStart = (e) => {
      if (!isEditable(e.target)) e.preventDefault();
    };

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("copy", onCopyOrCut, true);
    document.addEventListener("cut", onCopyOrCut, true);
    document.addEventListener("dragstart", onDragStart, true);

    // Signal to CSS that the guard is active (disables text selection except in
    // editable fields — see globals.css). Done from JS so pages still render
    // and remain usable if scripting is disabled.
    document.documentElement.setAttribute("data-guard", "on");

    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("copy", onCopyOrCut, true);
      document.removeEventListener("cut", onCopyOrCut, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.documentElement.removeAttribute("data-guard");
    };
  }, []);

  return null;
}
