import { Extension, Node, mergeAttributes } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import TiptapImage from '@tiptap/extension-image';
import { FIELD_MAP } from '../utils/documentStudio';

// 기본 이미지 노드에 IndexedDB 사진 참조(photoId)만 추가 — localStorage에는 이 id만 남고
// 실제 바이트는 photoStore.js(IndexedDB)에 저장된다(strip/hydrate로 오간다).
export const ImageWithId = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      photoId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-photo-id') || null,
        renderHTML: (attributes) => (attributes.photoId ? { 'data-photo-id': attributes.photoId } : {}),
      },
    };
  },
});

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
      // 삽입 시점의 라벨을 노드에 함께 저장 — 기본 필드든 관리자 커스텀 필드든 조회 없이
      // 스스로 표시 가능. 비어 있으면(기존 저장 문서) FIELD_MAP 조회로 폴백한다(하위 호환).
      fieldLabel: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-field-label') || '',
        renderHTML: (attributes) => (attributes.fieldLabel ? { 'data-field-label': attributes.fieldLabel } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-field-chip]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const key = node.attrs.fieldKey;
    const label = node.attrs.fieldLabel || FIELD_MAP[key]?.label || key || '알 수 없는 필드';
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-field-chip': 'true',
      class: 'sw-field-chip',
      title: `${label} 자동 필드`,
    }), label];
  },

  addCommands() {
    return {
      insertFieldChip: (fieldKey, fieldLabel = '') => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: { fieldKey, fieldLabel } }),
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

// "/" 입력 시 필드 삽입 메뉴 — 노션·워드 같은 웹 에디터처럼 본문 중간에서 바로
// "/원아명"을 치면 필드 목록이 뜨고, 클릭(또는 방향키+Enter)으로 바로 삽입된다.
// getItems(query)는 검색어에 맞는 필드 배열({key,label,value?,custom?})을 반환해야 한다.
export function createFieldSlashCommand({ getItems, onInsert }) {
  return Extension.create({
    name: 'fieldSlashCommand',

    addOptions() {
      return {
        suggestion: {
          char: '/',
          startOfLine: false,
          items: ({ query }) => getItems(query),
          command: ({ editor, range, props }) => {
            editor.chain().focus().deleteRange(range).insertFieldChip(props.key, props.label).run();
            onInsert?.(props);
          },
          render: createSlashMenuRenderer,
        },
      };
    },

    addProseMirrorPlugins() {
      return [Suggestion({ editor: this.editor, ...this.options.suggestion })];
    },
  });
}

function createSlashMenuRenderer() {
  let panelEl = null;
  let listEl = null;
  let selectedIndex = 0;
  let currentItems = [];
  let currentCommand = null;

  const renderList = () => {
    listEl.innerHTML = '';
    if (!currentItems.length) {
      const empty = document.createElement('div');
      empty.textContent = '검색 결과가 없어요.';
      empty.style.cssText = 'font-size:11.5px;color:var(--text-tertiary);padding:8px 4px;';
      listEl.appendChild(empty);
      return;
    }
    currentItems.forEach((item, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.style.cssText = `display:block;width:100%;text-align:left;padding:7px 9px;border-radius:7px;`
        + `font-size:12.5px;font-weight:700;color:var(--text-primary);border:none;cursor:pointer;`
        + `background:${index === selectedIndex ? 'var(--gray-50)' : 'transparent'};`;
      row.textContent = item.label;
      if (item.custom) {
        const hint = document.createElement('span');
        hint.textContent = item.value || '(비어 있음)';
        hint.style.cssText = 'font-size:10.5px;font-weight:700;color:var(--text-tertiary);margin-left:6px;';
        row.appendChild(hint);
      }
      row.addEventListener('mousedown', (event) => {
        event.preventDefault();
        currentCommand(item);
      });
      row.addEventListener('mouseenter', () => { selectedIndex = index; renderList(); });
      listEl.appendChild(row);
    });
  };

  const updatePosition = (clientRect) => {
    if (!panelEl || !clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    panelEl.style.top = `${rect.bottom + 6}px`;
    panelEl.style.left = `${rect.left}px`;
  };

  const destroy = () => {
    panelEl?.remove();
    panelEl = null;
    listEl = null;
  };

  return {
    onStart: (props) => {
      currentItems = props.items;
      currentCommand = props.command;
      selectedIndex = 0;

      panelEl = document.createElement('div');
      panelEl.style.cssText = 'position:fixed;z-index:200;width:220px;max-height:240px;overflow-y:auto;'
        + 'background:var(--white);border:1px solid var(--border);border-radius:12px;'
        + 'box-shadow:0 12px 32px rgba(0,0,0,0.16);padding:8px;';
      listEl = document.createElement('div');
      panelEl.appendChild(listEl);
      document.body.appendChild(panelEl);

      renderList();
      updatePosition(props.clientRect);
    },
    onUpdate: (props) => {
      currentItems = props.items;
      currentCommand = props.command;
      selectedIndex = 0;
      renderList();
      updatePosition(props.clientRect);
    },
    onKeyDown: (props) => {
      if (!panelEl) return false;
      if (props.event.key === 'Escape') { destroy(); return true; }
      if (props.event.key === 'ArrowDown') {
        selectedIndex = currentItems.length ? (selectedIndex + 1) % currentItems.length : 0;
        renderList();
        return true;
      }
      if (props.event.key === 'ArrowUp') {
        selectedIndex = currentItems.length ? (selectedIndex - 1 + currentItems.length) % currentItems.length : 0;
        renderList();
        return true;
      }
      if (props.event.key === 'Enter') {
        if (currentItems[selectedIndex]) currentCommand(currentItems[selectedIndex]);
        return true;
      }
      return false;
    },
    onExit: destroy,
  };
}

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
