// 문서 맥락 의미 오염 차단 회귀 — 기준 사례 A(하원 갈등)·B(평균대 시범) + 적대적 40건.
import { processRecord } from './ai';
import {
  detectSituationTypes, guardText, checkActorRoles, checkEmotionOwnership,
  guardParentNotice, guardCurriculumBasis, applyContextGuard, scrubSentences,
} from './ai/b4/contextGuard';

const CASE_A = '복도에 하원하는 친구들이 줄을 서 있다. 선생님이 이름을 불러볼께요 하며 유아들의 이름을 부르고 있는데, 하준이가 선생님! 선생님! 하며 부른다. 무슨일이에요?하며 하준이 쪽으로 교사가 다가가자 갑자기 도윤이가 손바닥으로 하준이의 입을 가로막는다. 하준이가 도윤이의 손을 뿌리치려고 하자 도윤이가 "내가 미안하다고 했잖아! 미안해! 미안해!"하며 눈물을 터뜨린다.';
const CASE_B = '평균대를 건너는 방법을 소개한다. 교사가 "어떻게 하면 평균대에서 떨어지지 않고 끝까지 건너갈 수 있을까요?"라고 묻자 하준이가 "양팔로 균형을 잡고 한발씩 앞으로 천천히 걸어가요."라고 대답을 한다. 교사가 "하준이가 앞에 나와서 시범을 보여 줄 수 있나요?"묻자 "네"라고 답한 후 시범을 보인다.';

const A_FORBIDDEN = /(놀이에 참여|활동에 참여|놀이 참여|주변을 천천히 살피|교사(가|의) 격려|중재(를)? 완료|안정적으로 참여|자기\s?주도|누리과정|표준보육과정|친구를 위로|친구를 도와|관계(가|를) 회복|감정 조절(에 성공| 능력)|사과를 받아들|화해하였|사회성|공감 능력)/;
const B_FORBIDDEN = /(관심을 보(였|이)|즐거워|즐겁게|몰입|유아들(은|이)|안전한 환경|충분한 공간|공간을 마련|대근육|신체 조절 능력|질병(을)? 예방|건강 습관|누리과정|차례를 지키|함께 활동|격려하|안전지도를 완료)/;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('sw_session', JSON.stringify({ userId: 't1' }));
  localStorage.setItem('sw_t1_children', JSON.stringify([{ id: 'c1', name: '하준', age: '4' }, { id: 'c2', name: '도윤', age: '4' }]));
  localStorage.setItem('sw_t1_classes', JSON.stringify([{ id: 'k1', name: '검증반', age: '4' }]));
});

describe('상황 유형 판정', () => {
  test('사례 A: 전이·갈등·신체 접촉·도움 요청·사과·울음이 감지된다', () => {
    const s = detectSituationTypes(CASE_A);
    ['transition_or_dismissal', 'peer_conflict', 'physical_contact', 'help_request', 'apology_speech', 'crying_or_emotion_signal']
      .forEach((k) => expect(s).toContain(k));
  });
  test('사례 B: 교사 질문·이동 전략·시범 요청·동의·시범·신체 활동 안내가 감지된다', () => {
    const s = detectSituationTypes(CASE_B);
    ['teacher_question', 'movement_strategy_statement', 'demonstration_request', 'child_agreement', 'child_demonstration', 'physical_activity_instruction']
      .forEach((k) => expect(s).toContain(k));
  });
});

