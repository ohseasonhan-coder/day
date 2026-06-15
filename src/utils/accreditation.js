// ── 어린이집 평가제(인증) 준비 자동화 ─────────────────────────────────────────
// 4차 어린이집 평가 4개 영역에 앱에 쌓인 데이터(기록·문서·투약·사고 등)를 근거로 자동 매핑.
// "지표별로 어떤 근거가 있고, 무엇이 부족한지"를 한눈에 보여준다.
import { getRecords, getDocuments, getMedicines, getAccidents, getNewsletters, getConsults, getInternalDocs } from './storage';

const DOC_TYPE_OF = (d) => d.docType || '';

export function buildAccreditationReadiness() {
  const records = getRecords();
  const docs = getDocuments();
  const meds = getMedicines();
  const accidents = getAccidents();
  const newsletters = getNewsletters();
  const consults = getConsults();
  const internal = getInternalDocs();

  const hasDocType = (types) => docs.filter(d => types.includes(DOC_TYPE_OF(d))).length;
  const hasInternal = (keys) => internal.filter(d => keys.includes(d.typeKey)).length;

  const areas = [
    {
      key: 'curriculum',
      title: '1영역 · 보육과정 및 상호작용',
      items: [
        { label: '관찰 기록 누적', count: records.length, need: 10, hint: '아이별 관찰을 꾸준히 기록하세요.' },
        { label: '보육일지', count: hasDocType(['daily']), need: 5, hint: 'AI작성 또는 원클릭 일괄로 만드세요.' },
        { label: '놀이·발달 평가', count: hasDocType(['weekly', 'monthly', 'development']), need: 2, hint: '주간/월간/발달 평가 문서를 생성하세요.' },
      ],
    },
    {
      key: 'environment',
      title: '2영역 · 보육환경 및 운영관리',
      items: [
        { label: '보육계획안', count: hasDocType(['weekplan', 'monthplan']), need: 2, hint: '자동화 > 주간 계획안으로 만드세요.' },
        { label: '가정통신문', count: newsletters.length, need: 1, hint: '가정통신문 자동 만들기를 활용하세요.' },
        { label: '부모상담 기록', count: consults.length, need: 1, hint: '상담 관리에서 상담을 기록하세요.' },
      ],
    },
    {
      key: 'safety',
      title: '3영역 · 건강·안전',
      items: [
        { label: '투약 기록', count: meds.length, need: 1, hint: '투약 의뢰가 있으면 기록하세요.' },
        { label: '사고·상해 기록', count: accidents.length, need: 0, hint: '사고 발생 시 즉시 기록(없으면 양호).' },
        { label: '안전교육 평가', count: hasInternal(['safetyEdu']), need: 1, hint: '원내문서 > 안전교육 평가를 작성하세요.' },
      ],
    },
    {
      key: 'staff',
      title: '4영역 · 교직원',
      items: [
        { label: '교직원 교육일지', count: hasInternal(['staffEdu']), need: 1, hint: '원내문서 > 교직원 교육일지를 작성하세요.' },
        { label: '교사회의록', count: hasInternal(['meeting']), need: 1, hint: '원내문서 > 교사회의록을 작성하세요.' },
      ],
    },
  ];

  // 각 항목 충족 여부 + 영역 점수
  areas.forEach(area => {
    area.items.forEach(it => { it.ok = it.count >= it.need; });
    area.done = area.items.filter(i => i.ok).length;
    area.total = area.items.length;
    area.percent = Math.round((area.done / area.total) * 100);
  });

  const totalItems = areas.reduce((s, a) => s + a.total, 0);
  const doneItems = areas.reduce((s, a) => s + a.done, 0);
  const overall = Math.round((doneItems / totalItems) * 100);

  return { areas, overall, doneItems, totalItems };
}
