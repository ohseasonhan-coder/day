import React, { useState, useRef } from 'react';
import { getSettings, saveSettings, getClasses, saveClasses, getChildren, saveChildren, genId, exportBackup, importBackup, parseBackup, importBackupMerge,
  getFormTemplates, addFormTemplate, updateFormTemplate, deleteFormTemplate,
  getRoutines, addRoutine, deleteRoutine, CATEGORIES,
  addBackupRecord, seedSampleData, clearSampleData, clearRecordsAndDocuments, clearDocumentsOnly,
  getFeedback, addFeedback, deleteFeedback, getBackupJson, getGoogleClientId, setGoogleClientId } from '../utils/storage';
import { backupToDrive, restoreFromDrive, getDriveMeta } from '../utils/driveBackup';
import { changePassword, deleteAccount, PLANS } from '../utils/auth';
import { RECORD_QUALITY_SAMPLES } from '../utils/ai';
import { ArrowLeft, Plus, Trash2, Download, Upload, LogOut, Key, UserX, Check, AlertCircle, Moon, Sun, ChevronUp, ChevronDown, FileText } from 'lucide-react';
import { renderPdfToImage, detectFieldsFromPdf } from '../utils/pdfUtils';

// ── 문서 종류별 기본 섹션 목록 (양식 매핑용) ───────────────────────────────────────
export const DOC_SECTION_MAP = {
  daily:       ['놀이 흐름 및 활동', '유아 반응', '교사 지원', '오늘 평가', '다음 지원계획'],
  weekly:      ['주간 놀이 흐름', '유아 반응 및 배움', '교사 지원 평가', '다음 주 예상놀이 및 지원계획'],
  monthly:     ['월간 놀이 흐름', '발달적 의미', '보육과정 평가', '다음 달 운영 방향'],
  parent:      ['상담 시작 인사말', '최근 성장 흐름', '강점 및 긍정적 모습', '가정 연계 제안'],
  development: ['신체운동·건강', '의사소통', '사회관계', '예술경험', '자연탐구', '종합평가 및 지원계획'],
  safety:      ['활동 개요', '유아 반응', '평가', '추후 지원'],
  teacher:     ['교육 주제', '교육 내용', '배운 점', '현장 적용 계획'],
  review:      ['기록 현황', '주요 놀이·발달 흐름', '검토 필요 사항', '원장 검토 메모'],
};
const AUTO_FIELDS = [
  { key: '__date__',      label: '📅 날짜 (자동)' },
  { key: '__childName__', label: '👤 아이 이름 (자동)' },
  { key: '__className__', label: '🏫 반 이름 (자동)' },
  { key: '__period__',    label: '📆 기간 (자동)' },
];
const DOC_TYPE_LABELS = {
  daily: '보육일지', weekly: '주간 놀이평가', monthly: '월간 놀이평가',
  parent: '부모상담자료', development: '발달평가', safety: '안전·행사평가',
  teacher: '교사교육일지', review: '원장 검토',
};

