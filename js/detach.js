const windowId = Number(new URLSearchParams(location.search).get('windowId'));

function callback(res) {
    if (chrome.runtime.lastError) { return }
}

const views = chrome.extension.getViews({ type: "popup" });
views[0].close(); // Will not focus if this is still open
chrome.windows.update(windowId, { drawAttention: true, focused: true }, callback);
