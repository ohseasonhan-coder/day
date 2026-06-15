// ── 투약·사고 보고서 자동 문장화 ──────────────────────────────────────────────
// 입력한 항목을 결재·제출용 보고서 문체로 정리한다. 입력 사실만 사용.

function timingLabel(timing) {
  if (Array.isArray(timing)) return timing.join(', ');
  return timing || '';
}

// 사고·상해 보고서
export function buildAccidentReport(a, childName) {
  const name = childName || a.childName || '해당 유아';
  const when = [a.date, a.time].filter(Boolean).join(' ');
  const sections = [
    { title: '사고 개요', text: [
      `유아명: ${name}`,
      when && `발생 일시: ${when}`,
      a.location && `발생 장소: ${a.location}`,
    ].filter(Boolean).join('\n') },
    { title: '사고 경위', text:
      `${when ? when + ', ' : ''}${a.location ? a.location + '에서 ' : ''}${a.situation || '사고가 발생하였다.'}`.trim() },
    { title: '부상 정도', text: a.injury ? `${a.injury}` : '경미한 정도로 확인되었다.' },
    { title: '조치 사항', text:
      `발견 즉시 ${a.treatment || '응급 처치를 실시하였다.'} 이후 유아의 상태를 지속적으로 관찰하였으며, 보호자에게 사고 내용을 안내하였다.` },
    { title: '추후 관리', text:
      '유아의 상태 변화를 면밀히 살피고, 동일한 사고가 재발하지 않도록 환경을 점검하며 안전 지도를 강화한다.' },
  ];
  return { title: `${name} 사고·상해 보고서`, badge: when, sections };
}

// 투약 보고서(투약 기록 정리)
export function buildMedicineReport(m, childName) {
  const name = childName || m.childName || '해당 유아';
  const sections = [
    { title: '투약 개요', text: [
      `유아명: ${name}`,
      m.date && `투약 일자: ${m.date}`,
      m.medicine && `약품명: ${m.medicine}`,
      m.dose && `용량: ${m.dose}`,
      m.timing && `투약 시간: ${timingLabel(m.timing)}`,
      m.reason && `투약 사유: ${m.reason}`,
    ].filter(Boolean).join('\n') },
    { title: '투약 경위', text:
      `보호자의 투약 의뢰에 따라 ${m.date ? m.date + '에 ' : ''}${m.reason ? m.reason + ' 증상으로 ' : ''}${m.medicine || '의뢰된 약'}을(를) ${m.dose ? m.dose + ' ' : ''}투약하였다.` },
    { title: '투약 후 관찰', text:
      '투약 후 유아의 상태를 지속적으로 관찰하였으며, 특이 사항 발생 시 즉시 보호자에게 안내할 수 있도록 하였다.' },
    { title: '비고', text:
      '본 투약은 보호자의 서면 동의(투약 의뢰서)에 근거하여 실시하였다.' },
  ];
  return { title: `${name} 투약 보고서`, badge: m.date || '', sections };
}

export function reportToText(d) {
  return `${d.title}\n${d.badge || ''}\n\n` + (d.sections || []).map(s => `[${s.title}]\n${s.text}`).join('\n\n');
}