const PLAN_LABELS = {
  [PLANS.VIP]:     { label: '영구 무료 (VIP)',  color: '#E91E9A', bg: '#FDE8F4', badge: '👑 VIP' },
  [PLANS.PREMIUM]: { label: '프리미엄',          color: 'var(--primary)', bg: 'var(--primary-light)', badge: '⭐ 프리미엄' },
  [PLANS.FREE]:    { label: '무료 플랜',          color: 'var(--text-secondary)', bg: 'var(--gray-100)', badge: '무료' },
};
export default function SettingsPage({ onBack, currentUser, onLogout, isDark, toggleTheme, activeClassId, onSetActiveClass }) {
  const [settings, setSettings]   = useState(getSettings());
  const [classes, setClasses]     = useState(getClasses());
  const [children, setChildren]   = useState(getChildren());
  const [activeTab, setActiveTab] = useState('general');
  const [newChildName, setNewChildName] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newClassYear, setNewClassYear] = useState(String(new Date().getFullYear()));
  const [newClassAge,  setNewClassAge]  = useState('3');
  const [saved, setSaved]         = useState(false);
  const [notifyPermission, setNotifyPermission] = useState(() =>
    ('Notification' in window) ? Notification.permission : 'unsupported'
  );

  const handleToggleNotify = async () => {
    if (settings.notifyUnrecorded) {
      const next = { ...settings, notifyUnrecorded: false };
      setSettings(next);
      saveSettings(next); // 알림은 토글 즉시 반영
      return;
    }
    if (!('Notification' in window)) {
      setNotifyPermission('unsupported');
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    setNotifyPermission(perm);
    if (perm === 'granted') {
      const next = { ...settings, notifyUnrecorded: true };
      setSettings(next);
      saveSettings(next);
    }
  };
  // 반복일정 상태
  const [routines, setRoutines]     = useState(() => getRoutines());
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [newRoutineDays, setNewRoutineDays]   = useState([]);
  const [newRoutineCat, setNewRoutineCat]     = useState('habit');
  const [newRoutineTemplate, setNewRoutineTemplate] = useState('');
  const DAY_LABELS = ['일','월','화','수','목','금','토'];

  // 비밀번호 변경
  const [oldPw, setOldPw]   = useState('');
  const [newPw, setNewPw]   = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwMsg, setPwMsg]   = useState(null); // { ok, text }

  // 계정 삭제
  const [deletePw, setDeletePw] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');

  const [pendingImport, setPendingImport] = useState(null); // { json, summary, fileName }
  // 구글 드라이브 백업
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveMsg, setDriveMsg] = useState(null);
  const [showDriveGuide, setShowDriveGuide] = useState(false);
  // 클라이언트 ID는 로그인 화면과 공유하는 전역 값 (이전 버전의 settings.driveClientId에서 자동 이관)
  const [googleClientId, setGoogleClientIdState] = useState(() => {
    const global = getGoogleClientId();
    if (global) return global;
    const legacy = (getSettings().driveClientId || '').trim();
    if (legacy) setGoogleClientId(legacy);
    return legacy;
  });

  const handleClientIdChange = (value) => {
    setGoogleClientIdState(value);
    setGoogleClientId(value);
  };

  const saveDriveSetting = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next); // 드라이브 설정은 즉시 저장
  };

  const handleDriveBackupNow = async () => {
    const clientId = googleClientId.trim();
    if (!clientId) { setDriveMsg({ ok: false, text: '먼저 구글 클라이언트 ID를 입력해 주세요. (아래 "최초 설정 방법" 참고)' }); return; }
    setDriveBusy(true); setDriveMsg(null);
    try {
      await backupToDrive(clientId, getBackupJson());
      addBackupRecord();
      setDriveMsg({ ok: true, text: '구글 드라이브에 백업했어요. (saemwork_backup.json)' });
    } catch (e) {
      setDriveMsg({ ok: false, text: `백업 실패: ${e.message}` });
    } finally {
      setDriveBusy(false);
    }
  };

  const handleDriveRestore = async () => {
    const clientId = googleClientId.trim();
    if (!clientId) { setDriveMsg({ ok: false, text: '먼저 구글 클라이언트 ID를 입력해 주세요.' }); return; }
    setDriveBusy(true); setDriveMsg(null);
    try {
      const { json, modifiedTime } = await restoreFromDrive(clientId);
      const res = parseBackup(json);
      if (!res.ok) { setDriveMsg({ ok: false, text: res.error }); return; }
      setPendingImport({
        json,
        summary: res.summary,
        fileName: `구글 드라이브 백업 (${new Date(modifiedTime).toLocaleString('ko-KR')})`,
      });
      setDriveMsg({ ok: true, text: '드라이브에서 백업을 불러왔어요. 아래 "데이터 가져오기"에서 병합 또는 덮어쓰기를 선택하세요.' });
    } catch (e) {
      setDriveMsg({ ok: false, text: `가져오기 실패: ${e.message}` });
    } finally {
      setDriveBusy(false);
    }
  };

  // 백업/복구
  const [backupMsg, setBackupMsg] = useState(null); // { ok, text }
  const fileRef = useRef(null);

  // 피드백
  const [feedbacks, setFeedbacks] = useState(() => getFeedback());
  const [feedbackType, setFeedbackType] = useState('문장이 어색해요');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddChild = () => {
    if (!newChildName.trim()) return;
    const cl = classes.find(c => c.id === activeClassId) || classes[0];
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
      addBackupRecord();
      setBackupMsg({ ok: true, text: '백업 파일이 다운로드됐어요.' });
      setTimeout(() => setBackupMsg(null), 3000);
    } catch (e) {
      setBackupMsg({ ok: false, text: '백업 중 오류가 발생했어요.' });
    }
  };

  // 파일 선택 → 내용 미리보기 후 병합/덮어쓰기 선택
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const res = parseBackup(ev.target.result);
      if (!res.ok) {
        setBackupMsg({ ok: false, text: res.error });
        setPendingImport(null);
        return;
      }
      setBackupMsg(null);
      setPendingImport({ json: ev.target.result, summary: res.summary, fileName: file.name });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleApplyMerge = () => {
    if (!pendingImport) return;
    const res = importBackupMerge(pendingImport.json);
    setPendingImport(null);
    if (!res.ok) { setBackupMsg({ ok: false, text: res.error }); return; }
    const s = res.summary;
    setChildren(getChildren());
    setBackupMsg({ ok: true, text: `병합 완료! 새 기록 ${s.addedRecords}건 · 새 아이 ${s.addedChildren}명 추가 (전체 기록 ${s.totalRecords}건)` });
    setTimeout(() => setBackupMsg(null), 6000);
  };

  const handleApplyOverwrite = () => {
    if (!pendingImport) return;
    if (!window.confirm('현재 이 기기의 데이터를 모두 지우고 백업 파일 내용으로 바꿉니다. 계속할까요?')) return;
    const res = importBackup(pendingImport.json);
    setPendingImport(null);
    if (!res.ok) { setBackupMsg({ ok: false, text: res.error }); return; }
    const s = res.summary;
    setChildren(getChildren());
    setBackupMsg({ ok: true, text: `복구 완료! 아이 ${s.children}명 · 기록 ${s.records}건 · 문서 ${s.documents}건` });
    setTimeout(() => setBackupMsg(null), 5000);
  };

  const handleSeedSamples = () => {
    const result = seedSampleData();
    setChildren(getChildren());
    setBackupMsg({ ok: true, text: `샘플 데이터 추가 완료: 아이 ${result.children}명 · 기록 ${result.records}건 · 문서 ${result.documents}건` });
    setTimeout(() => setBackupMsg(null), 5000);
  };

  const handleClearSamples = () => {
    if (!window.confirm('샘플 데이터만 삭제할까요? 직접 작성한 데이터는 유지됩니다.')) return;
    clearSampleData();
    setChildren(getChildren());
    setBackupMsg({ ok: true, text: '샘플 데이터가 삭제됐어요.' });
    setTimeout(() => setBackupMsg(null), 4000);
  };

  const handleClearDocuments = () => {
    const typed = window.prompt('문서 이력을 모두 삭제하려면 "삭제"를 입력하세요. 기록은 유지됩니다. 먼저 백업을 권장합니다.');
    if (typed !== '삭제') return;
    clearDocumentsOnly();
    setBackupMsg({ ok: true, text: '문서 이력이 모두 삭제됐어요.' });
    setTimeout(() => setBackupMsg(null), 4000);
  };

  const handleClearRecordsAndDocs = () => {
    const typed = window.prompt('기록과 문서 이력을 모두 삭제하려면 "삭제"를 입력하세요. 아이 명단은 유지됩니다. 먼저 백업을 권장합니다.');
    if (typed !== '삭제') return;
    clearRecordsAndDocuments();
    setBackupMsg({ ok: true, text: '기록과 문서 이력이 모두 삭제됐어요.' });
    setTimeout(() => setBackupMsg(null), 4000);
  };

  // 원 양식 상태
  const [formTemplates, setFormTemplates] = useState(() => getFormTemplates());
  const [editingForm, setEditingForm]     = useState(null); // null | 'new' | { ...template }

  const refreshForms = () => setFormTemplates(getFormTemplates());

  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    const newClass = { id: genId(), name: newClassName.trim(), year: newClassYear, age: newClassAge };
    const updated = [...classes, newClass];
    saveClasses(updated);
    setClasses(updated);
    setNewClassName(''); setNewClassYear(String(new Date().getFullYear())); setNewClassAge('3');
  };

  const cl = classes.find(c => c.id === activeClassId) || classes[0];
  const handleSubmitFeedback = () => {
    if (!feedbackText.trim()) {
      setFeedbackMsg({ ok: false, text: '피드백 내용을 입력해 주세요.' });
      return;
    }
    addFeedback({ type: feedbackType, text: feedbackText.trim(), page: activeTab });
    setFeedbacks(getFeedback());
    setFeedbackText('');
    setFeedbackMsg({ ok: true, text: '피드백이 저장됐어요. 다음 수정 기준으로 확인할 수 있습니다.' });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleDeleteFeedback = (id) => {
    deleteFeedback(id);
    setFeedbacks(getFeedback());
  };

  const TABS = [
    ['general',  '⚙️ 일반'],
    ['routines', '🔄 반복일정'],
    ['forms',    '📋 원 양식'],
    ['children', '👶 아이 관리'],
    ['backup',   '💾 백업/복구'],
    ['account',  '👤 계정'],
    ['api',      '🤖 AI'],
    ['feedback', '💬 피드백'],
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

            <SettingCard title="알림">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>미기록 아이 알림</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.6 }}>
                    앱을 열었을 때 오늘 기록하지 않은 아이가 있으면 하루 1회 알려드려요
                  </div>
                </div>
                <button onClick={handleToggleNotify} style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: settings.notifyUnrecorded ? 'var(--primary)' : 'var(--gray-300)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}>
                  <div style={{
                    width: 18, height: 18, background: 'var(--white)', borderRadius: '50%',
                    position: 'absolute', top: 3, left: settings.notifyUnrecorded ? 23 : 3, transition: 'left 0.2s',
                  }} />
                </button>
              </div>
              {notifyPermission === 'denied' && (
                <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8, lineHeight: 1.6 }}>
                  ⚠️ 브라우저에서 알림이 차단되어 있어요. 주소창 왼쪽 자물쇠 아이콘 → 알림 허용 후 다시 켜주세요.
                </div>
              )}
              {notifyPermission === 'unsupported' && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  이 환경에서는 알림을 지원하지 않아요.
                </div>
              )}
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

        {/* ── 반복일정 탭 ──────────────────────────────────────────── */}
        {activeTab === 'routines' && (
          <div>
            <SettingCard title="반복 일정 관리">
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
                요일별로 반복되는 일정을 등록하면 기록 페이지에서 빠르게 불러올 수 있어요.
              </div>
              {routines.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>등록된 반복 일정이 없어요</div>
              ) : (
                routines.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {(r.days || []).map(d => ['일','월','화','수','목','금','토'][d]).join('·')} · {CATEGORIES[r.category]?.label || r.category}
                      </div>
                    </div>
                    <button onClick={() => { deleteRoutine(r.id); setRoutines(getRoutines()); }} style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </SettingCard>
            <SettingCard title="반복 일정 추가">
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 5 }}>일정 이름</div>
                <input value={newRoutineTitle} onChange={e => setNewRoutineTitle(e.target.value)} placeholder='예: 아침 체조, 낮잠 관찰' style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 7 }}>반복 요일</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DAY_LABELS.map((d, i) => (
                    <button key={i} onClick={() => setNewRoutineDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} style={{ width: 36, height: 36, borderRadius: '50%', fontSize: 13, fontWeight: 800, background: newRoutineDays.includes(i) ? 'var(--primary)' : 'var(--gray-100)', color: newRoutineDays.includes(i) ? 'white' : 'var(--text-secondary)' }}>{d}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 5 }}>카테고리</div>
                <select value={newRoutineCat} onChange={e => setNewRoutineCat(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, fontFamily: 'inherit', background: 'var(--white)' }}>
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 5 }}>기본 문구 템플릿</div>
                <textarea value={newRoutineTemplate} onChange={e => setNewRoutineTemplate(e.target.value)} placeholder='클릭 시 기록란에 자동 삽입될 문구를 입력하세요.' rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, lineHeight: 1.7, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }} />
              </div>
              <button onClick={() => {
                if (!newRoutineTitle.trim()) return alert('일정 이름을 입력해주세요.');
                if (newRoutineDays.length === 0) return alert('반복 요일을 선택해주세요.');
                addRoutine({ title: newRoutineTitle.trim(), days: newRoutineDays, category: newRoutineCat, template: newRoutineTemplate.trim() });
                setRoutines(getRoutines());
                setNewRoutineTitle(''); setNewRoutineDays([]); setNewRoutineTemplate('');
              }} style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <Plus size={16} /> 반복 일정 추가
              </button>
            </SettingCard>
          </div>
        )}

        {/* 원 양식 탭 */}
        {activeTab === 'forms' && (
          <div>
            {editingForm ? (
              <FormEditor
                form={editingForm === 'new' ? null : editingForm}
                onSave={(form) => {
                  if (!form.id) { addFormTemplate(form); }
                  else { updateFormTemplate(form.id, form); }
                  refreshForms();
                  setEditingForm(null);
                }}
                onCancel={() => setEditingForm(null)}
              />
            ) : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:900 }}>원 양식 관리</div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>문서 생성 후 원 양식 구조로 자동 변환해요</div>
                  </div>
                  <button onClick={() => setEditingForm('new')} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:12, background:'var(--primary)', color:'white', fontSize:13, fontWeight:800 }}>
                    <Plus size={15}/> 새 양식 등록
                  </button>
                </div>

                {formTemplates.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'48px 20px', background:'var(--white)', border:'1px dashed var(--border-strong)', borderRadius:16 }}>
                    <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                    <div style={{ fontSize:14, fontWeight:800, color:'var(--text-secondary)' }}>등록된 양식이 없어요</div>
                    <div style={{ fontSize:12, color:'var(--text-tertiary)', marginTop:6, lineHeight:1.7 }}>
                      원에서 쓰는 보육일지·발달평가 등의 양식을 등록하면<br/>
                      문서 생성 후 해당 양식 구조로 자동 변환돼요.
                    </div>
                    <button onClick={() => setEditingForm('new')} style={{ marginTop:16, padding:'11px 22px', borderRadius:12, background:'var(--primary)', color:'white', fontWeight:800 }}>
                      첫 양식 등록하기
                    </button>
                  </div>
                ) : (
                  formTemplates.map(tpl => (
                    <div key={tpl.id} style={{ background:'var(--white)', border:'1px solid var(--border)', borderRadius:14, padding:'14px 16px', marginBottom:10, boxShadow:'var(--shadow-sm)' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <FileText size={16} color="var(--primary)"/>
                          <div>
                            <div style={{ fontWeight:800, fontSize:14 }}>{tpl.name}</div>
                            <div style={{ fontSize:11, color:'var(--text-tertiary)', marginTop:1 }}>
                              {DOC_TYPE_LABELS[tpl.docType] || tpl.docType} · {(tpl.fields||[]).length}개 칸
                            </div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => setEditingForm(tpl)} style={{ padding:'6px 12px', borderRadius:9, background:'var(--primary-light)', color:'var(--primary)', fontSize:12, fontWeight:800 }}>편집</button>
                          <button onClick={() => { deleteFormTemplate(tpl.id); refreshForms(); }} style={{ padding:'6px 12px', borderRadius:9, background:'var(--accent-light)', color:'var(--accent)', fontSize:12, fontWeight:800 }}>삭제</button>
                        </div>
                      </div>
                      {/* 칸 미리보기 */}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                        {(tpl.fields||[]).map((f,i) => (
                          <span key={f.id||i} style={{ fontSize:11, background:'var(--gray-100)', color:'var(--text-secondary)', padding:'3px 8px', borderRadius:6, fontWeight:600 }}>
                            {f.label}{f.charLimit ? ` (${f.charLimit}자)` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* ── 아이 관리 ─────────────────────────────────────── */}
        {activeTab === 'children' && (
          <div>
            {/* 반 목록 및 활성 반 선택 */}
            <SettingCard title="반 목록">
              {classes.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>등록된 반이 없어요.</div>
              ) : (
                classes.map(c => {
                  const isActive = (activeClassId ? c.id === activeClassId : c === classes[0]);
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{c.year}학년도 · {c.age}세반</div>
                      </div>
                      <button onClick={() => onSetActiveClass && onSetActiveClass(c.id)} style={{
                        padding: '6px 14px', borderRadius: 9, fontSize: 12, fontWeight: 800,
                        background: isActive ? 'var(--primary)' : 'var(--gray-100)',
                        color: isActive ? 'white' : 'var(--text-secondary)',
                      }}>
                        {isActive ? '✓ 활성' : '선택'}
                      </button>
                    </div>
                  );
                })
              )}
            </SettingCard>

            {/* 반 추가 */}
            <SettingCard title="반 추가">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>반 이름</div>
                  <input value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="예: 햇님반"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>연도</div>
                  <input value={newClassYear} onChange={e => setNewClassYear(e.target.value)} placeholder="2025"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 5 }}>연령 (세)</div>
                <div style={{ display: 'flex', gap: 7 }}>
                  {['1','2','3','4','5'].map(a => (
                    <button key={a} onClick={() => setNewClassAge(a)} style={{ width: 40, height: 40, borderRadius: 10, fontWeight: 800, fontSize: 14, background: newClassAge === a ? 'var(--primary)' : 'var(--gray-100)', color: newClassAge === a ? 'white' : 'var(--text-secondary)' }}>{a}세</button>
                  ))}
                </div>
              </div>
              <button onClick={handleAddClass} style={{ width: '100%', background: 'var(--primary)', color: 'white', borderRadius: 10, padding: '11px', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Plus size={15} /> 반 추가
              </button>
            </SettingCard>

            {cl && (
              <div style={{ background: 'var(--primary-light)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>현재 활성 반</div>
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

            <SettingCard title="☁️ 구글 드라이브 자동 백업">
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 12 }}>
                <b>본인 구글 계정의 드라이브</b>에 백업 파일을 자동 보관합니다. 데이터는 개발자 서버를 거치지 않고
                이 브라우저에서 내 드라이브로 바로 전송되며, 앱은 자신이 만든 백업 파일 1개에만 접근할 수 있어요.
              </div>

              {driveMsg && (
                <div style={{
                  background: driveMsg.ok ? 'var(--cat-play-light)' : 'var(--accent-light)',
                  color: driveMsg.ok ? 'var(--cat-play)' : 'var(--accent)',
                  borderRadius: 10, padding: '10px 12px', fontSize: 12, fontWeight: 700,
                  marginBottom: 12, lineHeight: 1.6,
                }}>
                  {driveMsg.text}
                </div>
              )}

              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 5 }}>구글 클라이언트 ID <span style={{ fontWeight: 600, color: 'var(--text-tertiary)' }}>(구글 로그인과 공유)</span></div>
              <input
                value={googleClientId}
                onChange={e => handleClientIdChange(e.target.value)}
                placeholder="예: 1234567890-xxxx.apps.googleusercontent.com"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
              />

              <button onClick={() => setShowDriveGuide(v => !v)} style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: 100, padding: '7px 14px', marginBottom: 12 }}>
                {showDriveGuide ? '▲ 설정 방법 닫기' : '▼ 최초 설정 방법 보기 (1회만, 약 5분)'}
              </button>

              {showDriveGuide && (
                <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.9, marginBottom: 14 }}>
                  {[
                    ['1', 'console.cloud.google.com 접속 → 상단에서 "새 프로젝트" 만들기 (이름 자유, 예: 쌤워크백업)'],
                    ['2', '왼쪽 메뉴 "API 및 서비스 → 라이브러리"에서 Google Drive API 검색 후 "사용" 클릭'],
                    ['3', '"OAuth 동의 화면" → 외부 선택 → 앱 이름·이메일 입력 → 저장. "테스트 사용자"에 본인 Gmail 주소 추가'],
                    ['4', '"사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID" → 유형: 웹 애플리케이션'],
                    ['5', '"승인된 자바스크립트 원본"에 이 앱 주소 2개 추가: 배포 주소(https://…vercel.app)와 http://localhost:3000'],
                    ['6', '만들어진 클라이언트 ID(…apps.googleusercontent.com)를 복사해 위 칸에 붙여넣기 → "지금 드라이브에 백업" 클릭'],
                  ].map(([n, t]) => (
                    <div key={n} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 900, color: 'var(--primary)', flexShrink: 0 }}>{n}.</span>
                      <span>{t}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                    💡 클라이언트 ID는 비밀번호가 아니라 "이 앱 주소에서만 내 구글 로그인을 쓸 수 있다"는 공개 식별자예요.
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <button onClick={handleDriveBackupNow} disabled={driveBusy} style={{
                  padding: '13px', borderRadius: 12, background: 'var(--primary)', color: 'white',
                  fontSize: 13, fontWeight: 900, opacity: driveBusy ? 0.6 : 1,
                }}>
                  {driveBusy ? '처리 중…' : '지금 드라이브에 백업'}
                </button>
                <button onClick={handleDriveRestore} disabled={driveBusy} style={{
                  padding: '13px', borderRadius: 12, background: 'var(--white)', border: '2px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 13, fontWeight: 900, opacity: driveBusy ? 0.6 : 1,
                }}>
                  드라이브에서 가져오기
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>자동 백업 (하루 1회)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>앱을 열 때 자동으로 드라이브에 백업해요</div>
                </div>
                <button onClick={() => saveDriveSetting({ driveAutoBackup: !settings.driveAutoBackup })} style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: settings.driveAutoBackup ? 'var(--primary)' : 'var(--gray-300)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}>
                  <div style={{
                    width: 18, height: 18, background: 'var(--white)', borderRadius: '50%',
                    position: 'absolute', top: 3, left: settings.driveAutoBackup ? 23 : 3, transition: 'left 0.2s',
                  }} />
                </button>
              </div>
              {getDriveMeta().lastBackupAt && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  마지막 드라이브 백업: {new Date(getDriveMeta().lastBackupAt).toLocaleString('ko-KR')}
                </div>
              )}
            </SettingCard>

            <SettingCard title="데이터 가져오기 (복구·기기 이동)">
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 14 }}>
                다른 기기에서 받은 백업 파일을 선택하면 내용을 먼저 보여드리고, <b>병합</b>(기존 데이터 유지 + 새 항목 추가)할지 <b>덮어쓰기</b>할지 선택할 수 있어요.
              </div>
              <input type="file" accept=".json" ref={fileRef} onChange={handleImport} style={{ display: 'none' }} />
              {!pendingImport ? (
                <button onClick={() => fileRef.current?.click()} style={{
                  width: '100%', padding: '14px', borderRadius: 12,
                  background: 'var(--white)', border: '2px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 14, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <Upload size={18} color="var(--primary)" /> 백업 파일 선택
                </button>
              ) : (
                <div style={{ background: 'var(--gray-50)', border: '1.5px solid var(--primary)', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 6 }}>📦 {pendingImport.fileName}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
                    아이 {pendingImport.summary.children}명 · 기록 {pendingImport.summary.records}건 · 문서 {pendingImport.summary.documents}건
                    {pendingImport.summary.exportedAt && (
                      <><br />내보낸 시각: {new Date(pendingImport.summary.exportedAt).toLocaleString('ko-KR')}</>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <button onClick={handleApplyMerge} style={{ padding: '12px', borderRadius: 10, background: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 900 }}>
                      병합하기 (권장)
                    </button>
                    <button onClick={handleApplyOverwrite} style={{ padding: '12px', borderRadius: 10, background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 900 }}>
                      전체 덮어쓰기
                    </button>
                  </div>
                  <button onClick={() => setPendingImport(null)} style={{ width: '100%', padding: '10px', borderRadius: 10, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 800 }}>
                    취소
                  </button>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 10, lineHeight: 1.6 }}>
                    병합: 두 기기를 같이 쓸 때 안전해요. 같은 기록은 한 번만 남아요.<br />
                    덮어쓰기: 이 기기 데이터를 지우고 파일 내용으로 완전히 교체해요.
                  </div>
                </div>
              )}
            </SettingCard>

            <SettingCard title="샘플 데이터">
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 14 }}>
                기능을 바로 확인할 수 있도록 샘플 아이 3명, 샘플 기록, 샘플 문서를 넣을 수 있습니다. 샘플 데이터는 언제든 따로 삭제할 수 있어요.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button onClick={handleSeedSamples} style={{ padding: '13px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 900 }}>
                  샘플 넣기
                </button>
                <button onClick={handleClearSamples} style={{ padding: '13px', borderRadius: 12, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 900 }}>
                  샘플 삭제
                </button>
              </div>
            </SettingCard>

            <SettingCard title="데이터 삭제 / 초기화">
              <div style={{ background: 'var(--accent-light)', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: 'var(--accent)', fontWeight: 800, marginBottom: 14, lineHeight: 1.6 }}>
                삭제 전 백업을 먼저 받아두세요. 삭제한 데이터는 앱 안에서 되돌릴 수 없습니다.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                <button onClick={handleClearDocuments} style={{ padding: '13px', borderRadius: 12, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 900 }}>
                  문서 이력만 삭제
                </button>
                <button onClick={handleClearRecordsAndDocs} style={{ padding: '13px', borderRadius: 12, background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 900 }}>
                  기록 + 문서 이력 삭제
                </button>
              </div>
            </SettingCard>

            <SettingCard title="개인정보 및 사용 주의">
              {[
                '아동 이름, 건강, 상담 내용은 민감할 수 있으므로 백업 파일을 안전한 위치에 보관하세요.',
                '이 앱의 문장은 진단이 아니라 관찰 사실과 교사 지원 방향을 정리하는 초안입니다.',
                '부모 상담, 평가제, 공식 문서 제출 전에는 원 상황에 맞게 최종 검토하세요.',
                '현재 데이터는 이 기기 브라우저 저장소에 보관됩니다. 기기 변경 전 백업이 필요합니다.',
              ].map(item => (
                <div key={item} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  {item}
                </div>
              ))}
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

            {/* 비밀번호 변경 — 구글 계정은 비밀번호가 없음 */}
            {currentUser.provider === 'google' ? (
              <SettingCard title="비밀번호">
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  이 계정은 <b>구글 로그인</b>으로 만들어져 별도의 비밀번호가 없어요.
                  비밀번호 관리는 구글 계정 설정(myaccount.google.com)에서 하시면 됩니다.
                </div>
              </SettingCard>
            ) : (
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
            )}

            {/* 계정 삭제 — 구글 계정은 비밀번호 확인 대신 문구 입력 확인 */}
            <SettingCard title="계정 삭제">
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700, marginBottom: 12, lineHeight: 1.6 }}>
                ⚠️ 계정을 삭제하면 이 계정의 모든 데이터가 영구히 삭제됩니다.
              </div>
              {deleteMsg && (
                <div style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                  {deleteMsg}
                </div>
              )}
              {currentUser.provider !== 'google' && (
                <PwInput label="비밀번호 확인" value={deletePw} onChange={setDeletePw} />
              )}
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

            <SettingCard title="실사용 샘플 테스트 세트">
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
                아래 샘플은 규칙 기반 자동 정리가 실제 교사 기록에서 흔히 만나는 상황을 안정적으로 처리하는지 확인하기 위한 기준 문장입니다.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, maxHeight: 360, overflowY: 'auto', paddingRight: 2 }}>
                {RECORD_QUALITY_SAMPLES.map((sample, index) => (
                  <div key={`${sample.category}-${index}`} style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, padding: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--primary)' }}>{sample.category}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>#{index + 1}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{sample.text}</div>
                  </div>
                ))}
              </div>
            </SettingCard>

            <SettingCard title="배포 후 점검표">
              {[
                'Vercel URL에서 새로고침 후 흰 화면 없이 첫 화면이 뜨는지 확인',
                '모바일 화면에서 오늘, 기록하기, 문서함, 점검 탭이 겹치지 않는지 확인',
                '샘플 기록 1개 저장 후 알림장, 상담자료, 성장요약, 문서 후보가 갱신되는지 확인',
                '문서함에서 보육일지와 부모상담자료를 생성하고 문서 이력에 저장되는지 확인',
                '문서 이력 검색, 유형 필터, 아이 필터, 즐겨찾기 필터가 동작하는지 확인',
                '백업 파일 다운로드 후 다른 브라우저에서 복구가 되는지 확인',
                '기록 수정/삭제 후 자동화 이력에 반영 문구가 남는지 확인',
              ].map((item, index) => (
                <div key={item} style={{ display: 'flex', gap: 9, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                    {index + 1}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{item}</span>
                </div>
              ))}
            </SettingCard>
          </div>
        )}

        {/* ── 피드백 ─────────────────────────────────────────── */}
        {activeTab === 'feedback' && (
          <div>
            {feedbackMsg && (
              <div style={{
                background: feedbackMsg.ok ? 'var(--cat-play-light)' : 'var(--accent-light)',
                color: feedbackMsg.ok ? 'var(--cat-play)' : 'var(--accent)',
                borderRadius: 12, padding: '13px 16px', fontSize: 13, fontWeight: 700,
                marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {feedbackMsg.ok ? <Check size={16} /> : <AlertCircle size={16} />}
                {feedbackMsg.text}
              </div>
            )}

            <SettingCard title="피드백 남기기">
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 14 }}>
                자동 정리 문장이 어색하거나, 분류가 맞지 않거나, 추가 문서가 필요할 때 바로 남겨두는 공간입니다. 현재는 이 기기에 저장됩니다.
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 5 }}>유형</div>
                <select
                  value={feedbackType}
                  onChange={e => setFeedbackType(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, background: 'var(--white)', boxSizing: 'border-box' }}
                >
                  {['문장이 어색해요', '분류가 틀렸어요', '필요한 문서가 있어요', '오류가 있어요', '기타'].map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 5 }}>내용</div>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  rows={5}
                  placeholder="예: 부모상담용 문장이 조금 딱딱해요. 더 부드럽게 바뀌면 좋겠어요."
                  style={{ width: '100%', padding: 12, borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, lineHeight: 1.7, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={handleSubmitFeedback}
                style={{ width: '100%', padding: '13px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 900 }}
              >
                피드백 저장
              </button>
            </SettingCard>

            <SettingCard title={`저장된 피드백 (${feedbacks.length}건)`}>
              {feedbacks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '22px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
                  아직 저장된 피드백이 없어요.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 9 }}>
                  {feedbacks.map(item => (
                    <div key={item.id} style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--primary)' }}>{item.type}</span>
                        <button onClick={() => handleDeleteFeedback(item.id)} style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 900 }}>
                          삭제
                        </button>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{item.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SettingCard>
          </div>
        )}

        {/* ── 정보 ─────────────────────────────────────────── */}
        {activeTab === 'about' && (
          <div>
            <div style={{ textAlign: 'center', padding: '40px 0 20px' }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--primary)', marginBottom: 8 }}>쌤워크</div>
              <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 4 }}>선생님은 기록만, 문서는 앱이.</div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>v0.4.0 · 문서 편집 + 다운로드 + 피드백</div>
            </div>
            <SettingCard title="앱 소개">
              <div style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--text-secondary)' }}>
                어린이집 교사가 하루 동안 짧게 남긴 기록을 바탕으로, 아이별 관찰일지·부모상담자료·발달평가·보육일지·주간/월간 놀이평가 문서를 자동으로 작성하는 AI 실무형 교사 업무관리 앱입니다.
              </div>
            </SettingCard>
            <SettingCard title="최근 업데이트">
              {[
                '문서함에서 생성 문서와 문서 이력을 TXT 파일로 다운로드',
                '문서 이력 수정·삭제 기능 추가',
                '중요 데이터 삭제 시 “삭제” 직접 입력 안전장치 적용',
                '샘플 데이터 추가·삭제와 기록/문서 초기화 기능 정리',
                '문장·분류·오류를 남길 수 있는 피드백 화면 추가',
              ].map((item, i) => (
                <div key={item} style={{ display: 'flex', gap: 9, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
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
            <SettingCard title="데이터 저장 방식">
              <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--text-secondary)', marginBottom: 12 }}>
                현재 데이터는 사용하는 브라우저의 로컬 저장소에 보관됩니다. 서버 API 키나 외부 AI 연결 없이 작동하지만, 기기를 바꾸거나 브라우저 데이터를 삭제하기 전에는 백업 파일을 내려받아야 합니다.
              </div>
              <button
                onClick={() => setActiveTab('backup')}
                style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'var(--gray-100)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 900 }}
              >
                백업/복구로 이동
              </button>
            </SettingCard>
            <SettingCard title="문의 / 피드백">
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 12 }}>
                자동 정리 결과가 어색한 사례를 남겨두면 다음 규칙 보강과 화면 수정 기준으로 활용할 수 있습니다.
              </div>
              <button
                onClick={() => setActiveTab('feedback')}
                style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 900 }}
              >
                피드백 남기기
              </button>
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

// ── 이미지 압축 유틸 ──────────────────────────────────────────────────────────
async function compressImage(file, maxWidth = 1000) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ── 칸 이름 → 앱 섹션 자동 감지 ──────────────────────────────────────────────
function suggestMapping(label, docType) {
  if (!label) return '';
  // 자동 필드 키워드
  if (/날짜|일자|작성일|오늘/.test(label)) return '__date__';
  if (/아이|원아|유아명|이름|성명/.test(label)) return '__childName__';
  if (/반명|학급|반$/.test(label)) return '__className__';
  if (/기간|period/.test(label)) return '__period__';
  // 앱 섹션 매칭 (글자 겹침 점수)
  const sections = DOC_SECTION_MAP[docType] || [];
  const words = label.split(/[\s·\-/]+/).filter(w => w.length >= 2);
  let best = ''; let bestScore = 0;
  for (const sec of sections) {
    const score = words.reduce((s, w) => s + (sec.includes(w) ? w.length : 0), 0);
    if (score > bestScore) { bestScore = score; best = sec; }
  }
  return best;
}

// ── 원 양식 편집기 ─────────────────────────────────────────────────────────────
function FormEditor({ form, onSave, onCancel }) {
  const isNew = !form;
  const [name, setName]         = useState(form?.name || '');
  const [docType, setDocType]   = useState(form?.docType || 'daily');
  const [fields, setFields]     = useState(form?.fields || []);
  const [imageData, setImageData] = useState(form?.imageData || null);
  const [setupTab, setSetupTab] = useState(form?.imageData ? 'image' : 'image'); // 기본 이미지 모드
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(''); // 업로드 진행 메시지
  const [autoDetected, setAutoDetected] = useState([]); // PDF 자동 감지 결과
  const imgInputRef = useRef(null);

  // ── PDF 또는 이미지 업로드 처리 ───────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setAutoDetected([]);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    try {
      if (isPdf) {
        // ── PDF 처리 ──────────────────────────────────────────
        setUploadStatus('📄 PDF 렌더링 중...');
        const { imageData: rendered } = await renderPdfToImage(file, 2);
        setImageData(rendered);

        setUploadStatus('🔍 입력 칸 자동 감지 중...');
        const detected = await detectFieldsFromPdf(file);
        setUploadStatus('');

        if (detected.length > 0) {
          // 자동 감지된 칸을 필드로 변환 (suggestMapping 적용)
          const autoFields = detected.map((d, i) => ({
            id: Date.now() + '-' + i,
            label:    d.label,
            mappedTo: suggestMapping(d.label, docType),
            charLimit: null,
            fieldWidth: 28,
            x: d.xPct,
            y: d.yPct,
          }));
          setAutoDetected(autoFields);
          setFields(autoFields);
        } else {
          setFields([]);
        }
      } else {
        // ── 이미지 처리 ───────────────────────────────────────
        setUploadStatus('🖼️ 이미지 처리 중...');
        const compressed = await compressImage(file, 1000);
        setImageData(compressed);
        setFields([]);
        setUploadStatus('');
      }
    } catch (err) {
      setUploadStatus('');
      alert(`파일 처리 중 오류가 발생했어요.\n${err.message}`);
    }

    setUploading(false);
    e.target.value = '';
  };

  const handleSave = () => {
    if (!name.trim()) { alert('양식 이름을 입력해주세요.'); return; }
    const cleaned = fields.filter(f => f.label?.trim());
    if (cleaned.length === 0) { alert('칸을 1개 이상 추가해주세요.'); return; }
    onSave({
      ...(form || {}),
      name: name.trim(),
      docType,
      imageData: setupTab === 'image' ? imageData : null,
      fields: cleaned.map(f => ({
        id: f.id || (Date.now() + Math.random() + ''),
        label: f.label.trim(),
        mappedTo: f.mappedTo || '',
        charLimit: f.charLimit ? Number(f.charLimit) : null,
        x: f.x ?? null,
        y: f.y ?? null,
      })),
    });
  };

  const iStyle = {
    padding: '9px 11px', borderRadius: 9, border: '1.5px solid var(--border)',
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
    background: 'var(--white)', color: 'var(--text-primary)',
    width: '100%', boxSizing: 'border-box',
  };

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button onClick={onCancel} style={{ padding:'7px 12px', borderRadius:10, background:'var(--gray-100)', color:'var(--text-secondary)', fontSize:13, fontWeight:700 }}>← 목록</button>
        <div style={{ fontSize:16, fontWeight:900 }}>{isNew ? '새 양식 등록' : '양식 편집'}</div>
      </div>

      {/* 기본 정보 */}
      <SettingCard title="기본 정보">
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'var(--text-secondary)', marginBottom:5 }}>양식 이름</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="예: ○○어린이집 보육일지" style={iStyle} />
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:'var(--text-secondary)', marginBottom:5 }}>적용 문서 종류</div>
          <select value={docType} onChange={e => setDocType(e.target.value)} style={iStyle}>
            {Object.entries(DOC_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </SettingCard>

      {/* 등록 방식 탭 */}
      <div style={{ display:'flex', gap:4, background:'var(--gray-100)', borderRadius:12, padding:4, marginBottom:16 }}>
        {[['image','📄 PDF / 이미지'],['manual','✏️ 직접 입력']].map(([id,label]) => (
          <button key={id} onClick={() => setSetupTab(id)} style={{
            flex:1, padding:'9px', borderRadius:9, fontSize:13,
            fontWeight: setupTab===id ? 900 : 600,
            background: setupTab===id ? 'var(--white)' : 'transparent',
            color: setupTab===id ? 'var(--primary)' : 'var(--text-secondary)',
          }}>{label}</button>
        ))}
      </div>

      {/* ── 이미지/PDF 업로드 모드 ── */}
      {setupTab === 'image' && (
        <div>
          {!imageData ? (
            /* 업로드 전 */
            <div
              onClick={() => !uploading && imgInputRef.current?.click()}
              style={{ border:'2.5px dashed var(--primary)', borderRadius:18, padding:'40px 20px', textAlign:'center', cursor:'pointer', background:'var(--primary-light)', marginBottom:16 }}
            >
              {uploading ? (
                <div>
                  <div style={{ fontSize:28, marginBottom:10 }}>⏳</div>
                  <div style={{ fontSize:14, color:'var(--primary)', fontWeight:800 }}>{uploadStatus || '처리 중...'}</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:6 }}>잠시만 기다려 주세요</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize:44, marginBottom:10 }}>📄</div>
                  <div style={{ fontSize:15, fontWeight:900, color:'var(--primary)', marginBottom:8 }}>PDF 또는 이미지 업로드</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.9 }}>
                    HWP → PDF로 내보낸 양식을 올리면<br/>
                    <b style={{color:'var(--primary)'}}>입력 칸을 자동으로 감지</b>해요 ✨<br/>
                    <span style={{color:'var(--text-tertiary)'}}>PDF · JPG · PNG 지원</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* 업로드 후 — 시각 매핑 */
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--text-secondary)' }}>📋 내용이 들어갈 빈칸을 탭해 확인·추가하세요</div>
                <button onClick={() => { setImageData(null); setFields([]); setAutoDetected([]); }} style={{ fontSize:12, color:'var(--accent)', fontWeight:700 }}>파일 교체</button>
              </div>

              {/* PDF 자동 감지 배너 */}
              {autoDetected.length > 0 && (
                <div style={{ background:'#E8F5E9', border:'1px solid #4CAF50', borderRadius:10, padding:'10px 14px', marginBottom:10, lineHeight:1.7 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:'#2E7D32' }}>
                    ✅ PDF에서 {autoDetected.length}개 칸 자동 감지
                  </div>
                  <div style={{ fontSize:11, color:'#388E3C', marginTop:2 }}>
                    마커를 탭해 이름·연결 섹션을 확인하고, 빈칸을 탭해 추가할 수 있어요.
                  </div>
                </div>
              )}

              <div style={{ fontSize:12, color:'var(--primary)', background:'var(--primary-light)', borderRadius:9, padding:'8px 12px', marginBottom:10, lineHeight:1.7 }}>
                💡 <b>빈칸</b>을 탭해 칸 추가 · 기존 마커를 탭해 편집
              </div>
              <ImageFormMapper
                imageData={imageData}
                fields={fields}
                onFieldsChange={setFields}
                docType={docType}
              />
            </div>
          )}
          <input ref={imgInputRef} type="file" accept="image/*,.pdf,application/pdf" onChange={handleFileUpload} style={{ display:'none' }} />

          {/* 등록된 칸 요약 */}
          {fields.length > 0 && (
            <SettingCard title={`등록된 칸 (${fields.length}개)`}>
              {fields.map((f, i) => {
                const autoLabel = AUTO_FIELDS.find(a => a.key === f.mappedTo)?.label;
                return (
                  <div key={f.id||i} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ width:20, height:20, borderRadius:'50%', background:'var(--primary)', color:'white', fontSize:10, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700 }}>{f.label}</div>
                      <div style={{ fontSize:11, color:'var(--text-tertiary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {autoLabel || f.mappedTo || '미연결'}
                        {f.charLimit ? ` · ${f.charLimit}자` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </SettingCard>
          )}
        </div>
      )}

      {/* ── 직접 입력 모드 ── */}
      {setupTab === 'manual' && (
        <ManualFieldEditor
          fields={fields}
          onFieldsChange={setFields}
          docType={docType}
        />
      )}

      <button onClick={handleSave} style={{ width:'100%', padding:'14px', borderRadius:14, background:'var(--primary)', color:'white', fontSize:15, fontWeight:900, boxShadow:'0 4px 16px rgba(79,127,255,0.3)', marginTop:8 }}>
        {isNew ? '양식 등록하기' : '변경사항 저장'}
      </button>
    </div>
  );
}

// ── 시각적 이미지 매퍼 ───────────────────────────────────────────────────────
function ImageFormMapper({ imageData, fields, onFieldsChange, docType }) {
  const containerRef = useRef(null);
  const [popup, setPopup] = useState(null); // null | {type:'new',x,y} | {type:'edit',idx}

  const getRelPos = (clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: parseFloat(((clientX - rect.left) / rect.width * 100).toFixed(1)),
      y: parseFloat(((clientY - rect.top)  / rect.height * 100).toFixed(1)),
    };
  };

  const handleClick = (e) => {
    if (popup) return;
    const pos = getRelPos(e.clientX, e.clientY);
    setPopup({ type:'new', ...pos });
  };

  const handleTouch = (e) => {
    e.preventDefault();
    if (popup) return;
    const t = e.changedTouches[0];
    const pos = getRelPos(t.clientX, t.clientY);
    setPopup({ type:'new', ...pos });
  };

  const handleAdd = (data) => {
    onFieldsChange([...fields, { id: Date.now()+'', ...data, x: popup.x, y: popup.y }]);
    setPopup(null);
  };

  const handleUpdate = (idx, data) => {
    onFieldsChange(fields.map((f,i) => i===idx ? {...f,...data} : f));
    setPopup(null);
  };

  const handleDelete = (idx) => {
    onFieldsChange(fields.filter((_,i) => i!==idx));
    setPopup(null);
  };

  return (
    <div ref={containerRef} style={{ position:'relative', width:'100%', touchAction:'none', userSelect:'none' }}>
      <img
        src={imageData} alt="양식"
        style={{ width:'100%', display:'block', borderRadius:12, border:'2px solid var(--border)', cursor:'crosshair' }}
        onClick={handleClick}
        onTouchEnd={handleTouch}
        draggable={false}
      />

      {/* 마커들 */}
      {fields.map((f, idx) => (
        <button
          key={f.id||idx}
          onClick={e => { e.stopPropagation(); setPopup({ type:'edit', idx }); }}
          style={{
            position:'absolute', left:`${f.x}%`, top:`${f.y}%`,
            transform:'translate(-50%,-50%)',
            width:26, height:26, borderRadius:'50%',
            background:'var(--primary)', color:'white',
            fontSize:11, fontWeight:900, zIndex:10,
            border:'2.5px solid white',
            boxShadow:'0 2px 10px rgba(79,127,255,0.55)',
          }}
        >{idx+1}</button>
      ))}

      {/* 신규 위치 미리보기 */}
      {popup?.type === 'new' && (
        <div style={{
          position:'absolute', left:`${popup.x}%`, top:`${popup.y}%`,
          transform:'translate(-50%,-50%)',
          width:26, height:26, borderRadius:'50%',
          background:'var(--accent)', color:'white',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:16, fontWeight:900, zIndex:10,
          border:'2.5px solid white', boxShadow:'0 2px 10px rgba(255,107,107,0.5)',
          pointerEvents:'none',
        }}>+</div>
      )}

      {/* 팝업 */}
      {popup && (
        <div
          onClick={() => setPopup(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background:'var(--white)', borderRadius:22, padding:24, width:'100%', maxWidth:380, boxShadow:'0 24px 64px rgba(0,0,0,0.3)' }}>
            <FieldPopup
              field={popup.type==='edit' ? fields[popup.idx] : null}
              docType={docType}
              onSave={popup.type==='edit' ? (d) => handleUpdate(popup.idx, d) : handleAdd}
              onDelete={popup.type==='edit' ? () => handleDelete(popup.idx) : null}
              onCancel={() => setPopup(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── 칸 팝업 (추가 / 편집) ─────────────────────────────────────────────────────
function FieldPopup({ field, docType, onSave, onDelete, onCancel }) {
  const [label, setLabel]       = useState(field?.label || '');
  const [mappedTo, setMappedTo] = useState(field?.mappedTo || '');
  const [charLimit, setCharLimit] = useState(field?.charLimit || '');
  const [fieldWidth, setFieldWidth] = useState(field?.fieldWidth ?? 30); // 칸 너비 (%)
  const [userChoseMapped, setUserChoseMapped] = useState(!!field?.mappedTo);

  const suggested = suggestMapping(label, docType);
  const effectiveMapped = userChoseMapped ? mappedTo : (suggested || mappedTo);

  const sectionOptions = [
    ...AUTO_FIELDS,
    ...(DOC_SECTION_MAP[docType] || []).map(s => ({ key: s, label: s })),
  ];

  const handleLabelChange = (val) => {
    setLabel(val);
    if (!userChoseMapped) {
      const s = suggestMapping(val, docType);
      if (s) setMappedTo(s);
    }
  };

  const handleSave = () => {
    if (!label.trim()) { alert('칸 이름을 입력해주세요.'); return; }
    onSave({ label: label.trim(), mappedTo: effectiveMapped, charLimit: charLimit ? Number(charLimit) : null, fieldWidth: fieldWidth ? Number(fieldWidth) : 30 });
  };

  const iStyle = {
    padding:'9px 11px', borderRadius:9, border:'1.5px solid var(--border)',
    fontSize:13, fontFamily:'inherit', outline:'none',
    background:'var(--white)', color:'var(--text-primary)',
    width:'100%', boxSizing:'border-box',
  };
  const suggestedLabel = sectionOptions.find(s => s.key === suggested)?.label;

  return (
    <div>
      <div style={{ fontWeight:900, fontSize:16, marginBottom:16 }}>{field ? '칸 편집' : '빈칸 추가'}</div>

      {/* 칸 이름 */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:800, color:'var(--text-secondary)', marginBottom:5 }}>원 양식 칸 이름</div>
        <input value={label} onChange={e => handleLabelChange(e.target.value)}
          placeholder="예: 놀이 흐름, 날짜, 아이 이름..." autoFocus style={iStyle}/>
      </div>

      {/* 자동 감지 배지 */}
      {suggested && !userChoseMapped && (
        <div style={{ background:'var(--primary-light)', border:'1px solid var(--primary)', borderRadius:9, padding:'8px 12px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12, color:'var(--primary)', fontWeight:700 }}>
            ✨ 자동 감지: <b>{suggestedLabel || suggested}</b>
          </span>
          <span style={{ fontSize:10, color:'var(--primary)', background:'white', padding:'2px 7px', borderRadius:5, fontWeight:800 }}>자동</span>
        </div>
      )}

      {/* 앱 섹션 연결 */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:800, color:'var(--text-secondary)', marginBottom:5 }}>앱 섹션 연결</div>
        <select value={effectiveMapped}
          onChange={e => { setMappedTo(e.target.value); setUserChoseMapped(true); }}
          style={iStyle}>
          <option value="">— 선택 안 함 —</option>
          {sectionOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* 칸 너비 + 글자수 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:'var(--text-secondary)', marginBottom:5 }}>칸 너비 (%)</div>
          <input type="number" value={fieldWidth} onChange={e => setFieldWidth(e.target.value)}
            placeholder="30" min={5} max={90} style={iStyle}/>
          <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:3 }}>형식 너비에 맞게 조정</div>
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:800, color:'var(--text-secondary)', marginBottom:5 }}>글자수 제한</div>
          <input type="number" value={charLimit} onChange={e => setCharLimit(e.target.value)}
            placeholder="없음" min={0} style={iStyle}/>
          <div style={{ fontSize:10, color:'var(--text-tertiary)', marginTop:3 }}>초과 시 자동 잘림</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8 }}>
        {onDelete && (
          <button onClick={onDelete} style={{ padding:'11px 14px', borderRadius:11, background:'var(--accent-light)', color:'var(--accent)', fontSize:13, fontWeight:800 }}>삭제</button>
        )}
        <button onClick={onCancel} style={{ flex:1, padding:'11px', borderRadius:11, background:'var(--gray-100)', color:'var(--text-secondary)', fontSize:13, fontWeight:700 }}>취소</button>
        <button onClick={handleSave} style={{ flex:2, padding:'11px', borderRadius:11, background:'var(--primary)', color:'white', fontSize:13, fontWeight:900 }}>
          {field ? '수정 완료' : '칸 추가'}
        </button>
      </div>
    </div>
  );
}

