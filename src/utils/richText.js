import MarkdownIt from 'markdown-it';

const markdownRenderer = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
});

const decodeHtmlEntities = (value) => value.replace(
  /&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi,
  (entity, code) => {
    const normalized = code.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos') return "'";
    if (normalized === 'nbsp') return ' ';
    const isHex = normalized.startsWith('#x');
    const number = Number.parseInt(normalized.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    return Number.isNaN(number) ? entity : String.fromCodePoint(number);
  }
);

export const normalizeMarkdownFormatting = (markdown = '') => markdown
  .replace(/(^|[^*])\*\*\*([^*\n]*?\S)[ \t]+\*\*\*(?!\*)/gm, '$1***$2*** ')
  .replace(/(^|[^*])\*\*([^*\n]*?\S)[ \t]+\*\*(?!\*)/gm, '$1**$2** ')
  .replace(/(^|[^*])\*([^*\n]*?\S)[ \t]+\*(?!\*)/gm, '$1*$2* ');

export const markdownToEditorHtml = (markdown = '') => (
  markdown.trim() ? markdownRenderer.render(normalizeMarkdownFormatting(markdown)) : ''
);

export const editorHtmlToMarkdown = (html = '') => {
  let output = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    // O HTML do editor contém quebras usadas apenas para formatar o código.
    // Recrie somente as quebras visuais representadas por blocos e <br>.
    .replace(/<\/p>\s*<p\b/gi, '</p><br><p')
    .replace(/\r?\n/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<(ul|ol)\b[^>]*>/gi, '')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<(p|div)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');

  output = decodeHtmlEntities(output)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/(^- .+)\n{2,}(?=- )/gm, '$1\n')
    .replace(/\n{3,}/g, '\n\n');

  return normalizeMarkdownFormatting(output).trim();
};
