const LMS_AUTH_cookie_name = 'TE1TX0FVVEg';
const LMS_CONTEXT_cookie_name = 'TE1TX0NPTlRFWFQ';

function getHaloUrl() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('haloUrl', (data) => {
            resolve(data.haloUrl || null);
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'get_lms_cookies') {
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

        return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'get_halo_url') {
        getHaloUrl().then((haloUrl) => {
            sendResponse({ haloUrl });
        });
        return true;
    }

    sendResponse({error: "Unknown action", action: request.action});
    return true;
});

// Check if page url changes and reload content script
chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
  if (details.frameId === 0) { // Ensures it runs for the top frame only
    chrome.tabs.sendMessage(details.tabId, { action: "historyStateUpdated", url: details.url });
  }
});

chrome.cookies.onChanged.addListener(function(changeInfo) {
    if (changeInfo.cookie.name === LMS_AUTH_cookie_name || changeInfo.cookie.name === LMS_CONTEXT_cookie_name) {
        // Notify all halo tabs that the cookies have changed
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(function(tab) {
                if (tab.url.startsWith(getHaloUrl())) {
                    if (changeInfo.cookie.name === LMS_AUTH_cookie_name) {
                        chrome.tabs.sendMessage(tab.id, { action: "lmsCookiesChanged", cookieName: "LMS_AUTH", cookieValue: changeInfo.cookie.value } );
                    } else if (changeInfo.cookie.name === LMS_CONTEXT_cookie_name) {
                        chrome.tabs.sendMessage(tab.id, { action: "lmsCookiesChanged", cookieName: "LMS_CONTEXT", cookieValue: changeInfo.cookie.value } );
                    }
                }
            });
        });
    }
});
