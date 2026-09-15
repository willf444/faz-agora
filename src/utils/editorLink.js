export const normalizeEditorLinkUrl = value => {
  const url = String(value || '').trim();
  if (!url || url === 'https://') return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

// Keep the selected DOM Range inside the WebView while the native URL field has focus.
export const installEditorLinkSelection = `
(function () {
  if (window.__fazLinkSelectionInstalled) return;
  window.__fazLinkSelectionInstalled = true;
  var content = document.getElementById('content');
  if (!content) return;
  window.__fazLinkRange = null;
  window.__fazLinkDialogOpen = false;
  function rememberSelection() {
    if (window.__fazLinkDialogOpen) return;
    var selection = window.getSelection();
    if (selection && selection.rangeCount && !selection.isCollapsed) {
      var range = selection.getRangeAt(0);
      if (content.contains(range.commonAncestorContainer)) {
        window.__fazLinkRange = range.cloneRange();
      }
    }
  }
  document.addEventListener('selectionchange', rememberSelection);
  content.addEventListener('touchstart', function () { window.__fazLinkRange = null; });
  content.addEventListener('mousedown', function () { window.__fazLinkRange = null; });
  content.addEventListener('keydown', function () { window.__fazLinkRange = null; });
  content.addEventListener('input', function () { window.__fazLinkRange = null; });
})();
true;
`;

export const prepareEditorLinkSelection = `
(function () {
  var content = document.getElementById('content');
  var selection = window.getSelection();
  if (content && selection && selection.rangeCount && !selection.isCollapsed) {
    var range = selection.getRangeAt(0);
    if (content.contains(range.commonAncestorContainer)) {
      window.__fazLinkRange = range.cloneRange();
    }
  }
  window.__fazLinkDialogOpen = true;
})();
true;
`;

export const cancelEditorLinkSelection = `
window.__fazLinkRange = null;
window.__fazLinkDialogOpen = false;
true;
`;

export const applyEditorLinkSelection = (url, label = '') => `
(function () {
  var content = document.getElementById('content');
  var range = window.__fazLinkRange;
  var hadSelection = !!range;
  var applied = false;
  try {
    if (content && range && !range.collapsed &&
        content.contains(range.startContainer) && content.contains(range.endContainer)) {
      var start = range.startContainer.nodeType === 1
        ? range.startContainer : range.startContainer.parentElement;
      var end = range.endContainer.nodeType === 1
        ? range.endContainer : range.endContainer.parentElement;
      var startBlock = start && start.closest('div,p,li,h1,h2,h3');
      var endBlock = end && end.closest('div,p,li,h1,h2,h3');
      if (startBlock && startBlock === endBlock &&
          !start.closest('a') && !end.closest('a') && range.toString().trim()) {
        var anchor = document.createElement('a');
        anchor.setAttribute('href', ${JSON.stringify(url)});
        var replacement = ${JSON.stringify(label)};
        var selected = range.extractContents();
        anchor.appendChild(replacement
          ? document.createTextNode(replacement) : selected);
        range.insertNode(anchor);
        var cursor = document.createRange();
        cursor.setStartAfter(anchor);
        cursor.collapse(true);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(cursor);
        window.__fazLinkRange = null;
        content.dispatchEvent(new Event('input', { bubbles: true }));
        applied = true;
      }
    }
  } catch (_error) {
    applied = false;
  }
  window.__fazLinkRange = null;
  window.__fazLinkDialogOpen = false;
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'FAZ_LINK_RESULT', data: { applied: applied, hadSelection: hadSelection }
  }));
})();
true;
`;
