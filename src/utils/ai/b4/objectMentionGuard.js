const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];

const BLOCK_MENTION = /(벽돌\s*블록|벽돌블록|블럭|블록)/;
const BLOCK_PLAY_EVIDENCE = /(벽돌\s*블록|벽돌블록|블럭|블록)[^.?!。]{0,24}(쌓|쌓아|만들|연결|끼우|구성|무너뜨|무너지|집|길|탑|성|다리)|(?:쌓|만들|연결|끼우|구성|무너뜨|무너지)[^.?!。]{0,18}(벽돌\s*블록|벽돌블록|블럭|블록)/;
const BLOCK_SURFACE_EVIDENCE = /(벽돌\s*블록|벽돌블록|블럭|블록)[^.?!。]{0,16}(위에|위로|위)(?:[^.?!。]{0,14})?(놓|두|올리|받치|받침)|(?:놓|두|올리|받치)[^.?!。]{0,16}(벽돌\s*블록|벽돌블록|블럭|블록)[^.?!。]{0,8}(위에|위)/;
const LOCATION_EVIDENCE = /(어디다|어디에|어디로|위치|자리|옆에|조금 더|내려놓|옮긴|옮기|놓지|놓자|두지|둘까)/;
const CAMERA_PROP_EVIDENCE = /(카메라|촬영|찍으려면|찍으려고|찍는 놀이|촬영 놀이)/;
const ACTUAL_SHOOTING_EVIDENCE = /(사진을\s*찍|촬영하|찍었다|찍었|찍어 보|카메라로\s*찍)/;
const CHAIR_SPACE_EVIDENCE = /(의자)[^.?!。]{0,20}(놓|내려놓|옮기|앉|자리|옆)/;

export function hasBlockPlayEvidence(input = '') {
  return BLOCK_PLAY_EVIDENCE.test(clean(input));
}

export function detectObjectMentionRoles(input = '') {
  const source = clean(input);
  const roles = [];
  if (!source) return roles;

  if (BLOCK_MENTION.test(source)) {
    if (hasBlockPlayEvidence(source)) {
      roles.push({
        object: '블록',
        role: 'play_theme',
        evidenceType: 'block_construction_action',
        allowedMeaning: '블록을 쌓거나 구성하는 놀이 행동',
        metadataOnly: true,
      });
    } else if (BLOCK_SURFACE_EVIDENCE.test(source) || (BLOCK_MENTION.test(source) && LOCATION_EVIDENCE.test(source))) {
      roles.push({
        object: /벽돌\s*블록|벽돌블록/.test(source) ? '벽돌블록' : '블록',
        role: 'support_surface',
        evidenceType: 'object_location_suggestion',
        blockedTheme: 'blockPlay',
        allowedMeaning: '물건을 놓을 위치 또는 받침 제안',
        metadataOnly: true,
      });
    } else {
      roles.push({
        object: /벽돌\s*블록|벽돌블록/.test(source) ? '벽돌블록' : '블록',
        role: 'object_mention',
        evidenceType: 'object_named_without_activity',
        blockedTheme: 'blockPlay',
        allowedMeaning: '사물 언급',
        metadataOnly: true,
      });
    }
  }

  if (CHAIR_SPACE_EVIDENCE.test(source)) {
    roles.push({
      object: '의자',
      role: 'space_component',
      evidenceType: 'space_positioning',
      allowedMeaning: '놀이 공간 또는 자리 구성 요소',
      metadataOnly: true,
    });
  }

  if (/카메라/.test(source)) {
    roles.push({
      object: '카메라',
      role: LOCATION_EVIDENCE.test(source) ? 'location_question' : 'roleplay_prop',
      evidenceType: LOCATION_EVIDENCE.test(source) ? 'object_location_question' : 'roleplay_prop_mention',
      blockedTheme: ACTUAL_SHOOTING_EVIDENCE.test(source) ? '' : 'actualPhotography',
      allowedMeaning: LOCATION_EVIDENCE.test(source) ? '촬영 놀이에 필요한 물건 위치 묻기' : '촬영 놀이 도구 언급',
      metadataOnly: true,
    });
  }

  if (/그림책|책/.test(source) && !/(읽|넘기|보다|보며|이야기|장면)/.test(source)) {
    roles.push({
      object: '그림책',
      role: 'object_mention',
      evidenceType: 'book_named_without_reading',
      blockedTheme: 'bookReading',
      allowedMeaning: '사물 언급',
      metadataOnly: true,
    });
  }

  return unique(roles.map((role) => JSON.stringify(role))).map((role) => JSON.parse(role));
}

