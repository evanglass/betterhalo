const LMS_AUTH_cookie_name = 'TE1TX0FVVEg'; // 'LMS_AUTH' in Base64
const LMS_CONTEXT_cookie_name = 'TE1TX0NPTlRFWFQ'; // 'LMS_CONTEXT' in Base64

function getHaloUrl() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('haloUrl', (data) => {
            resolve(data.haloUrl || 'https://halo.gcu.edu');
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'get_lms_cookies') {
        // Send back the LMS_AUTH and LMS_CONTEXT cookies for the Halo URL

        if (!sender.tab || !sender.tab.id) {
            sendResponse({ error: 'No tab information' });
            return false;
        }

        const storeId = sender.tab.cookieStoreId;

        getHaloUrl().then((haloUrl) => {
            if (!haloUrl) {
                sendResponse({ error: 'Halo URL not set' });
                return;
            }

            chrome.cookies.getAll({ url: haloUrl, storeId: storeId }, (cookies) => {
                let lmsAuthCookie = cookies.find(cookie => cookie.name === LMS_AUTH_cookie_name);
                let lmsContextCookie = cookies.find(cookie => cookie.name === LMS_CONTEXT_cookie_name);
                sendResponse({
                    LMS_AUTH: lmsAuthCookie ? lmsAuthCookie.value : null,
                    LMS_CONTEXT: lmsContextCookie ? lmsContextCookie.value : null,
                });
            });
        });

        return true;
    } else if (request.action === 'get_halo_url') {
        // Send back the saved Halo URL

        getHaloUrl().then((haloUrl) => {
            sendResponse({ haloUrl });
        });
        return true;
    }

    sendResponse({error: "Unknown action", action: request.action});
    return true;
});

chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
  if (details.frameId === 0) { // Ensures it runs for the top frame only
    chrome.tabs.sendMessage(details.tabId, { action: "historyStateUpdated", url: details.url }).catch(() => {
        // Ignore errors when the content script isn't ready
    });
  }
});

// The content script waits for cookies to be set before updating the homepage.
// This is usually done via the get_lms_cookies message, but on first load the cookies don't exist yet.
// In that case, we'll listen for cookie changes here and notify the content script when they get set.
chrome.cookies.onChanged.addListener(function(changeInfo) {
    if (changeInfo.cookie.name === LMS_AUTH_cookie_name || changeInfo.cookie.name === LMS_CONTEXT_cookie_name) {
        getHaloUrl().then((haloUrl) => {
            if (!haloUrl) return;

            chrome.tabs.query({ url: haloUrl + "/*" }, function(tabs) {
                tabs.forEach(function(tab) {
                    if (changeInfo.cookie.name === LMS_AUTH_cookie_name) {
                        chrome.tabs.sendMessage(tab.id, { action: "lmsCookiesChanged", cookieName: "LMS_AUTH", cookieValue: changeInfo.cookie.value }).catch(() => {});
                    } else if (changeInfo.cookie.name === LMS_CONTEXT_cookie_name) {
                        chrome.tabs.sendMessage(tab.id, { action: "lmsCookiesChanged", cookieName: "LMS_CONTEXT", cookieValue: changeInfo.cookie.value }).catch(() => {});
                    }
                });
            });
        });
    }
});
