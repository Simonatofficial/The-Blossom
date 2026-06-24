/* The 5 Aspects → Attributes → Skills (docs/17 §2). PURE DATA — the growth spine.
   Nothing is rendered from here yet; the growth engine (js/core/growth.js) and the
   self-contained Aspect tool (js/widgets/aspect.js) read it. Roster ported verbatim
   from the Transfer Pack DESIGN-DOC Floor 1.3 (the single source of truth).

   Shape: each aspect is a flower. Its `attributes` are petals (sized by level); each
   attribute's `skills` are stars orbiting it (brighter as they level). One aspect lives
   in one module, but a single action can feed more than one aspect/attribute — see
   growth.js. Ids are stable kebab-case so the ledger keys never depend on display names. */

/** @typedef {{ id:string, name:string, desc:string }} SkillDef */
/** @typedef {{ id:string, name:string, desc:string, skills:SkillDef[] }} AttributeDef */
/** @typedef {{ id:string, name:string, module:string, color:string, icon:string, blurb:string, attributes:AttributeDef[] }} AspectDef */

const sk = (id, name, desc) => ({ id, name, desc });

/** @type {AspectDef[]} */
export const ASPECTS = [
  {
    id: 'mental', name: 'Mental', module: 'productivity', color: '#6b8cff', icon: 'sparkles',
    blurb: 'Focus, learning, and clear thinking — the mind in bloom.',
    attributes: [
      { id: 'focus', name: 'Focus', desc: 'Direct and maintain your attention on tasks for deep, meaningful work.', skills: [
        sk('deep-work', 'Deep Work Sessions', 'Engage in uninterrupted, focused work periods'),
        sk('distraction-elimination', 'Distraction Elimination', 'Identify and remove focus blockers'),
        sk('attention-span', 'Attention Span Extension', 'Gradually increase focus duration'),
        sk('task-prioritization', 'Task Prioritization', 'Identify and focus on high-impact activities')
      ] },
      { id: 'memory', name: 'Memory', desc: 'Enhance your capacity to encode, store, and retrieve information.', skills: [
        sk('information-retention', 'Information Retention', 'Improve ability to remember learned material'),
        sk('active-recall', 'Active Recall', 'Practice retrieving information without cues'),
        sk('spaced-repetition', 'Spaced Repetition', 'Use proven techniques to strengthen memory'),
        sk('memory-palace', 'Memory Palace Technique', 'Apply visualization strategies for complex information')
      ] },
      { id: 'problem-solving', name: 'Problem Solving', desc: 'Analyze situations and find effective solutions to complex challenges.', skills: [
        sk('analytical-breakdown', 'Analytical Breakdown', 'Deconstruct complex problems into components'),
        sk('creative-solutions', 'Creative Solution Generation', 'Brainstorm multiple approaches'),
        sk('logical-reasoning', 'Logical Reasoning', 'Apply structured thinking to problems'),
        sk('systems-thinking', 'Systems Thinking', 'Understand how different elements interact')
      ] },
      { id: 'learning', name: 'Learning', desc: 'Continuously acquire knowledge and expand your capabilities.', skills: [
        sk('active-learning', 'Active Learning', 'Engage deeply with new material'),
        sk('skill-acquisition', 'Skill Acquisition', 'Master new abilities systematically'),
        sk('knowledge-integration', 'Knowledge Integration', 'Connect new information to existing knowledge'),
        sk('curiosity', 'Curiosity Development', 'Cultivate intrigue and exploration mindset')
      ] },
      { id: 'emotional-intelligence', name: 'Emotional Intelligence', desc: 'Understand emotions logically for better decision-making and awareness.', skills: [
        sk('emotion-recognition', 'Emotion Recognition', 'Identify emotional states in yourself and others'),
        sk('pattern-recognition', 'Pattern Recognition', 'Connect emotions to triggers and outcomes'),
        sk('perspective-taking', 'Perspective Taking', 'Consider situations from multiple viewpoints'),
        sk('decision-analysis', 'Decision Analysis', 'Evaluate choices with emotional awareness')
      ] }
    ]
  },
  {
    id: 'physical', name: 'Physical', module: 'activity', color: '#ff7a6b', icon: 'activity',
    blurb: 'Strength, energy, and care for the body that carries you.',
    attributes: [
      { id: 'strength', name: 'Strength', desc: 'Build muscular power and functional capability for daily life and long-term resilience.', skills: [
        sk('compound-lifting', 'Compound Lifting', 'Master fundamental movements like squats, deadlifts, and presses'),
        sk('core-stability', 'Core Stability', 'Build abdominal and deep core muscle endurance'),
        sk('functional-movement', 'Functional Movement', 'Apply strength to real-world lifting and carrying'),
        sk('progressive-overload', 'Progressive Overload', 'Systematically increase resistance and difficulty')
      ] },
      { id: 'endurance', name: 'Endurance', desc: 'Sustain physical activity over extended periods and build cardiovascular health.', skills: [
        sk('aerobic-conditioning', 'Aerobic Conditioning', 'Improve heart and lung efficiency through sustained activity'),
        sk('distance-building', 'Distance Building', 'Gradually increase duration of cardio activities'),
        sk('pace-management', 'Pace Management', 'Maintain consistent effort levels during long activities'),
        sk('recovery-optimization', 'Recovery Optimization', 'Develop proper rest and nutrition strategies')
      ] },
      { id: 'mobility', name: 'Mobility', desc: 'Increase range of motion and prevent injuries for better movement.', skills: [
        sk('static-stretching', 'Static Stretching', 'Hold stretches to increase muscle length'),
        sk('dynamic-movement', 'Dynamic Movement', 'Practice active flexibility during exercise'),
        sk('joint-mobility', 'Joint Mobility', 'Restore and maintain optimal joint function'),
        sk('breathing-techniques', 'Breathing Techniques', 'Use breath work to deepen stretches safely')
      ] },
      { id: 'nutrition', name: 'Nutrition', desc: 'Fuel your body properly for energy, recovery, and long-term vitality.', skills: [
        sk('meal-planning', 'Meal Planning', 'Design balanced, sustainable eating patterns'),
        sk('nutrient-knowledge', 'Nutrient Knowledge', 'Understand macros and micronutrients'),
        sk('hydration', 'Hydration Mastery', 'Maintain optimal fluid intake'),
        sk('supplement-understanding', 'Supplement Understanding', 'Make informed choices about supplements')
      ] },
      { id: 'recovery', name: 'Recovery', desc: 'Allow your body to repair and regenerate for optimal performance.', skills: [
        sk('sleep-hygiene', 'Sleep Hygiene', 'Establish consistent routines and environment'),
        sk('rest-cycles', 'Rest Cycles', 'Understand and implement recovery days'),
        sk('stress-reduction', 'Stress Reduction', 'Use relaxation techniques before bed'),
        sk('sleep-tracking', 'Sleep Quality Tracking', 'Monitor and improve sleep patterns')
      ] }
    ]
  },
  {
    id: 'emotional', name: 'Emotional', module: 'meditation', color: '#56c2a6', icon: 'heart',
    blurb: 'Awareness, calm, and kindness toward yourself.',
    attributes: [
      { id: 'self-awareness', name: 'Self-Awareness', desc: 'Understand your emotions, triggers, patterns, and values deeply.', skills: [
        sk('emotion-identification', 'Emotion Identification', 'Name and understand your feelings'),
        sk('trigger-mapping', 'Trigger Mapping', 'Identify what causes your emotional reactions'),
        sk('values-clarification', 'Values Clarification', 'Understand what truly matters to you'),
        sk('shadow-work', 'Shadow Work', 'Acknowledge and integrate difficult aspects of yourself')
      ] },
      { id: 'self-regulation', name: 'Self-Regulation', desc: 'Manage emotions and respond thoughtfully to situations.', skills: [
        sk('grounding', 'Grounding Techniques', 'Use methods to calm yourself in stress'),
        sk('breathing-mastery', 'Breathing Mastery', 'Use breath work for emotional control'),
        sk('pause-respond', 'Pause & Respond', 'Create space between stimulus and response'),
        sk('emotional-reframing', 'Emotional Reframing', 'Change perspective to shift emotional state')
      ] },
      { id: 'resilience', name: 'Resilience', desc: 'Recover from difficulties and grow stronger through challenges.', skills: [
        sk('failure-integration', 'Failure Integration', 'Learn and grow from setbacks'),
        sk('perspective-maintenance', 'Perspective Maintenance', 'Keep challenges in healthy perspective'),
        sk('resource-activation', 'Resource Activation', 'Draw on inner and outer resources during difficulty'),
        sk('growth-mindset', 'Growth Mindset', 'View obstacles as opportunities to develop')
      ] },
      { id: 'self-compassion', name: 'Self-Compassion', desc: 'Treat yourself with kindness and understanding.', skills: [
        sk('self-talk', 'Negative Self-Talk Reduction', 'Challenge the harsh inner critic'),
        sk('self-forgiveness', 'Forgiveness of Self', 'Release guilt and shame constructively'),
        sk('worthiness', 'Worthiness Recognition', 'Accept your inherent value'),
        sk('boundaries', 'Boundaries Setting', 'Protect your emotional energy')
      ] },
      { id: 'motivation', name: 'Motivation', desc: 'Find direction and drive that fuels your actions meaningfully.', skills: [
        sk('goal-alignment', 'Goal Alignment', 'Ensure goals match your values'),
        sk('intrinsic-motivation', 'Intrinsic Motivation', 'Develop internal drive, not external pressure'),
        sk('purpose-connection', 'Purpose Connection', 'Link daily actions to larger meaning'),
        sk('energy-management', 'Energy Management', 'Maintain motivation through ups and downs')
      ] }
    ]
  },
  {
    id: 'social', name: 'Social', module: 'connection', color: '#e6b45a', icon: 'users',
    blurb: 'Connection, empathy, and the people who matter.',
    attributes: [
      { id: 'communication', name: 'Communication', desc: 'Express yourself clearly and listen actively to others.', skills: [
        sk('active-listening', 'Active Listening', 'Fully engage and understand others'),
        sk('clear-expression', 'Clear Expression', 'Articulate ideas with clarity and precision'),
        sk('non-verbal', 'Non-Verbal Communication', 'Master body language and tone'),
        sk('question-asking', 'Question Asking', 'Ask thoughtful, open-ended questions')
      ] },
      { id: 'empathy', name: 'Empathy', desc: 'Understand and share the feelings of others genuinely.', skills: [
        sk('perspective-understanding', 'Perspective Understanding', "Genuinely see from others' viewpoints"),
        sk('emotional-resonance', 'Emotional Resonance', 'Feel with others, not just for them'),
        sk('validation', 'Validation Skills', "Acknowledge others' feelings and experiences"),
        sk('compassionate-response', 'Compassionate Response', 'Respond with genuine care and support')
      ] },
      { id: 'relationships', name: 'Relationships', desc: 'Form meaningful connections and nurture them over time.', skills: [
        sk('networking', 'Networking', 'Build professional and personal connections'),
        sk('vulnerability', 'Vulnerability', 'Share authentically and allow others to know you'),
        sk('conflict-resolution', 'Conflict Resolution', 'Navigate disagreements constructively'),
        sk('trust-development', 'Trust Development', 'Build and maintain trusted relationships')
      ] },
      { id: 'collaboration', name: 'Collaboration', desc: 'Work effectively with others toward shared goals.', skills: [
        sk('cooperative-problem-solving', 'Cooperative Problem-Solving', 'Work together toward solutions'),
        sk('role-recognition', 'Role Recognition', 'Understand and embrace your role in teams'),
        sk('feedback-integration', 'Feedback Integration', 'Receive and apply input from others'),
        sk('group-dynamics', 'Group Dynamics', 'Navigate team interactions effectively')
      ] },
      { id: 'leadership', name: 'Leadership', desc: 'Inspire and guide others to achieve shared goals.', skills: [
        sk('vision-communication', 'Vision Communication', 'Articulate compelling direction'),
        sk('decision-making', 'Decision Making', 'Make sound choices for group benefit'),
        sk('delegation', 'Delegation', 'Empower others to take on responsibilities'),
        sk('inspiration', 'Inspiration', 'Motivate and uplift those around you')
      ] }
    ]
  },
  {
    id: 'recreation', name: 'Recreation', module: 'entertainment', color: '#c07ad6', icon: 'smile',
    blurb: 'Play, creativity, and joy — the fun side of a full life.',
    attributes: [
      { id: 'creativity', name: 'Creativity', desc: 'Create something new and express yourself authentically.', skills: [
        sk('artistic-skill', 'Artistic Skill Development', 'Master your chosen creative medium'),
        sk('creative-problem-solving', 'Creative Problem-Solving', 'Apply creativity to overcome challenges'),
        sk('ideation', 'Ideation', 'Generate abundant ideas and possibilities'),
        sk('execution', 'Execution', 'Bring creative visions to reality')
      ] },
      { id: 'mastery', name: 'Mastery', desc: 'Develop competence and expertise in activities you enjoy.', skills: [
        sk('deliberate-practice', 'Deliberate Practice', 'Focus on improving specific aspects'),
        sk('technique-refinement', 'Technique Refinement', 'Perfect the fundamentals'),
        sk('advanced-technique', 'Advanced Technique', 'Move beyond basics into complexity'),
        sk('teaching-others', 'Teaching Others', 'Share your skill with community')
      ] },
      { id: 'presence', name: 'Presence', desc: 'Be fully engaged in the moment without judgment.', skills: [
        sk('present-awareness', 'Present Moment Awareness', "Focus on what's happening now"),
        sk('sensory-appreciation', 'Sensory Appreciation', 'Engage all senses fully'),
        sk('flow-state', 'Flow State Achievement', 'Reach deep engagement and enjoyment'),
        sk('mindfulness', 'Meditation Practice', 'Develop sustained mindfulness')
      ] },
      { id: 'adventure', name: 'Adventure', desc: 'Seek new experiences and step outside comfort zones.', skills: [
        sk('new-experiences', 'New Experience Seeking', 'Try activities outside your normal routine'),
        sk('comfort-zone', 'Comfort Zone Expansion', 'Gradually increase challenge level'),
        sk('travel-exploration', 'Travel & Exploration', 'Discover new places and perspectives'),
        sk('risk-assessment', 'Risk Assessment', 'Balance adventure with safety')
      ] },
      { id: 'joy', name: 'Joy', desc: 'Cultivate happiness and appreciation in daily life.', skills: [
        sk('gratitude', 'Gratitude Practice', "Regularly acknowledge what's good"),
        sk('simple-pleasures', 'Simple Pleasure Recognition', 'Find joy in everyday moments'),
        sk('celebration', 'Celebration', 'Mark achievements and positive moments'),
        sk('humor', 'Humor Cultivation', 'Find and share lightness and laughter')
      ] }
    ]
  }
];

