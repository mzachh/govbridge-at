import { renderPopup } from "../ui/popup.js";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Popup root missing.");

renderPopup(root, {
  onOpenDashboard: () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  },
});
