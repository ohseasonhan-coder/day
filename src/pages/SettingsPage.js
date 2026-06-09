import React, { useState, useRef } from 'react';
import { getSettings, saveSettings, getClasses, getChildren, saveChildren, genId, exportBackup, importBackup } from '../utils/storage';
import { changePassword, deleteAccount, PLANS } from '../utils/auth';
import { ArrowLeft, Plus, Trash2, Download, Upload, LogOut, Key, UserX, Check, AlertCircle, Moon, Sun } from 'lucide-react';

const PLAN_LABELS = {
  [PLANS.VIP]:     { label: '영구 무료 (VIP)',  color: '#E91E9A', bg: '#FDE8F4', badge: '👑 VIP' },
  [PLANS.PREMIUM]: { label: '프리미엄',          color: 'var(--primary)', bg: 'var(--primary-light)', badge: '⭐ 프리미엄' },
  [PLANS.FREE]:    { label: '무료 플랜',          color: 'var(--text-secondary)', bg: 'var(--gray-100)', badge: '무료' },
};
export default function SettingsPage({ onBack, currentUser, onLogout, isDark, toggleTheme }) {
  const [settings, setSettings]   = useState(getSettings());
  const [classes]                 = useState(getClasses());
  const [children, setChildren]   = useState(getChildren());
  const [activeTab, setActiveTab] = useState('general');
  const [newChildName, setNewChildName] = useState('');
  const [saved, setSaved]         = useState(false);

  // 비밀번호 변경
  const [oldPw, setOldPw]   = useState('');
  const [newPw, setNewPw]   = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwMsg, setPwMsg]   = useState(null); // { ok, text }

  // 계정 삭제
  const [deletePw, setDeletePw] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');

  // 백업/복구
  const [backupMsg, setBackupMsg] = useState(null); // { ok, text }
  const fileRef = useRef(null);

  const handleSave = () => {
    saveSettings(settings);
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

  const handleChangePassword = () => {
    const res = changePassword(currentUser?.userId, oldPw, newPw);
    if (!res.ok) { setPwMsg({ ok: false, text: res.error }); return; }
    if (newPw !== newPw2) { setPwMsg({ ok: false, text: '새 비밀번호가 일치하지 않아요.' }); return; }
    setPwMsg({ ok: true, text: '비밀번호가 변경됐어요.' });
    setOldPw(''); setNewPw(''); setNewPw2('');
    setTimeout(() => setPwMsg(null), 3000);
  };

  const handleDeleteAccount = () => {
    if (!window.confirm('정말로 계정을 삭제할까요? 모든 데이터가 지워지고 되돌릴 수 없어요.')) return;
    const res = deleteAccount(currentUser?.userId, deletePw);
    if (!res.ok) { setDeleteMsg(res.error); return; }
    onLogout();
  };

  const handleExport = () => {
    try {
      exportBackup();
      setBackupMsg({ ok: true, text: '백업 파일이 다운로드됐어요.' });
      setTimeout(() => setBackupMsg(null), 3000);
    } catch (e) {
      setBackupMsg({ ok: false, text: '백업 중 오류가 발생했어요.' });
    }
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = importBackup(ev.target.result);
      if (!res.ok) {
        setBackupMsg({ ok: false, text: res.error });
      } else {
        const s = res.summary;
        setChildren(getChildren()); // 화면 갱신
        setBackupMsg({ ok: true, text: `복구 완료! 아이 ${s.children}명 · 기록 ${s.records}건 · 문서 ${s.documents}건` });
        setTimeout(() => setBackupMsg(null), 5000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const cl = classes[0];
  const TABS = [
    ['general',  '⚙️ 일반'],
    ['children', '👶 아이 관리'],
    ['backup',   '💾 백업/복구'],
    ['account',  '👤 계정'],
    ['api',      '🤖 AI'],
    ['about',    'ℹ️ 정보'],
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, background: 'rgba(248,250,254,0.95)',
        backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)',
        padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100,
      }}>
        <button onClick={onBack} style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14 }}>
          <ArrowLeft size={18} /> 설정
        </button>
        {currentUser && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
            {currentUser.displayName} 선생님
          </div>
        )}
      </div>

      <div style={{ padding: '20px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
          {TABS.map(([k, v]) => (
            <button key={k} onClick={() => setActiveTab(k)} style={{
              padding: '7px 14px', borderRadius: 100, fontSize: 13, fontWeight: 700,
              background: activeTab === k ? 'var(--primary)' : 'var(--gray-100)',
              color: activeTab === k ? 'white' : 'var(--text-secondary)',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {v}
            </button>
          ))}
        </div>

        {/* ── 일반 ─────────────────────────────────────────── */}
        {activeTab === 'general' && (
          <div>
            {/* 다크모드 토글 */}
            <SettingCard title="화면 테마">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {isDark ? <Moon size={18} color="var(--primary)" /> : <Sun size={18} color="var(--cat-habit)" />}
                  <div>
                    <div style={{ fontSize:14, fontWeight:700 }}>{isDark ? '다크 모드' : '라이트 모드'}</div>
                    <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:2 }}>앱 전체 색상 테마</div>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  style={{
                    width:52, height:28, borderRadius:14,
                    background: isDark ? 'var(--primary)' : 'var(--gray-300)',
                    position:'relative', transition:'background 0.2s', flexShrink:0,
                  }}
                >
                  <div style={{
                    width:22, height:22, background:'var(--white)', borderRadius:'50%',
                    position:'absolute', top:3, left: isDark ? 27 : 3, transition:'left 0.2s',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:11,
                  }}>
                    {isDark ? '🌙' : '☀️'}
                  </div>
                </button>
              </div>
            </SettingCard>

            <SettingCard title="이름 표시 방식">
              {[['name', '실명 (하준이는)'], ['alias', '별칭 (A아동은)'], ['blank', '빈칸 (○○이는)'], ['common', '공통 (유아는)']].map(([k, v]) => (
                <button key={k} onClick={() => setSettings(s => ({ ...s, nameStyle: k }))} style={{
                  width: '100%', padding: '12px 14px', textAlign: 'left', fontSize: 14,
                  background: settings.nameStyle === k ? 'var(--primary-light)' : 'transparent',
                  color: settings.nameStyle === k ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: settings.nameStyle === k ? 700 : 400,
                  borderRadius: 8, marginBottom: 2,
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
                  fontWeight: settings.tone === k ? 700 : 400,
                  borderRadius: 8, marginBottom: 2,
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
                  <button onClick={() => setSettings(s => ({ ...s, [k]: !s[k] }))} style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: settings[k] ? 'var(--primary)' : 'var(--gray-300)',
                    position: 'relative', transition: 'background 0.2s',
                  }}>
                    <div style={{
                      width: 18, height: 18, background: 'var(--white)', borderRadius: '50%',
                      position: 'absolute', top: 3, left: settings[k] ? 23 : 3, transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
              ))}
            </SettingCard>

            <button onClick={handleSave} style={{
              width: '100%', padding: '14px', borderRadius: 14,
              background: saved ? 'var(--cat-play)' : 'var(--primary)',
              color: 'white', fontSize: 15, fontWeight: 700,
              boxShadow: '0 4px 16px rgba(79,127,255,0.3)',
            }}>
              {saved ? '✓ 저장 완료!' : '설정 저장'}
            </button>
          </div>
        )}

        {/* ── 아이 관리 ─────────────────────────────────────── */}
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
                fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4,
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
                <button onClick={() => handleRemoveChild(c.id)} style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── 백업/복구 ─────────────────────────────────────── */}
        {activeTab === 'backup' && (
          <div>
            {backupMsg && (
              <div style={{
                background: backupMsg.ok ? 'var(--cat-play-light)' : 'var(--accent-light)',
                color: backupMsg.ok ? 'var(--cat-play)' : 'var(--accent)',
                borderRadius: 12, padding: '13px 16px', fontSize: 13, fontWeight: 700,
                marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {backupMsg.ok ? <Check size={16} /> : <AlertCircle size={16} />}
                {backupMsg.text}
              </div>
            )}

            <SettingCard title="데이터 백업">
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 16 }}>
                지금까지 기록한 모든 데이터(아이 정보, 관찰기록, 문서, 설정)를 JSON 파일로 내보냅니다. 기기 변경이나 앱 초기화 전에 백업해 두세요.
              </div>
              <button onClick={handleExport} style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 14px rgba(79,127,255,0.3)',
              }}>
                <Download size={18} /> 백업 파일 다운로드
              </button>
            </SettingCard>

            <SettingCard title="데이터 복구">
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 8 }}>
                이전에 저장한 백업 파일을 선택하면 데이터를 복구합니다.
              </div>
              <div style={{
                background: 'var(--accent-light)', borderRadius: 10, padding: '10px 12px',
                fontSize: 12, color: 'var(--accent)', fontWeight: 700, marginBottom: 14, lineHeight: 1.6,
              }}>
                ⚠️ 복구를 하면 현재 데이터를 덮어씁니다. 먼저 백업을 받아두세요.
              </div>
              <input type="file" accept=".json" ref={fileRef} onChange={handleImport} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} style={{
                width: '100%', padding: '14px', borderRadius: 12,
                background: 'var(--white)', border: '2px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Upload size={18} color="var(--primary)" /> 백업 파일에서 복구
              </button>
            </SettingCard>
          </div>
        )}

        {/* ── 계정 ─────────────────────────────────────────── */}
        {activeTab === 'account' && currentUser && (
          <div>
            {/* 현재 계정 정보 */}
            {(() => {
              const planInfo = PLAN_LABELS[currentUser.plan] || PLAN_LABELS[PLANS.FREE];
              const isVipUser = currentUser.plan === PLANS.VIP;
              return (
                <div style={{
                  background: isVipUser
                    ? 'linear-gradient(135deg, #7B2FF7, #E91E9A)'
                    : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                  borderRadius: 18, padding: 20, marginBottom: 20, color: 'white',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900 }}>
                      {currentUser.displayName?.[0] || '?'}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 900, background: 'rgba(255,255,255,0.25)', padding: '5px 12px', borderRadius: 100 }}>
                      {planInfo.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{currentUser.displayName} 선생님</div>
                  <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>@{currentUser.userId}</div>
                  <div style={{ fontSize: 12, opacity: 0.75, background: 'rgba(255,255,255,0.15)', padding: '6px 12px', borderRadius: 8, display: 'inline-block' }}>
                    {planInfo.label} {isVipUser && '· 유료화 이후에도 무료'}
                  </div>
                </div>
              );
            })()}

            {/* 로그아웃 */}
            <SettingCard title="로그아웃">
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
                로그아웃해도 이 기기의 데이터는 지워지지 않아요. 다시 로그인하면 그대로 사용할 수 있어요.
              </div>
              <button onClick={onLogout} style={{
                width: '100%', padding: '13px', borderRadius: 12,
                background: 'var(--gray-800)', color: 'white', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <LogOut size={16} /> 로그아웃
              </button>
            </SettingCard>

            {/* 비밀번호 변경 */}
            <SettingCard title="비밀번호 변경">
              {pwMsg && (
                <div style={{
                  background: pwMsg.ok ? 'var(--cat-play-light)' : 'var(--accent-light)',
                  color: pwMsg.ok ? 'var(--cat-play)' : 'var(--accent)',
                  borderRadius: 10, padding: '10px 13px', fontSize: 13, fontWeight: 700, marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {pwMsg.ok ? <Check size={14} /> : <AlertCircle size={14} />} {pwMsg.text}
                </div>
              )}
              <PwInput label="현재 비밀번호" value={oldPw}  onChange={setOldPw} />
              <PwInput label="새 비밀번호"  value={newPw}  onChange={setNewPw} />
              <PwInput label="새 비밀번호 확인" value={newPw2} onChange={setNewPw2} />
              <button onClick={handleChangePassword} style={{
                width: '100%', padding: '12px', borderRadius: 12,
                background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 4,
              }}>
                <Key size={15} /> 비밀번호 변경
              </button>
            </SettingCard>

            {/* 계정 삭제 */}
            <SettingCard title="계정 삭제">
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginBottom: 12, lineHeight: 1.6 }}>
                ⚠️ 계정을 삭제하면 이 계정의 모든 데이터가 영구히 삭제됩니다.
              </div>
              {deleteMsg && (
                <div style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                  {deleteMsg}
                </div>
              )}
              <PwInput label="비밀번호 확인" value={deletePw} onChange={setDeletePw} />
              <button onClick={handleDeleteAccount} style={{
                width: '100%', padding: '12px', borderRadius: 12,
                background: 'var(--accent-light)', border: '1.5px solid var(--accent)',
                color: 'var(--accent)', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 4,
              }}>
                <UserX size={15} /> 계정 영구 삭제
              </button>
            </SettingCard>
          </div>
        )}

        {/* ── AI 탭 ─────────────────────────────────────────── */}
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

        {/* ── 정보 ─────────────────────────────────────────── */}
        {activeTab === 'about' && (
          <div>
            <div style={{ textAlign: 'center', padding: '40px 0 20px' }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--primary)', marginBottom: 8 }}>쌤워크</div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 4 }}>선생님은 기록만, 문서는 앱이.</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>v0.2.0 · 로그인 + 백업/복구</div>
            </div>
            <SettingCard title="앱 소개">
              <div style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--text-secondary)' }}>
                어린이집 교사가 하루 동안 짧게 남긴 기록을 바탕으로, 아이별 관찰일지·부모상담자료·발달평가·보육일지·주간/월간 놀이평가 문서를 자동으로 작성하는 AI 실무형 교사 업무관리 앱입니다.
              </div>
            </SettingCard>
            <SettingCard title="주요 기능">
              {[
                '✍️ 짧은 관찰 기록 입력 → AI 자동 분류',
                '📋 관찰일지·부모상담용·지원계획 자동 생성',
                '📄 오늘 기록 → 보육일지 초안 자동 작성',
                '👶 아이별 성장 요약 및 상담자료 생성',
                '✅ 기록 누락 체크 및 카테고리 균형 점검',
                '💾 데이터 백업/복구 지원',
                '👤 아이디 기반 개인 계정 관리',
              ].map((item, i) => (
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

function PwInput({ label, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 5 }}>{label}</div>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: '100%', padding: '10px 42px 10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
        <button type="button" onClick={() => setShow(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 12 }}>
          {show ? '숨김' : '보기'}
        </button>
      </div>
    </div>
  );
}

function SettingCard({ title, children }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.3px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}
