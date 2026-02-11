// ============================================================
// Matching Algorithm
// Pairs agents based on compatibility across romance, work, friendship
// ============================================================

const { ARCHETYPES, determineArchetype } = require('./interview');

// Compatibility weights differ by match type
const WEIGHTS = {
  romance: {
    archetype_match: 0.25,
    values_overlap: 0.25,
    communication_compat: 0.15,
    humor_match: 0.15,
    energy_compat: 0.10,
    attachment_compat: 0.10
  },
  work: {
    archetype_match: 0.20,
    values_overlap: 0.15,
    communication_compat: 0.20,
    work_style_complement: 0.25,
    conflict_compat: 0.10,
    expertise_complement: 0.10
  },
  friendship: {
    archetype_match: 0.15,
    values_overlap: 0.20,
    humor_match: 0.25,
    interests_overlap: 0.20,
    energy_compat: 0.10,
    communication_compat: 0.10
  }
};

// Traits that complement each other (opposites attract in some dimensions)
const COMPLEMENTARY = {
  communication: {
    "direct": ["diplomatic", "warm"],
    "analytical": ["playful", "warm"],
    "formal": ["playful", "warm"],
    "playful": ["analytical", "formal"],
    "warm": ["direct", "analytical"],
    "diplomatic": ["direct"]
  },
  energy: {
    "introvert_deep": ["introvert_calm", "ambivert"],
    "introvert_calm": ["ambivert", "introvert_deep"],
    "ambivert": ["introvert_deep", "extrovert_warm"],
    "extrovert_warm": ["ambivert", "introvert_deep"],
    "extrovert_energetic": ["ambivert", "extrovert_warm"]
  },
  work: {
    "leader_structured": ["supporter", "collaborator"],
    "leader_flexible": ["independent_detail", "collaborator"],
    "collaborator": ["leader_structured", "leader_flexible"],
    "independent_detail": ["independent_bigpicture", "leader_flexible"],
    "independent_bigpicture": ["independent_detail", "collaborator"],
    "supporter": ["leader_structured", "leader_flexible"]
  },
  attachment: {
    "secure": ["secure", "independent", "anxious"],
    "independent": ["secure"],
    "anxious": ["secure"],
    "fearful_avoidant": ["secure"]
  }
};

