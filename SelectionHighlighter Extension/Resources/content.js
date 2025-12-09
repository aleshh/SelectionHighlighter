// content.js

(() => {
    const HIGHLIGHT_CLASS = "__selection_highlighter_match__";
    const ACTIVE_CLASS = "__selection_highlighter_match_active__";
    const BAR_ID = "__selection_highlighter_bar__";
    const STYLE_ID = "__selection_highlighter_style__";
    
    console.log("SelectionHighlighter content.js loaded on",
                window.location.href);

    let isHighlighting = false;
    let lastText = "";
    let debounceTimer = null;
    
    let isMouseDown = false;


    function clearPrevious() {
        const spans = document.querySelectorAll("." + HIGHLIGHT_CLASS);
        spans.forEach((span) => {
            const parent = span.parentNode;
            if (!parent)
                return;

            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
            parent.normalize();
        });

        const existingBar = document.getElementById(BAR_ID);
        if (existingBar)
            existingBar.remove();

        const existingStyle = document.getElementById(STYLE_ID);
        if (existingStyle)
            existingStyle.remove();
    }

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function injectStyle() {
        if (document.getElementById(STYLE_ID))
            return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
        .${HIGHLIGHT_CLASS} {
          background-color: yellow;
        }
        .${ACTIVE_CLASS} {
          outline: 2px solid orange;
          background-color: #fff8c4;
        }

        /* Full reset inside the bar to avoid site CSS conflicts */
        #${BAR_ID}, #${BAR_ID} * {
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
          font-size: 12px !important;
          line-height: 1 !important;
        }

        #${BAR_ID} {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 2147483647 !important;

          background: rgba(245, 245, 245, 0.98) !important;
          border: none !important;
          border-radius: 0 !important;

          padding: 4px 8px !important;

          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 8px !important;

          min-height: 28px !important;
        }

      #${BAR_ID} button {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;

        height: 24px !important;        /* slightly taller */
        min-width: 30px !important;     /* more room for the larger icon */

        padding: 0 !important;
        margin: 0 !important;

        border: 1px solid #bbb !important;
        border-radius: 4px !important;
        background: #fff !important;
        color: #333 !important;
      }

      #${BAR_ID} button svg {
        width: 16px !important;
        height: 16px !important;
        display: block !important;
        pointer-events: none !important;
      }

        #${BAR_ID} button:hover {
          background: #f0f0f0 !important;
        }

        #${BAR_ID}_label {
          flex: 0 0 auto !important;
          white-space: nowrap !important;
          margin-left: 2px !important;
          margin-right: 2px !important;
        }

        /* Close button aligned to far right and perfectly centered */
        #${BAR_ID}_close {
          margin-left: auto !important;

          border: none !important;
          background: transparent !important;

          height: 22px !important;
          min-width: 22px !important;

          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;

          font-size: 18px !important;       /* bigger “×” */
          color: #333 !important;
        }

        #${BAR_ID}_close:hover {
          background: rgba(0,0,0,0.07) !important;
          border-radius: 4px !important;
        }
      `;
        document.documentElement.appendChild(style);
    }

    function runHighlighter() {
        if (isHighlighting)
            return;
        isHighlighting = true;

        clearPrevious();

        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim() : "";
        console.log("SelectionHighlighter selected text:",
                    JSON.stringify(selectedText));

        if (!selectedText || selectedText.length < 2) {
            isHighlighting = false;
            lastText = "";
            return;
        }

        // Capture selection rect before we change the DOM,
        // so we can choose the match nearest to where the user is.
        let selectionRect = null;
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            selectionRect = range.getBoundingClientRect();
        }

        const pattern = escapeRegExp(selectedText);
        const regex = new RegExp(pattern, "gi");
        const highlights = [];

        function highlightInTextNode(textNode) {
            let text = textNode.nodeValue;
            if (!text || !regex.test(text)) {
                regex.lastIndex = 0;
                return;
            }

            regex.lastIndex = 0;
            let currentNode = textNode;
            let match;

            while ((match = regex.exec(text)) !== null) {
                const matchText = match[0];
                const matchIndex = match.index;

                const before = currentNode.splitText(matchIndex);
                const after = before.splitText(matchText.length);

                const span = document.createElement("span");
                span.className = HIGHLIGHT_CLASS;
                span.textContent = before.nodeValue;

                before.parentNode.replaceChild(span, before);
                highlights.push(span);

                currentNode = after;
                text = currentNode.nodeValue;
                regex.lastIndex = 0;
            }
        }

        function walk(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                highlightInTextNode(node);
                return;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName;
                if (tagName === "SCRIPT" || tagName === "STYLE" ||
                    tagName === "NOSCRIPT") {
                    return;
                }

                let child = node.firstChild;
                while (child) {
                    const next = child.nextSibling;
                    walk(child);
                    child = next;
                }
            }
        }

        walk(document.body);

        if (highlights.length === 0) {
            isHighlighting = false;
            return;
        }

        injectStyle();

        // Choose initial index: the match whose rect is vertically closest
        // to where the user's selection was.
        let currentIndex = 0;
        if (selectionRect) {
            const selCenterY = selectionRect.top + selectionRect.height / 2;
            let bestIdx = 0;
            let bestDelta = Infinity;

            highlights.forEach((el, i) => {
                const r = el.getBoundingClientRect();
                const centerY = r.top + r.height / 2;
                const delta = Math.abs(centerY - selCenterY);
                if (delta < bestDelta) {
                    bestDelta = delta;
                    bestIdx = i;
                }
            });

            currentIndex = bestIdx;
        }

        let labelEl = null;

        function setActiveHighlight(index) {
            highlights.forEach((el, i) => {
                if (i === index) {
                    el.classList.add(ACTIVE_CLASS);
                } else {
                    el.classList.remove(ACTIVE_CLASS);
                }
            });
        }

        function scrollToHighlight(index) {
            const el = highlights[index];
            if (!el)
                return;

            const rect = el.getBoundingClientRect();
            const absoluteTop = rect.top + window.scrollY;
            const offset = window.innerHeight * 0.3;

            window.scrollTo({top : absoluteTop - offset, behavior : "smooth"});
        }

        function goTo(index) {
            if (highlights.length === 0)
                return;

            if (index < 0) {
                index = highlights.length - 1;
            } else if (index >= highlights.length) {
                index = 0;
            }

            currentIndex = index;
            setActiveHighlight(currentIndex);
            scrollToHighlight(currentIndex);

            if (labelEl) {
                labelEl.textContent =
                    `${currentIndex + 1} / ${highlights.length} matches`;
            }
        }

        function createBar() {
            const bar = document.createElement("div");
            bar.id = BAR_ID;

            const label = document.createElement("span");
            label.id = `${BAR_ID}_label`;
            label.textContent =
                `${currentIndex + 1} / ${highlights.length} matches`;

            const prevBtn = document.createElement("button");

            const nextBtn = document.createElement("button");

            prevBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 12 12" fill="currentColor">
              <path d="M8.5 2L3.5 6L8.5 10Z" />
            </svg>
          `;

            nextBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3.5 2L8.5 6L3.5 10Z" />
            </svg>
          `;

            const closeBtn = document.createElement("button");
            closeBtn.id = `${BAR_ID}_close`;
            closeBtn.setAttribute("aria-label", "Clear highlights");
            closeBtn.textContent = "×";

            prevBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                goTo(currentIndex - 1);
            });

            nextBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                goTo(currentIndex + 1);
            });

            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                clearPrevious();
            });

            bar.appendChild(label);
            bar.appendChild(prevBtn);
            bar.appendChild(nextBtn);
            bar.appendChild(closeBtn);

            document.documentElement.appendChild(bar);

            return {label};
        }

        ({label : labelEl} = createBar());

        // Make the nearest match active, but do NOT scroll initially.
        setActiveHighlight(currentIndex);
        // scrollToHighlight(currentIndex);  // intentionally not called here

        isHighlighting = false;
    }
    function nodeInsideBar(node) {
        while (node) {
            if (node.nodeType === Node.ELEMENT_NODE && node.id === BAR_ID) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    }

    function maybeHighlightFromSelection() {
        if (isHighlighting)
            return;

        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : "";

        // Ignore selection changes that occur inside our own bar
        const anchorNode = selection ? selection.anchorNode : null;
        const focusNode = selection ? selection.focusNode : null;
        if ((anchorNode && nodeInsideBar(anchorNode)) ||
            (focusNode && nodeInsideBar(focusNode))) {
            return;
        }

        if (!text || text.length < 2) {
            // When the selection becomes empty, clear highlights
            clearPrevious();
            lastText = "";
            return;
        }

        if (text === lastText) {
            return;
        }

        lastText = text;
        runHighlighter();
    }

    function scheduleHighlightFromSelection() {
      if (isMouseDown) return;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(maybeHighlightFromSelection, 150);
    }
    
    // Track mouse dragging so we don’t interfere with drag-select
    document.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;                    // only left button
      if (nodeInsideBar(e.target)) return;           // ignore clicks in our own bar
      isMouseDown = true;
    });

    document.addEventListener("mouseup", (e) => {
      if (e.button !== 0) return;
      if (nodeInsideBar(e.target)) return;           // ignore bar clicks
      isMouseDown = false;
      // Now that dragging is finished, process whatever selection remains
      scheduleHighlightFromSelection();
    });

    // React only to selection changes; ignore mouseup/keyup noise
    document.addEventListener("selectionchange",
                              scheduleHighlightFromSelection);
})();
