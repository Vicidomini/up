let Recall
(async () => {
    const module = await import("./recall.js");
    Recall = module.Recall
})();

const parseHostname = () => {
    const units = window.location.hostname.split('.');
    const domain = units.splice(-2).join('.');
    const subdomain = units.join('.');
    return [subdomain, domain]
}
const [subdomain, domain] = parseHostname()
console.log(`[UP] for ${domain}`)

const quarry = {
    _target: false,
    get target() {
        return quarry._target;
    },
    set target(t) {
        if (quarry._target !== t) {
            quarry._target = t;
            quarry.setTimestamp();
            popup.connect();
        }
    },
    created: new Date(),
    setCaratToEnd(element) {
        if (element.type !== "textarea" && element.contentEditable) {
            element.focus();
            window.getSelection().selectAllChildren(element);
            window.getSelection().collapseToEnd();
        } else {
            element.focus();
            element.select();
            window.getSelection().collapseToEnd();
        }
    },
    setTimestamp: () => {
        quarry._target?.recall?.setTimestamp();
    },
    paste: (newInput) => {
        if (quarry._target) {
            quarry._target.recall?.swapValue(newInput);
            quarry.setCaratToEnd(quarry._target);
        }
    },
    sendLogTo: (action) => {
        quarry._target?.recall?.sendLog(action);
    },
}

const tags = new Set(["INPUT", "TEXTAREA"])
const getAttrType = (tgt) => {
    if (tags.has(tgt.tagName)) return "value";
    if (!tgt.contentEditable) return; // not an input element
    if (tgt.id === "input") return "innerHTML";
    if (tgt.getAttribute('data-a-target') === 'chat-input') return "textContent";
}

const setupYoutube = async (subdomain) => {
    document.getElementById("chat").addEventListener("click", (e) => {
        if (e.target.id === "message") {
            quarry.paste(e.target.innerHTML);
        } else if (e.target.parentNode.id === "message") {
            const clone = e.target.parentNode.cloneNode(true);
            for (const child of clone.children) {
                if (child.tagName !== "IMG") {
                    child.remove();
                }
            }
            quarry.paste(clone.innerHTML);
        }
    });
}
const setupTwitch = (subdomain) => {
    Recall.prototype.swapValue = function (value) {
        this.target.dispatchEvent(new Event('focus', {
            bubbles: true,
            cancelable: true,
            composed: true
        }));
        this.target.dispatchEvent(new InputEvent('beforeinput', {
            inputType: 'deleteHardLineBackward'
        }));
        this.target.dispatchEvent(new InputEvent('beforeinput', {
            inputType: 'deleteHardLineForward'
        }));
        this.target.dispatchEvent(new InputEvent('beforeinput', {
            inputType: 'insertText',
            data: value.slice(0, 500)
        }));
    }
}
const setupDefault = (subdomain) => { }

const historyDemo = [];

const setRecall = (tgt) => {
    const attrType = getAttrType(tgt)
    if (attrType) {
        if (!Recall) return;
        quarry.target = tgt
        switch (domain) {
            case 'youtube.com':
                setupYoutube(subdomain)
                break;
            case 'twitch.tv':
                setupTwitch(subdomain)
                break;
            default:
                setupDefault(subdomain)
                break;
        }
        new Recall(tgt, attrType, historyDemo)
        tgt.addEventListener('click', (e) => {
            quarry.setTimestamp();
            if (!popup.port) {
                popup.connect();
            }
        });

    }
    return tgt.recall
}

const hasRecall = (tgt) => {
    if (tgt.recall) {
        quarry.target = tgt;
        return tgt.recall;
    }
    return setRecall(tgt);
}




/* EVENTS */
const handlers = {
    keydown: () => { hasRecall(document.activeElement) },
    click: () => { hasRecall(document.activeElement) ?? handlers.firstclick() },
    firstclick: () => { document.addEventListener('click', handlers.click, { once: true }) },
};

const extension = {
    valid: () => chrome.runtime?.id,
    speak: (message) => {
        if (!extension.valid()) return;
        chrome.runtime.sendMessage(message).catch((error) => { });
    },
    listen: (action) => {
        chrome.runtime.onMessage.addListener(action);
    },
    getURL: (url) => {
        if (!extension.valid()) return;
        return chrome.runtime.getURL(url);
    },
};

const interceptor = {
    toggle: (state) => {
        document.dispatchEvent(new CustomEvent('toggle-up-fetch-interceptor', { detail: { turn: state } }))
    },
    activate: (port) => {
        interceptor.toggle("on");
        port.onDisconnect.addListener(() => {
            interceptor.toggle("off");
        });
    },
    forward: (e) => { // forward the data from injected script to popup
        popup.speak({ event: "fetch-intercepted", data: e.detail })
    },
};

const popup = {
    _port: false,
    get port() {
        return popup._port;
    },
    set port(port) {
        if (popup._port) {
            popup._port.disconnect();
        }
        popup._port = port;
    },
    on: false,
    connect: () => {
        if (!extension.valid()) return
        const port = chrome.runtime.connect();
        const runOnce = (action) => {
            const modifiedAction = (message) => {
                if (action(message)) {
                    port.onMessage.removeListener(modifiedAction);
                }
            };
            port.onMessage.addListener(modifiedAction);
        }
        const step1 = (m) => {
            switch (m.event) {
                case 'port-activated':
                    if (quarry.target) {
                        quarry.sendLogTo((h, t) => {
                            port.postMessage({ history: h, timestamp: t });
                        });
                    } else {
                        port.postMessage({ history: [], timestamp: quarry.created });
                    }
                    runOnce(step2);
                    return true;
            }
        }
        const step2 = (m) => {
            switch (m.event) {
                case 'time-newest':
                    popup.port = port;
                    popup.connected();
                case 'time-late': // disconnect fires on other side
                case 'time-same':
                    return true;
            }
        }
        runOnce(step1)
        port.onDisconnect.addListener(() => {
            if (chrome.runtime.lastError) { /* onConnect not found */ }
            if (popup.port === port) {
                popup.port = false;
            }
        });
    },
    connected: () => {
        if (domain === "youtube.com") {
            interceptor.activate(popup.port);
        }
        popup.port.onMessage.addListener((m) => {
            switch (m.event) {
                case 'paste':
                    if (quarry.target) {
                        quarry.paste(m.input);
                        popup.speak({ event: "pasted" })
                    }
                    break;
                case 'time-stale': // disconnect fires on other side
                    break;
            }
        });
    },
    from: (m) => {
        switch (m.event) {
            case 'popup-activated':
                popup.connect();
                break;
            case 'popup-deactivated':
                break;
        }
    },
    speak: (message) => {
        if (popup.port) {
            popup.port.postMessage(message);
        }
    },
};

handlers.firstclick()
document.addEventListener('keydown', handlers.keydown, true);
document.addEventListener('fetch-intercepted', interceptor.forward)
extension.listen(popup.from)

// Inject Filter
// https://stackoverflow.com/questions/9515704/access-variables-and-functions-defined-in-page-context-using-a-content-script/9517879#9517879
const injectScript = (url) => {
    const s = document.createElement('script');
    s.src = extension.getURL(url);
    s.onload = function () { this.remove(); };
    (document.head || document.documentElement).appendChild(s);
}
if (domain === "youtube.com") injectScript('js/filter.js');

