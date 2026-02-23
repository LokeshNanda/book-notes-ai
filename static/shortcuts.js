/**
 * Keyboard shortcuts: j/k or arrows for chapter nav, / to focus search, Esc to close panel.
 */
export function initShortcuts(onPrevChapter, onNextChapter, onFocusSearch, onClosePanel) {
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, [contenteditable=true]")) return;

    switch (e.key) {
      case "Escape":
        onClosePanel?.();
        break;
      case "/":
        e.preventDefault();
        onFocusSearch?.();
        break;
      case "j":
      case "ArrowDown":
        e.preventDefault();
        onNextChapter?.();
        break;
      case "k":
      case "ArrowUp":
        e.preventDefault();
        onPrevChapter?.();
        break;
      default:
        break;
    }
  });
}
