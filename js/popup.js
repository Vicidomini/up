console.log("[UP] popup created")

let tabId = Number(new URLSearchParams(location.search).get('tabId'));
if (tabId) { // detached popup
    onbeforeunload = () => {
        chrome.action.setPopup({ popup: "popup.html" });
    };
}

/* 
    buckets array
    ↪ [0]: lookup table Map
    ↪ bucket array
      ↪ [0]: data count num
      ↪ [i]: data any
*/
class Bucket {
    constructor() {
        this.buckets = [];
        this.buckets[0] = new Map();
    }

    get lookup() {
        return this.buckets[0]
    }

    set lookup([data, location]) {
        this.buckets[0].set(data, location)
    }

    last(bucket) {
        for (let i = bucket?.length; i >= 0; i--) {
            if (bucket[i]) return bucket[i];
        }
    }

    prev(index) {
        for (let i = index; i >= 1; i--) {
            if (this.buckets[i]) return this.buckets[i];

        }
    }

    add(data, index) {
        this.remove(data);
        if (this.buckets[index]) {
            this.buckets[index][0]++;
            this.buckets[index].push(data);
            this.lookup = [data, [index, this.buckets[index].length - 1]];
        } else {
            this.buckets[index] = [1, data];
            this.lookup = [data, [index, 1]];
        }
    }

    remove(data) {
        const loc = this.lookup.get(data);
        if (!loc) {
            return; // no data to remove
        }
        this.lookup.delete(data);
        this.buckets[loc[0]][0]--;
        if (this.buckets[loc[0]][0]) {
            delete this.buckets[loc[0]][loc[1]];
        } else {
            delete this.buckets[loc[0]];
        }
    }

    put(element, parent) {
        if (this.lookup.get(element)) {
            this.remove(element);
            parent.removeChild(element);
        }
        const bucket = this.prev(element.counter);
        parent.insertBefore(element, this.last(bucket));
        this.add(element, element.counter);
    }
}

class ULControl {
    static #port
    static get port() {
        return ULControl.#port;
    }
    static set port(port) {
        if (ULControl.#port !== port) {
            ULControl.#port?.disconnect();
            ULControl.#port = port;
        }
    }

    constructor(key) {
        this.contentLiMap = new Map();
        this.key = key;
        this.order = "ascending";
        this.bucket = new Bucket();
        this.limit = 0;

        this.ul = document.getElementById(key);
        this.ul.addEventListener('pointerdown', this.handle.pointerDown);
        this.ul.addEventListener('click', this.handle.click);
        // this.ul.addEventListener('dblclick', this.handleDoubleClick);
    }

    upsert(content) {
        let li = this.contentLiMap.get(content);
        if (li) {
            if (this.order !== "bucket") return li
            if (li.counter === 1) {
                li.setAttribute("data-meter", "");
            }
            li.counter++;
            li.style.setProperty("--meter", `'x${li.counter}'`);
            this.contentLiMap.delete(content);
            this.contentLiMap.set(content, li);
        } else {
            li = this.create.LI(content);
            this.contentLiMap.set(content, li);
        }
        if (this.limit) {
            this.slidingWindow()
        }
        return li;
    }

    slidingWindow() {
        if (this.contentLiMap.size < this.limit) {
            return; // still within the window
        }
        const iter = this.contentLiMap.entries()
        while (this.limit && this.contentLiMap.size > this.limit) {
            const [key, val] = iter.next().value;
            this.contentLiMap.delete(key);
            this.bucket.remove(val);
            val.remove();
        }
    }


    create = {
        SPAN: (content) => {
            const span = document.createElement('span');
            span.className = "truncate-ellipsis";
            span.innerHTML = `${content}`;
            return span;
        },
        LI: (record) => {
            const li = document.createElement('li');
            li.title = record;
            li.counter = 1;
            li.appendChild(this.create.SPAN(record));
            return li;
        },
    }

    process = (record) => {
        const li = this.upsert(record);
        switch (this.order) {
            case "ascending":
                this.ul.appendChild(li);
                break;
            case 'descending':
                this.ul.insertBefore(li, this.ul.firstChild);
                break;
            case 'bucket':
                this.bucket.put(li, this.ul);
                break;
        }
    }

    refresh() {
        this.ul.innerHTML = "";
        List.lists[this.key].list.forEach((record) => {
            this.process(record)
        })
    }

    onClick = {
        getContent: (e) => {
            switch (e.target.tagName) {
                case 'UL':
                    return false;
                case 'LI':
                    return e.target.title;
                case 'SPAN':
                    return e.target.parentNode.title;
                default:
                    return e.target.parentNode.parentNode.title;
            }
        },
        getLI: (e) => {
            switch (e.target.tagName) {
                case 'UL':
                    return false;
                case 'LI':
                    return e.target;
                case 'SPAN':
                    return e.target.parentNode;
                default:
                    return e.target.parentNode.parentNode;
            }
        },
    }

