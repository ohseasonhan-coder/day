import React, { useEffect, useRef, useState } from 'react';
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
import TiptapLink from '@tiptap/extension-link';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CheckSquare, Columns3,
  Highlighter, Image as ImageIcon, Indent, Italic, Link as LinkIcon, List, ListOrdered, Minus, Outdent, Quote,
  Redo2, Rows3, SplitSquareHorizontal, Strikethrough, Table as TableIcon, Tag,
  Trash2, Type, Underline as UnderlineIcon, Undo2,
} from 'lucide-react';
import { FIELD_DEFINITIONS } from '../utils/documentStudio';
import { getCustomFields } from '../utils/customFields';
import { compressImage, savePhotos } from '../utils/photoStore';
import {
  FieldChipNode, FontSizeExtension, ImageWithId, IndentExtension, LineHeightExtension, PageBreakNode,
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

function FieldOption({ field, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left', padding: '7px 9px', borderRadius: 7,
        fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)',
        background: hover ? 'var(--gray-50)' : 'transparent', border: 'none',
      }}
    >
      {field.label}
      {field.custom && <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', marginLeft: 6 }}>{field.value || '(비어 있음)'}</span>}
    </button>
  );
}

// fieldScope: 'all'(기본 16개+커스텀 전부) | 'customOnly'(원아 기록 기반 기본 필드는 의미가 없는
// 공개 페이지 등에서 관리자가 만든 커스텀 필드만 노출)
// "여기에 이게 들어간다"를 클릭 한 번으로 고르는 웹 에디터 느낌의 삽입 메뉴(검색+목록+클릭 삽입).
function FieldInsert({ editor, disabled, onFieldInfo, fieldScope = 'all' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocPointer = (event) => {
      if (btnRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (disabled) return null;

  const baseFields = fieldScope === 'customOnly' ? [] : FIELD_DEFINITIONS;
  const customFields = getCustomFields().map((f) => ({ key: f.key, label: f.label, value: f.value, custom: true }));
  const combined = [...baseFields, ...customFields];
  const q = query.trim().toLowerCase();
  const filtered = combined.filter((field) => !q || field.label.toLowerCase().includes(q) || field.key.toLowerCase().includes(q));
  const baseMatches = filtered.filter((f) => !f.custom);
  const customMatches = filtered.filter((f) => f.custom);

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen((v) => !v);
  };
  const insertField = (field) => {
    editor?.chain().focus().insertFieldChip(field.key, field.label).run();
    onFieldInfo?.(field);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="필드 삽입 — 여기에 무엇이 들어갈지 골라요"
        onClick={toggleOpen}
        style={{ ...toolbarButton(open, !editor), width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}
      >
        <Tag size={14} /> 필드 삽입
      </button>
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 200, width: 240,
            background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,0.16)', padding: 8,
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="필드 검색"
            style={{ ...selectStyle, width: '100%', marginBottom: 6, boxSizing: 'border-box' }}
          />
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {combined.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', padding: '8px 4px' }}>
                커스텀 필드가 없어요 — 사이트 관리에서 먼저 만들어 주세요.
              </div>
            )}
            {baseMatches.length > 0 && (
              <>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-tertiary)', padding: '4px 6px' }}>기본 필드</div>
                {baseMatches.map((field) => <FieldOption key={field.key} field={field} onClick={() => insertField(field)} />)}
              </>
            )}
            {customMatches.length > 0 && (
              <>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-tertiary)', padding: '4px 6px' }}>직접 만든 필드</div>
                {customMatches.map((field) => <FieldOption key={field.key} field={field} onClick={() => insertField(field)} />)}
              </>
            )}
            {combined.length > 0 && filtered.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', padding: '8px 4px' }}>검색 결과가 없어요.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function RichDocumentEditor({
  content,
  onChange,
  editable = true,
  canInsertFields = false,
  fieldScope = 'all',
  photoOwnerId = null,
  onFieldInfo,
}) {
  const fileInputRef = useRef(null);
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
      TiptapLink.configure({ openOnClick: false, autolink: false }),
      ImageWithId.configure({ inline: false }),
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
          const key = target.dataset.fieldKey;
          const field = FIELD_DEFINITIONS.find((item) => item.key === key)
            || getCustomFields().find((item) => item.key === key);
          if (field) onFieldInfo?.(field);
        }
        return false;
      },
    },
  }, [editable]);

  const insertImage = async (file) => {
    if (!file || !editor) return;
    try {
      const dataUrl = await compressImage(file);
      const photoId = photoOwnerId ? (await savePhotos(photoOwnerId, [dataUrl]))[0] : null;
      editor.chain().focus().setImage({ src: dataUrl, photoId }).run();
    } catch {
      // 이미지 삽입 실패해도 문서 편집 자체는 계속할 수 있어야 하므로 조용히 무시
    }
  };

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
            <span className="doc-toolbar-sep" />
            <input
              ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) insertImage(file); }}
            />
            <ToolButton title="이미지 삽입" disabled={!photoOwnerId} onClick={() => fileInputRef.current?.click()}><ImageIcon size={iconSize} /></ToolButton>
            <ToolButton title="링크" active={editor.isActive('link')} onClick={() => {
              const prevHref = editor.getAttributes('link').href || '';
              const url = window.prompt('링크 주소(URL)', prevHref);
              if (url === null) return;
              if (!url.trim()) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
              editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
            }}><LinkIcon size={iconSize} /></ToolButton>
            <FieldInsert editor={editor} disabled={!canInsertFields} fieldScope={fieldScope} onFieldInfo={onFieldInfo} />
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
