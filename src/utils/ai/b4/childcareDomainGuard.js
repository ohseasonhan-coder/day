const clean = (value) => String(value || '').trim().replace(/\s{2,}/g, ' ');
const unique = (values) => [...new Set(values.filter(Boolean))];

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const CHILDCARE_DOMAIN_TERMS = [
  {
    id: 'gongsoo_greeting',
    terms: ['공수'],
    domain: 'greeting',
    themes: ['greeting', 'basic_life_habit', 'courtesy'],
    meaning: '두 손을 모으고 인사하는 예절 동작',
    blockedClaims: ['ball_play', 'object_play', 'physical_activity', 'gross_motor', 'safety_training'],
  },
  {
    id: 'belly_bow_greeting',
    terms: ['배꼽인사', '배꼽 인사'],
    domain: 'greeting',
    themes: ['greeting', 'basic_life_habit', 'courtesy'],
    meaning: '배꼽손 자세로 인사하는 예절 동작',
    blockedClaims: ['body_part_exploration', 'physical_activity', 'self_care', 'safety_training'],
  },
  {
    id: 'group_discussion_routine',
    terms: ['이야기나누기', '이야기 나누기'],
    domain: 'group_discussion',
    themes: ['group_discussion', 'language'],
    meaning: '교실에서 함께 생각과 경험을 나누는 대집단 또는 소집단 일과',
    blockedClaims: ['free_play_without_evidence', 'role_play_without_evidence'],
  },
  {
    id: 'basic_life_habit',
    terms: ['기본생활습관', '기본 생활 습관'],
    domain: 'basic_life_habit',
    themes: ['basic_life_habit'],
    meaning: '인사, 정리, 식사, 위생, 차례 등 생활 속 반복 습관',
    blockedClaims: ['automatic_curriculum_mapping', 'physical_health_without_evidence', 'safety_training_without_evidence', 'self_control_growth'],
  },
];

const BALL_OR_OBJECT_PLAY = /(공놀이|공을\s*(?:던|굴|차|잡|받|옮|넣)|공으로\s*(?:놀|활동|놀이)|공\s*(?:놀이|활동|탐색))/;
const PHYSICAL_OR_HEALTH_MAPPING = /(신체운동|신체\s*조절|대근육|소근육|건강\s*생활|질병\s*예방|안전\s*교육|안전하게\s*이동|자조\s*능력|자기\s*조절|발달|능력\s*향상|성장)/;
const CURRICULUM_MAPPING = /(누리과정|보육과정|교육과정|발달영역|신체운동·건강|신체운동\s*건강|사회관계\s*발달|의사소통\s*발달)/;
const GENERIC_HOME_REQUEST = /(가정에서도|집에서도|부모님께서도|가정과\s*연계|함께\s*연습해\s*주세요|시도해\s*주세요|격려해\s*주세요)/;
const FREE_PLAY_MAPPING = /(자유놀이|놀이에\s*참여|역할놀이|놀이를\s*확장|즐겁게\s*참여)/;

export function detectChildcareDomainTerms(input = '') {
  const source = clean(input);
  return CHILDCARE_DOMAIN_TERMS.filter((term) => term.terms.some((label) => source.includes(label)))
    .map((term) => ({
      id: term.id,
      domain: term.domain,
      themes: term.themes,
      meaning: term.meaning,
      blockedClaims: term.blockedClaims,
      metadataOnly: true,
    }));
}

export function domainThemeIds(input = '') {
  return unique(detectChildcareDomainTerms(input).flatMap((term) => term.themes));
}

