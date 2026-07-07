const defineCase = (id, themes, factsShape, learningPatternId, supportPatternId, learningSkeleton, supportSkeleton, options = {}) => ({
  id,
  themes,
  factsShape,
  learningPatternId,
  supportPatternId,
  learningSkeleton,
  supportSkeleton,
  blockedClaims: options.blockedClaims || ['development_claim', 'ability_judgment'],
  qualityTags: options.qualityTags || ['specific', 'safe', 'teacher_style'],
  constraints: {
    hasSpeech: options.hasSpeech ?? null,
    hasPeer: options.hasPeer ?? null,
    hasTeacherSupport: options.hasTeacherSupport ?? null,
    sparse: options.sparse ?? false,
    documentType: options.documentType || 'observation',
  },
});

export const B3_CASE_LIBRARY = [
  defineCase('case_retry_compact_01', ['retry'], ['failed_attempt', 'retry'], 'retry_context_compact', 'retry_material_flow', '{child}은/는 {context} {meaning}.', '{flow}을 이어 갈 수 있도록 {supportAction}', { blockedClaims: ['confidence_growth', 'problem_solving_growth'] }),
  defineCase('case_retry_speech_01', ['retry', 'language'], ['failed_attempt', 'retry', 'direct_speech'], 'retry_speech_sequence', 'retry_time_support', '{child}은/는 “{speech}”라고 말한 뒤 {meaning}.', '다음 놀이에서도 {supportAction}', { hasSpeech: true }),
  defineCase('case_retry_peer_01', ['retry', 'peer_help'], ['failed_attempt', 'retry', 'peer_interaction'], 'retry_peer_compact', 'shared_construction_support', '{child}은/는 친구와 함께한 상황에서 {meaning}.', '{flow}이 이어지도록 {supportAction}', { hasPeer: true, blockedClaims: ['confidence_growth', 'social_development'] }),
  defineCase('case_explore_change_01', ['change_explore'], ['exploration', 'change_observation'], 'explore_context_detail', 'explore_compare_support', '{child}은/는 {context} {meaning}.', '{flow}을 이어 갈 수 있도록 {supportAction}'),
  defineCase('case_explore_question_01', ['question', 'change_explore'], ['question', 'exploration', 'direct_speech'], 'question_evidence_flow', 'question_resource_support', '{child}은/는 {scene}. 이 장면에서 {meaning}.', '아이의 질문에서 시작된 {flow}을 위해 {supportAction}', { hasSpeech: true }),
  defineCase('case_make_material_01', ['make'], ['construction', 'material_use'], 'make_material_context', 'make_material_extension', '{child}은/는 {context} {meaning}.', '현재의 {flow}을 이어 가도록 {supportAction}'),
  defineCase('case_make_retry_01', ['make', 'retry'], ['construction', 'failed_attempt', 'retry'], 'make_retry_sequence', 'make_retry_support', '{child}은/는 {scene}. 이어서 {meaning}.', '{flow}을 이어 갈 수 있도록 {supportAction}'),
  defineCase('case_language_quote_01', ['language'], ['direct_speech', 'language_expression'], 'language_quote_grounded', 'language_wait_support', '{child}은/는 “{speech}”라고 말하며 {meaning}.', '말로 표현하는 {flow}을 이어 가도록 {supportAction}', { hasSpeech: true }),
  defineCase('case_language_explain_01', ['language'], ['language_expression'], 'language_explain_context', 'language_record_support', '{child}은/는 {context} {meaning}.', '경험을 다시 표현할 수 있도록 {supportAction}'),
  defineCase('case_role_peer_01', ['roleplay', 'peer_share'], ['role_assignment', 'peer_interaction'], 'role_peer_sequence', 'role_prop_support', '{child}은/는 친구와 역할을 나눈 장면에서 {meaning}.', '역할놀이의 {flow}이 이어지도록 {supportAction}', { hasPeer: true }),
  defineCase('case_role_language_01', ['roleplay', 'language'], ['role_assignment', 'direct_speech'], 'role_speech_flow', 'role_scene_support', '{child}은/는 “{speech}”라고 말하며 {meaning}.', '다음 장면으로 이어 갈 수 있도록 {supportAction}', { hasSpeech: true }),
  defineCase('case_peer_share_01', ['peer_share'], ['peer_interaction', 'sharing'], 'peer_share_action', 'peer_material_support', '{child}은/는 친구와 주고받는 과정에서 {meaning}.', '함께하는 {flow}이 이어지도록 {supportAction}', { hasPeer: true, blockedClaims: ['social_development', 'consideration_trait'] }),
  defineCase('case_conflict_words_01', ['conflict', 'language'], ['conflict', 'peer_interaction', 'language_expression'], 'conflict_words_sequence', 'conflict_language_support', '{child}은/는 {scene}. 이 과정에서 {meaning}.', '서로의 말을 확인하는 {flow}을 위해 {supportAction}', { hasPeer: true }),
  defineCase('case_conflict_apology_01', ['conflict'], ['conflict', 'apology', 'peer_interaction'], 'conflict_apology_grounded', 'conflict_restart_support', '{child}은/는 갈등 뒤 관찰된 말과 행동을 통해 {meaning}.', '놀이를 다시 시작할 수 있도록 {supportAction}', { hasPeer: true }),
  defineCase('case_rules_wait_01', ['rules'], ['turn_waiting'], 'rules_wait_context', 'rules_visual_support', '{child}은/는 {context} {meaning}.', '차례를 확인하는 {flow}을 이어 가도록 {supportAction}'),
  defineCase('case_rules_peer_01', ['rules', 'peer_share'], ['turn_waiting', 'peer_interaction'], 'rules_peer_compact', 'rules_repeat_support', '{child}은/는 친구와 순서를 주고받는 장면에서 {meaning}.', '같은 순서를 다시 경험하도록 {supportAction}', { hasPeer: true }),
  defineCase('case_selfhelp_daily_01', ['selfhelp'], ['self_help', 'daily_routine'], 'selfhelp_action_context', 'selfhelp_wait_support', '{child}은/는 {context} {meaning}.', '스스로 해 보는 {flow}을 위해 {supportAction}'),
  defineCase('case_movement_control_01', ['movement'], ['body_movement'], 'movement_control_context', 'movement_space_support', '{child}은/는 {context} {meaning}.', '움직임을 반복해 볼 수 있도록 {supportAction}'),
  defineCase('case_emotion_observed_01', ['emotion_expression'], ['emotion_cue'], 'emotion_observed_only', 'emotion_wait_support', '{child}은/는 관찰된 말과 행동으로 {meaning}.', '표현을 서두르지 않도록 {supportAction}', { blockedClaims: ['emotion_recovery', 'emotion_regulation_growth'] }),
  defineCase('case_emotion_recovery_01', ['emotion_recovery'], ['emotion_cue', 'recovery_cue'], 'emotion_recovery_sequence', 'recovery_pace_support', '{child}은/는 {scene}. 이후 {meaning}.', '다시 시작한 {flow}을 이어 가도록 {supportAction}'),
  defineCase('case_compare_sort_01', ['compare'], ['comparison', 'classification'], 'compare_basis_context', 'compare_set_support', '{child}은/는 {context} {meaning}.', '같은 기준으로 비교를 이어 가도록 {supportAction}'),
  defineCase('case_story_sequence_01', ['story', 'language'], ['story_sequence', 'direct_speech'], 'story_speech_sequence', 'story_record_support', '{child}은/는 “{speech}”라고 말하며 {meaning}.', '이야기의 다음 {flow}을 위해 {supportAction}', { hasSpeech: true }),
  defineCase('case_story_long_01', ['story'], ['story_sequence', 'long_narrative'], 'story_two_sentence', 'story_prompt_support', '{child}은/는 {scene}. 이 과정에서 {meaning}.', '마지막 장면에서 이어지는 {flow}을 위해 {supportAction}'),
  defineCase('case_help_request_01', ['peer_help', 'language'], ['help_request', 'direct_speech'], 'help_request_quote', 'help_words_support', '{child}은/는 “{speech}”라고 말하며 {meaning}.', '도움을 주고받는 {flow}을 이어 가도록 {supportAction}', { hasSpeech: true, hasPeer: true }),
  defineCase('case_help_action_01', ['peer_help'], ['help_action', 'peer_interaction'], 'help_action_context', 'help_role_support', '{child}은/는 친구와 도움을 주고받는 과정에서 {meaning}.', '서로 돕는 {flow}을 이어 가도록 {supportAction}', { hasPeer: true }),
  defineCase('case_make_teacher_observed_01', ['make'], ['construction', 'actual_teacher_support'], 'make_after_observed_support', 'make_next_material_support', '{child}은/는 {context} {meaning}.', '다음 활동에서는 {supportAction}', { hasTeacherSupport: true }),
  defineCase('case_rules_teacher_observed_01', ['rules'], ['turn_waiting', 'actual_teacher_support'], 'rules_after_observed_support', 'rules_next_visual_support', '{child}은/는 {context} {meaning}.', '다음 순서 경험에서도 {supportAction}', { hasTeacherSupport: true }),
];

