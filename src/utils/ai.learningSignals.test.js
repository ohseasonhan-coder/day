// 3단계 회귀 — 배움 읽기 신호 사전 확장(정서·도전/구성/자립/표현/또래) 검증.
// 원칙: 입력 단서가 있을 때만 발화, 사실 추가 금지, 결정론, 금지표현 미재도입, 미감지 시 보수적 폴백.
import { buildLearningReading, buildAuditedCopyReady, readLearningSignal } from './ai/copyReadyObservation';
import { auditObservationCopy } from './ai/observationAudit';

const CASES = {
  challenge: '지우가 처음 해 보는 활동을 망설이다 교사의 격려로 시도했다.',
  retry: '지우가 블록 탑이 무너지자 다시 차근차근 쌓았다.',
  collage: '수아가 다양한 색의 한지를 찢어 붙이며 콜라주를 했다.',
  paint: '수아가 그림물감으로 손바닥을 찍어 도화지를 꾸몄다.',
  hygiene: '도윤이가 손을 씻을 때 비누 거품을 충분히 내어 깨끗이 씻었다.',
  meal: '하준이가 식사 시간에 골고루 먹으려고 채소도 한 입 먹었다.',
  speech: '예린이가 "이건 우리 엄마예요"라고 그림을 가리키며 이야기했다.',
  rolePeer: '시우가 역할놀이 영역에서 의사 역할을 맡아 친구를 진료해 주었다.',
  recover: '하은이가 큰 소리에 놀랐지만 교사가 안아 주자 안정을 찾았다.',
  recover2: '주아가 아침에 잠시 엄마를 찾았지만 곧 놀이에 집중했다.',
  rules: '연우가 차례를 기다렸다가 미끄럼틀을 탔다.',
  sort: '지호가 가을 낙엽을 모아 크기 순서대로 늘어놓았다.',
  change: '서윤이가 색을 섞어 새로운 색이 되는 것을 보고 놀라워했다.',
  aim: '건우가 콩주머니를 바구니에 던져 넣으며 즐거워했다.',
  none: '아인이가 오늘 유치원에 왔다.',
};
const BANNED = [/유아들은/, /활용하여/, /놀이에 참여하였다/, /발달 경험과 연결/, /영역의 발달/, /영역과 연결지어/];
const OVERCLAIM = [/자신감이 높아졌/, /불안이 해소/, /발달이 향상/, /창의성이 뛰어나/, /예술적 감각/, /완성도가 높/, /자립심이 완성/, /생활습관이 확립/, /사회성이 향상/, /배려심이 뛰어나/, /갈등이 해결/];
const learn = (input, name = '지우') => buildLearningReading({ input, childName: name });