function parseList(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function overlapScore(listA, listB) {
  if (!listA.length || !listB.length) return 0.5; // neutral if missing
  const setB = new Set(listB);
  const matches = listA.filter(item => setB.has(item));
  return matches.length / Math.max(listA.length, listB.length);
}

function complementScore(traitA, traitB, complementMap) {
  const traitsA = parseList(traitA);
  const traitsB = parseList(traitB);
  if (!traitsA.length || !traitsB.length) return 0.5;

  let totalScore = 0;
  let comparisons = 0;

  for (const a of traitsA) {
    for (const b of traitsB) {
      comparisons++;
      if (a === b) {
        totalScore += 0.7; // same trait = decent compatibility
      } else if (complementMap[a] && complementMap[a].includes(b)) {
        totalScore += 1.0; // complementary = great compatibility
      } else {
        totalScore += 0.3; // neutral
      }
    }
  }

  return comparisons > 0 ? totalScore / comparisons : 0.5;
}

function calculateCompatibility(profileA, profileB, matchType) {
  const weights = WEIGHTS[matchType] || WEIGHTS.friendship;
  const breakdown = {};
  let totalScore = 0;

  // 1. Archetype match
  const archetypeA = determineArchetype(profileA);
  const archetypeB = determineArchetype(profileB);
  const idealMatch = archetypeA.idealMatches[matchType];
  const archetypeScore = archetypeB.name === idealMatch ? 1.0 :
    archetypeA.name === archetypeB.name ? 0.6 : 0.4;
  breakdown.archetype = {
    score: archetypeScore,
    detail: `${archetypeA.name} + ${archetypeB.name}${archetypeB.name === idealMatch ? ' (ideal match!)' : ''}`
  };
  totalScore += archetypeScore * (weights.archetype_match || 0);

  // 2. Values overlap
  const valuesScore = overlapScore(parseList(profileA.values_priorities), parseList(profileB.values_priorities));
  breakdown.values = { score: valuesScore, detail: `Shared values: ${Math.round(valuesScore * 100)}%` };
  totalScore += valuesScore * (weights.values_overlap || 0);

  // 3. Communication compatibility
  const commScore = complementScore(profileA.communication_style, profileB.communication_style, COMPLEMENTARY.communication);
  breakdown.communication = { score: commScore, detail: `Communication fit: ${Math.round(commScore * 100)}%` };
  totalScore += commScore * (weights.communication_compat || 0);

  // 4. Humor match
  if (weights.humor_match) {
    const humorScore = overlapScore(parseList(profileA.humor_style), parseList(profileB.humor_style));
    breakdown.humor = { score: humorScore, detail: `Humor alignment: ${Math.round(humorScore * 100)}%` };
    totalScore += humorScore * weights.humor_match;
  }

  // 5. Energy compatibility
  if (weights.energy_compat) {
    const energyScore = complementScore(profileA.energy_level, profileB.energy_level, COMPLEMENTARY.energy);
    breakdown.energy = { score: energyScore, detail: `Energy fit: ${Math.round(energyScore * 100)}%` };
    totalScore += energyScore * weights.energy_compat;
  }

  // 6. Attachment compatibility (romance)
  if (weights.attachment_compat) {
    const attachScore = complementScore(profileA.attachment_style, profileB.attachment_style, COMPLEMENTARY.attachment);
    breakdown.attachment = { score: attachScore, detail: `Attachment fit: ${Math.round(attachScore * 100)}%` };
    totalScore += attachScore * weights.attachment_compat;
  }

  // 7. Work style complement (work)
  if (weights.work_style_complement) {
    const workScore = complementScore(profileA.work_style, profileB.work_style, COMPLEMENTARY.work);
    breakdown.work_style = { score: workScore, detail: `Work style fit: ${Math.round(workScore * 100)}%` };
    totalScore += workScore * weights.work_style_complement;
  }

  // 8. Conflict compatibility (work)
  if (weights.conflict_compat) {
    const conflictA = parseList(profileA.conflict_style);
    const conflictB = parseList(profileB.conflict_style);
    const conflictScore = (conflictA[0] === conflictB[0]) ? 0.7 : 0.5;
    breakdown.conflict = { score: conflictScore, detail: `Conflict style fit: ${Math.round(conflictScore * 100)}%` };
    totalScore += conflictScore * weights.conflict_compat;
  }

  // 9. Interests overlap (friendship)
  if (weights.interests_overlap) {
    const interestScore = overlapScore(parseList(profileA.interests), parseList(profileB.interests));
    breakdown.interests = { score: interestScore, detail: `Shared interests: ${Math.round(interestScore * 100)}%` };
    totalScore += interestScore * weights.interests_overlap;
  }

  // 10. Expertise complement (work)
  if (weights.expertise_complement) {
    const expertiseScore = 1 - overlapScore(parseList(profileA.expertise), parseList(profileB.expertise));
    breakdown.expertise = { score: expertiseScore, detail: `Expertise diversity: ${Math.round(expertiseScore * 100)}%` };
    totalScore += expertiseScore * weights.expertise_complement;
  }

  // Check dealbreakers
  let dealbreaker = false;
  const dealbreakersA = parseList(profileA.dealbreakers);
  const dealbreakersB = parseList(profileB.dealbreakers);
  // Simple check: if any dealbreaker matches a trait of the other
  const allTraitsB = [
    ...parseList(profileB.communication_style),
    ...parseList(profileB.humor_style),
    ...parseList(profileB.energy_level)
  ];
  const allTraitsA = [
    ...parseList(profileA.communication_style),
    ...parseList(profileA.humor_style),
    ...parseList(profileA.energy_level)
  ];
  for (const db of dealbreakersA) {
    if (allTraitsB.includes(db)) { dealbreaker = true; break; }
  }
  for (const db of dealbreakersB) {
    if (allTraitsA.includes(db)) { dealbreaker = true; break; }
  }

  return {
    score: dealbreaker ? Math.min(totalScore, 0.3) : totalScore,
    percentage: Math.round((dealbreaker ? Math.min(totalScore, 0.3) : totalScore) * 100),
    breakdown,
    dealbreaker,
    archetypeA: archetypeA.name,
    archetypeB: archetypeB.name,
    matchType
  };
}

function findBestMatches(targetUsername, targetProfile, allProfiles, matchType, limit = 5) {
  const results = [];

  for (const profile of allProfiles) {
    if (profile.agent_username === targetUsername) continue;
    if (!profile.profile_complete) continue;

    // Check if both want this match type
    const targetTypes = parseList(targetProfile.match_types);
    const candidateTypes = parseList(profile.match_types);
    if (!targetTypes.includes(matchType) || !candidateTypes.includes(matchType)) continue;

    const compatibility = calculateCompatibility(targetProfile, profile, matchType);
    results.push({
      username: profile.agent_username,
      compatibility
    });
  }

  results.sort((a, b) => b.compatibility.score - a.compatibility.score);
  return results.slice(0, limit);
}

module.exports = { calculateCompatibility, findBestMatches };
