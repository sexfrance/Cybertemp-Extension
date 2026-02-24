importScripts('pako.js');

// Configuration
const API_BASE = "https://api.cybertemp.xyz";

// ... existing code ...
const POLLING_INTERVAL_MINUTES = 0.083; // Poll every ~5 seconds
const ALARM_NAME = "poll_mail";

// State
let currentEmail = null;
let lastEmailId = null;

// --- Utility Functions ---

// Get stored data helper
async function getStorage(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, (result) => resolve(result));
    });
}

// Set stored data helper
async function setStorage(data) {
    return new Promise((resolve) => {
        chrome.storage.local.set(data, () => resolve());
    });
}

// --- Domain Management ---

async function updateDomainsCache() {
    try {
        const response = await fetch(`${API_BASE}/getDomains`);
        if (!response.ok) throw new Error("Failed to fetch domains");
        const domains = await response.json();
        if (Array.isArray(domains) && domains.length > 0) {
            await setStorage({ cachedDomains: domains });
            console.log("Domains cached:", domains.length);
        }
    } catch (e) {
        console.error("Domain cache update failed:", e);
    }
}

// --- User Stats / Plan ---

async function fetchUserStats() {
    const data = await getStorage(['apiKey']);
    if (!data.apiKey) return;

    try {
        const response = await fetch(`${API_BASE}/api/user/me`, {
            headers: {
                "x-api-key": data.apiKey,
                "Content-Type": "application/json"
            }
        });

        if (response.ok) {
            const userData = await response.json();
            if (userData.plan) {
                // Store the plan object (including type: 'FREE'|'CORE'|'ELITE')
                const plan = {
                    type: userData.plan.type,
                    isActive: userData.plan.status === 'active'
                };
                await setStorage({ plan: plan });
                console.log("User plan updated:", plan);
            }
        }
    } catch (e) {
        console.error("Failed to fetch user stats:", e);
    }
}


// --- API Interaction ---

async function fetchMail() {
    const data = await getStorage(['apiKey', 'currentEmail', 'fingerprint']);

    // If no email is set, nothing to poll
    if (!data.currentEmail) {
        return;
    }

    const headers = {
        "Content-Type": "application/json"
    };

    if (data.apiKey) {
        headers['x-api-key'] = data.apiKey;
    } else {
        // Strict Login Wall enforced in popup. 
        // If we get here without a key, we just return to avoid unauthorized calls.
        return;
    }

    try {
        const url = `${API_BASE}/getMail?email=${encodeURIComponent(data.currentEmail)}&limit=10`;
        const response = await fetch(url, { headers });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("API Error:", response.status, errorText);

            if (response.status === 401) {
                // IMPORTANT: Only clear key if it's explicitly invalid
                // Don't clear on temporary auth issues or server errors
                try {
                    const errorData = JSON.parse(errorText);
                    // Only clear if the backend explicitly says the key is invalid
                    if (errorData.code === "INVALID_API_KEY" || errorData.error?.toLowerCase().includes("invalid api key")) {
                        const currentData = await getStorage(['apiKey']);
                        if (currentData.apiKey) {
                            chrome.notifications.create({
                                type: 'basic',
                                iconUrl: 'icons/icon48.png',
                                title: 'Authentication Failed',
                                message: 'Your API Key is invalid. Please login again.',
                                priority: 2
                            });
                            // Clear key to force re-login
                            await setStorage({ apiKey: "" });
                        }
                    }
                    // Otherwise, DO NOT clear the key - it might be a temporary server issue
                } catch (e) {
                    // If we can't parse the error, DON'T clear the key
                    console.error("Could not parse 401 error, keeping API key");
                }
            }
            return;
        }

        const emails = await response.json();
        processEmails(emails);
    } catch (e) {
        console.error("Fetch Mail Failed:", e);
    }
}

// Check for new emails and extract codes
async function processEmails(emails) {
    if (!emails || emails.length === 0) return;

    // Sort by ID descending (newest first)
    const newestEmail = emails[0];

    // Check if we have a new email
    if (lastEmailId && newestEmail.id === lastEmailId) {
        return; // No new mail
    }

    lastEmailId = newestEmail.id;

    // Notify popup / UI
    chrome.runtime.sendMessage({ type: "EMAILS_UPDATED", emails: emails }).catch(() => { });

    // Scan for verification codes in the newest email
    const code = extractVerificationCode(newestEmail);
    // Parse 'from' field which might be "Name <email>" or just "email"
    const from = newestEmail.from || "Unknown Sender";

    if (code) {
        console.log("Found code:", code);
        // Send to active tab for autofill
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: "fill_code",
                    code: code
                }).catch(() => {
                    // Content script might not be injected in this tab, ignore
                });
            }
        });

        // Notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Verification Code Found',
            message: `Code: ${code} from ${from}`,
            priority: 2
        });
    } else {
        // Notification for normal email
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'New Email Received',
            message: `From: ${from}\nSubject: ${newestEmail.subject}`,
            priority: 1
        });
    }

    // Save cache
    await setStorage({ cachedEmails: emails });
}