describe('신규 신호 — 입력 단서 기반 발화', () => {
  test('망설임·격려 후 시도: 격려는 입력에 있을 때만 반영', () => {
    const l = learn(CASES.challenge);
    expect(readLearningSignal(CASES.challenge)?.key).toBe('challenge');
    expect(l).toMatch(/망설였지만/);
    expect(l).toMatch(/격려 속에서/);       // 입력에 '격려' 있음 → 반영
    const noHelp = learn('지우가 처음 해 보는 활동을 망설이다 시도했다.');
    expect(noHelp).not.toMatch(/격려/);     // 입력에 없으면 언급 금지
  });

  test('다시 시도: 기존 끈기 신호 유지(우선순위 불변)', () => {
    expect(readLearningSignal(CASES.retry)?.key).toBe('persist');
    expect(learn(CASES.retry)).toMatch(/끈기|시도/);
  });

  test('찢기·붙이기·콜라주: 구성·표상으로 읽되 창의성 단정 금지', () => {
    expect(readLearningSignal(CASES.collage)?.key).toBe('craft');
    const l = learn(CASES.collage, '수아');
    expect(l).toMatch(/구성|표현|방식/);
    OVERCLAIM.forEach((re) => expect(l).not.toMatch(re));
  });

  test('물감 찍기·꾸미기(활용형 "꾸몄"): craft로 감지', () => {
    expect(readLearningSignal(CASES.paint)?.key).toBe('craft');
    expect(learn(CASES.paint, '수아')).toMatch(/구성|표현/);
  });

  test('자립·위생: "손을 씻"(활용형) 감지 + 습관 확립 단정 금지', () => {
    expect(readLearningSignal(CASES.hygiene)?.key).toBe('hygiene');
    const l = learn(CASES.hygiene, '도윤');
    expect(l).toMatch(/스스로 실천/);
    OVERCLAIM.forEach((re) => expect(l).not.toMatch(re));
  });

  test('식습관: 골고루·채소 단서 → 스스로 시도로 읽음', () => {
    expect(readLearningSignal(CASES.meal)?.key).toBe('meal');
    expect(learn(CASES.meal, '하준')).toMatch(/스스로 시도|건강한 식습관/);
  });

  test('직접 발화·표현: 기존 express 신호 유지', () => {
    expect(readLearningSignal(CASES.speech)?.key).toBe('express');
    expect(learn(CASES.speech, '예린')).toMatch(/표현/);
  });

  test('역할놀이: 친구 언급 있으면 또래 포함, 없으면 미포함', () => {
    expect(readLearningSignal(CASES.rolePeer)?.key).toBe('roleplay');
    expect(learn(CASES.rolePeer, '시우')).toMatch(/친구/);
    const noPeer = learn('시우가 요리사 역할을 맡아 음식을 만드는 흉내를 냈다.', '시우');
    expect(noPeer).not.toMatch(/친구|또래/);   // 입력에 또래 없음 → 창작 금지
  });

  test('정서·안정 회복: 감정+회복 단서가 모두 있을 때만', () => {
    expect(readLearningSignal(CASES.recover)?.key).toBe('recover');
    expect(learn(CASES.recover, '하은')).toMatch(/안정을 찾/);
    expect(readLearningSignal(CASES.recover2)?.key).toBe('recover');
    expect(learn(CASES.recover2, '주아')).toMatch(/놀이에 집중/);
    // 감정만 있고 회복 단서 없으면 recover 미발화
    expect(readLearningSignal('주아가 큰 소리에 놀랐다.')?.key).not.toBe('recover');
  });

  test('차례·규칙 / 분류·배열 / 변화 탐구 / 조준', () => {
    expect(readLearningSignal(CASES.rules)?.key).toBe('rules');
    expect(learn(CASES.rules, '연우')).toMatch(/순서와 규칙/);
    expect(readLearningSignal(CASES.sort)?.key).toBe('sort');
    expect(learn(CASES.sort, '지호')).toMatch(/기준|배열/);
    expect(readLearningSignal(CASES.change)?.key).toBe('change');
    expect(learn(CASES.change, '서윤')).toMatch(/변화/);
    expect(readLearningSignal(CASES.aim)?.key).toBe('aim');
    expect(learn(CASES.aim, '건우')).toMatch(/힘과 방향|조절/);
  });
});

describe('안전 — 사실 추가 방지·금지표현·결정론·폴백', () => {
  test('입력에 없는 정서·의도·교사 지원을 만들지 않음(전 신규 사례 audit 무중대)', () => {
    Object.values(CASES).forEach((input) => {
      const name = (input.match(/^([가-힣]{2,3})(?:이가|가)/) || [, '지우'])[1];
      const l = learn(input, name);
      const a = auditObservationCopy({ input, observation: input, learning: l, support: '놀이 흐름을 살펴 다음 활동을 준비한다.', childName: name });
      expect(a.severity).not.toBe('major');
      OVERCLAIM.forEach((re) => expect(l).not.toMatch(re));
    });
  });

  test('같은 입력은 항상 같은 결과(결정론)', () => {
    Object.values(CASES).forEach((input) => {
      expect(learn(input)).toBe(learn(input));
    });
  });

  test('금지표현 미재도입', () => {
    Object.values(CASES).forEach((input) => {
      const l = learn(input);
      BANNED.forEach((re) => expect(l).not.toMatch(re));
    });
  });

  test('신호 미감지 시 보수적 폴백 유지(일반론·발달 영역 창작 없음)', () => {
    expect(readLearningSignal(CASES.none)).toBeNull();
    const l = learn(CASES.none, '아인');
    expect(l).toMatch(/경험을 (넓혀 갔다|쌓아 갔다)/);
    expect(l).not.toMatch(/영역|발달/);
  });

  test('support 미입력 + 신호 감지 → 계획 문체 힌트만 채움(과거 단정 없음)', () => {
    const { copyReady, audit } = buildAuditedCopyReady({ observation: CASES.collage, support: '', input: CASES.collage, childName: '수아' });
    expect(copyReady).toContain('[교사 지원 및 다음 계획]');
    expect(copyReady).not.toMatch(/지원하였다|도와주었다|제공하였다|격려하였다/);
    expect(audit.severity).not.toBe('major');
  });
});
