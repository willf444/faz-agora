import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: true });
const BLOCK_TYPES = new Set(['paragraph', 'blank', 'heading1', 'heading2', 'heading3', 'list_item']);

const decodeEntities = (value = '') => value.replace(
  /&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi,
  (entity, code) => {
    const normalized = code.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos') return "'";
    if (normalized === 'nbsp') return ' ';
    const hex = normalized.startsWith('#x');
    const number = Number.parseInt(normalized.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (Number.isNaN(number) || number < 0 || number > 0x10ffff) return entity;
    return String.fromCodePoint(number);
  }
);

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const sameFormat = (left, right) => (
  Boolean(left.bold) === Boolean(right.bold)
  && Boolean(left.italic) === Boolean(right.italic)
  && (left.link || '') === (right.link || '')
);

const appendRun = (runs, text, format = {}) => {
  if (!text) return;
  const run = { text };
  if (format.bold) run.bold = true;
  if (format.italic) run.italic = true;
  if (format.link) run.link = format.link;
  const previous = runs[runs.length - 1];
  if (previous && sameFormat(previous, run)) previous.text += text;
  else runs.push(run);
};

const inlineMarkdownToRuns = (source) => {
  const runs = [];
  const state = { bold: false, italic: false, link: '' };
  const tokens = markdown.parseInline(source, {})[0]?.children || [];
  tokens.forEach((token) => {
    if (token.type === 'strong_open') state.bold = true;
    else if (token.type === 'strong_close') state.bold = false;
    else if (token.type === 'em_open') state.italic = true;
    else if (token.type === 'em_close') state.italic = false;
    else if (token.type === 'link_open') state.link = token.attrGet('href') || '';
    else if (token.type === 'link_close') state.link = '';
    else if (token.type === 'text' || token.type === 'code_inline') {
      appendRun(runs, token.content, state);
    } else if (token.type === 'softbreak' || token.type === 'hardbreak') {
      appendRun(runs, ' ', state);
    }
  });
  return runs;
};

export const markdownToRichDocument = (source = '') => {
  const normalizedSource = String(source).replace(/\r\n?/g, '\n');
  if (!normalizedSource) return { version: 1, blocks: [] };
  return {
    version: 1,
    blocks: normalizedSource.split('\n').map((line) => {
    if (line === '') return { type: 'blank', runs: [] };
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const item = line.match(/^[-*]\s+(.*)$/);
    if (heading) {
      return {
        type: `heading${heading[1].length}`,
        runs: inlineMarkdownToRuns(heading[2]).map(({ bold, ...run }) => run),
      };
    }
    if (item) return { type: 'list_item', runs: inlineMarkdownToRuns(item[1]) };
    return { type: 'paragraph', runs: inlineMarkdownToRuns(line) };
    }),
  };
};

export const normalizeRichDocument = (document, fallbackMarkdown = '') => {
  if (!document || document.version !== 1 || !Array.isArray(document.blocks)) {
    return markdownToRichDocument(fallbackMarkdown);
  }
  const blocks = document.blocks.map((block) => {
    const type = BLOCK_TYPES.has(block?.type) ? block.type : 'paragraph';
    if (type === 'blank') return { type, runs: [] };
    const runs = [];
    (Array.isArray(block?.runs) ? block.runs : []).forEach((run) => {
      appendRun(runs, String(run?.text || ''), {
        bold: !type.startsWith('heading') && Boolean(run?.bold),
        italic: Boolean(run?.italic),
        link: typeof run?.link === 'string' ? run.link : '',
      });
    });
    return runs.length ? { type, runs } : { type: 'blank', runs: [] };
  });
  return { version: 1, blocks };
};

const runToMarkdown = (run) => {
  let text = run.text;
  if (run.link) text = `[${text}](${run.link})`;
  if (run.bold && run.italic) return `***${text}***`;
  if (run.bold) return `**${text}**`;
  if (run.italic) return `*${text}*`;
  return text;
};

export const richDocumentToMarkdown = (document) => normalizeRichDocument(document).blocks
  .map((block) => {
    if (block.type === 'blank') return '';
    const content = block.runs.map(runToMarkdown).join('');
    if (block.type === 'list_item') return `- ${content}`;
    if (block.type.startsWith('heading')) return `${'#'.repeat(Number(block.type.slice(-1)))} ${content}`;
    return content;
  })
  .join('\n');

const runToHtml = (run) => {
  let value = escapeHtml(run.text);
  if (run.link) value = `<a href="${escapeHtml(run.link)}">${value}</a>`;
  if (run.italic) value = `<em>${value}</em>`;
  if (run.bold) value = `<strong>${value}</strong>`;
  return value;
};

export const richDocumentToEditorHtml = (document) => {
  const blocks = normalizeRichDocument(document).blocks;
  const output = [];
  let listOpen = false;
  const closeList = () => {
    if (listOpen) output.push('</ul>');
    listOpen = false;
  };
  blocks.forEach((block) => {
    if (block.type === 'list_item') {
      if (!listOpen) output.push('<ul>');
      listOpen = true;
      output.push(`<li>${block.runs.map(runToHtml).join('')}</li>`);
      return;
    }
    closeList();
    if (block.type === 'blank') output.push('<div><br></div>');
    else if (block.type.startsWith('heading')) {
      const level = Number(block.type.slice(-1));
      output.push(`<h${level}>${block.runs.map(runToHtml).join('')}</h${level}>`);
    } else output.push(`<div>${block.runs.map(runToHtml).join('')}</div>`);
  });
  closeList();
  return output.join('');
};

const parseStyle = (tag, parent = {}) => {
  const next = { ...parent };
  const name = tag.match(/^<\/?\s*([a-z0-9]+)/i)?.[1]?.toLowerCase() || '';
  if (name === 'strong' || name === 'b') next.bold = true;
  if (name === 'em' || name === 'i') next.italic = true;
  if (name === 'a') next.link = decodeEntities(tag.match(/href\s*=\s*["']([^"']*)["']/i)?.[1] || '');
  const style = tag.match(/style\s*=\s*["']([^"']*)["']/i)?.[1]?.toLowerCase() || '';
  const weight = style.match(/font-weight\s*:\s*([^;]+)/)?.[1]?.trim();
  if (weight) next.bold = /^(bold|[6-9]00)$/.test(weight);
  const fontStyle = style.match(/font-style\s*:\s*([^;]+)/)?.[1]?.trim();
  if (fontStyle) next.italic = fontStyle === 'italic' || fontStyle === 'oblique';
  return next;
};

export const editorHtmlToRichDocument = (html = '') => {
  const safe = String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '');
  const blocks = [];
  const blockStack = [];
  const inlineStack = [];

  const currentStyle = () => inlineStack[inlineStack.length - 1]?.style || {};
  const emit = (context) => {
    if (!context.runs.length) return;
    blocks.push({ type: context.type, runs: context.runs });
    context.runs = [];
    context.emitted = true;
  };
  const lineBreak = (context) => {
    if (context.runs.length) {
      emit(context);
      context.afterBreak = true;
    } else if (context.afterBreak) {
      blocks.push({ type: 'blank', runs: [] });
      context.emitted = true;
    } else {
      context.afterBreak = true;
    }
  };
  const appendText = (context, value) => {
    const parts = value.replace(/\r\n?/g, '\n').split('\n');
    parts.forEach((part, index) => {
      if (index) lineBreak(context);
      if (!part) return;
      context.afterBreak = false;
      appendRun(context.runs, part, currentStyle());
    });
  };
  const begin = (name, type) => {
    const parent = blockStack[blockStack.length - 1];
    const nestedInListItem = parent?.type === 'list_item' && (name === 'div' || name === 'p');
    if (parent) {
      emit(parent);
      if (parent.afterBreak) {
        blocks.push({ type: 'blank', runs: [] });
        parent.afterBreak = false;
      }
      parent.hasBlockChild = true;
    }
    blockStack.push({
      name,
      // Alguns teclados/WebViews envolvem o texto de <li> em <div> ou <p>.
      // Esses invólucros continuam pertencendo à lista e não podem perder o marcador.
      type: nestedInListItem ? 'list_item' : type,
      runs: [],
      afterBreak: false,
      emitted: false,
      hasBlockChild: false,
    });
  };
  const finish = (context) => {
    emit(context);
    if (context.afterBreak && !context.hasBlockChild) {
      blocks.push({ type: 'blank', runs: [] });
    }
  };
  const blockType = (name) => {
    if (name === 'h1' || name === 'h2' || name === 'h3') return `heading${name.slice(1)}`;
    if (name === 'li') return 'list_item';
    if (name === 'div' || name === 'p') return 'paragraph';
    return null;
  };

  safe.match(/<[^>]+>|[^<]+/g)?.forEach((token) => {
    if (!token.startsWith('<')) {
      const text = decodeEntities(token);
      if (!text || (!blockStack.length && !text.trim())) return;
      if (!blockStack.length) begin('', 'paragraph');
      appendText(blockStack[blockStack.length - 1], text);
      return;
    }
    const closing = /^<\//.test(token);
    const name = token.match(/^<\/?\s*([a-z0-9]+)/i)?.[1]?.toLowerCase() || '';
    if (!closing && name === 'br') {
      if (!blockStack.length) begin('', 'paragraph');
      lineBreak(blockStack[blockStack.length - 1]);
      return;
    }
    const type = blockType(name);
    if (!closing && type) {
      begin(name, type);
      return;
    }
    if (closing && type) {
      const position = blockStack.map(item => item.name).lastIndexOf(name);
      if (position >= 0) {
        const closingContexts = blockStack.splice(position);
        closingContexts.reverse().forEach(finish);
      }
      return;
    }
    if (!closing && !['ul', 'ol', 'html', 'body'].includes(name)) {
      inlineStack.push({ name, style: parseStyle(token, currentStyle()) });
    } else if (closing) {
      const position = inlineStack.map(item => item.name).lastIndexOf(name);
      if (position >= 0) {
        inlineStack.splice(position);
      }
    }
  });
  while (blockStack.length) finish(blockStack.pop());
  if (blocks.length && blocks.every(block => block.type === 'blank')) {
    return { version: 1, blocks: [] };
  }
  return normalizeRichDocument({ version: 1, blocks });
};