    newLoadingBar = (element, duration, delayedAction) => {
        const loadingBar = document.createElement('div');
        loadingBar.className = 'loading-bar';
        loadingBar.style.cssText = `--duration: ${duration}ms;`
        element.appendChild(loadingBar);

        document.addEventListener('pointerup', () => {
            element.removeChild(loadingBar);
            clearTimeout(delayedAction);
        }, { once: true });
    }

    timeoutAction = (e) => {
        const record = this.onClick.getContent(e);
        const li = this.onClick.getLI(e);
        if (this.order === "bucket") {
            this.bucket.remove(li);
        }
        li.remove();
        List.lists[this.key].relocate(record);
    }

    handle = {
        pendingClick: 0,
        pointerDown: (e) => {
            const duration = 600; // milliseconds
            const li = this.onClick.getLI(e);
            if (!li) {
                return; // clicked on UL
            }
            this.newLoadingBar(li, duration, setTimeout(this.timeoutAction, duration, e));
        },
        update: (e) => {
            const content = this.onClick.getContent(e);
            if (!content) {
                return // clicked on UL
            };
            const event = "paste"
            const input = content
            ULControl.port?.postMessage({ event, input });
        },
        click: (e) => {
            if (this.handle.pendingClick) {
                clearTimeout(this.handle.pendingClick);
                this.handle.pendingClick = 0;
            }
            switch (e.detail) {
                case 1:
                    this.handle.pendingClick = setTimeout(() => {
                        this.handle.update(e)
                    }, 200);// should match OS multi-click speed
                    return;
                case 2:
                    return; // double click

            }
        }
    }
}

class List {
    static lists = {}

    constructor(key) {
        this.list = new Set();
        this.key = key;
        this.UL = new ULControl(key);
        List.lists[key] = this;
    }

    type = "local";
    save = false;

    add(record) {
        this.delete(record);
        this.list.add(record);
    }

    delete(record) {
        this.list.delete(record);
        return this;
    }

    has(record) {
        return this.list.has(record);
    }

    clear() {
        this.list.clear();
    }

    async read() {
        const local = await chrome.storage[this.type].get(this.key)
        local[this.key]?.forEach(key => {
            this.add(key);
        });
    }

    async write() {
        if (this.save) {
            await chrome.storage[this.type].set({ [this.key]: Array.from(this.list) })
        }
        return this;
    }

    async purge() { // removes ALL saved content
        await chrome.storage[this.type].clear();
    }

    #subs = []
    get subs() {
        return this.#subs;
    }
    set subs(subscriber) {
        this.#subs.push(this.action(subscriber));
    }

    action(subscriber) {
        return (message) => {
            subscriber.UL.process(message);
            if (!subscriber.save) {
                return; // no reason to add if I'm not saving
            }
            subscriber.add(message);
            subscriber.write();
        }
    }

    publish(message) {
        this.#subs.forEach((publish) => {
            publish(message);
        });
        return this;
    }

    relocate(message) {
        return this.delete(message).publish(message).write();
    }
}

const lists = {
    pinned: new List("pinned"),
    history: new List("entries"),
    filter: new List("filter"),
    timestamp: 0,
};

lists.pinned.subs = lists.history;
lists.pinned.save = true;
lists.history.subs = lists.pinned;
lists.history.UL.order = "descending";
lists.filter.subs = lists.pinned;
lists.filter.UL.order = "bucket";


const filterLimit = document.getElementById('filterLimit');
chrome.storage.local.get(['filterLimit'], function (data) {
    let number = 99;
    if (data.filterLimit) {
        number = parseFloat(data.filterLimit);

    }
    filterLimit.value = number;
    lists.filter.UL.limit = number;
});
filterLimit.addEventListener('input', function () {
    const number = parseFloat(filterLimit.value);
    if (!isNaN(number)) {
        chrome.storage.local.set({ 'filterLimit': number });
        lists.filter.UL.limit = number;
    }
});

