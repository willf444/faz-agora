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

export const markdownToEditorHtml = (markdown = '') => (
  markdown.trim() ? markdownRenderer.render(markdown) : ''
);

export const editorHtmlToMarkdown = (html = '') => {
  let output = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
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
    .replace(/\n{3,}/g, '\n\n');

  return output.trim();
};