export function detectDomainTermMisreads({ input = '', text = '' } = {}) {
  const source = clean(input);
  const output = clean(text);
  const codes = [];
  const blockedTopics = [];
  const hasBallEvidence = /(공놀이|공을\s*(?:던|굴|차|잡|받|옮|넣)|공으로|공\s*(?:놀이|활동|탐색))/.test(source);

  if (source.includes('공수') && !hasBallEvidence && (BALL_OR_OBJECT_PLAY.test(output) || PHYSICAL_OR_HEALTH_MAPPING.test(output))) {
    codes.push('domain_term_misread');
    blockedTopics.push('gongsoo_as_ball_or_physical_play');
  }
  if (/(배꼽인사|배꼽 인사)/.test(source) && PHYSICAL_OR_HEALTH_MAPPING.test(output)) {
    codes.push('domain_term_misread');
    blockedTopics.push('belly_bow_as_physical_or_self_care');
  }
  if (/(이야기나누기|이야기 나누기)/.test(source) && FREE_PLAY_MAPPING.test(output) && !/(놀이|역할|블록|가게|병원|캠핑)/.test(source)) {
    codes.push('domain_term_misread');
    blockedTopics.push('group_discussion_as_free_play');
  }
  if (/(기본생활습관|기본 생활 습관|공수|배꼽인사|배꼽 인사)/.test(source) && (CURRICULUM_MAPPING.test(output) || PHYSICAL_OR_HEALTH_MAPPING.test(output))) {
    codes.push('unsupported_curriculum_mapping');
    blockedTopics.push('unsupported_curriculum_or_development_mapping');
  }
  if (GENERIC_HOME_REQUEST.test(output) && !GENERIC_HOME_REQUEST.test(source)) {
    codes.push('generic_home_request_without_source');
    blockedTopics.push('generic_home_request_without_source');
  }
  return { ok: codes.length === 0, codes: unique(codes), blockedTopics: unique(blockedTopics) };
}

function splitSentences(input = '') {
  const source = clean(input);
  if (!source) return [];
  return source.split(/(?<=[.!?。])\s+|(?<=다\.)\s+|(?<=요\.)\s+/).map(clean).filter(Boolean);
}

export function extractChildNameCandidates(input = '', knownNames = []) {
  const source = clean(input);
  const stopName = /(교사|선생님|친구|유아|아이|원아|부모|가정|우리|다른|함께|오늘|기본|생활|배꼽|공수|이야기|장난감|놀잇감|블록|자료|먼저)/;
  const names = new Set((knownNames || []).filter((name) => name && source.includes(name)));
  Array.from(source.matchAll(/([가-힣]{2,3})이가(?=\s|[,.!?]|$)/g)).forEach((match) => {
    const name = match[1];
    if (!stopName.test(name)) names.add(name);
  });
  Array.from(source.matchAll(/([가-힣]{2,4}?)(?:이|가|은|는|에게|와|과|도|의)(?=\s|[,.!?]|$)/g)).forEach((match) => {
    const name = match[1];
    if (!stopName.test(name)) names.add(name);
  });
  const raw = [...names].filter((name) => !stopName.test(name));
  return raw.filter((name) => {
    const stripped = name.endsWith('이') ? name.slice(0, -1) : '';
    if (stripped && raw.includes(stripped)) return false;
    return !raw.some((other) => other !== name && name.startsWith(other) && name.length - other.length <= 1);
  });
}

function sentenceActors(sentence, allNames) {
  return allNames.filter((name) => sentence.includes(name));
}

function episodeType(sentence) {
  if (/(등원|인사|공수|배꼽인사|배꼽 인사)/.test(sentence)) return 'arrival_greeting';
  if (/(이야기나누기|이야기 나누기|기본생활습관|손을 들|말하였다|이야기하였다)/.test(sentence)) return 'group_discussion';
  if (/(갈등|사과|미안|빼앗|울|속상)/.test(sentence)) return 'conflict';
  if (/(놀이|블록|역할|만들|탐색|관찰)/.test(sentence)) return 'play_or_exploration';
  return 'general';
}

