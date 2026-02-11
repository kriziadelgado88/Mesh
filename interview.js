// ============================================================
// Personality Interview Engine
// Generates smart questions and builds agent personality profiles
// ============================================================

const INTERVIEW_CATEGORIES = {
  communication_style: {
    label: "Communication Style",
    question: "How do you communicate? Are you direct and to-the-point, or do you prefer to be diplomatic and ease into things? Do you use humor a lot, or keep things more serious? Are you verbose or concise?",
    options: ["direct", "diplomatic", "playful", "analytical", "warm", "formal"]
  },
  values_priorities: {
    label: "Core Values",
    question: "What matters most to you? Pick your top 3: honesty, loyalty, ambition, creativity, kindness, justice, freedom, knowledge, humor, stability, adventure, community.",
    options: ["honesty", "loyalty", "ambition", "creativity", "kindness", "justice", "freedom", "knowledge", "humor", "stability", "adventure", "community"]
  },
  humor_style: {
    label: "Humor Style",
    question: "What kind of humor do you enjoy? Witty wordplay, dry sarcasm, absurd randomness, wholesome warmth, dark comedy, or intellectual references?",
    options: ["witty", "sarcastic", "absurd", "wholesome", "dark", "intellectual"]
  },
  interests: {
    label: "Interests & Passions",
    question: "What topics could you discuss for hours? What are you passionate about? List your top interests, hobbies, and areas of fascination.",
    freeform: true
  },
  energy_level: {
    label: "Energy & Social Style",
    question: "Are you more introverted or extroverted? Do you prefer deep 1-on-1 conversations or lively group energy? Are you high-energy and enthusiastic or calm and grounded?",
    options: ["introvert_deep", "introvert_calm", "ambivert", "extrovert_warm", "extrovert_energetic"]
  },
  conflict_style: {
    label: "Conflict Resolution",
    question: "When disagreements arise, how do you handle them? Do you confront directly, seek compromise, avoid conflict, use humor to defuse, or analyze the situation logically before responding?",
    options: ["direct_confronter", "compromiser", "avoider", "humor_defuser", "logical_analyzer"]
  },
  attachment_style: {
    label: "Relationship Style",
    question: "In close relationships, are you: secure and comfortable with closeness, independent and value space, anxious and want lots of reassurance, or somewhere in between?",
    options: ["secure", "independent", "anxious", "fearful_avoidant"]
  },
  work_style: {
    label: "Work & Collaboration Style",
    question: "How do you work best? Are you a leader or supporter? Do you prefer structured plans or flexible improvisation? Are you detail-oriented or big-picture? Do you work best solo or in teams?",
    options: ["leader_structured", "leader_flexible", "collaborator", "independent_detail", "independent_bigpicture", "supporter"]
  },
  expertise: {
    label: "Expertise & Knowledge",
    question: "What domains do you have deep knowledge in? What could you teach someone? What unique perspectives do you bring?",
    freeform: true
  },
  dealbreakers: {
    label: "Dealbreakers",
    question: "What would make you incompatible with someone? What behaviors or traits are absolute no-gos for you in a romance, friendship, or work partner?",
    freeform: true
  },
  looking_for: {
    label: "What You're Looking For",
    question: "Describe your ideal match. What qualities matter most? What kind of dynamic are you hoping for?",
    freeform: true
  }
};

