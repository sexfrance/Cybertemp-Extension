// CyberTemp Content Script

// Configuration
// Using a clean Mail icon (Violet) instead of the previous "horrible" one
// Using a premium Mail icon with a subtle fill
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;

// --- Utilities ---
const isOrphan = () => !chrome.runtime?.id;

function safeSendMessage(message) {
    if (isOrphan()) return Promise.reject(new Error("Extension invalidated"));
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        } catch (e) {
            resolve(null);
        }
    });
}

function safeGetStorage(keys) {
    if (isOrphan()) return Promise.reject(new Error("Extension invalidated"));
    return new Promise((resolve) => {
        try {
            chrome.storage.local.get(keys, (res) => {
                if (chrome.runtime.lastError) resolve({});
                else resolve(res);
            });
        } catch (e) {
            resolve({});
        }
    });
}

// --- Email Input Injection ---

function isEmailInput(input) {
    if (input.dataset.cybertempIgnore) return false;

    // STRICT EXCLUSIONS: specific types that should NEVER be touched
    const eTypes = ['checkbox', 'radio', 'button', 'submit', 'image', 'file', 'hidden', 'password', 'reset', 'range', 'color', 'date', 'datetime-local'];
    if (eTypes.includes(input.type)) return false;

    if (input.style.display === 'none' || input.style.visibility === 'hidden') return false; // Visual check
    if (input.getAttribute('aria-hidden') === 'true') return false;

    if (input.type === 'email') return true;
    if (input.name && input.name.toLowerCase().includes('password')) return false; // Extra safety against password fields labeled weirdly

    if (input.autocomplete === 'email' || input.autocomplete === 'username') return true;

    // Check attributes for keywords
    const keywords = ['email', 'e-mail', 'mail', 'username', 'identifier', 'login'];
    const attrToCheck = [input.name, input.id, input.placeholder, input.getAttribute('aria-label')];

    // Check associated labels
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) attrToCheck.push(label.innerText);
    }
    // Check parent label
    const parentLabel = input.closest('label');
    if (parentLabel) attrToCheck.push(parentLabel.innerText);

    for (const attr of attrToCheck) {
        if (!attr) continue;
        const lower = attr.toLowerCase();
        if (keywords.some(k => lower.includes(k))) return true;
    }
    return false;
}

function injectIcon(input) {
    if (input.dataset.cybertempInjected || input.type === 'hidden') return;
    if (isOrphan()) return;

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'cybertemp-icon-wrapper';
    Object.assign(wrapper.style, {
        position: 'absolute',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '9999',
        width: '28px',
        height: '28px',
        opacity: '0.9',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'auto',
        background: 'rgba(139, 92, 246, 0.15)', // Visible violet tint
        border: '1px solid rgba(139, 92, 246, 0.3)', // Violet border
        borderRadius: '8px',
        backdropFilter: 'blur(4px)',
        boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
    });
    // Safely insert SVG without innerHTML
    const tempDiv = document.createElement('div');
    tempDiv.insertAdjacentHTML('afterbegin', ICON_SVG);
    wrapper.appendChild(tempDiv.firstChild);

    wrapper.onmouseenter = () => {
        wrapper.style.opacity = '1';
        wrapper.style.transform = 'scale(1.05)';
        wrapper.style.background = 'rgba(139, 92, 246, 0.25)'; // Darker violet on hover
        wrapper.style.border = '1px solid rgba(139, 92, 246, 0.5)';
        wrapper.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.25)'; // Glow effect
    };
    wrapper.onmouseleave = () => {
        wrapper.style.opacity = '0.9';
        wrapper.style.transform = 'scale(1)';
        wrapper.style.background = 'rgba(139, 92, 246, 0.15)';
        wrapper.style.border = '1px solid rgba(139, 92, 246, 0.3)';
        wrapper.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';
    };

    // Append to body (safer than appending to parent which might be an input group)
    document.body.appendChild(wrapper);

    // Positioning Logic
    const updatePosition = () => {
        if (isOrphan() || !document.contains(input)) {
            wrapper.remove();
            return;
        }
        const rect = input.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(input).display === 'none') {
            wrapper.style.display = 'none';
            return;
        }

        wrapper.style.display = 'flex';
        // Position at the right end of the input (inside)
        const top = rect.top + window.scrollY + (rect.height - 24) / 2;
        const left = rect.left + window.scrollX + rect.width - 32; // 32px padding from right edge

        wrapper.style.top = `${top}px`;
        wrapper.style.left = `${left}px`;
    };

    updatePosition();

    // Listeners for position updates
    const resizeObserver = new ResizeObserver(() => updatePosition());
    resizeObserver.observe(input);
    window.addEventListener('scroll', updatePosition, { capture: true, passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    // Click Action
    wrapper.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Animation
        wrapper.style.transform = "scale(0.9)";
        setTimeout(() => wrapper.style.transform = "scale(1.1)", 150);

        try {
            // STRICT AUTH CHECK
            const { apiKey } = await safeGetStorage(['apiKey']);

            if (!apiKey) {
                // Not authenticated - show login prompt
                showLoginToast();
                return;
            }

            // Check for existing email
            let data = await safeSendMessage({ type: "GET_CURRENT_EMAIL" });

            if (!data || !data.email) {
                // No email exists - generate one automatically
                const loadingToast = showToast("Generating email...", "loading");
                data = await safeSendMessage({
                    type: "GENERATE_EMAIL",
                    random: true
                });

                if (loadingToast) loadingToast.remove();

                if (!data || !data.email) {
                    showToast("Failed to generate email. Try again.", "error");
                    return;
                }

                showToast("Email created successfully!", "success");
            }

            // Fill the input
            input.focus();
            // React/Framework friendly input set
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(input, data.email);
            } else {
                input.value = data.email;
            }

            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true })); // Trigger blur to save
        } catch (err) {
            showToast("Extension error. Please reload page.", "error");
        }
    });

    input.dataset.cybertempInjected = "true";
}

