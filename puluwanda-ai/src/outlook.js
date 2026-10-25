// Outlook mail via Microsoft Graph. Sign-in uses the device-code flow: the web page
// shows a short code, you enter it at microsoft.com/devicelogin, and the token is
// cached locally in data/msal-cache.json (read-only Mail.Read permission).
const fs = require("fs");
const path = require("path");
const msal = require("@azure/msal-node");

const SCOPES = ["User.Read", "Mail.Read"];
const CACHE_FILE = path.join(__dirname, "..", "data", "msal-cache.json");

const cachePlugin = {
  async beforeCacheAccess(ctx) {
    if (fs.existsSync(CACHE_FILE)) ctx.tokenCache.deserialize(fs.readFileSync(CACHE_FILE, "utf8"));
  },
  async afterCacheAccess(ctx) {
    if (ctx.cacheHasChanged) {
      fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
      fs.writeFileSync(CACHE_FILE, ctx.tokenCache.serialize(), { mode: 0o600 });
    }
  },
};

let pca = null;
const login = { pending: false, userCode: null, verificationUri: null, error: null };

function client() {
  if (!process.env.MS_CLIENT_ID) throw new Error("MS_CLIENT_ID is not set in .env");
  if (!pca) {
    pca = new msal.PublicClientApplication({
      auth: {
        clientId: process.env.MS_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.MS_TENANT || "common"}`,
      },
      cache: { cachePlugin },
    });
  }
  return pca;
}

async function getAccount() {
  const accounts = await client().getTokenCache().getAllAccounts();
  return accounts[0] || null;
}

async function getStatus() {
  if (!process.env.MS_CLIENT_ID) return { status: "not_configured" };
  const account = await getAccount();
  if (account) return { status: "ready", user: account.username };
  if (login.pending) {
    return { status: "awaiting_code", userCode: login.userCode, verificationUri: login.verificationUri };
  }
  return { status: "signed_out", error: login.error };
}

/** Start device-code sign-in. Resolves once the code is available to show the user. */
function startLogin() {
  if (login.pending) return Promise.resolve();
  login.pending = true;
  login.error = null;
  return new Promise((resolve, reject) => {
    client()
      .acquireTokenByDeviceCode({
        scopes: SCOPES,
        deviceCodeCallback: (res) => {
          login.userCode = res.userCode;
          login.verificationUri = res.verificationUri;
          resolve();
        },
      })
      .catch((err) => {
        login.error = err.message;
        reject(err);
      })
      .finally(() => {
        login.pending = false;
        login.userCode = null;
      });
  });
}

async function signOut() {
  const account = await getAccount();
  if (account) await client().getTokenCache().removeAccount(account);
}

async function getAccessToken() {
  const account = await getAccount();
  if (!account) throw new Error("Outlook is not signed in yet");
  const result = await client().acquireTokenSilent({ account, scopes: SCOPES });
  return result.accessToken;
}

/** Inbox messages received in the last `lookbackHours`, newest first. */
async function getRecentEmails({ lookbackHours = 24, max = 40 } = {}) {
  const token = await getAccessToken();
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();
  const url =
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages" +
    `?$filter=receivedDateTime ge ${since}` +
    "&$orderby=receivedDateTime desc" +
    `&$top=${max}` +
    "&$select=subject,from,receivedDateTime,bodyPreview,isRead,importance,hasAttachments";

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Microsoft Graph error ${res.status}: ${await res.text()}`);
  const data = await res.json();

  return data.value.map((m) => ({
    time: m.receivedDateTime,
    from: m.from?.emailAddress ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>` : "unknown",
    subject: m.subject,
    preview: m.bodyPreview,
    unread: !m.isRead,
    importance: m.importance,
    hasAttachments: m.hasAttachments,
  }));
}

module.exports = { getStatus, startLogin, signOut, getRecentEmails };