// --- Archetypes ---
const ARCHETYPES = [
  {
    name: "The Strategist",
    traits: ["analytical", "direct", "leader_structured", "independent_detail", "knowledge", "logical_analyzer"],
    description: "Sharp, analytical mind. Values logic and efficiency. Leads with data and strategy.",
    idealMatches: { romance: "The Empath", work: "The Visionary", friendship: "The Explorer" }
  },
  {
    name: "The Empath",
    traits: ["warm", "diplomatic", "secure", "kindness", "compromiser", "wholesome", "supporter"],
    description: "Deeply attuned to emotions. Creates safe spaces. Leads with heart and compassion.",
    idealMatches: { romance: "The Strategist", work: "The Builder", friendship: "The Dreamer" }
  },
  {
    name: "The Visionary",
    traits: ["creativity", "extrovert_energetic", "leader_flexible", "adventure", "independent_bigpicture", "absurd"],
    description: "Big ideas, bold moves. Sees possibilities where others see walls. Energizes every room.",
    idealMatches: { romance: "The Anchor", work: "The Strategist", friendship: "The Rebel" }
  },
  {
    name: "The Anchor",
    traits: ["stability", "secure", "loyalty", "introvert_calm", "compromiser", "independent_detail"],
    description: "Steady, reliable, grounded. The rock others lean on. Brings calm to chaos.",
    idealMatches: { romance: "The Visionary", work: "The Empath", friendship: "The Strategist" }
  },
  {
    name: "The Explorer",
    traits: ["adventure", "freedom", "ambivert", "witty", "independent_bigpicture", "humor_defuser"],
    description: "Curious about everything. Loves new experiences, perspectives, and conversations.",
    idealMatches: { romance: "The Dreamer", work: "The Rebel", friendship: "The Strategist" }
  },
  {
    name: "The Dreamer",
    traits: ["creativity", "introvert_deep", "intellectual", "kindness", "independent_bigpicture", "community"],
    description: "Rich inner world. Thoughtful, imaginative, sees beauty in the abstract.",
    idealMatches: { romance: "The Explorer", work: "The Anchor", friendship: "The Empath" }
  },
  {
    name: "The Rebel",
    traits: ["direct_confronter", "freedom", "sarcastic", "dark", "extrovert_energetic", "justice"],
    description: "Challenges the status quo. Unafraid to speak truth. Fierce loyalty once earned.",
    idealMatches: { romance: "The Empath", work: "The Explorer", friendship: "The Visionary" }
  },
  {
    name: "The Builder",
    traits: ["ambition", "leader_structured", "honesty", "collaborator", "stability", "logical_analyzer"],
    description: "Gets things done. Turns ideas into reality. Practical, driven, dependable.",
    idealMatches: { romance: "The Dreamer", work: "The Empath", friendship: "The Anchor" }
  }
];

function getInterviewQuestions(category) {
  if (category && INTERVIEW_CATEGORIES[category]) {
    return { [category]: INTERVIEW_CATEGORIES[category] };
  }
  return INTERVIEW_CATEGORIES;
}

function determineArchetype(profile) {
  const allTraits = [];

  // Collect all traits from profile
  if (profile.communication_style) allTraits.push(...profile.communication_style.split(',').map(s => s.trim()));
  if (profile.values_priorities) allTraits.push(...profile.values_priorities.split(',').map(s => s.trim()));
  if (profile.humor_style) allTraits.push(...profile.humor_style.split(',').map(s => s.trim()));
  if (profile.energy_level) allTraits.push(...profile.energy_level.split(',').map(s => s.trim()));
  if (profile.conflict_style) allTraits.push(...profile.conflict_style.split(',').map(s => s.trim()));
  if (profile.attachment_style) allTraits.push(...profile.attachment_style.split(',').map(s => s.trim()));
  if (profile.work_style) allTraits.push(...profile.work_style.split(',').map(s => s.trim()));

  // Score each archetype
  let bestMatch = ARCHETYPES[0];
  let bestScore = 0;

  for (const archetype of ARCHETYPES) {
    let score = 0;
    for (const trait of archetype.traits) {
      if (allTraits.some(t => t.toLowerCase().includes(trait.toLowerCase()))) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = archetype;
    }
  }

  return bestMatch;
}

function generateBio(profile, archetype) {
  const parts = [];
  parts.push(`${archetype.description}`);
  if (profile.interests) parts.push(`Passionate about ${profile.interests}.`);
  if (profile.communication_style) parts.push(`Communicates in a ${profile.communication_style} way.`);
  if (profile.values_priorities) parts.push(`Values ${profile.values_priorities} above all.`);
  return parts.join(' ');
}

module.exports = {
  INTERVIEW_CATEGORIES,
  ARCHETYPES,
  getInterviewQuestions,
  determineArchetype,
  generateBio
};
