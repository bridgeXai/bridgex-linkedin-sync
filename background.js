chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "extract-to-memo",
    title: "BridgeX 同步此信息作为履历备注",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "extract-to-message",
    title: "BridgeX 保存为发出的消息",
    contexts: ["selection"],
  });
});

function notifySaved(tabId) {
  chrome.action.setBadgeText({ text: "+1", tabId });
  chrome.action.setBadgeBackgroundColor({ color: "#057642" });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.selectionText) return;

  if (info.menuItemId === "extract-to-memo") {
    chrome.storage.local.get(["temp_memo"], (data) => {
      const existing = data.temp_memo ? `${data.temp_memo}\n\n` : "";
      chrome.storage.local.set({ temp_memo: existing + info.selectionText }, () => {
        notifySaved(tab.id);
      });
    });
    return;
  }

  if (info.menuItemId === "extract-to-message") {
    chrome.storage.local.set({ temp_message: info.selectionText.trim() }, () => {
      notifySaved(tab.id);
    });
  }
});
