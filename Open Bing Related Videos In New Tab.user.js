// ==UserScript==
// @name         Open Bing Related Videos In New Tab 2
// @namespace    https://github.com/UndeadKitten/monkey-scripts
// @version      1.3.42
// @description  Restores and completely customizes Bing functionality when clicking on related videos. Menu config available.
// @author       UndeadKitten (aka AlwaysNothing)
// @match        https://www.bing.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // --- Configuration Object ---
    // Centralized configuration for all selectors, attributes, and magic values.
    // Update this object if Bing's HTML/CSS structure changes.
    const BING_CONFIG = {
        selectors: {
            videoTile: '.videoTile',
            hostLink: '.source[href], .publishUser[href]',
            ghostClass: 'bvf-ghost',
            controlsToAvoid: '.vol, .vrhol, .vhcic',
            metadataLinks: [
                '.metaItem a',
                '.source[href]',
                '.publishUser[href]',
                'a.metaItem.vctil',
                'a[data-c="sourceItem"]'
            ],
            titleElement: '.title'
        },
        attributes: {
            cardMetadata: 'mmeta',
            processedCard: 'data-bvf-v4',
            videoIdField: 'mid'
        },
        urls: {
            baseVideoSearch: 'https://www.bing.com/videos/search',
            baseRiverview: 'https://www.bing.com/videos/riverview/relatedvideo'
        },
        params: {
            queryKey: 'q',
            viewKey: 'view',
            videoIdKey: 'mid',
            modeKey: 'mmscn',
            viewValue: 'detail',
            modeValue: 'vidadt'
        },
        timing: {
            patchInterval: 1500,
            ghostElementTimeout: 250
        }
    };

    const isVidadt = new URLSearchParams(window.location.search).get(BING_CONFIG.params.modeKey) === BING_CONFIG.params.modeValue;

    // --- Error Codes ---
    const BVF_ERRORS = {
        E002: "Failed to parse card metadata or missing mid field",
        E003: "Host link not found in card - selector may have changed",
        E004: "Title element not found in card - selector may have changed",
        E005: "Metadata link selectors failed to match"
    };

    function reportError(code, context = '') {
        const message = BVF_ERRORS[code] || "Unknown error";
        const fullMessage = context ? `${message} (${context})` : message;
        console.error(`[BVF ${code}] ${fullMessage}`);
    }

    // --- Settings Management ---
    const defaultSettings = {
        video_left: 1, video_middle: 2, video_ctrl: 2,
        host_left: 4, host_middle: 5, host_ctrl: 5,
        update_query: 0, force_vidadt: 1, refresh_on_left_click: 0
    };
    let settings = GM_getValue('bvf_settings', defaultSettings);

    // --- Check and fix vidadt on page load ---
    (function () {
        const hasVidadt = isVidadt;
        let shouldReload = false;

        if (settings.force_vidadt === 0 && hasVidadt) {
            // Force Off: remove vidadt
            shouldReload = true;
        } else if (settings.force_vidadt === 1 && !hasVidadt) {
            // Force On: add vidadt
            shouldReload = true;
        }

        if (shouldReload) {
            const url = new URL(window.location);
            if (settings.force_vidadt === 0) {
                url.searchParams.delete('mmscn');
            } else if (settings.force_vidadt === 1) {
                url.searchParams.set('mmscn', 'vidadt');
            }
            window.location.href = url.toString();
        }
    })();
    const actionLabels = {
        1: "Open onto bing embed in current tab", 2: "Open onto bing embed in new tab",
        3: "Open onto bing embed in new tab and open the new tab", 4: "Open onto host website in current tab",
        5: "Open onto host website in new tab", 6: "Open onto host website in new tab and open the new tab"
    };
    const vidadtLabels = {
        0: "Force Riverview layout (not fully supported)",
        1: "Force Vidadt layout (old layout, fully supported)",
        2: "Don't Force"
    };

    // --- Settings UI ---
    function openSettingsUI() {
        if (document.getElementById('bvf-settings-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'bvf-settings-modal';
        modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: sans-serif;`;
        const container = document.createElement('div');
        container.style.cssText = `background: #fff; color: #333; padding: 25px; border-radius: 8px; width: 500px; max-width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.3);`;
        container.innerHTML = `
            <h2 style="margin-top:0; border-bottom:1px solid #ccc; padding-bottom:10px;">⚙️ Bing Video Clicks</h2>
            <div style="display:flex; flex-direction:column; gap:15px; margin-bottom: 20px;">
                ${createSelectHTML('Video: Left Click', 'video_left', actionLabels)}
                ${createSelectHTML('Video: Middle Click', 'video_middle', actionLabels)}
                ${createSelectHTML('Video: Ctrl+Left Click', 'video_ctrl', actionLabels)}
                <hr style="width:100%; border:0; border-top:1px solid #eee; margin:0;" />
                ${createSelectHTML('Host Website: Left Click', 'host_left', actionLabels)}
                ${createSelectHTML('Host Website: Middle Click', 'host_middle', actionLabels)}
                ${createSelectHTML('Host Website: Ctrl+Left Click', 'host_ctrl', actionLabels)}
                <hr style="width:100%; border:0; border-top:1px solid #eee; margin:0;" />
                ${createSelectHTML('Layout Mode', 'force_vidadt', vidadtLabels)}
                ${createCheckboxHTML('Update query to video title', 'update_query')}
                ${createCheckboxHTML('Refresh page on video left-click', 'refresh_on_left_click')}
            </div>
            <div style="display:flex; justify-content:space-between; gap:10px;">
                <button id="bvf-reset" style="padding:8px 16px; cursor:pointer; background:#f0f0f0; border:1px solid #ccc; border-radius:4px;">Reset to Default</button>
                <div style="display:flex; gap:10px;">
                    <button id="bvf-cancel" style="padding:8px 16px; cursor:pointer; background:#f0f0f0; border:1px solid #ccc; border-radius:4px;">Cancel</button>
                    <button id="bvf-save" style="padding:8px 16px; cursor:pointer; background:#0078D4; border:none; border-radius:4px; color:#fff;">Save & Reload</button>
                </div>
            </div>`;
        modal.appendChild(container);
        document.body.appendChild(modal);

        document.getElementById('bvf-reset').addEventListener('click', () => {
            // Reset all form fields to default values (don't save yet)
            ['video_left', 'video_middle', 'video_ctrl', 'host_left', 'host_middle', 'host_ctrl', 'force_vidadt'].forEach(k => {
                document.getElementById(`sel_${k}`).value = defaultSettings[k];
            });
            ['update_query', 'refresh_on_left_click'].forEach(k => {
                document.getElementById(`chk_${k}`).checked = defaultSettings[k] === 1;
            });
        });

        document.getElementById('bvf-cancel').addEventListener('click', () => modal.remove());
        document.getElementById('bvf-save').addEventListener('click', () => {
            const s = {};
            ['video_left', 'video_middle', 'video_ctrl', 'host_left', 'host_middle', 'host_ctrl', 'force_vidadt'].forEach(k => s[k] = parseInt(document.getElementById(`sel_${k}`).value, 10));
            ['update_query', 'refresh_on_left_click'].forEach(k => s[k] = document.getElementById(`chk_${k}`).checked ? 1 : 0);
            GM_setValue('bvf_settings', s);
            window.location.reload();
        });
    }

    function createSelectHTML(label, key, labels) {
        let opt = '';
        for (const val in labels) {
            opt += `<option value="${val}" ${settings[key] == val ? 'selected' : ''}>${labels[val]}</option>`;
        }
        return `<div style="display:flex; flex-direction:column; gap:5px;"><label style="font-weight:bold; font-size:13px;">${label}</label><select id="sel_${key}" style="padding:6px; border:1px solid #ccc; border-radius:4px;">${opt}</select></div>`;
    }

    function createCheckboxHTML(label, key) {
        return `<div style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="chk_${key}" ${settings[key] === 1 ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;"><label style="font-weight:bold; font-size:13px; cursor:pointer; margin:0;" for="chk_${key}">${label}</label></div>`;
    }
    GM_registerMenuCommand("⚙️ Configure Click Behaviors", openSettingsUI);

    // --- Logic ---

    /**
     * urlHasVidadt: Checks if a URL contains the vidadt parameter
     */
    function urlHasVidadt(url) {
        const searchParams = new URLSearchParams(url.split('?')[1] || '');
        return searchParams.get(BING_CONFIG.params.modeKey) === BING_CONFIG.params.modeValue;
    }

    function buildBingVideoUrl(videoId, title) {
        // Determine query: use title if update_query is enabled, otherwise use current search query or title
        let q;
        if (settings.update_query === 1) {
            q = title;
        } else {
            q = new URLSearchParams(window.location.search).get(BING_CONFIG.params.queryKey) || title;
        }

        let useVidadt = false;
        if (settings.force_vidadt === 1) {
            useVidadt = true;
        } else if (settings.force_vidadt === 2 && isVidadt) {
            useVidadt = true;
        }

        if (useVidadt) {
            // Old layout (vidadt)
            const params = new URLSearchParams({
                [BING_CONFIG.params.queryKey]: q,
                [BING_CONFIG.params.viewKey]: BING_CONFIG.params.viewValue,
                [BING_CONFIG.params.videoIdKey]: videoId,
                [BING_CONFIG.params.modeKey]: BING_CONFIG.params.modeValue
            });
            return BING_CONFIG.urls.baseVideoSearch + '?' + params.toString();
        } else {
            // New layout (riverview)
            // Note: Bing requires double && after the query string for riverview mode
            const qParam = new URLSearchParams({ [BING_CONFIG.params.queryKey]: q }).toString();
            const restParams = new URLSearchParams({ [BING_CONFIG.params.videoIdKey]: videoId }).toString();
            return BING_CONFIG.urls.baseRiverview + '?' + qParam + '&&' + restParams;
        }
    }

    function getCardData(card) {
        let m = card.getAttribute(BING_CONFIG.attributes.cardMetadata);
        if (!m && card.parentElement) {
            const vrhdata = card.parentElement.querySelector('.vrhdata');
            if (vrhdata) {
                m = vrhdata.getAttribute('vrhm');
            }
        }

        if (m) {
            try {
                const j = JSON.parse(m);
                if (j[BING_CONFIG.attributes.videoIdField]) {
                    let title = j.vt || card.querySelector(BING_CONFIG.selectors.titleElement)?.title || card.querySelector(BING_CONFIG.selectors.titleElement)?.innerText || '';
                    if (!title) {
                        reportError('E004');
                    }
                    return {
                        mid: j[BING_CONFIG.attributes.videoIdField],
                        t: title
                    };
                }
            } catch (e) {
                reportError('E002', e.message);
            }
        } else {
            const playinfo = card.parentElement?.querySelector('.playinfo') || card.querySelector('.playinfo');
            if (playinfo) {
                const mid = playinfo.getAttribute('data-videoid-info');
                if (mid) {
                    let title = card.querySelector(BING_CONFIG.selectors.titleElement)?.title || card.querySelector(BING_CONFIG.selectors.titleElement)?.innerText || '';
                    return {
                        mid: mid,
                        t: title
                    };
                }
            }
            reportError('E002', 'metadata attribute not found');
        }
        return null;
    }

    /**
     * execute: Performs the actual navigation/tab opening.
     * To ensure the tab order matches the browser's native right-click/middle-click behavior,
     * we simulate a native click on a temporary anchor rather than using GM_openInTab.
     */
    function execute(code, bing, host, originalEvent = null) {
        const url = code <= 3 ? bing : host;

        // Handle current tab navigation
        if (code === 1 || code === 4) {
            window.location.href = url;
            return;
        }

        // Handle new tab navigation by simulating a native browser click.
        // This bypasses userscript manager tab-ordering logic and uses the browser's own rules.
        const link = document.createElement('a');
        link.href = url;

        if (code === 3 || code === 6) {
            // "Active" new tab: standard browser behavior for target="_blank"
            link.target = '_blank';
        } else {
            // "Background" new tab: We use a MouseEvent to mimic a Ctrl+Click (native background tab)
            const navEvent = new MouseEvent('click', {
                ctrlKey: true,
                metaKey: true,
                bubbles: true,
                cancelable: true
            });
            link.dispatchEvent(navEvent);
            return;
        }

        link.click();
    }

    function updateGhostLink(card, bingUrl) {
        let ghost = card.querySelector('.' + BING_CONFIG.selectors.ghostClass);
        if (!ghost) {
            ghost = document.createElement('a');
            ghost.className = BING_CONFIG.selectors.ghostClass;
            ghost.style.cssText = 'position:absolute; inset:0; z-index:-1; opacity:0; pointer-events:none;';
            card.appendChild(ghost);
        }
        ghost.href = bingUrl;
        return ghost;
    }

    function isCurrentVideoMetadata(el) {
        if (!el) return false;
        if (el.closest(BING_CONFIG.selectors.videoTile)) return false;
        return el.matches(BING_CONFIG.selectors.metadataLinks.join(','));
    }

    function patch() {
        const tiles = document.querySelectorAll(BING_CONFIG.selectors.videoTile + ':not([' + BING_CONFIG.attributes.processedCard + '])');

        tiles.forEach(card => {
            const data = getCardData(card);
            if (!data) return;

            card.setAttribute(BING_CONFIG.attributes.processedCard, '1');
            const bingUrl = buildBingVideoUrl(data.mid, data.t);
            const hostLinkElements = card.querySelectorAll(BING_CONFIG.selectors.hostLink);

            if (hostLinkElements.length === 0) {
                reportError('E003');
            }

            const ghost = updateGhostLink(card, bingUrl);

            hostLinkElements.forEach(el => {
                if (window.getComputedStyle(el).position === 'static') {
                    el.style.position = 'relative';
                }
                el.style.zIndex = '10000';
            });

            const handleIntercept = (e) => {
                if (e.target.closest(BING_CONFIG.selectors.controlsToAvoid)) return;

                const isCtrl = e.ctrlKey || e.metaKey;
                const type = e.button === 1 ? 'middle' : (isCtrl ? 'ctrl' : 'left');
                const targetHostLink = e.target.closest(BING_CONFIG.selectors.hostLink);
                const onHostLink = !!targetHostLink;
                const code = settings[`${onHostLink ? 'host' : 'video'}_${type}`];
                const currentHostUrl = targetHostLink ? (targetHostLink.href || targetHostLink.getAttribute('href')) : '';

                if (e.button === 2 || e.type === 'contextmenu') {
                    if (!onHostLink) {
                        ghost.style.zIndex = '99999';
                        ghost.style.pointerEvents = 'auto';
                        setTimeout(() => {
                            ghost.style.zIndex = '-1';
                            ghost.style.pointerEvents = 'none';
                        }, BING_CONFIG.timing.ghostElementTimeout);
                    } else if (targetHostLink.tagName !== 'A') {
                        let hGhost = targetHostLink.querySelector('.bvf-host-ghost');
                        if (!hGhost) {
                            hGhost = document.createElement('a');
                            hGhost.className = 'bvf-host-ghost';
                            hGhost.style.cssText = 'position:absolute; inset:0; z-index:99999; opacity:0; pointer-events:none;';
                            targetHostLink.appendChild(hGhost);
                        }
                        hGhost.href = currentHostUrl;
                        hGhost.style.pointerEvents = 'auto';
                        setTimeout(() => {
                            hGhost.style.pointerEvents = 'none';
                        }, BING_CONFIG.timing.ghostElementTimeout);
                    }
                    return;
                }

                if (type === 'middle' || type === 'ctrl') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if (e.type === 'click' || e.type === 'auxclick') {
                        execute(code, bingUrl, currentHostUrl, e);
                    }
                    return;
                }

                if (type === 'left') {
                    // If refresh_on_left_click is enabled, execute the navigation (load new page)
                    // Otherwise, return and let Bing's default behavior happen (swap embedded video)
                    if (code === 1 && !onHostLink && !settings.refresh_on_left_click) return;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if (e.type === 'click') {
                        execute(code, bingUrl, currentHostUrl, e);
                    }
                }
            };

            card.addEventListener('mousedown', handleIntercept, true);
            card.addEventListener('click', handleIntercept, true);
            card.addEventListener('auxclick', handleIntercept, true);
            card.addEventListener('contextmenu', handleIntercept, true);
        });
    }

    const handleGlobalMetaClick = (e) => {
        const targetLink = e.target.closest('a, div[href]');
        if (!isCurrentVideoMetadata(targetLink)) return;

        targetLink.removeAttribute('target');
        const isCtrl = e.ctrlKey || e.metaKey;
        const type = e.button === 1 ? 'middle' : (isCtrl ? 'ctrl' : 'left');
        const code = settings[`host_${type}`];

        if (e.button === 2 || e.type === 'contextmenu') return;

        e.preventDefault();
        e.stopImmediatePropagation();

        if (e.type === 'click' || e.type === 'auxclick') {
            const url = targetLink.href || targetLink.getAttribute('href');
            execute(code, '', url, e);
        }
    };

    document.body.addEventListener('mousedown', handleGlobalMetaClick, true);
    document.body.addEventListener('click', handleGlobalMetaClick, true);
    document.body.addEventListener('auxclick', handleGlobalMetaClick, true);

    // --- Efficient MutationObserver for video tile changes ---
    let patchTimeout = null;
    const debouncedPatch = () => {
        clearTimeout(patchTimeout);
        patchTimeout = setTimeout(() => {
            patch();
            patchTimeout = null;
        }, 50); // Debounce to batch rapid mutations
    };

    // Initial patch on page load
    patch();

    // Observe related videos container for new tiles
    const relatedVideosContainer = document.getElementById('mm_relvid');
    if (relatedVideosContainer) {
        const observer = new MutationObserver(debouncedPatch);
        observer.observe(relatedVideosContainer, { childList: true, subtree: true });
    }

    // Observe embedded video metadata for changes
    const metadataBar = document.querySelector('.metadataBar');
    if (metadataBar) {
        const metaObserver = new MutationObserver(debouncedPatch);
        metaObserver.observe(metadataBar, {
            subtree: true,
            attributes: true,
            attributeFilter: ['href', BING_CONFIG.attributes.cardMetadata]
        });
    }

    // Fallback to polling if observers couldn't attach
    if (!relatedVideosContainer || !metadataBar) {
        setInterval(patch, BING_CONFIG.timing.patchInterval);
    }
})();
