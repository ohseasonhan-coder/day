import React, { useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CheckSquare, Columns3,
  Highlighter, Indent, Italic, List, ListOrdered, Minus, Outdent, Quote,
  Redo2, Rows3, SplitSquareHorizontal, Strikethrough, Table as TableIcon,
  Trash2, Type, Underline as UnderlineIcon, Undo2,
} from 'lucide-react';
import { FIELD_DEFINITIONS } from '../utils/documentStudio';
import {
  FieldChipNode, FontSizeExtension, IndentExtension, LineHeightExtension, PageBreakNode,
} from './documentEditorExtensions';

const toolbarButton = (active = false, disabled = false) => ({
  width: 34,
  height: 34,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: active ? 'var(--primary)' : 'var(--white)',
  color: active ? 'white' : 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: disabled ? 0.45 : 1,
});

const selectStyle = {
  height: 34,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--white)',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 700,
  padding: '0 8px',
};

function ToolButton({ title, active, disabled, onClick, children }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} style={toolbarButton(active, disabled)}>
      {children}
    </button>
  );
}

function FieldInsert({ editor, disabled, onFieldInfo }) {
  const [query, setQuery] = useState('');
  const [fieldKey, setFieldKey] = useState(FIELD_DEFINITIONS[0].key);
  const fields = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FIELD_DEFINITIONS.filter((field) =>
      !q || field.label.toLowerCase().includes(q) || field.key.toLowerCase().includes(q));
  }, [query]);
  const selected = FIELD_DEFINITIONS.find((field) => field.key === fieldKey) || FIELD_DEFINITIONS[0];

  if (disabled) return null;
  return (
    <div className="doc-toolbar-field">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="필드 검색"
        style={{ ...selectStyle, width: 96 }}
      />
      <select
        value={fieldKey}
        onChange={(event) => {
          setFieldKey(event.target.value);
          const field = FIELD_DEFINITIONS.find((item) => item.key === event.target.value);
          if (field) onFieldInfo?.(field);
        }}
        style={{ ...selectStyle, width: 150 }}
      >
        {fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
      </select>
      <button
        type="button"
        onClick={() => {
          editor?.chain().focus().insertFieldChip(selected.key).run();
          onFieldInfo?.(selected);
        }}
        style={{ ...toolbarButton(false, !editor), width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 800 }}
      >
        삽입
      </button>
    </div>
  );
}

