"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseListTimelineTweets = void 0;
const timeline_v2_1 = require("./timeline-v2");
function parseListTimelineTweets(timeline) {
    let bottomCursor;
    let topCursor;
    const tweets = [];
    const instructions = timeline.data?.list?.tweets_timeline?.timeline?.instructions ?? [];
    for (const instruction of instructions) {
        const entries = instruction.entries ?? [];
        for (const entry of entries) {
            const entryContent = entry.content;
            if (!entryContent)
                continue;
            if (entryContent.cursorType === 'Bottom') {
                bottomCursor = entryContent.value;
                continue;
            }
            else if (entryContent.cursorType === 'Top') {
                topCursor = entryContent.value;
                continue;
            }
            const idStr = entry.entryId;
            if (!idStr.startsWith('tweet') &&
                !idStr.startsWith('list-conversation')) {
                continue;
            }
            if (entryContent.itemContent) {
                (0, timeline_v2_1.parseAndPush)(tweets, entryContent.itemContent, idStr);
            }
            else if (entryContent.items) {
                for (const contentItem of entryContent.items) {
                    if (contentItem.item &&
                        contentItem.item.itemContent &&
                        contentItem.entryId) {
                        (0, timeline_v2_1.parseAndPush)(tweets, contentItem.item.itemContent, contentItem.entryId.split('tweet-')[1]);
                    }
                }
            }
        }
    }
    return { tweets, next: bottomCursor, previous: topCursor };
}
exports.parseListTimelineTweets = parseListTimelineTweets;
//# sourceMappingURL=timeline-list.js.map