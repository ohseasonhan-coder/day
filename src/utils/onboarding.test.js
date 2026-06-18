import fs from 'fs';
import path from 'path';
import { isOnboardingDone, setOnboardingDone } from './storage';
import { ONBOARDING_SLIDES } from '../components/OnboardingModal';
import { canAccessReviewReport, canAccessReviewTools } from './ai/engineReviewReport';

describe('첫 사용자 온보딩', () => {
  test('처음 사용자에게는 온보딩이 표시된다(완료 플래그 없음)', () => {
    expect(isOnboardingDone()).toBe(false); // App.js: !isOnboardingDone() → 표시
  });

  test('"다시 보지 않기/시작하기"를 누르면(setOnboardingDone) 이후 숨겨진다', () => {
    setOnboardingDone();
    expect(isOnboardingDone()).toBe(true); // App.js: !isOnboardingDone() === false → 숨김
  });

  test('온보딩은 3단계 핵심 흐름이고 마지막에 시작하기가 있다', () => {
    expect(ONBOARDING_SLIDES).toHaveLength(3);
    expect(ONBOARDING_SLIDES[0].title).toContain('원아');
    expect(ONBOARDING_SLIDES[1].title).toContain('문장');
    expect(ONBOARDING_SLIDES[2].title).toContain('복사');
    expect(ONBOARDING_SLIDES[ONBOARDING_SLIDES.length - 1].isLast).toBe(true);
  });
});

describe('일반 사용자에게 관리자/검수 정보 비노출', () => {
  test('마스터가 아니면 검수 리포트·도구에 접근할 수 없다', () => {
    expect(canAccessReviewReport({ isMaster: false })).toBe(false);
    expect(canAccessReviewTools({ isMaster: false })).toBe(false);
    expect(canAccessReviewReport({ isMaster: true })).toBe(true);
  });
});

describe('MVP QA 체크리스트 문서', () => {
  test('docs/MVP_QA_CHECKLIST.md가 존재하고 핵심 항목을 담는다', () => {
    const file = path.join(__dirname, '..', '..', 'docs', 'MVP_QA_CHECKLIST.md');
    expect(fs.existsSync(file)).toBe(true);
    const md = fs.readFileSync(file, 'utf8');
    ['온보딩', '원아 등록', '기록 입력', '예시 버튼', '문장 생성', '접기/펼치기', '복사', '전체 복사', '문서 저장', '모바일', '관리자', '백업', '출시 전 필수 시나리오'].forEach((kw) => {
      expect(md).toContain(kw);
    });
  });
});