/* ---- lookups (built once; the ledger and tools index by id) ---- */

/** module key → aspect id, and the inverse (docs/17 §3). */
export const ASPECT_BY_MODULE = Object.freeze(Object.fromEntries(ASPECTS.map(a => [a.module, a.id])));
export const MODULE_BY_ASPECT = Object.freeze(Object.fromEntries(ASPECTS.map(a => [a.id, a.module])));

const _aspectIndex = new Map(ASPECTS.map(a => [a.id, a]));
const _attrIndex = new Map();   // 'aspectId:attrId' and bare 'attrId' → { aspect, attribute }
const _skillIndex = new Map();  // 'skillId' → { aspect, attribute, skill }
for (const aspect of ASPECTS) {
  for (const attribute of aspect.attributes) {
    _attrIndex.set(`${aspect.id}:${attribute.id}`, { aspect, attribute });
    if (!_attrIndex.has(attribute.id)) _attrIndex.set(attribute.id, { aspect, attribute });
    for (const skill of attribute.skills) {
      _skillIndex.set(skill.id, { aspect, attribute, skill });
    }
  }
}

/** @returns {AspectDef|null} */
export function aspectById(id) { return _aspectIndex.get(id) || null; }

/** @returns {AspectDef|null} the aspect a module feeds. */
export function aspectForModule(moduleKey) { return _aspectIndex.get(ASPECT_BY_MODULE[moduleKey]) || null; }

/** Resolve an attribute by 'attrId' or 'aspectId:attrId'. @returns {{aspect,attribute}|null} */
export function findAttribute(ref) { return _attrIndex.get(ref) || null; }

/** Resolve a skill by its id. @returns {{aspect,attribute,skill}|null} */
export function findSkill(skillId) { return _skillIndex.get(skillId) || null; }

/** Every attribute id (handy for seeding a fresh ledger). */
export function allAttributeIds() { return [..._attrIndex.keys()].filter(k => !k.includes(':')); }
