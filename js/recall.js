/* QUIRKS
this.index.arr is usually out of bounds
next() and read() reflect that
push resets this.index.arr to out of bounds
*/
class ArrayChain {
    constructor(count) {
        this.count = count;
        this.index = { arr: this.count, sub: 0 };
        while (count--) {
            this[count] = [];
        }
    }

    #index
    set index(obj) {
        this.#index = obj;
        this.hold = {
            prev: 0,
            next: 0
        }
    }
    get index() {
        return this.#index;
    }

    prev() {
        if (this.hold.prev) return true
        this.hold.prev = { ...this.index }
        if (this.hold.prev.sub > 0) {
            this.hold.prev.sub--;
            return true;
        }
        while (this.hold.prev.arr > 0) {
            this.hold.prev.arr--;
            if (this[this.hold.prev.arr].length) {
                this.hold.prev.sub = this[this.hold.prev.arr].length - 1;
                return true;
            }
        }
        this.hold.prev = 0;
        return false;
    }

    next() {
        if (this.hold.next) return true
        this.hold.next = { ...this.index }
        if (this.hold.next.sub < this[this.hold.next.arr]?.length - 1) {
            this.hold.next.sub++;
            return true;
        }
        this.hold.next.sub = 0;
        while (this.hold.next.arr < this.count) {
            this.hold.next.arr++;
            if (this.hold.next.arr === this.count) {
                return true
            }
            if (this[this.hold.next.arr]?.length) {
                return true;
            }
        }
        this.hold.next = 0;
        return false;
    }

    move(direction) {
        switch (direction) {
            case 'prev':
                [this.index, this.hold.next, this.hold.prev] = [this.hold.prev, this.index, 0];
                break;
            case 'next':
                [this.index, this.hold.prev, this.hold.next] = [this.hold.next, this.index, 0];
                break;
        }
    }

    mark(iPos) {
        switch (iPos) {
            case 'head':
                this.index = { arr: 0, sub: 0 };
                break;
            case 'tail':
                this.index = { arr: this.count - 1, sub: this[this.count - 1].length - 1 };
                break;
            case 'over':
                this.index = { arr: this.count, sub: 0 };
                break;
            default:
                if (typeof iPos !== 'number') return
                for (let i = 0; i < this.count; i++) {
                    if (iPos < this[i].length) {
                        return this.index = { arr: i, sub: iPos };
                    }
                    iPos -= this[i].length;
                }
                this.index.arr = this.count;
                break;
        }
    }

    read() {
        const { arr, sub } = this.index;
        return this[arr]?.[sub];
    }

    push(value) {
        this[this.count - 1].push(value);
        this.mark("over");
        if (chrome.runtime?.id) { // might be a better method
            chrome.runtime?.sendMessage({ event: "log-updated", record: value }).catch(e => { /* Receiving end DNE */ });
        }
    }

    get length() {
        let totalLength = 0;
        for (let i = 0; i < this.count; i++) {
            totalLength += this[i].length;
        }
        return totalLength;
    }

    get isHead() {
        if (this.index.arr !== 0) return false
        if (this.index.sub !== 0) return false
        return true
    }

    get isTail() {
        if (this.index.arr !== this.count - 1) return false
        if (this.index.sub !== this[this.count - 1].length - 1) return false
        return true
    }

    get isOver() {
        if (this.index.arr !== this.count) return false
        return true
    }
}