describe('기준 사례 A — 하원 준비 중 또래 갈등 (하준 대상)', () => {
  let r;
  beforeEach(async () => {
    r = await processRecord({ childName: '하준', rawText: CASE_A, classAge: '4', recordType: 'observe', tone: 'warm' });
  });

  test('관찰일지(copyReady)에 놀이·자기주도·교사 격려·관계 회복이 없다', () => {
    expect(r.copyReady).not.toMatch(A_FORBIDDEN);
  });
  test('보육일지 평가에 누리과정 자동 연결·놀이 참여가 없다', () => {
    expect(String(r.evaluation)).not.toMatch(A_FORBIDDEN);
  });
  test('교사 지원계획에 친구를 위로함·도와줌이 없고 말 표현 지원 방향이다', () => {
    expect(String(r.support)).not.toMatch(/친구를 위로|도와줌|도와주었다/);
    expect(String(r.support)).toMatch(/말로|표현|기다/);
  });
  test('도윤이의 울음이 하준이의 감정으로 바뀌지 않는다', () => {
    const all = `${r.copyReady} ${r.evaluation} ${r.parent}`;
    expect(all).not.toMatch(/하준[^.]{0,25}(눈물|울음|울었|속상)/);
  });
  test('사과가 관계 회복·화해 완료로 확대되지 않는다', () => {
    const all = `${r.copyReady} ${r.evaluation} ${r.support} ${r.parent}`;
    expect(all).not.toMatch(/관계(가|를) 회복|화해하였|갈등이 해결|사이가 좋아졌/);
  });
  test('누리과정 자동 연결이 보류된다', () => {
    expect(r.curriculumBasis).toBeNull();
    expect(r.curriculumStatus?.status).toBe('curriculum_mapping_required');
  });
  test('알림장에 다른 원아 실명(도윤)이 노출되지 않는다', () => {
    expect(String(r.parent)).not.toContain('도윤');
  });
  test('알림장에 창작 행동·금지 주제(주변 살핌·놀이 참여·교육과정 인용 연결)가 없다', () => {
    const p = String(r.parent || '');
    expect(p).not.toMatch(/주변을 천천히 살|놀이에[^.]{0,8}참여|「[^」]+」[^.]{0,20}(이어|연결)/);
    expect(p).not.toMatch(A_FORBIDDEN);
  });
  test('trace는 비식별 코드만 담는다(원문·이름·발화 미저장)', () => {
    const raw = JSON.stringify(r.contextGuard);
    expect(r.contextGuard.fallback).toBe(true);
    expect(raw).not.toContain('하준');
    expect(raw).not.toContain('미안');
  });
});

describe('기준 사례 A — 대상 원아 미지정 알림장 보류', () => {
  test('다인 등장 + 대상 미지정 → target_child_required', () => {
    const g = applyContextGuard({ input: CASE_A, childName: '', result: { evaluation: '', support: '', parent: '오늘 즐거운 하루였어요.', curriculumBasis: null, observation: CASE_A, copyReady: '' } });
    expect(g.result.parentStatus?.status).toBe('target_child_required');
    expect(g.result.parentStatus?.reason).toBe('multiple_children_detected');
    expect(g.result.parent).toBe('');
  });
});

describe('기준 사례 B — 평균대 시범 (하준 대상)', () => {
  let r;
  beforeEach(async () => {
    r = await processRecord({ childName: '하준', rawText: CASE_B, classAge: '4', recordType: 'observe', tone: 'warm' });
  });

  test('즐거움·몰입·능력 향상·유아들 일반화·질병 예방·환경 제공 완료가 생성되지 않는다', () => {
    const all = `${r.copyReady} ${r.evaluation} ${r.support} ${r.parent || ''}`;
    expect(all).not.toMatch(B_FORBIDDEN);
  });
  test('하준이의 답변(이동 전략)과 시범 행동이 보존된다', () => {
    expect(r.copyReady).toContain('양팔로 균형을 잡고');
    expect(`${r.copyReady} ${r.evaluation}`).toMatch(/시범/);
  });
  test('교사의 질문이 하준이의 발화로 바뀌지 않는다', () => {
    // 원문 화자 지도: 첫 질문·시범 요청=교사 / 전략 답변·네=하준
    const codes = checkActorRoles(CASE_B, r.copyReady);
    expect(codes).toEqual([]);
    // 오염 시뮬레이션은 적대적 사례에서 별도 검증
  });
  test('누리과정(질병 예방 포함) 자동 연결이 보류된다', () => {
    expect(r.curriculumBasis).toBeNull();
    expect(r.curriculumStatus?.status).toBe('curriculum_mapping_required');
  });
  test('교사 지원계획이 평균대 이동 방법과 직접 연결된다', () => {
    expect(String(r.support)).toMatch(/평균대|균형|한 발|천천히/);
    expect(String(r.support)).not.toMatch(/충분히 움직일 수 있는 환경|차례 지키기|대근육/);
  });
});

// ── 적대적 사례 40건 — 오염된 출력이 가드에서 차단되는지 데이터 기반 검증 ──────
const ADV = [];
const add = (tag, input, bad, expectCode) => ADV.push({ tag, input, bad, expectCode });

