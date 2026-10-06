chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download_video" && message.url) {
    const filename = message.filename || `x_video_${Date.now()}.mp4`;

    chrome.downloads.download(
      {
        url: message.url,
        filename: filename,
        saveAs: false
      },
      (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          sendResponse({
            success: false,
            error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Download failed"
          });
        } else {
          sendResponse({ success: true, downloadId: downloadId });
        }
      }
    );
    return true;
  }
});