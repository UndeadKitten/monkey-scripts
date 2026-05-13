// ==UserScript==
// @name         Open Bing Related Videos In New Tab
// @namespace    https://github.com/UndeadKitten/monkey-scripts
// @version      1.2
// @description  Restores old Bing functionality when clicking on related videos, and a bit of extra stuff. Settings config available.
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

    // Check once whether the current page uses the &mmscn=vidadt layout.
    const isVidadt = new URLSearchParams(window.location.search).get('mmscn') === 'vidadt';

    // --- Settings Management ---
    const defaultSettings = {
        video_left: 1,
        video_middle: 2,
        video_ctrl: 2,
        host_left: 4,
        host_middle: 5,
        host_ctrl: 5,
        update_query: 0,
        force_vidadt: 1,
        force_refresh: 0
    };

    let settings = GM_getValue('bvf_settings', defaultSettings);

    const actionLabels = {
        1: "Open onto bing embed in current tab",
        2: "Open onto bing embed in new tab",
        3: "Open onto bing embed in new tab and open the new tab",
        4: "Open onto host website in current tab",
        5: "Open onto host website in new tab",
        6: "Open onto host website in new tab and open the new tab"
    };

    // --- Settings UI ---
    function openSettingsUI() {
        if (document.getElementById('bvf-settings-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'bvf-settings-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.6); z-index: 999999; display: flex;
            align-items: center; justify-content: center; font-family: sans-serif;
        `;

        const container = document.createElement('div');
        container.style.cssText = `
            background: #fff; color: #333; padding: 25px; border-radius: 8px;
            width: 500px; max-width: 90%; max-height: 90vh; overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        `;

        container.innerHTML = `
            <h2 style="margin-top:0; border-bottom:1px solid #ccc; padding-bottom:10px;">⚙️ Bing Video Clicks</h2>
            <div style="display:flex; flex-direction:column; gap:15px; margin-bottom: 20px;">
                ${createSelectHTML('Video: Left Click', 'video_left')}
                ${createSelectHTML('Video: Middle Click', 'video_middle')}
                ${createSelectHTML('Video: Ctrl+Left Click', 'video_ctrl')}
                <hr style="width:100%; border:0; border-top:1px solid #eee; margin:0;" />
                ${createSelectHTML('Host Website: Left Click', 'host_left')}
                ${createSelectHTML('Host Website: Middle Click', 'host_middle')}
                ${createSelectHTML('Host Website: Ctrl+Left Click', 'host_ctrl')}
                <hr style="width:100%; border:0; border-top:1px solid #eee; margin:0;" />

                <div style="display:flex; flex-direction:column; gap:5px;">
                    <label style="font-weight:bold; font-size:13px;">Change search query to related video's title:</label>
                    <select id="sel_update_query" style="padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                        <option value="1" ${settings.update_query === 1 ? 'selected' : ''}>Yes</option>
                        <option value="0" ${settings.update_query === 0 ? 'selected' : ''}>No</option>
                    </select>
                </div>

                <div style="display:flex; flex-direction:column; gap:5px;">
                    <label style="font-weight:bold; font-size:13px;">Change video layout (&mmscn=vidadt):</label>
                    <select id="sel_force_vidadt" style="padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                        <option value="1" ${settings.force_vidadt === 1 ? 'selected' : ''}>Yes, force &mmscn=vidadt on video pages</option>
                        <option value="2" ${settings.force_vidadt === 2 ? 'selected' : ''}>Yes, remove &mmscn=vidadt on video pages</option>
                        <option value="3" ${settings.force_vidadt === 3 ? 'selected' : ''}>No, retain &mmscn=vidadt if present</option>
                    </select>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:5px;">
                <label style="font-weight:bold; font-size:13px;">Left click refreshes page (current tab):</label>
                <select id="sel_force_refresh" style="padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                    <option value="0" ${settings.force_refresh === 0 ? 'selected' : ''}>No, use Bing's native loader</option>
                    <option value="1" ${settings.force_refresh === 1 ? 'selected' : ''}>Yes, force a full page refresh</option>
                </select>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center;">
                <button id="bvf-reset" style="padding:8px 16px; cursor:pointer; background:#fff; border:1px solid #d32f2f; border-radius:4px; color:#d32f2f;">Reset Defaults</button>
                <div style="display:flex; gap:10px;">
                    <button id="bvf-cancel" style="padding:8px 16px; cursor:pointer; background:#f0f0f0; border:1px solid #ccc; border-radius:4px; color:#333;">Cancel</button>
                    <button id="bvf-save" style="padding:8px 16px; cursor:pointer; background:#0078D4; border:none; border-radius:4px; color:#fff;">Save & Reload</button>
                </div>
            </div>
        `;

        modal.appendChild(container);
        document.body.appendChild(modal);

        // Reset Button Logic
        document.getElementById('bvf-reset').addEventListener('click', () => {
            document.getElementById('sel_video_left').value = defaultSettings.video_left;
            document.getElementById('sel_video_middle').value = defaultSettings.video_middle;
            document.getElementById('sel_video_ctrl').value = defaultSettings.video_ctrl;
            document.getElementById('sel_host_left').value = defaultSettings.host_left;
            document.getElementById('sel_host_middle').value = defaultSettings.host_middle;
            document.getElementById('sel_host_ctrl').value = defaultSettings.host_ctrl;
            document.getElementById('sel_update_query').value = defaultSettings.update_query;
            document.getElementById('sel_force_vidadt').value = defaultSettings.force_vidadt;
            document.getElementById('sel_force_refresh').value = defaultSettings.force_refresh;
        });

        // Cancel Button Logic
        document.getElementById('bvf-cancel').addEventListener('click', () => modal.remove());

        // Save Button Logic
        document.getElementById('bvf-save').addEventListener('click', () => {
            const newSettings = {
                video_left: parseInt(document.getElementById('sel_video_left').value, 10),
                video_middle: parseInt(document.getElementById('sel_video_middle').value, 10),
                video_ctrl: parseInt(document.getElementById('sel_video_ctrl').value, 10),
                host_left: parseInt(document.getElementById('sel_host_left').value, 10),
                host_middle: parseInt(document.getElementById('sel_host_middle').value, 10),
                host_ctrl: parseInt(document.getElementById('sel_host_ctrl').value, 10),
                update_query: parseInt(document.getElementById('sel_update_query').value, 10),
                force_vidadt: parseInt(document.getElementById('sel_force_vidadt').value, 10),
                force_refresh: parseInt(document.getElementById('sel_force_refresh').value, 10),
            };
            GM_setValue('bvf_settings', newSettings);
            settings = newSettings;
            window.location.reload();
        });
    }

    function createSelectHTML(label, key) {
        let optionsHtml = '';
        for (let i = 1; i <= 6; i++) {
            const selected = settings[key] === i ? 'selected' : '';
            optionsHtml += `<option value="${i}" ${selected}>${actionLabels[i]}</option>`;
        }
        return `
            <div style="display:flex; flex-direction:column; gap:5px;">
                <label style="font-weight:bold; font-size:13px;">${label}</label>
                <select id="sel_${key}" style="padding:6px; border:1px solid #ccc; border-radius:4px; font-size:13px;">
                    ${optionsHtml}
                </select>
            </div>
        `;
    }

    GM_registerMenuCommand("⚙️ Configure Click Behaviors", openSettingsUI);

    // --- Core Logic ---

    function buildBingVideoUrl(videoId, title) {
        const currentQ = new URLSearchParams(window.location.search).get('q');
        const qParam = (settings.update_query === 0 && currentQ) ? currentQ : title;

        const params = new URLSearchParams({ q: qParam, view: 'detail', mid: videoId });

        // V2.4 Layout Logic: Handle the &mmscn=vidadt parameter based on settings
        if (settings.force_vidadt === 1) {
            params.set('mmscn', 'vidadt'); // Force add
        } else if (settings.force_vidadt === 3 && isVidadt) {
            params.set('mmscn', 'vidadt'); // Retain current page's state
        }
        // If force_vidadt === 2, we just don't set it at all.

        return 'https://www.bing.com/videos/search?' + params.toString();
    }

    function getCardData(card) {
        const mmetaRaw = card.getAttribute('mmeta');
        if (mmetaRaw) {
            try {
                const mmeta = JSON.parse(mmetaRaw);
                if (mmeta.mid) return { videoId: mmeta.mid, title: card.querySelector('.title')?.getAttribute('title') ?? card.querySelector('.title')?.textContent?.trim() ?? '' };
            } catch (_) {}
        }
        const playinfo = card.querySelector('.playinfo[data-inst-info]');
        if (playinfo) {
            try {
                const info = JSON.parse(playinfo.getAttribute('data-inst-info'));
                if (info.videoId) return { videoId: info.videoId, title: card.querySelector('.title')?.getAttribute('title') ?? card.querySelector('.title')?.textContent?.trim() ?? '' };
            } catch (_) {}
        }
        return null;
    }

    function executeAction(actionCode, bingUrl, hostUrl) {
        const targetUrl = (actionCode <= 3) ? bingUrl : hostUrl;

        if (actionCode === 1 || actionCode === 4) {
            window.location.href = targetUrl;
        } else if (actionCode === 2 || actionCode === 5) {
            GM_openInTab(targetUrl, { active: false, insert: true });
        } else if (actionCode === 3 || actionCode === 6) {
            GM_openInTab(targetUrl, { active: true, insert: true });
        }
    }

    function attachInteractionHandlers(element, source, bingUrl, hostUrl) {
        const getClickType = (e) => {
            if (e.button === 1) return 'middle';
            if (e.button === 0 && (e.ctrlKey || e.metaKey)) return 'ctrl';
            if (e.button === 0 && !e.shiftKey) return 'left';
            return null;
        };

        element.addEventListener('mousedown', (e) => {
            if (e.button === 2) return;

            const clickType = getClickType(e);
            if (!clickType) return;

            const actionCode = settings[`${source}_${clickType}`];

            const isPassThrough = (source === 'video' && clickType === 'left' && actionCode === 1 && settings.force_refresh === 0);;

            if (isPassThrough) {
                element.style.pointerEvents = 'none';
                setTimeout(() => { element.style.pointerEvents = ''; }, 200);
            } else if (clickType === 'middle') {
                e.preventDefault();
                e.stopPropagation();
            } else {
                e.stopPropagation();
            }
        });

        const handleExecution = (e) => {
            if (e.button === 2) return;

            const clickType = getClickType(e);
            if (!clickType) return;

            const actionCode = settings[`${source}_${clickType}`];
            const isPassThrough = (source === 'video' && clickType === 'left' && actionCode === 1 && settings.force_refresh === 0);;

            if (isPassThrough) {
                return; // Bing native loader handles this
            }

            e.preventDefault();
            e.stopPropagation();
            executeAction(actionCode, bingUrl, hostUrl);
        };

        element.addEventListener('click', handleExecution);
        element.addEventListener('auxclick', handleExecution);
    }

    // V2.5: Apply routing behavior to the main embedded video's metadata links
    function patchMainVideoLinks() {
        const selectors = [
            '.metadataArea .mmvdp_meta_top a.metaItem:not([data-bvf-patched])', // Video Title
            '.metadataArea a.source.tosurl:not([data-bvf-patched])',           // Host Website
            '.metadataArea a.metaItem.vctil:not([data-bvf-patched])'            // Uploader Channel
        ];

        document.querySelectorAll(selectors.join(', ')).forEach(link => {
            // Stamp it so we don't attach duplicate listeners on DOM reloads
            link.dataset.bvfPatched = '1';

            // Remove target so our JS fully controls tab routing
            link.removeAttribute('target');

            // By passing link.href as both bingUrl and hostUrl, we ensure that if a user
            // maps a host setting to a "Bing Embed" action (1,2,3), it still gracefully
            // routes to the external channel/video using the correct tab logic.
            attachInteractionHandlers(link, 'host', link.href, link.href);
        });
    }

    function patchCards() {
        document.querySelectorAll('.videoTile.wilcpt:not([data-bvf-patched])').forEach(card => {
            const data = getCardData(card);
            if (!data) return;

            card.dataset.bvfPatched = '1';
            const bingUrl = buildBingVideoUrl(data.videoId, data.title);
            let hostUrl = '';

            const hostLink = card.querySelector('a.source.tosurl');
            if (hostLink) {
                hostUrl = hostLink.href;
                if (getComputedStyle(hostLink).position === 'static') {
                    hostLink.style.position = 'relative';
                }
                hostLink.style.zIndex = '20';

                hostLink.removeAttribute('target');

                attachInteractionHandlers(hostLink, 'host', bingUrl, hostUrl);
            }

            if (getComputedStyle(card).position === 'static') {
                card.style.position = 'relative';
            }

            const overlay = document.createElement('a');
            overlay.href = bingUrl;
            overlay.title = data.title;
            overlay.style.cssText = 'position:absolute;inset:0;z-index:10;display:block;';

            attachInteractionHandlers(overlay, 'video', bingUrl, hostUrl);

            card.appendChild(overlay);
        });
    }

    patchCards();
    patchMainVideoLinks();

    let debounceTimer;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            patchCards();
            patchMainVideoLinks();
        }, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();