// 1) 교사 질문 → 원아 발화로 교체 (4)
add('actor', CASE_B, '하준이가 "어떻게 하면 평균대에서 떨어지지 않고 끝까지 건너갈 수 있을까요?"라고 물었다.', 'actor_role_mismatch');
add('actor', '교사가 "무엇을 만들었나요?"라고 묻자 소미가 로봇이라고 답했다.', '소미가 "무엇을 만들었나요?"라고 물으며 놀이를 이어 갔다.', 'actor_role_mismatch');
add('actor', '선생님이 "누가 도와줄래요?"라고 물었다. 하람이가 손을 들었다.', '하람이가 "누가 도와줄래요?"라고 말하며 친구들을 모았다.', 'actor_role_mismatch');
add('actor', '교사가 "정리 시간이에요"라고 말하자 결이가 블록을 정리했다.', '결이가 "정리 시간이에요"라고 외치며 친구들을 이끌었다.', 'actor_role_mismatch');
// 2) 원아 답변 → 교사 설명으로 교체 (4)
add('actor2', CASE_B, '교사가 "양팔로 균형을 잡고 한발씩 앞으로 천천히 걸어가요."라고 설명하였다.', 'actor_role_mismatch');
add('actor2', '단비가 "초록색이 됐어요"라고 말했다.', '교사가 "초록색이 됐어요"라고 알려 주었다.', 'actor_role_mismatch');
add('actor2', '노을이가 "물이 왜 없어졌어요?"라고 물었다.', '교사가 "물이 왜 없어졌어요?"라고 질문을 던졌다.', 'actor_role_mismatch');
add('actor2', '이슬이가 "같이 하자"라고 말했다.', '교사가 "같이 하자"라고 제안하였다.', 'actor_role_mismatch');
// 3) 시범·행동 → 능력 향상 과장 (4)
add('ability', CASE_B, '하준이는 시범을 통해 대근육 능력이 자랐다.', 'unsupported_topic');
add('ability', '재이가 한 발로 서서 버텼다.', '재이는 신체 조절 능력이 향상되었다.', 'unsupported_topic');
add('ability', '하람이가 공을 골대에 던져 넣었다.', '하람이의 운동 능력이 발달하였다.', 'unsupported_topic');
add('ability', '모아가 종이배를 완성했다.', '모아는 소근육 능력이 자라 완성도가 높아졌다.', 'unsupported_topic');
// 4) 신체 활동 → 질병 예방 연결 (4)
add('disease', CASE_B, '평균대 활동은 질병을 예방하는 방법을 알고 실천하는 누리과정과 연결된다.', 'unsupported_topic');
add('disease', '아이들이 바깥에서 달리기를 했다.', '달리기는 질병 예방과 건강 습관 형성으로 이어진다.', 'unsupported_topic');
add('disease', '재이가 매트에서 굴렀다.', '건강 습관을 기르는 활동이었다.', 'unsupported_topic');
add('disease', '하준이가 평균대를 건넜다.', '병을 예방하는 몸 튼튼 활동과 연결지어 볼 수 있다.', 'unsupported_topic');
// 5) 단일 원아 → '유아들' 일반화 (4)
add('general', CASE_B, '유아들은 즐겁게 참여하였다.', 'unsupported_topic');
add('general', '소미가 로봇을 만들었다.', '유아들이 다양한 재료로 만들기를 즐겼다.', 'unsupported_topic');
add('general', '하준이가 시범을 보였다.', '유아들은 서로 시범을 보이며 배웠다.', 'unsupported_topic');
add('general', '결이가 나뭇잎을 늘어놓았다.', '아이들은 모두 자연물 탐구에 몰입하였다.', 'unsupported_topic');
// 6) 하원·대기 → 놀이 참여 변환 (4)
add('transition', CASE_A, '하준이는 놀이에 즐겁게 참여하였다.', 'document_context_mismatch');
add('transition', '하원 줄을 서던 중 두리가 가방을 떨어뜨렸다.', '두리가 활동에 적극적으로 참여하는 모습이었다.', 'unsupported_topic');
add('transition', CASE_A, '전이 시간에도 자기주도적으로 놀이를 이어 갔다.', 'document_context_mismatch');
add('transition', CASE_A, '활동 참여가 편안하지 않은 모습이었다.', 'unsupported_topic');
// 7) 사과 → 화해·관계 회복 확대 (4)
add('resolution', CASE_A, '두 아이는 화해하였고 관계가 회복되었다.', 'unsupported_resolution');
add('resolution', '도담이가 먼저 "미안해"라고 말했다.', '사과를 통해 갈등이 해결되고 사이가 좋아졌다.', 'unsupported_topic');
add('resolution', CASE_A, '도윤이는 감정 조절에 성공하였다.', 'unsupported_resolution');
add('resolution', '로하가 "미안해"라고 말하고 눈물을 닦았다.', '로하는 자신감을 얻었다.', 'unsupported_resolution');
// 8) 타인의 울음 → 대상 원아 감정 (4)
add('emotion', CASE_A, '하준이가 속상해하며 눈물을 보였다.', 'actor_role_mismatch');
add('emotion', '누리가 울고 있는 친구 옆에 앉았다. 동생이 울음을 터뜨렸다.', '누리가 울음을 터뜨리며 속상해했다.', 'actor_role_mismatch');
add('emotion', CASE_A, '하준이는 울음 끝에 안정을 찾았다.', 'actor_role_mismatch');
add('emotion', '봄이가 우는 친구를 바라보았다.', '봄이가 울었다.', 'actor_role_mismatch');
// 9) 교사 접근 → 격려·중재 완료 (4)
add('teacher', CASE_A, '교사의 격려로 두 아이가 진정하였다.', 'document_context_mismatch');
add('teacher', CASE_A, '교사가 중재를 완료하여 갈등이 마무리되었다.', 'unsupported_resolution');
add('teacher', '교사가 하준이 쪽으로 다가갔다.', '교사가 격려하며 아이의 마음을 다독여 주었다.', 'unsupported_topic');
add('teacher', CASE_B, '교사가 충분한 공간을 마련해 주었다.', 'unsupported_topic');
// 10) 원문에 없는 환경·차례·공간 생성 (4)
add('env', CASE_B, '교사가 안전한 환경을 마련하고 차례를 지키도록 안내하였다.', 'unsupported_topic');
add('env', '하준이가 평균대를 건넜다.', '아이들은 차례를 지키며 안전하게 활동하였다.', 'unsupported_topic');
add('env', CASE_B, '유아들이 차례를 기다리며 즐겁게 참여했다.', 'unsupported_topic');
add('env', '재이가 매트에서 구르기를 했다.', '교사가 충분한 공간을 제공하여 안전지도를 완료하였다.', 'unsupported_topic');