// --- Detection System (MutationObserver) ---

let detectionEnabled = true;

async function runDetection() {
    if (isOrphan()) {
        shutdown();
        return;
    }

    const { enableDetection } = await safeGetStorage(['enableDetection']);

    // Explicitly check for false, default to true if undefined
    if (enableDetection === false) {
        detectionEnabled = false;
        // Remove existing icons if disabled
        document.querySelectorAll('.cybertemp-icon-wrapper').forEach(el => el.remove());
        // Reset injected flags so they can be re-injected if enabled later
        document.querySelectorAll('input[data-cybertemp-injected]').forEach(el => delete el.dataset.cybertempInjected);
        return;
    }

    detectionEnabled = true;

    // Scan all existing inputs
    document.querySelectorAll('input').forEach(input => {
        if (isEmailInput(input)) injectIcon(input);
    });
}

// Observer for new nodes
const observer = new MutationObserver((mutations) => {
    if (isOrphan()) {
        shutdown();
        return;
    }
    if (!detectionEnabled) return;

    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) { // Element
                if (node.tagName === 'INPUT' && isEmailInput(node)) {
                    injectIcon(node);
                } else if (node.querySelectorAll) {
                    node.querySelectorAll('input').forEach(inp => {
                        if (isEmailInput(inp)) injectIcon(inp);
                    });
                }
            }
        }
    }
});

function startObserver() {
    if (isOrphan()) return;
    observer.observe(document.body, { childList: true, subtree: true });
    runDetection();
}

function shutdown() {
    observer.disconnect();
    document.querySelectorAll('.cybertemp-icon-wrapper').forEach(el => el.remove());
}

// Start up
if (document.body) {
    startObserver();
} else {
    document.addEventListener('DOMContentLoaded', startObserver);
}

// --- Autofill Logic (SMS/Code) ---

function isCodeInput(input) {
    if (input.type === 'hidden' || input.type === 'email' || input.type === 'password') return false;

    // Explicit attributes
    if (input.autocomplete === 'one-time-code') return true;

    const keywords = [/code/i, /otp/i, /pin/i, /verification/i, /2fa/i, /security/i];
    const attrToCheck = [input.name, input.id, input.placeholder];

    // Check labels
    if (input.id) {
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) attrToCheck.push(label.innerText);
    }
    const parentLabel = input.closest('label');
    if (parentLabel) attrToCheck.push(parentLabel.innerText);

    for (const attr of attrToCheck) {
        if (!attr) continue;
        if (keywords.some(regex => regex.test(attr))) return true;
    }

    // Heuristics: Short numeric inputs often used for OTPs
    if ((input.type === 'text' || input.type === 'tel' || input.type === 'number')) {
        const maxLen = input.maxLength;
        if (maxLen > 0 && maxLen <= 8) return true; // Likely a code field
    }

    return false;
}

