import { hasPersianScript } from "../utils/textDirection.js";

/**
 * Auto-RTL: any box whose own text (or form value/placeholder) contains at
 * least one Persian/Farsi word gets dir="rtl"; it is reverted when the text
 * goes back to non-Persian.  Boxes that already carry an author-set dir
 * (report previews, locale direction) are left alone.  html/head are skipped
 * so page-level direction stays locale-driven.
 */

const MANAGED = "data-auto-rtl";
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "HTML",
  "HEAD",
]);

function ownText(el) {
  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue || "";
  }
  return text;
}

function controlText(el) {
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement
  ) {
    return `${el.value || ""} ${el.placeholder || ""}`;
  }
  if (el instanceof HTMLSelectElement) {
    const option = el.selectedOptions && el.selectedOptions[0];
    return option ? option.text || "" : "";
  }
  return "";
}

function isFormControl(el) {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

function evaluate(el) {
  if (!(el instanceof HTMLElement)) return;
  if (SKIP_TAGS.has(el.tagName)) return;
  const managed = el.hasAttribute(MANAGED);
  // Respect an author-set direction unless this utility set it itself.
  if (el.hasAttribute("dir") && !managed) return;
  const text =
    ownText(el) + (isFormControl(el) ? ` ${controlText(el)}` : "");
  if (hasPersianScript(text)) {
    if (el.getAttribute("dir") !== "rtl") el.setAttribute("dir", "rtl");
    if (!managed) el.setAttribute(MANAGED, "1");
  } else if (managed) {
    el.removeAttribute("dir");
    el.removeAttribute(MANAGED);
  }
}

function scanSubtree(root) {
  if (root instanceof HTMLElement) evaluate(root);
  if (root instanceof Element || root instanceof Document) {
    const all = root.querySelectorAll("*");
    for (const el of all) evaluate(el);
  }
}

let installed = false;
let formScanQueued = false;

function queueFormScan() {
  if (formScanQueued) return;
  formScanQueued = true;
  requestAnimationFrame(() => {
    formScanQueued = false;
    // Controlled inputs change .value without a DOM mutation — rescan them.
    const controls = document.querySelectorAll("input, textarea, select");
    for (const el of controls) evaluate(el);
  });
}

export function installAutoRtl() {
  if (installed || typeof document === "undefined" || !document.body) return;
  installed = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) scanSubtree(node);
        }
        if (mutation.target instanceof HTMLElement) {
          evaluate(mutation.target);
        }
      } else if (mutation.type === "characterData") {
        const parent = mutation.target.parentElement;
        if (parent) evaluate(parent);
      } else if (mutation.type === "attributes") {
        evaluate(mutation.target);
      }
    }
    queueFormScan();
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["value", "placeholder"],
  });

  document.addEventListener(
    "input",
    (event) => evaluate(event.target),
    true,
  );
  document.addEventListener(
    "change",
    (event) => evaluate(event.target),
    true,
  );

  scanSubtree(document.body);
}
