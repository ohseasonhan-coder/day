import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getRecords, getChildren, getDocuments, getConsults } from '../utils/storage';
import { Search, X, PenLine, FolderOpen, MessageSquare } from 'lucide-react';

function highlight(text, query) {
  if (!query || !text) return text || '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 3, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SearchModal({ isOpen, onClose, onNavigate }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;

    const children = getChildren();
    const childMap = Object.fromEntries(children.map(c => [c.id, c.name]));

    const records = getRecords();
    const matchedRecords = records
      .filter(r => {
        const haystack = [r.childName, r.rawText, r.observation, r.parent, r.support, ...(r.tags || [])].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8)
      .map(r => ({
        type: 'record',
        id: r.id,
        title: r.childName || childMap[r.childId] || '아동',
        sub: r.rawText ? r.rawText.slice(0, 60) + (r.rawText.length > 60 ? '…' : '') : '',
        date: r.date,
        ctx: { childId: r.childId, date: r.date, mode: 'list' },
      }));

    const documents = getDocuments();
    const matchedDocs = documents
      .filter(d => {
        const haystack = [d.title, d.content, d.docType].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 5)
      .map(d => ({
        type: 'doc',
        id: d.id,
        title: d.title || '문서',
        sub: d.content ? d.content.slice(0, 60) + (d.content.length > 60 ? '…' : '') : '',
        date: d.date || d.createdAt?.slice(0, 10),
        ctx: { docType: d.docType },
      }));

    const consults = getConsults();
    const matchedConsults = consults
      .filter(c => {
        const haystack = [c.childName, c.notes, c.topic, c.type].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 5)
      .map(c => ({
        type: 'consult',
        id: c.id,
        title: c.childName || '아동',
        sub: c.notes ? c.notes.slice(0, 60) + (c.notes.length > 60 ? '…' : '') : (c.topic || ''),
        date: c.date,
        ctx: null,
      }));

    return { records: matchedRecords, docs: matchedDocs, consults: matchedConsults };
  }, [query]);

  if (!isOpen) return null;

  const total = results ? results.records.length + results.docs.length + results.consults.length : 0;

  const handleClick = (item) => {
    onClose();
    if (item.type === 'record') onNavigate('record', item.ctx);
    else if (item.type === 'doc') onNavigate('docs', item.ctx);
    else if (item.type === 'consult') onNavigate('consult');
  };

  const ICONS = { record: PenLine, doc: FolderOpen, consult: MessageSquare };
  const COLORS = { record: 'var(--primary)', doc: 'var(--cat-play)', consult: '#FF8C42' };

  const ResultGroup = ({ label, items }) => {
    if (!items?.length) return null;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: '0.6px', padding: '6px 16px 4px', textTransform: 'uppercase' }}>{label}</div>
        {items.map(item => {
          const Icon = ICONS[item.type];
          const color = COLORS[item.type];
          return (
            <button key={item.id} onClick={() => handleClick(item)} style={{
              width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '11px 16px', background: 'transparent', textAlign: 'left',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <Icon size={16} color={color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {highlight(item.title, query.trim())}
                  {item.date && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginLeft: 8 }}>{item.date}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {highlight(item.sub, query.trim())}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '70vh',
          background: 'var(--white)', borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column',
          margin: '0 16px',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="기록, 문서, 상담 검색 (2자 이상)"
            style={{
              flex: 1, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
              background: 'transparent', outline: 'none', border: 'none',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
              <X size={18} />
            </button>
          )}
          <button onClick={onClose} style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700, background: 'var(--gray-100)', padding: '5px 9px', borderRadius: 8, flexShrink: 0 }}>
            ESC
          </button>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!results && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              검색어를 2자 이상 입력하세요<br />
              <span style={{ fontSize: 11, marginTop: 6, display: 'block' }}>기록, 문서, 상담 내용을 한 번에 찾아드립니다</span>
            </div>
          )}
          {results && total === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              <span style={{ fontSize: 20 }}>🔍</span><br />
              <span style={{ marginTop: 8, display: 'block' }}>"{query.trim()}"에 해당하는 결과가 없어요</span>
            </div>
          )}
          {results && total > 0 && (
            <>
              <ResultGroup label={`기록 (${results.records.length})`} items={results.records} />
              <ResultGroup label={`문서 (${results.docs.length})`} items={results.docs} />
              <ResultGroup label={`상담 (${results.consults.length})`} items={results.consults} />
            </>
          )}
        </div>

        {results && total > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>
            총 {total}개 결과
          </div>
        )}
      </div>
    </div>
  );
}
