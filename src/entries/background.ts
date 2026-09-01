import { sortClaims } from "../domain/claim.js";
import { ChromeClaimStorage } from "../storage/chrome-storage.js";
import { reconcileClaims } from "../tracking/reconcile.js";
import { isSupportedMeineSvUrl, isValidWebMcpSender, parseExtensionRequest } from "./messages.js";
import { createReadOnlyClaimTools } from "../webmcp/handlers.js";

const storage = new ChromeClaimStorage();
const webMcpTools = createReadOnlyClaimTools(storage);
let observationQueue: Promise<unknown> = Promise.resolve();

function extensionSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`) === true;
}

async function handleMessage(message: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const request = parseExtensionRequest(message);
  if (!request) return { ok: false, error: "INVALID_MESSAGE" };
  try {
    if (request.type === "claims.observe") {
      if (!isValidWebMcpSender(sender, chrome.runtime.id)) {
        return { ok: false, error: "INVALID_SENDER" };
      }
      const transaction = observationQueue.then(() => reconcileClaims(storage, request.result));
      observationQueue = transaction.catch(() => undefined);
      const result = await transaction;
      return { ok: true, data: { committed: result.committed, eventCount: result.newEvents.length } };
    }
    if (request.type === "webmcp.execute") {
      if (sender.id !== chrome.runtime.id || !isSupportedMeineSvUrl(sender.url)) {
        return { ok: false, error: { code: "INTERNAL_ERROR", message: "Tool execution failed." } };
      }
      const tool = webMcpTools.find(({ name }) => name === request.tool);
      if (!tool) return { ok: false, error: { code: "INVALID_INPUT", message: "Invalid input." } };
      return tool.execute(request.input);
    }
    if (!extensionSender(sender)) return { ok: false, error: "INVALID_SENDER" };
    if (request.type === "dashboard.open") {
      await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
      return { ok: true, data: {} };
    }
    const state = await storage.loadSnapshot();
    return { ok: true, data: { ...state, claims: sortClaims(state.claims) } };
  } catch {
    return { ok: false, error: "LOCAL_OPERATION_FAILED" };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message, sender).then(sendResponse);
  return true;
});