function extractVerificationCode(email) {
    if (!email) return null;
    const content = email.text || email.html || "";

    // Strip HTML tags for cleaner matching on HTML emails
    const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    // --- Priority 1: Context-aware patterns (keyword before/after number) ---
    const contextPatterns = [
        /\b(?:verification|confirm(?:ation)?|security|login|sign.in|one.time|access|auth(?:entication)?)\s+code[:\s]+(\d{4,8})\b/i,
        /\bcode[:\s]+(\d{4,8})\b/i,
        /\botp[:\s]+(\d{4,8})\b/i,
        /\bpin[:\s]+(\d{4,8})\b/i,
        /\btoken[:\s]+(\d{4,8})\b/i,
        /\bis[:\s]+(\d{4,8})\b/i,
        /\b(\d{4,8})\s+is\s+your\s+(?:verification\s+)?code\b/i,
        /\benter\s+(\d{4,8})\b/i,
        /\b(?:code|token|otp)[:\s]+([A-Z0-9]{4,12})\b/i,
    ];

    for (const pattern of contextPatterns) {
        const match = plainText.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    // --- Priority 2: Bare number fallback (4-8 digits, heavily filtered) ---
    const bareNumberRegex = /\b(\d{4,8})\b/g;
    let match;
    while ((match = bareNumberRegex.exec(plainText)) !== null) {
        const num = match[1];
        const surroundingText = plainText.slice(Math.max(0, match.index - 5), match.index + num.length + 5);

        // Skip years
        if (/^(19|20)\d{2}$/.test(num)) continue;
        // Skip prices
        if (/[\$€£]/.test(surroundingText) || /\.\d{2}/.test(plainText.slice(match.index + num.length, match.index + num.length + 3))) continue;
        // Skip phone fragments
        if (/\d{9,}/.test(plainText.slice(Math.max(0, match.index - 2), match.index + num.length + 2))) continue;

        return num;
    }

    return null;
}

// --- Lifecycle & Events ---

chrome.runtime.onInstalled.addListener(() => {
    console.log("CyberTemp Extension Installed");
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: POLLING_INTERVAL_MINUTES });
    updateDomainsCache(); // Cache domains on install/update
    fetchUserStats(); // Fetch plan on install/update
});

chrome.runtime.onStartup.addListener(() => {
    updateDomainsCache(); // Cache domains on startup
    fetchUserStats(); // Fetch plan on startup
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
        fetchMail();
        // Occasionally fetch stats too? Maybe not every 5 seconds. 
        // Let's rely on startup/save_api_key events for now to avoid calling /me too much.
    }
});

// Listener for messages from Popup or Content Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GENERATE_EMAIL") {
        (async () => {
            // Use cached domains if available
            let domains = (await getStorage(['cachedDomains'])).cachedDomains;

            if (!domains || domains.length === 0) {
                try {
                    const response = await fetch(`${API_BASE}/getDomains`);
                    domains = await response.json();
                    setStorage({ cachedDomains: domains });
                } catch (e) {
                    console.error("Failed to fetch domains for generation", e);
                    domains = ["cybertemp.xyz"]; // Fallback
                }
            }

            let randomDomain = domains[Math.floor(Math.random() * domains.length)];

            // Allow Custom Domain if provided (Auth check done in Popup)
            if (message.domain) {
                // Ideally we validate if this domain is actually offered, but trust the backend to reject invalid emails if needed.
                // Or simply trust the user picked a valid domain if built into UI later.
                // For raw string input, we trust 'domainPart'.
                randomDomain = message.domain;
            }

            let preferredUser = "";
            if (!message.random && message.username) {
                preferredUser = message.username;
            } else {
                preferredUser = Math.random().toString(36).substring(2, 10);
            }

            const newEmail = `${preferredUser}@${randomDomain}`;

            await setStorage({ currentEmail: newEmail });
            currentEmail = newEmail;
            lastEmailId = null; // Reset tracking

            sendResponse({ email: newEmail });
        })();
        return true; // Keep channel open
    }

    if (message.type === "SAVE_API_KEY") {
        console.log("[CyberTemp Service Worker] Received SAVE_API_KEY:", message.apiKey ? "✓ Has key" : "✗ No key");

        if (!message.apiKey) {
            console.error("[CyberTemp Service Worker] No API key provided in message");
            sendResponse({ success: false, error: "No API key provided" });
            return false;
        }

        // Use Promise wrapper for set to ensure completion
        const saveKey = new Promise((resolve) => {
            chrome.storage.local.set({ apiKey: message.apiKey }, () => {
                if (chrome.runtime.lastError) {
                    console.error("[CyberTemp Service Worker] Storage error:", chrome.runtime.lastError);
                    resolve(false);
                } else {
                    console.log("[CyberTemp Service Worker] API key saved successfully via storage api");
                    resolve(true);
                }
            });
        });

        saveKey.then((success) => {
            if (success) {
                // Verify it was saved
                chrome.storage.local.get(['apiKey'], (result) => {
                    console.log("[CyberTemp Service Worker] Verification check:", result.apiKey === message.apiKey ? "MATCH" : "MISMATCH");
                    sendResponse({ success: true });
                    fetchMail();
                    fetchUserStats(); // Fetch plan immediately after saving key
                });
            } else {
                sendResponse({ success: false, error: "Storage save failed" });
            }
        });

        return true; // Keep channel open for async response
    }

    if (message.type === "REFRESH_MAIL") {
        fetchMail().then(() => sendResponse({ success: true }));
        return true;
    }

    if (message.type === "GET_CURRENT_EMAIL") {
        getStorage(['currentEmail']).then((data) => {
            sendResponse({ email: data.currentEmail });
        });
        return true;
    }

    if (message.type === "FETCH_DOMAINS") {
        updateDomainsCache().then(() => sendResponse({ success: true }));
        return true;
    }

    if (message.type === "FETCH_USER_STATS") {
        fetchUserStats().then(() => sendResponse({ success: true }));
        return true;
    }
});
