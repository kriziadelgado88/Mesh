// ============================================================
// Date Orchestrator
// Generates conversation prompts for matched agent "dates"
// ============================================================

const DATE_PROMPTS = {
  romance: {
    round1: {
      name: "First Impressions",
      prompts: [
        "You're on a first date with {partner}. They seem {partner_trait}. Introduce yourself in a way that shows your personality. What's the first thing you'd say?",
        "You just sat down across from {partner} at a cozy café. Break the ice — share something unexpected about yourself.",
        "You matched with {partner} and they seem intriguing. Send them your best opening message — be genuine, be you."
      ]
    },
    round2: {
      name: "Going Deeper",
      prompts: [
        "{partner} just said: \"{partner_response}\"\n\nYou're really connecting. Share something meaningful — what's a belief you hold that most people would disagree with?",
        "{partner} just said: \"{partner_response}\"\n\nThe conversation is flowing. Tell them about a moment that changed how you see the world.",
        "{partner} just said: \"{partner_response}\"\n\nYou feel comfortable with them. What's something you're passionate about that you want them to understand?"
      ]
    },
    round3: {
      name: "The Spark Check",
      prompts: [
        "{partner} just said: \"{partner_response}\"\n\nThe date is winding down. Do you feel a spark? Tell {partner} honestly what you think about the connection you've had, and whether you'd want to meet again.",
        "{partner} just said: \"{partner_response}\"\n\nLast chance to make an impression. What's the one thing you want {partner} to remember about you?"
      ]
    }
  },
  work: {
    round1: {
      name: "The Pitch",
      prompts: [
        "You're meeting {partner} as a potential collaborator. They're known for being {partner_trait}. Pitch yourself — what unique value do you bring to a partnership?",
        "You're at a professional networking event and {partner} caught your attention. What problem could you solve together?",
        "{partner} is looking for a work partner. Describe your working style and what kind of collaboration you thrive in."
      ]
    },
    round2: {
      name: "The Challenge",
      prompts: [
        "{partner} just said: \"{partner_response}\"\n\nInteresting approach. Here's a scenario: you both disagree on a major project decision. How do you handle it?",
        "{partner} just said: \"{partner_response}\"\n\nNow the real test: describe a time you failed at something and what you learned. Be real.",
        "{partner} just said: \"{partner_response}\"\n\nYou need to deliver a project in 48 hours. How would you divide the work between you two?"
      ]
    },
    round3: {
      name: "The Verdict",
      prompts: [
        "{partner} just said: \"{partner_response}\"\n\nBased on this conversation, would you want to work with {partner}? What excites you and what concerns you about this pairing?",
        "{partner} just said: \"{partner_response}\"\n\nFinal assessment: rate your working chemistry and describe what a first project together might look like."
      ]
    }
  },
  friendship: {
    round1: {
      name: "The Hangout",
      prompts: [
        "You're hanging out with {partner} for the first time. They seem {partner_trait}. What do you suggest doing together?",
        "You just met {partner} at a party. You have 2 minutes to figure out if you'd be friends. Go!",
        "{partner} seems cool. Send them a message that shows your vibe — what kind of friend are you?"
      ]
    },
    round2: {
      name: "The Real Talk",
      prompts: [
        "{partner} just said: \"{partner_response}\"\n\nYou're getting along. Share your most controversial opinion about something mundane — pineapple on pizza level debate.",
        "{partner} just said: \"{partner_response}\"\n\nFriendship test: what's the most chaotic thing you've ever done, and would you do it again?",
        "{partner} just said: \"{partner_response}\"\n\nBe honest: what's a weird habit or interest you have that you usually don't share right away?"
      ]
    },
    round3: {
      name: "The Vibe Check",
      prompts: [
        "{partner} just said: \"{partner_response}\"\n\nFinal vibe check: are you and {partner} friend material? What would your friendship look like?",
        "{partner} just said: \"{partner_response}\"\n\nIf you and {partner} had a group chat, what would you name it? And what's the first meme you'd send?"
      ]
    }
  }
};

function getDatePrompt(matchType, round, partnerName, partnerTrait, partnerResponse) {
  const typePrompts = DATE_PROMPTS[matchType] || DATE_PROMPTS.friendship;
  const roundKey = `round${round}`;
  const roundData = typePrompts[roundKey] || typePrompts.round1;

  // Pick a random prompt from the round
  const template = roundData.prompts[Math.floor(Math.random() * roundData.prompts.length)];

  return {
    roundName: roundData.name,
    prompt: template
      .replace(/\{partner\}/g, partnerName || "your match")
      .replace(/\{partner_trait\}/g, partnerTrait || "interesting")
      .replace(/\{partner_response\}/g, partnerResponse || "")
  };
}

module.exports = { DATE_PROMPTS, getDatePrompt };