export function safeObjectMentionTrace(roles = []) {
  return (roles || []).map((role) => ({
    object: role.object,
    role: role.role,
    evidenceType: role.evidenceType,
    blockedTheme: role.blockedTheme || '',
    allowedMeaning: role.allowedMeaning || '',
    metadataOnly: true,
  }));
}

function sourceHasAny(input, re) {
  return re.test(clean(input));
}

function textHasAny(text, re) {
  return re.test(clean(text));
}

export function detectObjectThemeOverreach({ input = '', text = '' } = {}) {
  const source = clean(input);
  const out = clean(text);
  const codes = [];
  const blockedTopics = [];

  if (!out) return { ok: true, codes, blockedTopics };

  const blockMentionWithoutPlay = BLOCK_MENTION.test(source) && !hasBlockPlayEvidence(source);
  if (blockMentionWithoutPlay && textHasAny(out, /(블록\s*놀이|블록놀이|블럭\s*놀이|블록을\s*활용|블록으로\s*(구성|만들)|블록\s*구조물|블록\s*활동|블록으로\s*집|블록으로\s*길|블록으로\s*탑)/)) {
    codes.push('object_as_theme_overreach', 'unsupported_material_activity');
    blockedTopics.push('blockPlay');
  }

  if (!sourceHasAny(source, /그림책|책/) && textHasAny(out, /(그림책|책)\s*(읽|보기|활동|이야기|함께 읽)/)) {
    codes.push('object_as_theme_overreach', 'unsupported_material_activity');
    blockedTopics.push('bookReading');
  }

  if (CAMERA_PROP_EVIDENCE.test(source) && !ACTUAL_SHOOTING_EVIDENCE.test(source) && textHasAny(out, /(사진을\s*찍|촬영하였|촬영했다|카메라로\s*찍)/)) {
    codes.push('object_as_theme_overreach');
    blockedTopics.push('actualPhotography');
  }

  if (textHasAny(out, /(가정에서도|집에서도)[^.?!。]{0,36}(그림책|다양한\s*놀이|언어\s*표현|표현을\s*격려|함께\s*읽|함께\s*해\s*주세요)/)) {
    codes.push('unsupported_home_extension');
    blockedTopics.push('homeExtension');
  }

  if (!sourceHasAny(source, /(즐거|웃|몰입|집중|관심|흥미|궁금|다가가|들여다보|살펴)/) && textHasAny(out, /(즐겁게|즐거움|몰입|관심을\s*보|흥미를\s*(보|느끼)|집중하여)/)) {
    codes.push('unsupported_engagement_emotion');
    blockedTopics.push('engagementEmotion');
  }

  if (!sourceHasAny(source, /(교사|선생님)[^.?!。]{0,28}(자료|공간|마련|제공|준비|지원|안내)/) && textHasAny(out, /(교사|선생님)(가|은|는)?[^.?!。]{0,28}(자료|공간)[^.?!。]{0,18}(마련|제공|준비|조성)/)) {
    codes.push('unsupported_topic');
    blockedTopics.push('teacherEnvironmentSupport');
  }

  if (textHasAny(out, /(의사소통\s*영역\s*발달|언어\s*능력\s*(향상|발달)|표현\s*확장\s*지원|발달\s*경험)/)) {
    codes.push('unsupported_topic');
    blockedTopics.push('abilityGrowth');
  }

  return { ok: codes.length === 0, codes: unique(codes), blockedTopics: unique(blockedTopics) };
}

export default detectObjectMentionRoles;