export default function RichDocumentEditor({
  content,
  onChange,
  editable = true,
  canInsertFields = false,
  onFieldInfo,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      FieldChipNode,
      PageBreakNode,
      FontSizeExtension,
      LineHeightExtension,
      IndentExtension,
    ],
    content,
    editable,
    onUpdate: ({ editor: nextEditor }) => onChange?.(nextEditor.getJSON()),
    editorProps: {
      handleClick(view, pos, event) {
        const target = event.target;
        if (target?.dataset?.fieldChip === 'true') {
          const field = FIELD_DEFINITIONS.find((item) => item.key === target.dataset.fieldKey);
          if (field) onFieldInfo?.(field);
        }
        return false;
      },
    },
  }, [editable]);

  React.useEffect(() => {
    if (!editor || !content) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(content);
    if (current !== incoming) editor.commands.setContent(content, false);
  }, [editor, content]);

  if (!editor) return null;

  const setHeading = (level) => {
    if (!level) editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level }).run();
  };

  const iconSize = 17;
  return (
    <div className="rich-document-editor">
      {editable && (
        <div className="doc-toolbar no-print">
          <div className="doc-toolbar-row">
            <ToolButton title="실행 취소" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={iconSize} /></ToolButton>
            <ToolButton title="다시 실행" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={iconSize} /></ToolButton>
            <span className="doc-toolbar-sep" />
            <select
              aria-label="문단 스타일"
              onChange={(event) => setHeading(Number(event.target.value))}
              value={editor.isActive('heading', { level: 1 }) ? 1 : editor.isActive('heading', { level: 2 }) ? 2 : editor.isActive('heading', { level: 3 }) ? 3 : 0}
              style={{ ...selectStyle, width: 94 }}
            >
              <option value={0}>문단</option>
              <option value={1}>제목 1</option>
              <option value={2}>제목 2</option>
              <option value={3}>제목 3</option>
            </select>
            <select aria-label="글자 크기" onChange={(event) => editor.chain().focus().setFontSize(event.target.value).run()} style={{ ...selectStyle, width: 76 }} defaultValue="15px">
              {['12px', '13px', '15px', '17px', '20px', '24px', '30px'].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <select aria-label="줄 간격" onChange={(event) => editor.chain().focus().setLineHeight(event.target.value).run()} style={{ ...selectStyle, width: 72 }} defaultValue="1.8">
              {['1.4', '1.6', '1.8', '2', '2.2'].map((line) => <option key={line} value={line}>{line}</option>)}
            </select>
            <ToolButton title="굵게" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={iconSize} /></ToolButton>
            <ToolButton title="기울임" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={iconSize} /></ToolButton>
            <ToolButton title="밑줄" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={iconSize} /></ToolButton>
            <ToolButton title="취소선" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={iconSize} /></ToolButton>
            <label className="doc-color-control" title="글자색">
              <Type size={15} />
              <input type="color" onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
            </label>
            <label className="doc-color-control" title="배경 강조색">
              <Highlighter size={15} />
              <input type="color" defaultValue="#fff3bf" onChange={(event) => editor.chain().focus().toggleHighlight({ color: event.target.value }).run()} />
            </label>
          </div>
          <div className="doc-toolbar-row">
            <ToolButton title="왼쪽 정렬" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={iconSize} /></ToolButton>
            <ToolButton title="가운데 정렬" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={iconSize} /></ToolButton>
            <ToolButton title="오른쪽 정렬" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={iconSize} /></ToolButton>
            <ToolButton title="양쪽 정렬" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify size={iconSize} /></ToolButton>
            <ToolButton title="들여쓰기" onClick={() => editor.chain().focus().indentParagraph().run()}><Indent size={iconSize} /></ToolButton>
            <ToolButton title="내어쓰기" onClick={() => editor.chain().focus().outdentParagraph().run()}><Outdent size={iconSize} /></ToolButton>
            <span className="doc-toolbar-sep" />
            <ToolButton title="글머리표" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={iconSize} /></ToolButton>
            <ToolButton title="번호 목록" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={iconSize} /></ToolButton>
            <ToolButton title="체크리스트" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}><CheckSquare size={iconSize} /></ToolButton>
            <ToolButton title="인용문" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={iconSize} /></ToolButton>
            <ToolButton title="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={iconSize} /></ToolButton>
            <button type="button" title="페이지 나누기" onClick={() => editor.chain().focus().insertPageBreak().run()} style={{ ...toolbarButton(false), width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 800 }}>쪽 나눔</button>
            <span className="doc-toolbar-sep" />
            <ToolButton title="표 삽입" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon size={iconSize} /></ToolButton>
            <ToolButton title="행 추가" disabled={!editor.can().addRowAfter()} onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 size={iconSize} /></ToolButton>
            <ToolButton title="열 추가" disabled={!editor.can().addColumnAfter()} onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 size={iconSize} /></ToolButton>
            <ToolButton title="셀 병합" disabled={!editor.can().mergeCells()} onClick={() => editor.chain().focus().mergeCells().run()}><SplitSquareHorizontal size={iconSize} /></ToolButton>
            <ToolButton title="셀 분할" disabled={!editor.can().splitCell()} onClick={() => editor.chain().focus().splitCell().run()}><SplitSquareHorizontal size={iconSize} /></ToolButton>
            <ToolButton title="행 삭제" disabled={!editor.can().deleteRow()} onClick={() => editor.chain().focus().deleteRow().run()}><Trash2 size={iconSize} /></ToolButton>
            <ToolButton title="열 삭제" disabled={!editor.can().deleteColumn()} onClick={() => editor.chain().focus().deleteColumn().run()}><Trash2 size={iconSize} /></ToolButton>
            <FieldInsert editor={editor} disabled={!canInsertFields} onFieldInfo={onFieldInfo} />
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