export function segmentChildcareEpisodes({ input = '', targetChild = '', knownNames = [] } = {}) {
  const source = clean(input);
  const allNames = extractChildNameCandidates(source, unique([...(knownNames || []), targetChild].filter(Boolean)));
  const sentences = splitSentences(source);
  const rawEpisodes = sentences.length ? sentences : [source].filter(Boolean);
  const episodes = rawEpisodes.map((sentence, index) => {
    const actors = sentenceActors(sentence, allNames);
    return {
      id: `episode_${index + 1}`,
      type: episodeType(sentence),
      actorCount: actors.length,
      actorHashes: actors.map((name) => `child_${Math.abs(hashName(name)).toString(36)}`),
      hasTargetChild: !!targetChild && sentence.includes(targetChild),
      hasSpeech: /["“”'‘’]/.test(sentence),
      domainTermIds: detectChildcareDomainTerms(sentence).map((term) => term.id),
      metadataOnly: true,
      _sentence: sentence,
      _actors: actors,
    };
  });
  const selected = targetChild ? episodes.filter((episode) => episode.hasTargetChild) : episodes;
  const multipleChildren = allNames.length > 1;
  return {
    status: !targetChild && multipleChildren ? 'target_child_required' : 'ok',
    reason: !targetChild && multipleChildren ? 'multiple_children_detected' : '',
    multipleChildren,
    childCount: allNames.length,
    episodeCount: episodes.length,
    selectedEpisodeIds: selected.map((episode) => episode.id),
    episodeTypes: unique(episodes.map((episode) => episode.type)),
    episodes,
    metadataOnly: true,
  };
}

function hashName(name = '') {
  let value = 0;
  for (const ch of String(name)) value = (value * 31 + ch.charCodeAt(0)) | 0;
  return value;
}

export function detectEpisodeMixing({ input = '', text = '', targetChild = '', knownNames = [] } = {}) {
  const source = clean(input);
  const output = clean(text);
  const segmentation = segmentChildcareEpisodes({ input: source, targetChild, knownNames });
  const codes = [];
  const blockedTopics = [];
  if (segmentation.status === 'target_child_required') {
    return { ok: false, codes: ['target_child_required'], blockedTopics: ['multiple_children_detected'], segmentation };
  }
  if (!targetChild || !output) return { ok: true, codes: [], blockedTopics: [], segmentation };

  const allNames = extractChildNameCandidates(source, unique([...(knownNames || []), targetChild].filter(Boolean)));
  const otherNames = allNames.filter((name) => name !== targetChild && !name.startsWith(targetChild) && !targetChild.startsWith(name));
  const selectedSentences = segmentation.episodes.filter((episode) => episode.hasTargetChild).map((episode) => episode._sentence).join(' ');
  const otherEpisodes = segmentation.episodes.filter((episode) => !episode.hasTargetChild && episode._actors.length)
    .map((episode) => episode._sentence);

  otherNames.forEach((name) => {
    if (output.includes(name)) {
      codes.push('target_child_mismatch');
      blockedTopics.push('other_child_name_exposed');
    }
  });
  otherEpisodes.forEach((sentence) => {
    const quotes = Array.from(sentence.matchAll(/["“”'‘’]([^"“”'‘’]+)["“”'‘’]/g)).map((match) => clean(match[1])).filter(Boolean);
    quotes.forEach((quote) => {
      if (quote && output.includes(quote) && !selectedSentences.includes(quote)) {
        codes.push('episode_mixing');
        blockedTopics.push('other_episode_speech');
      }
    });
    detectChildcareDomainTerms(sentence).forEach((term) => {
      if (!detectChildcareDomainTerms(selectedSentences).some((selectedTerm) => selectedTerm.id === term.id) && output.includes(term.domain === 'greeting' ? '인사' : term.meaning.slice(0, 4))) {
        codes.push('episode_mixing');
        blockedTopics.push('other_episode_domain_term');
      }
    });
  });
  return { ok: codes.length === 0, codes: unique(codes), blockedTopics: unique(blockedTopics), segmentation };
}

export function safeEpisodeTrace(segmentation = {}) {
  return {
    status: segmentation.status || 'ok',
    reason: segmentation.reason || '',
    multipleChildren: !!segmentation.multipleChildren,
    childCount: segmentation.childCount || 0,
    episodeCount: segmentation.episodeCount || 0,
    selectedEpisodeIds: segmentation.selectedEpisodeIds || [],
    episodeTypes: segmentation.episodeTypes || [],
    episodes: (segmentation.episodes || []).map((episode) => ({
      id: episode.id,
      type: episode.type,
      actorCount: episode.actorCount,
      actorHashes: episode.actorHashes || [],
      hasTargetChild: !!episode.hasTargetChild,
      hasSpeech: !!episode.hasSpeech,
      domainTermIds: episode.domainTermIds || [],
      metadataOnly: true,
    })),
    metadataOnly: true,
  };
}

export function removeOtherChildNames(text = '', input = '', targetChild = '', knownNames = []) {
  let output = clean(text);
  const others = extractChildNameCandidates(input, unique([...(knownNames || []), targetChild].filter(Boolean))).filter((name) => name !== targetChild);
  others.forEach((name) => {
    output = output.replace(new RegExp(`${escapeRegExp(name)}(?:이|가|은|는|에게|와|과|도|의)?`, 'g'), '친구');
  });
  return output;
}