// [lifecycle] popup.js sendMessage > cscript.js onMessage > recall.js connect > popup.js onConnect
const fromCScript = (port) => {
    port.postMessage({ event: "port-activated" });
    const runOnce = (action) => {
        const modifiedAction = (message) => {
            action(message);
            port.onMessage.removeListener(modifiedAction);
        };
        port.onMessage.addListener(modifiedAction);
    }
    const step1Response = (msg) => {
        if (msg.timestamp < lists.timestamp) {
            port.postMessage({ event: "time-late" });
            port.disconnect(); // only fired on other end
            return; // not the most recent
        }
        if (msg.timestamp === lists.timestamp) {
            port.postMessage({ event: "time-same" });
            return; // already active
        }
        if (ULControl.port) {
            ULControl.port.postMessage({ event: "time-stale" });
            ULControl.port.disconnect();
        }
        ULControl.port = port;
        tabId = port.sender.tab.id;
        port.postMessage({ event: "time-newest" });
        lists.timestamp = msg.timestamp;
        lists.history.clear();
        msg.history?.forEach((record) => {
            if (!lists.pinned.has(record)) {
                lists.history.add(record);
            }
        });
        lists.history.UL.refresh();
    }
    runOnce(step1Response);
    port.onMessage.addListener((request) => {
        switch (request.event) {
            case "fetch-intercepted":
                lists.filter.UL.process(request.data)
                return;
            case "pasted":
                chrome.windows.update(port.sender.tab.windowId, { focused: true }, () => { });
                return;
        }
    });
    port.onDisconnect.addListener(() => {
        ULControl.port = undefined;
        lists.history.clear();
        lists.history.UL.refresh();
    });
}
chrome.runtime?.onConnect.addListener(fromCScript);

const sendMessageToActiveTab = async (event) => {
    if (!tabId) {
        let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        tabId = tab.id
    }
    chrome.tabs.sendMessage(tabId, { event })
        .catch(e => console.log("no content script"));
}

lists.pinned.read().then(() => {
    lists.pinned.UL.refresh();
    sendMessageToActiveTab("popup-activated");
});

// new user input 
chrome.runtime?.onMessage.addListener((m) => {
    if (m.event === "log-updated") {
        lists.history.UL.process(m.record)
    }
});

// gets rid of strange ::-webkit-scrollbar shadow
window.onload = () => {
    var button = document.getElementById("home");
    if (button) { button.click() }
};

// Detach Popup
document.getElementById("toplogo").addEventListener("click", async () => {
    const views = chrome.extension.getViews({ type: "popup" });
    if (views.length > 0) {
        chrome.runtime?.onConnect.removeListener(fromCScript); // must stop listener or will double
        chrome.windows.create({
            type: "popup",
            url: `popup.html?${new URLSearchParams({
                tabId: tabId,
            })}`,
            width: 400,
            height: 700,
        }).then((newpop) => {
            chrome.action.setPopup({
                popup: `detach.html?${new URLSearchParams({
                    windowId: newpop.id,
                })}`
            });
            views[0].close();
        });
    } else {
        // default only popup action
        // sendMessageToActiveTab("popup-activated");
    }
});


const markdownParser = (text) => {
    const lines = text.split('\n');
    const li = new Set(['-', '*', '+']);

    text = ""
    let space = 0;
    let ulLevel = 0;
    for (const line of lines) {
        const trimmed = line.trimStart();
        const wsCount = line.length - trimmed.length;
        const index = trimmed.indexOf(" ");
        const marker = trimmed.slice(0, index);

        if (ulLevel && !li.has(marker)) {
            do {
                text += "</ul>"
            } while (--ulLevel)
            space = 0;
        }

        switch (marker) {
            case "#":
                text += `<h2>${trimmed.slice(index + 1)}</h2>`
                break;
            case "##":
                text += `<h3>${trimmed.slice(index + 1)}</h3>`
                break;
            case "###":
                text += `<h4>${trimmed.slice(index + 1)}</h4>`
                break;
            case "-":
            case "*":
            case "+":
                if (!ulLevel) {
                    text += "<ul>"
                    ulLevel++;
                } else if (space < wsCount) {
                    space = wsCount
                    text += "<ul>"
                    ulLevel++;
                } else if (space > wsCount) {
                    space = wsCount
                    text += "</ul>"
                    ulLevel--;
                }
                text += `<li>${trimmed.slice(index + 1)}</li>`
                break;
            default:
                break;
        }
    }
    return text;
}

fetch(`https://raw.githubusercontent.com/Vicidomini/up/main/CHANGELOG.md`)
    .then(response => response.body)
    .then((stream) => {
        const reader = stream.getReader();
        const textDecoder = new TextDecoder();
        let data = "";
        reader.read().then(function pump({ done, value }) {
            if (done) return data;
            data += textDecoder.decode(value, { stream: true });;
            return reader.read().then(pump);
        }).then(data => {
            let cL = document.getElementById("changeLog");
            // const formattedContent = data?.replace(/\n/g, '<br>')?.replace(/    /g, '&nbsp;&nbsp;&nbsp;&nbsp;');
            const formattedContent = markdownParser(data);
            var newDiv = document.createElement('div');
            newDiv.className = "md"
            newDiv.innerHTML = formattedContent;
            cL.insertBefore(newDiv, cL.firstChild);
        });
    })
    .catch(e => console.log("[UP] error", e))