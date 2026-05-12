// ==UserScript==
// @name         Open Bing Related Videos In New Tab
// @namespace    https://github.com/UndeadKitten/monkey-scripts
// @version      1.0
// @description  Restores old Bing functionality when clicking on related videos. Middle-click or Ctrl+click to open them in a new tab. Left-click works normally. Right-click shows proper link context menu.
// @author       UndeadKitten (aka AlwaysNothing)
// @match        https://www.bing.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/**
* Incase the script stops working due to bing layout changes, you'll need to do this:
* Right click on a related video.
* Click Inspect.
* Find the bottom-most element that highlights the entire clickable area of the related video.
* Copy it's Inner HTML, Outer HTML, CSS Selector, CSS Path, & XPath.
* Give it all to a coding LLM, tell it that the bing layout changed, and to fix the script.
* ezpz (may or may not be more complicated then that depending on layout and url changes).
* Currently, whether or not "&mmscn=vidadt" is present in your url changes the video layout.
*/

(function () {
    'use strict';

    // Check once whether the current page uses the &mmscn=vidadt layout.
    // Opened tabs will mirror this so the layout stays consistent.
    const isVidadt = new URLSearchParams(window.location.search).get('mmscn') === 'vidadt';

    /**
     * Build the Bing video detail page URL for a given video.
     * Preserves &mmscn=vidadt when on that layout, omits it otherwise.
     */
    function buildBingVideoUrl(videoId, title) {
        const params = new URLSearchParams({
            q:    title,
            view: 'detail',
            mid:  videoId,
        });
        if (isVidadt) params.set('mmscn', 'vidadt');
        return 'https://www.bing.com/videos/search?' + params.toString();
    }

    /**
     * Extract video ID and title from a card element.
     * Prefers the `mmeta` attribute on the card root (present on both layouts),
     * falls back to `data-inst-info` on div.playinfo.
     */
    function getCardData(card) {
        // Primary: mmeta JSON on the card root itself
        const mmetaRaw = card.getAttribute('mmeta');
        if (mmetaRaw) {
            try {
                const mmeta = JSON.parse(mmetaRaw);
                if (mmeta.mid) {
                    return {
                        videoId: mmeta.mid,
                        title:   card.querySelector('.title')?.getAttribute('title')
                              ?? card.querySelector('.title')?.textContent?.trim()
                              ?? '',
                    };
                }
            } catch (_) {}
        }

        // Fallback: data-inst-info on div.playinfo
        const playinfo = card.querySelector('.playinfo[data-inst-info]');
        if (playinfo) {
            try {
                const info = JSON.parse(playinfo.getAttribute('data-inst-info'));
                if (info.videoId) {
                    return {
                        videoId: info.videoId,
                        title:   card.querySelector('.title')?.getAttribute('title')
                              ?? card.querySelector('.title')?.textContent?.trim()
                              ?? '',
                    };
                }
            } catch (_) {}
        }

        return null;
    }

    function patchCards() {
        // .videoTile.wilcpt covers both the &mmscn=vidadt layout and the
        // standard sidebar layout — no need for separate selectors.
        document.querySelectorAll('.videoTile.wilcpt:not([data-bvf-patched])').forEach(card => {
            const data = getCardData(card);
            if (!data) return;

            // Only stamp as patched once we know we have good data,
            // so a card that fails parsing can be retried on the next pass.
            card.dataset.bvfPatched = '1';

            const url = buildBingVideoUrl(data.videoId, data.title);

            // The card needs position:relative for the overlay to fill it correctly.
            if (getComputedStyle(card).position === 'static') {
                card.style.position = 'relative';
            }

            // Transparent full-cover <a> overlay.
            // This is what gives the browser enough context to show a proper
            // right-click context menu ("Open Link in New Tab", "Copy Link
            // Address", etc.) — the browser reads the href on the topmost element.
            const overlay = document.createElement('a');
            overlay.href = url;
            overlay.target = '_blank';
            overlay.rel = 'noopener noreferrer';
            overlay.title = data.title;
            overlay.style.cssText = 'position:absolute;inset:0;z-index:10;display:block;';

            overlay.addEventListener('mousedown', (e) => {
                if (e.button === 1) {
                    // Middle-click: suppress the browser autoscroll circle.
                    // The browser will still open the href in a new tab natively.
                    e.preventDefault();
                } else if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    // Plain left-click: step aside so the click reaches Bing's
                    // handler on the card underneath, keeping normal behaviour.
                    overlay.style.pointerEvents = 'none';
                    setTimeout(() => { overlay.style.pointerEvents = ''; }, 100);
                }
                // Right-click (button 2) and modifier+click: do nothing here,
                // let the browser handle them against the overlay href normally.
            });

            card.appendChild(overlay);
        });
    }

    // Initial pass
    patchCards();

    // Watch for dynamically loaded cards.
    // Debounced so querySelectorAll doesn't run on every individual DOM mutation
    // (Bing's page can fire many in rapid succession during scroll/load).
    let debounceTimer;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(patchCards, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