// ── 직접 입력 모드 필드 에디터 ───────────────────────────────────────────────
function ManualFieldEditor({ fields, onFieldsChange, docType }) {
  const sectionOptions = [
    ...AUTO_FIELDS,
    ...(DOC_SECTION_MAP[docType] || []).map(s => ({ key: s, label: s })),
  ];

  const addField = () => onFieldsChange([...fields, { id: Date.now()+'', label:'', mappedTo:'', charLimit:'' }]);

  const updateField = (idx, key, val) =>
    onFieldsChange(fields.map((item,i) => i===idx ? {...item,[key]:val} : item));

  const removeField = (idx) => onFieldsChange(fields.filter((_,i) => i!==idx));

  const moveField = (idx, dir) => {
    const next = [...fields]; const swap = idx+dir;
    if (swap<0||swap>=next.length) return;
    [next[idx],next[swap]]=[next[swap],next[idx]];
    onFieldsChange(next);
  };

  const iStyle = {
    padding:'8px 10px', borderRadius:8, border:'1.5px solid var(--border)',
    fontSize:12, fontFamily:'inherit', outline:'none',
    background:'var(--white)', color:'var(--text-primary)',
    width:'100%', boxSizing:'border-box',
  };

  return (
    <SettingCard title="원 양식 칸 구성">
      <div style={{ fontSize:12, color:'var(--text-tertiary)', marginBottom:12, lineHeight:1.7 }}>
        원 양식의 순서대로 칸을 등록하고 앱 섹션을 연결하세요.
      </div>
      {fields.map((f, idx) => (
        <div key={f.id||idx} style={{ background:'var(--gray-50)', border:'1px solid var(--border)', borderRadius:12, padding:12, marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:11, fontWeight:900, color:'var(--text-tertiary)', minWidth:18 }}>{idx+1}</span>
              <button onClick={() => moveField(idx,-1)} disabled={idx===0} style={{ padding:4, borderRadius:6, background:'var(--white)', border:'1px solid var(--border)', opacity:idx===0?0.3:1 }}><ChevronUp size={12}/></button>
              <button onClick={() => moveField(idx,1)} disabled={idx===fields.length-1} style={{ padding:4, borderRadius:6, background:'var(--white)', border:'1px solid var(--border)', opacity:idx===fields.length-1?0.3:1 }}><ChevronDown size={12}/></button>
            </div>
            <button onClick={() => removeField(idx)} style={{ padding:'3px 8px', borderRadius:7, background:'var(--accent-light)', color:'var(--accent)', fontSize:11, fontWeight:800 }}>삭제</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr 80px', gap:7 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', marginBottom:4 }}>칸 이름</div>
              <input value={f.label} onChange={e => { updateField(idx,'label',e.target.value); if (!f.mappedTo) { const s=suggestMapping(e.target.value,docType); if(s) updateField(idx,'mappedTo',s); } }} placeholder="예: 놀이 흐름" style={iStyle}/>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', marginBottom:4 }}>앱 섹션</div>
              <select value={f.mappedTo} onChange={e => updateField(idx,'mappedTo',e.target.value)} style={iStyle}>
                <option value="">— 선택 —</option>
                {sectionOptions.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-tertiary)', marginBottom:4 }}>글자 제한</div>
              <input type="number" value={f.charLimit} onChange={e => updateField(idx,'charLimit',e.target.value)} placeholder="없음" min={0} style={iStyle}/>
            </div>
          </div>
        </div>
      ))}
      <button onClick={addField} style={{ width:'100%', padding:'11px', borderRadius:11, background:'var(--primary-light)', color:'var(--primary)', fontSize:13, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:4, border:'1.5px dashed var(--primary)' }}>
        <Plus size={15}/> 칸 추가
      </button>
    </SettingCard>
  );
}
