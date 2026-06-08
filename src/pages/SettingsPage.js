import React, { useState } from 'react';
import { getSettings, saveSettings, getApiKey, saveApiKey, getClasses, getChildren, saveChildren, genId } from '../utils/storage';
import { ArrowLeft, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

export default function SettingsPage({ onBack }) {
  const [settings, setSettings] = useState(getSettings());
  const [apiKey, setApiKey] = useState(getApiKey());
  const [showKey, setShowKey] = useState(false);
  const [classes] = useState(getClasses());
  const [children, setChildren] = useState(getChildren());
  const [activeTab, setActiveTab] = useState('general');
  const [newChildName, setNewChildName] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveSettings(settings);
    saveApiKey(apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddChild = () => {
    if (!newChildName.trim()) return;
    const cl = classes[0];
    const newChild = { id: genId(), name: newChildName.trim(), classId: cl?.id };
    const updated = [...children, newChild];
    saveChildren(updated);
    setChildren(updated);
    setNewChildName('');
  };

  const handleRemoveChild = (id) => {
    const updated = children.filter(c => c.id !== id);
    saveChildren(updated);
    setChildren(updated);
  };

  const cl = classes[0];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, background: 'rgba(248,250,254,0.95)',
        backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)',
        padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 12, zIndex: 100,
      }}>
        <button onClick={onBack} style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14 }}>
          <ArrowLeft size={18} /> 설정
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
          {[['general', '⚙️ 일반'], ['children', '👶 아이 관리'], ['api', '🤖 AI'], ['about', 'ℹ️ 정보']].map(([k, v]) => (
            <button key={k} onClick={() => setActiveTab(k)} style={{
              padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 500,
              background: activeTab === k ? 'var(--primary)' : 'var(--gray-100)',
              color: activeTab === k ? 'white' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {v}
            </button>
          ))}
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <div>
            <SettingCard title="이름 표시 방식">
              {[['name', '실명 (하준이는)', 'alias', '별칭 (A아동은)'], ['blank', '빈칸 (○○이는)', 'common', '공통 (유아는)']].flat().reduce((acc, _, i, arr) => {
                if (i % 2 === 0) acc.push(arr.slice(i, i + 2));
                return acc;
              }, []).map(([k, v]) => (
                <button key={k} onClick={() => setSettings(s => ({ ...s, nameStyle: k }))} style={{
                  width: '100%', padding: '12px 14px', textAlign: 'left', fontSize: 14,
                  background: settings.nameStyle === k ? 'var(--primary-light)' : 'transparent',
                  color: settings.nameStyle === k ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: settings.nameStyle === k ? 600 : 400,
                  borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 4,
                }}>
                  {settings.nameStyle === k ? '✓ ' : '  '}{v}
                </button>
              ))}
            </SettingCard>

            <SettingCard title="기본 말투">
              {[['warm', '따뜻하고 전문적으로'], ['professional', '전문적이고 간결하게'], ['formal', '공식적이고 격식 있게']].map(([k, v]) => (
                <button key={k} onClick={() => setSettings(s => ({ ...s, tone: k }))} style={{
                  width: '100%', padding: '12px 14px', textAlign: 'left', fontSize: 14,
                  background: settings.tone === k ? 'var(--primary-light)' : 'transparent',
                  color: settings.tone === k ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: settings.tone === k ? 600 : 400,
                  borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 4,
                }}>
                  {settings.tone === k ? '✓ ' : '  '}{v}
                </button>
              ))}
            </SettingCard>

            <SettingCard title="자동화 설정">
              {[
                ['softening', '부정 표현 자동 순화'],
                ['autoCategory', '대표 카테고리 자동 분류'],
                ['saveParentVersion', '부모상담용 문장 자동 저장'],
                ['saveSupportPlan', '지원계획 자동 생성'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14 }}>{v}</span>
                  <button
                    onClick={() => setSettings(s => ({ ...s, [k]: !s[k] }))}
                    style={{
                      width: 44, height: 24, borderRadius: 12,
                      background: settings[k] ? 'var(--primary)' : 'var(--gray-300)',
                      position: 'relative', border: 'none', cursor: 'pointer', transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, background: 'white', borderRadius: '50%',
                      position: 'absolute', top: 3,
                      left: settings[k] ? 23 : 3,
                      transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              ))}
            </SettingCard>

            <button onClick={handleSave} style={{
              width: '100%', padding: '14px', borderRadius: 14,
              background: saved ? 'var(--cat-play)' : 'var(--primary)',
              color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', border: 'none',
              boxShadow: '0 4px 16px rgba(79,127,255,0.3)',
            }}>
              {saved ? '저장 완료!' : '설정 저장'}
            </button>
          </div>
        )}

        {/* Children Tab */}
        {activeTab === 'children' && (
          <div>
            {cl && (
              <div style={{ background: 'var(--primary-light)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>현재 반</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{cl.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{cl.year}학년도 · {cl.age}세반</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={newChildName}
                onChange={e => setNewChildName(e.target.value)}
                placeholder="아이 이름 추가"
                onKeyDown={e => e.key === 'Enter' && handleAddChild()}
                style={{ flex: 1, padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
              />
              <button onClick={handleAddChild} style={{
                background: 'var(--primary)', color: 'white', padding: '0 16px', borderRadius: 10,
                fontWeight: 600, cursor: 'pointer', border: 'none', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Plus size={16} /> 추가
              </button>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
              등록된 아이 ({children.length}명)
            </div>
            {children.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</span>
                <button onClick={() => handleRemoveChild(c.id)} style={{ color: 'var(--accent)', cursor: 'pointer', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* AI Tab */}
        {activeTab === 'api' && (
          <div>
            <SettingCard title="AI 자동화 방식">
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  API 키 없이 바로 사용
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  이 앱은 기기 안에서 자동으로 분류·순화·문서 생성을 처리합니다.<br />
                  외부 서버나 API 연결이 필요 없으며,<br />
                  인터넷 없이도 모든 기능을 사용할 수 있습니다.
                </div>
              </div>
              <div style={{ background: 'var(--gray-50)', borderRadius: 12, padding: '16px', marginTop: 8 }}>
                {[
                  ['카테고리 자동 분류', '키워드 분석으로 즉시 처리'],
                  ['발달영역 자동 태깅', '관찰 내용 기반 자동 매핑'],
                  ['부정 표현 순화', '전문 용어 사전 기반'],
                  ['문서 초안 생성', '보육 전문 템플릿 적용'],
                ].map(([title, desc]) => (
                  <div key={title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{desc}</span>
                  </div>
                ))}
              </div>
            </SettingCard>
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div>
            <div style={{ textAlign: 'center', padding: '40px 0 20px' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>쌤워크</div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 4 }}>선생님은 기록만, 문서는 앱이.</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>v0.1.0 MVP</div>
            </div>

            <SettingCard title="앱 소개">
              <div style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--text-secondary)' }}>
                어린이집 교사가 하루 동안 짧게 남긴 기록을 바탕으로, 아이별 관찰일지·부모상담자료·발달평가·보육일지·주간/월간 놀이평가 문서를 자동으로 작성하는 AI 실무형 교사 업무관리 앱입니다.
              </div>
            </SettingCard>

            <SettingCard title="주요 기능">
              {['✍️ 짧은 관찰 기록 입력 → AI 자동 분류', '📋 관찰일지·부모상담용·지원계획 자동 생성', '📄 오늘 기록 → 보육일지 초안 자동 작성', '👶 아이별 성장 요약 및 상담자료 생성', '✅ 기록 누락 체크 및 카테고리 균형 점검'].map((item, i) => (
                <div key={i} style={{ fontSize: 14, padding: '8px 0', borderBottom: '1px solid var(--border)', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {item}
                </div>
              ))}
            </SettingCard>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingCard({ title, children }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.3px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}
