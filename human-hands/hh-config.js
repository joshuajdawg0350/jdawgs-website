// Human Hands — site config for the "Continue with Google" feature.
// ---------------------------------------------------------------------------
// TO SWITCH GOOGLE SIGN-IN ON: set HH_GOOGLE_CLIENT_ID below to the real
// Google OAuth 2.0 client ID (and set the same value as the GOOGLE_CLIENT_ID
// env var on the human-hands-ai-inbox Vercel project so the API can verify
// tokens against it). That is the whole switch — no other code changes.
//
// While the client ID is empty, the feature is OFF: no Google button renders
// anywhere, no Google script loads, and every form works exactly as before.
// The ID-token flow uses no client secret — never put one in this file.
window.HH_GOOGLE_CLIENT_ID = "237128777207-3tfnfq58q5l09agu6f1f6om83tjnmtta.apps.googleusercontent.com";
window.HH_API_BASE = "https://human-hands-ai-inbox-joshuajdawg0350-1282.vercel.app";
// Web Push (worker app job alerts): the VAPID PUBLIC key. Public by
// design — it only identifies our server to the push service. The
// private key lives solely in the Vercel project's env vars.
window.HH_VAPID_PUBLIC_KEY = "BL3fVZM8u4Aye6rT1pAQhaLAxBDSeNucZKJRF1pLl0M-6vlo8sHU0AphpR7rgMq7GYfKZIvhmymyzyZTNO_RZwo";