export const B3_THEME_LANGUAGE = {
  retry: { meanings: ['다시 시도하며 방법을 이어 갔다', '방법을 바꾸어 시도를 이어 갔다', '같은 시도를 다시 이어 가 보았다'], flow: '다시 시도하는 흐름' },
  change_explore: { meanings: ['대상과 변화를 자세히 살펴보았다', '변화하는 모습을 이어서 살펴보았다', '대상의 모습을 눈여겨보았다'], flow: '살펴보는 흐름' },
  make: { meanings: ['재료를 다루어 형태로 표현했다', '재료를 연결하며 구성을 이어 갔다', '사용한 재료로 형태를 만들어 보았다'], flow: '재료로 구성하는 흐름' },
  question: { meanings: ['궁금한 점을 말로 물었다', '궁금한 내용을 질문으로 표현했다', '확인하고 싶은 점을 말로 나타냈다'], flow: '질문에서 시작된 탐색 흐름' },
  language: { meanings: ['자신의 생각을 말로 표현했다', '경험한 내용을 말로 전했다', '관찰한 내용을 말로 설명해 보았다'], flow: '말로 표현하는 흐름' },
  roleplay: { meanings: ['역할을 정해 상황을 표현했다', '맡은 역할에 따라 놀이 장면을 이어 갔다', '역할에 맞는 말과 행동을 나타냈다'], flow: '역할에 따른 놀이 흐름' },
  peer_share: { meanings: ['친구와 나누거나 함께하는 행동을 이어 갔다', '친구와 자료를 주고받으며 놀이를 이어 갔다', '친구와 함께 사용하는 행동을 이어 갔다'], flow: '친구와 함께하는 흐름' },
  conflict: { meanings: ['갈등 상황에서 말이나 행동으로 관계를 조정해 보았다', '갈등 뒤 자신의 요구를 말과 행동으로 나타냈다', '친구와의 상황을 말이나 행동으로 다시 조정해 보았다'], flow: '관계를 다시 조정하는 흐름' },
  rules: { meanings: ['차례나 순서를 지키며 활동을 이어 갔다', '정해진 순서를 확인하며 자신의 차례를 기다렸다', '차례에 맞추어 행동을 이어 갔다'], flow: '차례를 주고받는 흐름' },
  selfhelp: { meanings: ['일상에서 필요한 행동을 스스로 해 보았다', '생활 과정의 한 단계를 스스로 이어 갔다', '자신에게 필요한 일상 행동을 직접 해 보았다'], flow: '스스로 해 보는 흐름' },
  movement: { meanings: ['힘과 방향을 조절하며 움직였다', '몸의 균형과 움직임을 조절해 보았다', '움직이는 방향과 힘을 바꾸어 보았다'], flow: '움직임을 조절하는 흐름' },
  emotion_expression: { meanings: ['마음을 말과 표정, 행동으로 표현했다', '관찰된 행동으로 현재의 마음을 나타냈다', '말이나 행동으로 마음을 드러냈다'], flow: '마음을 표현하는 흐름' },
  emotion_recovery: { meanings: ['입력에 드러난 회복 행동을 이어 갔다', '마음을 표현한 뒤 다시 행동을 시작했다', '관찰된 회복 단서에 따라 놀이를 다시 이어 갔다'], flow: '다시 행동을 시작하는 흐름' },
  compare: { meanings: ['기준에 따라 비교하고 배열했다', '자신이 정한 기준으로 대상을 나누어 보았다', '같고 다른 점을 살펴보며 순서를 정했다'], flow: '기준에 따라 비교하는 흐름' },
  story: { meanings: ['사건이나 말을 순서 있게 이어 갔다', '앞뒤 장면을 연결해 이야기를 이어 갔다', '일어난 일을 순서에 따라 표현했다'], flow: '이야기를 이어 가는 흐름' },
  peer_help: { meanings: ['도움을 요청하거나 행동으로 도움을 주었다', '필요한 도움을 말로 요청해 보았다', '친구와 도움을 주고받는 행동을 이어 갔다'], flow: '도움을 주고받는 흐름' },
};

export const B3_LEARNING_SKELETONS = [
  { id: 'theme_context_compact', text: '{child}은/는 {context} {meaning}.' },
  { id: 'theme_scene_two_sentence', text: '{child}은/는 {scene}. 이 과정에서 {meaning}.' },
  { id: 'theme_meaning_compact', text: '{child}은/는 {meaning}.' },
  { id: 'theme_flow_link', text: '{child}은/는 {context} {meaningShort}.' },
  { id: 'theme_observed_sequence', text: '{child}은/는 관찰된 장면에서 {meaning}.' },
];

export const B3_SUPPORT_SKELETONS = [
  { id: 'support_direct', text: '{supportAction}' },
  { id: 'support_next_play', text: '다음 놀이에서도 {supportAction}' },
  { id: 'support_flow_first', text: '{flow}을 고려해 {supportAction}' },
  { id: 'support_observed_link', text: '{flow}과 연결해 {supportAction}' },
  { id: 'support_practical_next', text: '다음 활동에서 {supportAction}' },
];

export default B3_CASE_LIBRARY;
