(function () {
  function extractTweetInfo(videoEl) {
    let username = "x";
    let statusId = null;

    const article = videoEl.closest('article[data-testid="tweet"]') || videoEl.closest("article");

    if (article) {
      const statusLinks = Array.from(
        article.querySelectorAll('a[href*="/status/"]')
      );

      for (const link of statusLinks) {
        const match = link.href.match(/\/\/x\.com\/([^/]+)\/status\/(\d+)/) ||
                      link.href.match(/\/\/twitter\.com\/([^/]+)\/status\/(\d+)/);
        if (match) {
          username = match[1];
          statusId = match[2];
          break;
        }
      }
    }

    if (!statusId) {
      const match = window.location.href.match(/\/(?:x|twitter)\.com\/([^/]+)\/status\/(\d+)/);
      if (match) {
        username = match[1];
        statusId = match[2];
      }
    }

    return { username, statusId };
  }

  async function resolveTwitterVideo(username, statusId) {
    const endpoints = [
      `https://api.vxtwitter.com/${username}/status/${statusId}`,
      `https://api.fxtwitter.com/${username}/status/${statusId}`
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) continue;

        const data = await res.json();
        
        // Check for direct video_url or media_extended entries
        if (data.media_extended && data.media_extended.length > 0) {
          const videoMedia = data.media_extended.find((m) => m.type === "video" || m.type === "gif");
          if (videoMedia && videoMedia.url) {
            return videoMedia.url;
          }
        }

        if (data.video_url) {
          return data.video_url;
        }

        if (data.tweet?.media?.videos && data.tweet.media.videos.length > 0) {
          return data.tweet.media.videos[0].url;
        }
      } catch (e) {
      }
    }

    return null;
  }

  async function triggerDownload(btn, videoEl) {
    const { username, statusId } = extractTweetInfo(videoEl);

    if (!statusId) {
      markButtonState(btn, "x-dl-error", "Tweet ID 404");
      return;
    }

    btn.className = "x-dl-btn x-dl-loading";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
      <span>Resolving...</span>
    `;

    const mp4Url = await resolveTwitterVideo(username, statusId);

    if (!mp4Url) {
      markButtonState(btn, "x-dl-error", "No MP4 found");
      return;
    }

    const filename = `x_${username}_${statusId}.mp4`;

    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
      <span>Downloading...</span>
    `;

    chrome.runtime.sendMessage(
      {
        action: "download_video",
        url: mp4Url,
        filename: filename
      },
      (res) => {
        if (res && res.success) {
          markButtonState(btn, "x-dl-success", "Saved!", true);
        } else {
          window.open(mp4Url, "_blank");
          markButtonState(btn, "x-dl-success", "Opened", true);
        }
      }
    );
  }

  function markButtonState(btn, className, text, isTemporary = false) {
    btn.className = `x-dl-btn ${className}`;
    btn.innerHTML = `<span>${text}</span>`;
    setTimeout(() => {
      resetButton(btn);
    }, isTemporary ? 2500 : 3000);
  }

  function resetButton(btn) {
    btn.className = "x-dl-btn";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
      <span>Download</span>
    `;
  }

  function attachButtonToVideo(videoEl) {
    let container = videoEl.closest('[data-testid="videoPlayer"]') ||
                    videoEl.closest('[data-testid="videoComponent"]') ||
                    videoEl.parentElement;

    if (!container) return;

    if (window.getComputedStyle(container).position === "static") {
      container.style.position = "relative";
    }

    if (container.querySelector(":scope > .x-dl-btn-container")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "x-dl-btn-container";

    const btn = document.createElement("button");
    btn.className = "x-dl-btn";
    resetButton(btn);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerDownload(btn, videoEl);
    });

    wrapper.appendChild(btn);
    container.appendChild(wrapper);
  }

  function scanForVideos() {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      const rect = video.getBoundingClientRect();
      if (rect.width > 120 && rect.height > 120) {
        attachButtonToVideo(video);
      }
    });
  }

  const observer = new MutationObserver(() => scanForVideos());
  observer.observe(document.body, { childList: true, subtree: true });

  setInterval(scanForVideos, 1000);
  scanForVideos();
})();