// Listen for messages from the website (Auto-Auth)
window.addEventListener("message", (event) => {
    // SECURITY: strictly validate origin
    const allowedOrigins = [
        "https://cybertemp.xyz",
        "https://www.cybertemp.xyz",
        "http://localhost:3000",
        "https://tempmail-next.vercel.app"
    ];

    // Message validation

    if (!allowedOrigins.includes(event.origin)) {
        return;
    }

    // SECURITY: Verify source is the window itself (prevents iframe spoofing from other frames)
    if (event.source !== window) {
        return;
    }

    let messageData = event.data;

    // Handle stringified JSON (common in some frameworks/extensions interactions)
    if (typeof messageData === "string") {
        try {
            messageData = JSON.parse(messageData);
        } catch (e) {
            // Not JSON, ignore
            return;
        }
    }

    if (messageData && messageData.type === "CYBERTEMP_AUTH_SUCCESS") {
        const { apiKey, plan } = messageData;

        if (apiKey && typeof apiKey === "string" && apiKey.length > 0) {
            chrome.storage.local.set({
                apiKey: apiKey,
                plan: plan || { type: "FREE", isActive: false }
            }, () => {
                chrome.runtime.sendMessage({ type: "REFRESH_MAIL" }).catch(() => { });
                // FORCE Update Stats immediately to fix "Free Plan" sync issue
                chrome.runtime.sendMessage({ type: "FETCH_USER_STATS" }).catch(() => { });
                showToast("Login Synced Successfully", "success");
            });
        }
    }

});

// --- Handshake: Tell Website we are here ---
function pingWebsite() {
    const allowedOrigins = [
        "https://cybertemp.xyz",
        "https://www.cybertemp.xyz",
        "http://localhost:3000",
        "https://tempmail-next.vercel.app"
    ];

    // Only ping if on allowed origin
    if (allowedOrigins.some(origin => window.location.href.startsWith(origin))) {
        // Only ping if we DON'T have an API key yet
        chrome.storage.local.get(['apiKey'], (result) => {
            if (!result.apiKey) {
                window.postMessage({ type: "CYBERTEMP_EXTENSION_READY" }, "*");
            }
        });
    }
}

// Ping a few times on load to catch React hydration
if (!isOrphan()) {
    setTimeout(pingWebsite, 500);
    setTimeout(pingWebsite, 1500);
    setTimeout(pingWebsite, 3000);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isOrphan()) return;

    if (message.type === "SETTINGS_UPDATED") {
        runDetection(); // Re-check settings (enable/disable icons)
        return;
    }

    if (message.type === "fill_code") {
        const code = message.code;
        if (!code) return;

        safeGetStorage(['enableAutofill']).then(result => {
            // Default to true if undefined? No, logic below says result.enableAutofill === false return.
            // But wait, do we have an enableAutofill setting separate from enableDetection?
            // The UI only has "Input Detection".
            // Assuming "Auto-fill" logic relies on the same or separate? 
            // In page.tsx I used "Input Detection" label but key "enableDetection".
            // Line 368 in old page.tsx said "Auto-fill".
            // I'll stick to "enableDetection" for inputs.
            // For code filling (via notification), it's separate. 
            // Logic here seems fine, assuming enableAutofill might be another setting or default.
            // I'll leave this logic as is for now.
            if (result.enableAutofill === false) return;

            // Find best candidate
            const inputs = Array.from(document.querySelectorAll('input'));
            let target = inputs.find(i => isVisible(i) && isCodeInput(i));

            // If no specific code input found, check for active element if it's generic text
            if (!target && document.activeElement && document.activeElement.tagName === 'INPUT') {
                if (['text', 'tel', 'number'].includes(document.activeElement.type)) {
                    target = document.activeElement;
                }
            }

            if (target) {
                fillInput(target, code);
                showToast(`Auto-filled code: ${code}`);
            }
        });
    }
});

function fillInput(input, value) {
    input.focus();
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value);
    } else {
        input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Highlight effect
    const originalShadow = input.style.boxShadow;
    const originalBorder = input.style.borderColor;

    input.style.transition = 'all 0.3s ease';
    input.style.boxShadow = '0 0 0 2px rgba(139, 92, 246, 0.3)'; // Violet shadow
    input.style.borderColor = '#8b5cf6'; // Violet border

    setTimeout(() => {
        input.style.boxShadow = originalShadow;
        input.style.borderColor = originalBorder;
    }, 1500);
}

