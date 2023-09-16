if (!window.upFetchInterceptor && window.location.hostname === "www.youtube.com") {
    //https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false
    //https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false
    let duplicates = new Set()
    console.log("[UP] Injecting toggleable fetch interceptor")

    window.upFetchInterceptor = {
        isOn: false,
    };
    window.upFetchInterceptor.off = window.fetch;
    window.upFetchInterceptor.on = async (url, options) => {
        const promise = window.upFetchInterceptor.off(url, options);
        if (url.url.includes('live_chat/get_live_chat')) {
            const isReplay = url.url.includes('live_chat/get_live_chat_replay');
            // console.group("intercepting")
            promise.then((response) => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.clone().json()
            }).then((json) => {
                // console.log("json", json.continuationContents.liveChatContinuation.actions)
                const actions = json.continuationContents.liveChatContinuation.actions ?? []
                let firstAction = true;
                for (let action of actions) {
                    if (action.replayChatItemAction?.actions[0]) { // if it's a replay
                        action = action.replayChatItemAction?.actions[0];
                    }
                    // other actions:
                    // action.removeChatItemAction
                    // item.liveChatPaidStickerRenderer
                    // item.liveChatMembershipItemRenderer
                    // item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer
                    // item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer

                    const msg = action.addChatItemAction?.item.liveChatTextMessageRenderer || action.addChatItemAction?.item.liveChatPaidMessageRenderer;
                    if (msg) {
                        if (!isReplay) { // 1,2,3,4,5 > 1,3,5 > 2,3,5 > 3,4,5
                            if (duplicates.has(msg.id)) {
                                if (firstAction) { // unlikely chance of keys before this one to be duplicates
                                    for (const key of duplicates) {
                                        if (key === msg.id) {
                                            break; // stop deleting keys
                                        }
                                        duplicates.delete(key);
                                        // console.log(key)
                                    }
                                }
                                continue; // goto next action
                            }
                            duplicates.add(msg.id);
                        }
                        // console.log("msg", msg);

                        let content = "";
                        for (let run of msg.message.runs) {
                            for (let key in run) {
                                // console.log(run[key])
                                switch (key) {
                                    case 'emoji':
                                        const img = document.createElement('img');
                                        img.src = run[key].image.thumbnails[0].url;
                                        img.alt = run[key].image.accessibility.accessibilityData.label;
                                        if (run[key].emojiId.length > 2) {
                                            img.setAttribute('data-emoji-id', run[key].emojiId);
                                        }
                                        content += img.outerHTML;
                                        break;
                                    case 'text':
                                        content += run[key];
                                        break;
                                    case 'link':
                                        content += run[key];
                                        break;
                                }
                            }
                        }
                        if (content) {
                            // console.log("content", content, action)
                            document.dispatchEvent(new CustomEvent('fetch-intercepted', { detail: content }))
                        }
                    }
                    firstAction = false;
                }
            }).catch((error) => {
                // console.log('Fetch promise error:', error);
            });
            // console.groupEnd()
        }
        return promise
    }
    document.addEventListener('toggle-up-fetch-interceptor', function (e) {
        console.log("[UP] Fetch interceptor toggle ", e.detail)
        switch (e.detail.turn) {
            case 'on':
                if (window.upFetchInterceptor.isOn) return
                // console.log("[UP] Fetch interceptor toggle ", e.detail)
                window.upFetchInterceptor.isOn = true;
                window.upFetchInterceptor.off = window.fetch
                window.fetch = window.upFetchInterceptor.on
                break;
            case 'off':
                if (!window.upFetchInterceptor.isOn) return
                // console.log("[UP] Fetch interceptor toggle ", e.detail)
                // console.log(duplicates.size)
                window.upFetchInterceptor.isOn = false;
                window.fetch = window.upFetchInterceptor.off
                break;
        }
    });
    console.log("[UP] Interceptor injected")
}


// authorBadges.customThumbnail === author that is member
// addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.icon.iconType === OWNER //(bold yellow), MODERATOR(spanner, build), VERIFIED (check)
// addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.tooltip === Owner //Moderator, Verified
// addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.accessibility.accessibilityData.label === Owner //Moderator, Verified
// addChatItemAction.item.liveChatTextMessageRenderer and no authorBadges = white