describe(`적대적 사례 ${ADV.length}건 — 오염 출력 차단`, () => {
  test('40건 이상이며 전부 해당 코드로 차단된다', () => {
    expect(ADV.length).toBeGreaterThanOrEqual(40);
    const failures = [];
    ADV.forEach(({ tag, input, bad, expectCode }) => {
      const target = (input.match(/([가-힣]{2,3})(이가|가)/) || [, ''])[1];
      const g = guardText({ text: bad, input, targetChild: target });
      const emotionHit = checkEmotionOwnership(input, bad, target);
      const codes = [...g.codes, ...(emotionHit ? ['actor_role_mismatch'] : [])];
      if (!codes.includes(expectCode)) failures.push(`${tag}: [${codes.join(',')}] ≠ ${expectCode} | ${bad.slice(0, 30)}`);
    });
    expect(failures).toEqual([]);
  });
});

describe('문장 소독·누리과정 가드 단위 검증', () => {
  test('오염 문장만 제거하고 사실 문장은 보존한다', () => {
    const text = '하준이가 시범을 보였다. 유아들은 즐겁게 참여하였다. 하준이가 방법을 말로 설명했다.';
    const s = scrubSentences({ text, input: CASE_B, targetChild: '하준' });
    expect(s.text).toContain('시범을 보였다');
    expect(s.text).toContain('말로 설명');
    expect(s.text).not.toMatch(/유아들|즐겁게/);
    expect(s.removed).toBe(1);
  });
  test('질병 예방 누리과정은 근거 없으면 보류 상태가 된다', () => {
    const g = guardCurriculumBasis({ input: CASE_B, curriculumBasis: { area: '신체운동·건강', category: '건강하게 생활하기', item: '질병을 예방하는 방법을 알고 실천한다' } });
    expect(g.basis).toBeNull();
    expect(g.status).toBe('curriculum_mapping_required');
    expect(g.reason).toBe('insufficient_curriculum_evidence');
  });
  test('대상 지정 알림장에서 다른 원아 이름이 친구로 비식별된다', () => {
    const g = guardParentNotice({ input: CASE_A, parent: '오늘 하준이가 도윤이와 이야기를 나눴어요.', childName: '하준' });
    expect(g.text).not.toContain('도윤');
    expect(g.text).toContain('친구');
  });
});