//new Recall(div, "innerHTML", [])
export class Recall {
    static pinned = []
    static subscribers = []
    static {
        chrome.storage.local.get("pinned").then((local) => {
            this.pinned = local["pinned"] ?? []
        })
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== "local") return
            if (!changes.pinned) return
            this.pinned = changes.pinned.newValue
            this.subscribers.forEach((publish) => {
                publish(this.pinned)
            })
        });
    }

    constructor(element, attrType, history = []) {
        this.records = new ArrayChain(2);
        this.records[0] = Recall.pinned;
        this.records[1] = history;
        this.toSave = ""
        this.setTimestamp();

        this.target = element;
        this.attrType = attrType;
        element.recall = this;
        element.addEventListener('keydown', this.handleKeydown, true)

        this.obs = new Observer(this.target, this.onMutation);
        Recall.subscribers.push(this.onMessage);
    }

    get input() {
        return this.target[this.attrType]
    }

    sendLog(action) {
        action(this.records[1], this.timestamp);
    }

    save() {
        this.toSave = this.input; //goto onMutation
    }

    prev() {
        if (!this.records.prev()) return
        if (caret.position(this.target) !== "beg") return
        this.records.move("prev")
        this.obs.pause(1)
        this.swapValue(this.records.read())
    }

    next() {
        if (!this.records.next()) return
        if (caret.position(this.target) !== "end") return
        this.records.move("next")
        this.obs.pause(1)
        this.swapValue(this.records.read() ?? this.obs.value)
    }

    swapValue(value) {
        this.target[this.attrType] = value;
        this.target.dispatchEvent(new Event("input", {
            bubbles: true,
            cancelable: true
        }));
    }

    setTimestamp = () => {
        this.timestamp = new Date();
    }

    handleKeydown = (e) => {
        switch (e.key) {
            case 'Enter':
                this.save();
                break;
            case 'ArrowUp':
                this.prev();
                break;
            case 'ArrowDown':
                this.next();
                break;
        }
    };

    onMutation = () => {
        const isWalking = this.records.count !== this.records.index.arr
        const isChanged = this.records.read() !== this.input
        if (this.toSave && // syncs observation w/ enter event
            this.toSave === this.obs.value ||
            this.toSave === this.records.read()) {
            if (!this.input?.startsWith(this.toSave)) {
                this.records.push(this.toSave);
            }
            this.toSave = ""
        }
        if (!isWalking) {
            this.obs.value = this.input;
        } else if (isChanged) {
            this.obs.value = this.input;
            this.records.mark("over");
        }
    }

    onMessage = (data) => {
        this.records[0] = data
        this.records.hold = {
            prev: 0,
            next: 0
        }
    }
}

/* OBSERVER */
class Observer {
    constructor(target, action) {
        this.observer
        this.target = target
        this.action = action
        this.value = ""
        this.paused = 0

        this.newMutationObserver()
    }

    targetMutated() {
        return (mutationList) => {
            if (this.paused) return this.paused--;
            this.action()
        }
    }

    newMutationObserver() {
        console.log("[UP] Setting observer", this.target)
        this.observer = new MutationObserver(this.targetMutated())
        this.start()
    }

    update = (newValue) => {
        this.value = newValue;
    }

    start() {
        this.observer.observe(this.target, {
            characterData: true,
            childList: true,
            subtree: true
        });
    }

    stop() {
        this.observer.disconnect();
    }

    pause(value) {
        this.paused += value
    }
}


/* CARET */
// NOTE: selection.anchorNode contains the deepest element 
// <div>👏text👏</div> 
// when on t^ext, the anchorNode is text, whose parentElement.childNodes would be img,text,img
// when on 👏^, the anchorNode is <div>👏text👏</div> whose childcount is 3 img,text,img
const caret = {
    tags: new Set(["INPUT", "TEXTAREA"]),
    position(target) {
        if (this.tags.has(target.tagName)) {
            this.caretLocation = target.selectionStart
            this.contentLength = target.value.length
            return this.transcode()
        }
        this.selection = document.getSelection();
        if (this.selection.rangeCount) {
            return this.hasSelection()
        }
        return "no caret"
    },
    transcode() {
        if (this.caretLocation === 0) return "beg"
        if (this.caretLocation >= this.contentLength) return "end"
        return "mid"
    },
    hasSelection() {
        this.range = this.selection.getRangeAt(0);
        this.anchor = this.selection.anchorNode
        if (this.anchor.nodeType === Node.TEXT_NODE) {
            return this.isTextNode()
        }
        return this.isImgNode()
    },
    isTextNode() {
        const nodes = Array.from(this.anchor.parentElement.childNodes)
        const isFirst = nodes[0] === this.anchor;
        const isLast = nodes.at(-1) === this.anchor;
        if (isFirst || isLast) {
            const clean = this.insertNullAndTrim();
            if (isFirst && clean.startsWith("\0")) return "beg";
            if (isLast && clean.endsWith("\0")) return "end";
            return "mid";
        }
    },
    isImgNode() {
        this.caretLocation = this.selection.anchorOffset
        this.contentLength = this.anchor.childNodes.length
        return this.transcode()
    },
    insertNullAndTrim() {
        return (
            this.range.startContainer.textContent.slice(0, this.range.startOffset) +
            "\0" +
            this.range.startContainer.textContent.slice(this.range.startOffset)
        ).trim()
    },
};

