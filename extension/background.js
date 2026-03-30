// Novel Studio Connector — Background Service Worker

chrome.runtime.onMessageExternal.addListener(
  (request, _sender, sendResponse) => {
    if (request.type === "PING") {
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
      return false;
    }

    if (request.type === "FETCH") {
      handleFetch(
        request.url,
        request.waitSelector,
        request.clickSelector,
        request.timeout || 10000,
      )
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }

    sendResponse({ ok: false, error: "Unknown message type" });
    return false;
  },
);

async function handleFetch(url, waitSelector, clickSelector, timeout) {
  const logs = [];
  const log = (msg) => { logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`); };

  const win = await chrome.windows.create({ url, state: "minimized" });
  const tabId = win.tabs[0].id;
  const windowId = win.id;
  log(`tab created (minimized window)`);

  try {
    await waitForTabLoad(tabId);
    log(`page loaded`);
    await delay(1500);

    let timedOut = false;
    if (clickSelector && waitSelector) {
      timedOut = await clickAndWait(tabId, clickSelector, waitSelector, timeout, log);
    } else if (clickSelector) {
      await robustClick(tabId, clickSelector);
      log(`clicked: ${clickSelector}`);
    } else if (waitSelector) {
      timedOut = await waitForSelector(tabId, waitSelector, timeout, 200);
      log(timedOut ? `wait timeout: ${waitSelector}` : `content ready: ${waitSelector}`);
    } else {
      await waitForStableContent(tabId, timeout);
      log(`content stabilized`);
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      args: [waitSelector || null],
      func: (sel) => {
        const html =
          "<!DOCTYPE html><html>" +
          document.head.outerHTML +
          "<body>" +
          document.body.innerHTML +
          "</body></html>";

        let contentText = null;
        if (sel) {
          const el = document.querySelector(sel);
          if (el) contentText = el.innerText;
        }

        return { html, contentText };
      },
    });

    const data = results?.[0]?.result;
    if (!data) throw new Error("Failed to extract page content");

    log(`extracted: html=${data.html.length} contentText=${data.contentText?.length ?? 0}${timedOut ? " (TIMEOUT)" : ""}`);
    return { html: data.html, contentText: data.contentText, timedOut, logs };
  } catch (err) {
    log(`error: ${err.message}`);
    throw Object.assign(err, { logs });
  } finally {
    try {
      await chrome.windows.remove(windowId);
    } catch {}
  }
}

/**
 * Click element and wait for content, with retry.
 * If content doesn't appear after first click, try clicking again.
 */
async function clickAndWait(tabId, clickSel, waitSel, timeout, log) {
  const maxRetries = 3;
  const perAttemptTimeout = Math.floor(timeout / maxRetries);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await robustClick(tabId, clickSel);
    log(`click attempt ${attempt + 1}/${maxRetries}`);

    const timedOut = await waitForSelector(
      tabId,
      waitSel,
      perAttemptTimeout,
      200,
    );

    if (!timedOut) {
      log(`content loaded after attempt ${attempt + 1}`);
      return false;
    }

    log(`attempt ${attempt + 1} timeout — retrying`);
  }

  log("all click attempts exhausted");
  return true;
}

/**
 * Try multiple click methods to maximize compatibility.
 */
async function robustClick(tabId, selector) {
  await chrome.scripting.executeScript({
    target: { tabId },
    args: [selector],
    func: (sel) => {
      const el = document.querySelector(sel);
      if (!el) return;

      // Method 1: native click
      el.click();

      // Method 2: dispatch full mouse event sequence
      const opts = { bubbles: true, cancelable: true, view: window };
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));

      // Method 3: focus + Enter (for elements that respond to keyboard)
      if (typeof el.focus === "function") el.focus();
    },
  });
  await delay(500);
}

async function waitForSelector(tabId, selector, maxWait, minLength) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      args: [selector],
      func: (sel) => {
        const el = document.querySelector(sel);
        if (!el) return 0;
        const clone = el.cloneNode(true);
        clone
          .querySelectorAll("script, style, noscript")
          .forEach((s) => s.remove());
        return clone.textContent.trim().length;
      },
    });
    const len = results?.[0]?.result ?? 0;
    if (len > minLength) return false;
    await delay(500);
  }
  return true;
}

async function waitForStableContent(tabId, maxWait) {
  const start = Date.now();
  let lastLength = 0;
  let stableCount = 0;
  await delay(2000);
  while (Date.now() - start < maxWait) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const clone = document.body.cloneNode(true);
        clone
          .querySelectorAll("script,style,noscript")
          .forEach((el) => el.remove());
        return clone.textContent.trim().length;
      },
    });
    const len = results?.[0]?.result ?? 0;
    if (len === lastLength && len > 0) {
      stableCount++;
      if (stableCount >= 2) return;
    } else stableCount = 0;
    lastLength = len;
    await delay(500);
  }
}

function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timeout (30s)"));
    }, 30000);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timeout);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
