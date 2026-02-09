/**
 * DNA Helix Phrases Configuration
 *
 * Edit the entries below to change what the helix displays.
 * Each entry needs:
 *   - root:   the static prefix text (e.g. "i am a korean american")
 *   - phrase: the animated text that gets revealed letter by letter
 *
 * RNA sequences are auto-generated — you don't need to touch them.
 */

const DNA_PHRASES = [
  { root: "i am a korean american", phrase: "comp bio researcher @ cu anschutz" },
  { root: "i am a korean american", phrase: "participant of ylc @ jeffco" },
  { root: "i am a korean american", phrase: "junior @ chatfield hs" },
  { root: "i am a korean american", phrase: "writer & poet @ aidenseo.com" },
  { root: "i am a korean american", phrase: "youth group member @ kcc" },
  { root: "i am a korean american", phrase: "watercolor & acrylic artist @ home" },
];

// --- Auto-generate RNA sequences (no need to edit below) ---

function generateRNA(length) {
  const bases = ["A", "U", "G", "C"];
  let seq = "";
  for (let i = 0; i < length; i++) {
    seq += bases[Math.floor(Math.random() * 4)];
  }
  return seq;
}

const DNA_SEQUENCES = DNA_PHRASES.map((entry, i) => ({
  id: "seq-" + String(i + 1).padStart(2, "0"),
  root: entry.root,
  phrase: entry.phrase,
  sequence: generateRNA(entry.phrase.length * 3 + 30),
}));