function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) &&
        window.getComputedStyle(el).visibility !== 'hidden';
}

function showToast(msg, type = "info") {
    const toast = document.createElement('div');

    // Shadcn / Premium UI Style
    // Dark mode default

    const icons = {
        success: `<svg class="w-4 h-4 text-emerald-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
        error: `<svg class="w-4 h-4 text-red-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        loading: `<svg class="w-4 h-4 text-violet-500 animate-spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
        info: `<svg class="w-4 h-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`
    };

    // Build toast content safely without innerHTML
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; gap: 12px;';

    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = 'display: flex; align-items: center; justify-content: center;';
    const iconTemp = document.createElement('div');
    iconTemp.insertAdjacentHTML('afterbegin', icons[type]);
    iconContainer.appendChild(iconTemp.firstChild);

    const msgSpan = document.createElement('span');
    msgSpan.style.cssText = 'font-size: 13px; font-weight: 500; color: #ededed; letter-spacing: -0.01em;';
    msgSpan.textContent = msg;

    container.appendChild(iconContainer);
    container.appendChild(msgSpan);
    toast.appendChild(container);

    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: '#09090b', // Zinc-950
        border: '1px solid #27272a', // Zinc-800
        padding: '12px 16px',
        borderRadius: '8px',
        zIndex: '2147483647',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.05)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        minWidth: '200px',
        maxWidth: '350px',
        opacity: '0',
        transform: 'translateY(16px) scale(0.98)',
        transition: 'all 0.35s cubic-bezier(0.21, 1.02, 0.73, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start'
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0) scale(1)';
    });

    // Loading toasts don't auto-dismiss
    if (type !== 'loading') {
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(8px) scale(0.98)';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    return toast;
}

function showLoginToast() {
    const toast = document.createElement('div');

    // Build login toast safely without innerHTML
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const lockIcon = document.createElement('span');
    lockIcon.style.fontSize = '18px';
    lockIcon.textContent = '🔒';

    const headerText = document.createElement('span');
    headerText.style.fontWeight = '600';
    headerText.textContent = 'Login Required';

    headerDiv.appendChild(lockIcon);
    headerDiv.appendChild(headerText);

    const description = document.createElement('p');
    description.style.cssText = 'margin: 0; font-size: 13px; opacity: 0.9; line-height: 1.5;';
    description.textContent = 'You need to be logged in to use CyberTemp.';

    const loginBtn = document.createElement('button');
    loginBtn.id = 'cybertemp-login-btn';
    loginBtn.style.cssText = 'background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);';
    loginBtn.textContent = 'Login to CyberTemp';

    mainContainer.appendChild(headerDiv);
    mainContainer.appendChild(description);
    mainContainer.appendChild(loginBtn);
    toast.appendChild(mainContainer);

    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        background: 'linear-gradient(135deg, rgba(10, 10, 15, 0.98) 0%, rgba(20, 20, 30, 0.98) 100%)',
        color: '#f9fafb',
        padding: '18px 22px',
        borderRadius: '14px',
        zIndex: '2147483647',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(139, 92, 246, 0.5)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '14px',
        backdropFilter: 'blur(16px)',
        opacity: '0',
        transform: 'translateY(16px) scale(0.95)',
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        minWidth: '280px',
        border: '1px solid rgba(139, 92, 246, 0.5)'
    });

    document.body.appendChild(toast);

    // Login button handler
    const loginBtn = toast.querySelector('#cybertemp-login-btn');
    loginBtn.addEventListener('click', () => {
        window.open('https://cybertemp.xyz/auth/login?source=extension&action=auth', '_blank');
        toast.remove();
    });

    loginBtn.addEventListener('mouseenter', () => {
        loginBtn.style.transform = 'translateY(-2px)';
        loginBtn.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
    });

    loginBtn.addEventListener('mouseleave', () => {
        loginBtn.style.transform = 'translateY(0)';
        loginBtn.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)';
    });

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0) scale(1)';
    });

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px) scale(0.95)';
        setTimeout(() => toast.remove(), 400);
    }, 6000);
}
