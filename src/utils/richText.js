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

export const markdownToEditorHtml = (markdown = '') => {
  if (!markdown.trim()) return '';

  const lines = normalizeMarkdownFormatting(markdown).split('\n');
  const output = [];
  let inList = false;
  const closeList = () => {
    if (inList) output.push('</ul>');
    inList = false;
  };
  const appendBlankLine = () => {
    for (let index = output.length - 1; index >= 0; index -= 1) {
      const updated = output[index].replace(/<\/(div|h[1-3]|li)>$/, '<br></$1>');
      if (updated !== output[index]) {
        output[index] = updated;
        return;
      }
    }
  };

  lines.forEach((line) => {
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const listItem = line.match(/^[-*]\s+(.*)$/);
    if (!line) {
      appendBlankLine();
      return;
    }
    if (listItem) {
      if (!inList) output.push('<ul>');
      inList = true;
      output.push(`<li>${markdownRenderer.renderInline(listItem[1])}</li>`);
      return;
    }

    closeList();
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level}>${markdownRenderer.renderInline(heading[2])}</h${level}>`);
    } else {
      output.push(`<div>${markdownRenderer.renderInline(line)}</div>`);
    }
  });
  closeList();
  return output.join('');
};

export const editorHtmlToMarkdown = (html = '') => {
  let output = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    // O HTML do editor contém quebras usadas apenas para formatar o código.
    // Recrie somente as quebras visuais representadas por blocos e <br>.
    .replace(/<(div|p)\b[^>]*>\s*<br\s*\/?>\s*<\/\1>/gi, '<br>')
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
    .replace(/\n[ \t]+/g, '\n');

  return normalizeMarkdownFormatting(output).trim();
};
