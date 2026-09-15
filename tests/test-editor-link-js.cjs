const assert = require('assert');
const vm = require('vm');
const babel = require('@babel/core');

const compiled = babel.transformFileSync('src/utils/editorLink.js', {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const loaded = { exports: {} };
vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports });
const {
  applyEditorLinkSelection,
  installEditorLinkSelection,
  normalizeEditorLinkUrl,
  prepareEditorLinkSelection,
} = loaded.exports;

assert.strictEqual(normalizeEditorLinkUrl('https://'), '');
assert.strictEqual(normalizeEditorLinkUrl('câmara.leg.br'), 'https://câmara.leg.br');
assert.strictEqual(normalizeEditorLinkUrl('https://example.com/a'), 'https://example.com/a');

const block = {};
const textNode = {
  nodeType: 3,
  parentElement: { closest: selector => selector === 'a' ? null : block },
};
const fragment = { textContent: 'Site-da-Câmara' };
let inserted;
let href;
let changed = false;
let response;
const range = {
  collapsed: false,
  startContainer: textNode,
  endContainer: textNode,
  commonAncestorContainer: textNode,
  cloneRange() { return this; },
  toString() { return 'Site-da-Câmara'; },
  extractContents() { return fragment; },
  insertNode(node) { inserted = node; },
};
const selection = {
  rangeCount: 1,
  isCollapsed: false,
  getRangeAt() { return range; },
  removeAllRanges() {},
  addRange() {},
};
const content = {
  contains: () => true,
  addEventListener() {},
  dispatchEvent() { changed = true; },
};
const context = {
  window: {
    getSelection: () => selection,
    ReactNativeWebView: { postMessage: value => { response = JSON.parse(value); } },
  },
  document: {
    getElementById: () => content,
    addEventListener() {},
    createElement: () => ({
      setAttribute: (_name, value) => { href = value; },
      appendChild(child) { this.child = child; },
    }),
    createRange: () => ({ setStartAfter() {}, collapse() {} }),
    createTextNode: text => ({ textContent: text }),
  },
  Event: function Event() {},
};

vm.runInNewContext(installEditorLinkSelection, context);
vm.runInNewContext(prepareEditorLinkSelection, context);
selection.isCollapsed = true; // O campo nativo tomou o foco depois da seleção.
vm.runInNewContext(applyEditorLinkSelection('https://example.com/"teste'), context);
assert.strictEqual(href, 'https://example.com/"teste');
assert.strictEqual(inserted.child, fragment);
assert.strictEqual(changed, true);
assert.strictEqual(response.type, 'FAZ_LINK_RESULT');
assert.strictEqual(response.data.applied, true);

selection.rangeCount = 0;
context.window.__fazLinkRange = null;
vm.runInNewContext(prepareEditorLinkSelection, context);
vm.runInNewContext(applyEditorLinkSelection('https://example.com', 'Site'), context);
assert.strictEqual(response.data.applied, false);
assert.strictEqual(response.data.hadSelection, false);

const richCompiled = babel.transformFileSync('src/utils/richDocument.js', {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const richLoaded = { exports: {} };
vm.runInNewContext(richCompiled, {
  module: richLoaded,
  exports: richLoaded.exports,
  require,
});
const rich = richLoaded.exports;
const expected = 'Visite [Site-da-Câmara](https://example.com)\n\n- Lista 1\n- Lista 2';
let document = rich.editorHtmlToRichDocument(
  '<div>Visite <a href="https://example.com">Site-da-Câmara</a></div>'
  + '<div><br></div><ul><li>Lista 1</li><li>Lista 2</li></ul>'
);
for (let cycle = 0; cycle < 25; cycle += 1) {
  assert.strictEqual(rich.richDocumentToMarkdown(document), expected);
  document = rich.editorHtmlToRichDocument(rich.richDocumentToEditorHtml(document));
}

console.log('Android: link selecionado e espaçamento estáveis.');
