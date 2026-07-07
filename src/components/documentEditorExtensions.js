import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { FIELD_MAP } from '../utils/documentStudio';

export const FieldChipNode = Node.create({
  name: 'fieldChip',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      fieldKey: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-field-key') || '',
        renderHTML: (attributes) => ({ 'data-field-key': attributes.fieldKey }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-field-chip]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const key = node.attrs.fieldKey;
    const label = FIELD_MAP[key]?.label || key || '알 수 없는 필드';
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-field-chip': 'true',
      class: 'sw-field-chip',
      title: `${label} 자동 필드`,
    }), label];
  },

  addCommands() {
    return {
      insertFieldChip: (fieldKey) => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: { fieldKey } }),
    };
  },
});

export const PageBreakNode = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true', class: 'sw-page-break' })];
  },

  addCommands() {
    return {
      insertPageBreak: () => ({ commands }) => commands.insertContent({ type: this.name }),
    };
  },
});

export const FontSizeExtension = Extension.create({
  name: 'fontSize',

  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize || null,
          renderHTML: (attributes) => (
            attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {}
          ),
        },
      },
    }];
  },

  addCommands() {
    return {
      setFontSize: (fontSize) => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

export const LineHeightExtension = Extension.create({
  name: 'lineHeight',

  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (element) => element.style.lineHeight || null,
          renderHTML: (attributes) => (
            attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {}
          ),
        },
      },
    }];
  },

  addCommands() {
    return {
      setLineHeight: (lineHeight) => ({ commands }) => commands.updateAttributes('paragraph', { lineHeight }),
    };
  },
});

export const IndentExtension = Extension.create({
  name: 'indent',

  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (element) => Number(element.getAttribute('data-indent') || 0),
          renderHTML: (attributes) => {
            const indent = Number(attributes.indent || 0);
            return indent > 0
              ? { 'data-indent': indent, style: `margin-left: ${indent * 24}px` }
              : {};
          },
        },
      },
    }];
  },

  addCommands() {
    const update = (delta) => ({ editor, commands }) => {
      const attrs = editor.getAttributes('paragraph');
      const next = Math.max(0, Math.min(6, Number(attrs.indent || 0) + delta));
      return commands.updateAttributes('paragraph', { indent: next });
    };
    return {
      indentParagraph: () => update(1),
      outdentParagraph: () => update(-1),
    };
  },
});
