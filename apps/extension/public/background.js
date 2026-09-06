// Opening the side panel from the toolbar icon is the only thing the worker does.
// No host permissions, no content scripts, no network: the bank ships in the package.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
