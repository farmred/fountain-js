import { describe, it, expect, beforeAll } from "vitest";
import {
  parse,
  formatTitlePage,
  formatSceneHeading,
  formatDialogue,
  formatTransition,
  formatParenthetical,
  formatCentered,
  formatNote,
  formatSection,
  formatPanel,
  extractLocationName,
  parseEmphasis,
  type FountainDocument,
  type TitlePageData,
} from "../index";

// ─── Helper ──────────────────────────────────────────────────────────────

/** Shorthand: get all tokens of a given type from a parsed document. */
function tokensOf(doc: FountainDocument, type: string) {
  return doc.tokens.filter((t) => t.type === type);
}

// ═══════════════════════════════════════════════════════════════════════════
// TITLE PAGE
// ═══════════════════════════════════════════════════════════════════════════

describe("Title Page", () => {
  it("parses a single title", () => {
    const src = `Title: THE BIG SLEEP

INT. OFFICE - DAY`;

    const doc = parse(src);
    expect(doc.title.title).toBe("THE BIG SLEEP");
    expect(doc.titlePageRaw.title).toBe("THE BIG SLEEP");
  });

  it("parses multiple title-page keys", () => {
    const src = `Title: BRICK
Credit: written by
Author: Rian Johnson
Draft date: 2024-01-15
Contact: rian@example.com

INT. DINER - NIGHT`;

    const doc = parse(src);
    expect(doc.title.title).toBe("BRICK");
    expect(doc.title.credit).toBe("written by");
    expect(doc.title.authors).toEqual(["Rian Johnson"]);
    expect(doc.title.draftDate).toBe("2024-01-15");
    expect(doc.title.contact).toBe("rian@example.com");
  });

  it("parses multiple authors", () => {
    const src = `Title: DUAL AUTHORS
Author: Jane Doe
Author: John Smith

EXT. BEACH - DAY`;

    const doc = parse(src);
    expect(doc.title.authors).toEqual(["Jane Doe", "John Smith"]);
  });

  it("includes genre and copyright", () => {
    const src = `Title: GENRE TEST
Genre: Thriller
Copyright: 2024

INT. CAVE - NIGHT`;

    const doc = parse(src);
    expect(doc.title.genre).toBe("Thriller");
    expect(doc.title.copyright).toBe("2024");
  });

  it("does not leak title tokens into body tokens", () => {
    const src = `Title: NO LEAK

INT. HOUSE - DAY`;

    const doc = parse(src);
    expect(doc.tokens.some((t) => t.type === "title_page")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENE HEADINGS
// ═══════════════════════════════════════════════════════════════════════════

describe("Scene Headings", () => {
  it("recognizes INT. headings", () => {
    const doc = parse("INT. OFFICE - DAY\n\nAction line.");
    const scenes = tokensOf(doc, "scene_heading");
    expect(scenes).toHaveLength(1);
    expect(scenes[0].text).toBe("INT. OFFICE - DAY");
  });

  it("recognizes EXT. headings", () => {
    const doc = parse("EXT. BEACH - SUNSET\n\nWaves crash.");
    const scenes = tokensOf(doc, "scene_heading");
    expect(scenes).toHaveLength(1);
    expect(scenes[0].text).toBe("EXT. BEACH - SUNSET");
  });

  it("recognizes EST. headings", () => {
    const doc = parse("EST. CITY SKYLINE - DAY\n\nPanning shot.");
    const scenes = tokensOf(doc, "scene_heading");
    expect(scenes).toHaveLength(1);
    expect(scenes[0].text).toBe("EST. CITY SKYLINE - DAY");
  });

  it("recognizes INT./EXT. headings", () => {
    const doc = parse("INT./EXT. CAR - DAY\n\nDriving.");
    const scenes = tokensOf(doc, "scene_heading");
    expect(scenes).toHaveLength(1);
    expect(scenes[0].text).toBe("INT./EXT. CAR - DAY");
  });

  it("recognizes I/E. headings", () => {
    const doc = parse("I/E. HOUSE - NIGHT\n\nInside outside.");
    const scenes = tokensOf(doc, "scene_heading");
    expect(scenes).toHaveLength(1);
  });

  it("recognizes forced scene headings with leading dot", () => {
    const doc = parse(".FLASHBACK - THE OLD HOUSE\n\nMemory.");
    const scenes = tokensOf(doc, "scene_heading");
    expect(scenes).toHaveLength(1);
    expect(scenes[0].text).toBe("FLASHBACK - THE OLD HOUSE");
  });

  it("extracts scene numbers from #N# syntax", () => {
    const doc = parse("INT. OFFICE - DAY #42#\n\nAction.");
    const scenes = tokensOf(doc, "scene_heading");
    expect(scenes[0].scene_number).toBe("42");
    // Scene number stripped from text
    expect(scenes[0].text).not.toContain("#42#");
  });

  it("counts scenes correctly", () => {
    const src = `INT. OFFICE - DAY

Action.

EXT. BEACH - NIGHT

More action.

INT. CAVE - CONTINUOUS`;

    const doc = parse(src);
    expect(doc.sceneCount).toBe(3);
    expect(doc.scenes).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ACTION
// ═══════════════════════════════════════════════════════════════════════════

describe("Action", () => {
  it("parses plain action lines", () => {
    const doc = parse("A dark room. Shadows on the wall.");
    const actions = tokensOf(doc, "action");
    expect(actions).toHaveLength(1);
    expect(actions[0].text).toBe("A dark room. Shadows on the wall.");
  });

  it("parses multi-line action block", () => {
    const doc = parse("Line one.\nLine two.\nLine three.");
    const actions = tokensOf(doc, "action");
    expect(actions).toHaveLength(1);
    expect(actions[0].text).toContain("Line one.");
    expect(actions[0].text).toContain("Line three.");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHARACTER / DIALOGUE / PARENTHETICAL
// ═══════════════════════════════════════════════════════════════════════════

describe("Character & Dialogue", () => {
  it("parses a character cue and dialogue", () => {
    const src = `JOHN
I can't do this anymore.`;

    const doc = parse(src);
    const chars = tokensOf(doc, "character");
    expect(chars).toHaveLength(1);
    expect(chars[0].character).toBe("JOHN");

    const dialogue = tokensOf(doc, "dialogue").filter((t) => t.text.trim());
    expect(dialogue.length).toBeGreaterThanOrEqual(1);
    expect(dialogue.some((d) => d.text.includes("can't do this"))).toBe(true);
  });

  it("parses @forced character names", () => {
    const src = `@Jane Smith
Hello there.`;

    const doc = parse(src);
    const chars = tokensOf(doc, "character");
    expect(chars).toHaveLength(1);
    expect(chars[0].character).toBe("Jane Smith");
  });

  it("parses character with extension", () => {
    const src = `JOHN (V.O.)
On the phone we hear...`;

    const doc = parse(src);
    const chars = tokensOf(doc, "character");
    expect(chars[0].character).toBe("JOHN");
    expect(chars[0].text).toContain("V.O.");
  });

  it("parses parenthetical in dialogue", () => {
    const src = `JOHN
(whispering)
Come closer.`;

    const doc = parse(src);
    const parens = tokensOf(doc, "parenthetical");
    expect(parens).toHaveLength(1);
    expect(parens[0].text).toBe("(whispering)");
  });

  it("collects unique character names", () => {
    const src = `JOHN
Hello.

MARY
Hi there.

JOHN
How are you?`;

    const doc = parse(src);
    expect(doc.characters).toEqual(["JOHN", "MARY"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("Transitions", () => {
  it("recognizes CUT TO:", () => {
    const doc = parse("CUT TO:");
    const transitions = tokensOf(doc, "transition");
    expect(transitions).toHaveLength(1);
  });

  it("recognizes FADE OUT.", () => {
    const doc = parse("FADE OUT.");
    const transitions = tokensOf(doc, "transition");
    expect(transitions).toHaveLength(1);
  });

  it("recognizes FADE TO BLACK.", () => {
    const doc = parse("FADE TO BLACK.");
    const transitions = tokensOf(doc, "transition");
    expect(transitions).toHaveLength(1);
  });

  it("recognizes forced >TO: transitions", () => {
    const doc = parse(">SMASH CUT TO:");
    const transitions = tokensOf(doc, "transition");
    expect(transitions).toHaveLength(1);
  });

  it("recognizes > prefix transitions", () => {
    const doc = parse("> CUT TO:");
    const transitions = tokensOf(doc, "transition");
    expect(transitions).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CENTERED TEXT
// ═══════════════════════════════════════════════════════════════════════════

describe("Centered Text", () => {
  it("recognizes >text< centered syntax", () => {
    const doc = parse(">THE END<");
    const centered = tokensOf(doc, "centered");
    expect(centered).toHaveLength(1);
    expect(centered[0].text).toBe("THE END");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTIONS & PANELS
// ═══════════════════════════════════════════════════════════════════════════

describe("Sections & Panels", () => {
  it("parses # section headings (depth 1)", () => {
    const doc = parse("# Act One");
    const sections = tokensOf(doc, "section");
    expect(sections).toHaveLength(1);
    expect(sections[0].depth).toBe(1);
    expect(sections[0].text).toBe("Act One");
  });

  it("parses ### section headings (depth 3)", () => {
    const doc = parse("# Act One\n\n### Sub-beat");
    const sections = tokensOf(doc, "section");
    expect(sections).toHaveLength(2);
    expect(sections[0].depth).toBe(1);
    expect(sections[1].depth).toBe(3);
  });

  it("parses ## headings as panel markers (comic extension)", () => {
    const doc = parse("## Panel 1\n\nAction here.");
    const panels = tokensOf(doc, "panel");
    expect(panels).toHaveLength(1);
    expect(panels[0].text).toBe("Panel 1");
    expect(panels[0].type).toBe("panel");
  });

  it("counts panels correctly", () => {
    const src = `## Panel 1

Action.

## Panel 2

More action.

## Panel 3

Final action.`;

    const doc = parse(src);
    expect(doc.panelCount).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SYNOPSIS
// ═══════════════════════════════════════════════════════════════════════════

describe("Synopsis", () => {
  it("parses = synopsis lines", () => {
    const doc = parse("= This is the story beat.");
    const synopses = tokensOf(doc, "synopsis");
    expect(synopses).toHaveLength(1);
    expect(synopses[0].text).toBe("This is the story beat.");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTES
// ═══════════════════════════════════════════════════════════════════════════

describe("Notes", () => {
  it("parses standalone [[note]] blocks", () => {
    const doc = parse("[[Check continuity here]]");
    const notes = tokensOf(doc, "note");
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe("Check continuity here");
  });

  it("strips inline [[notes]] from action", () => {
    const src = "Some action [[remove this]] remaining text.";
    const doc = parse(src);
    const actions = tokensOf(doc, "action");
    expect(actions[0].text).not.toContain("[[remove this]]");
    expect(actions[0].text).toContain("remaining text");
  });

  it("strips inline [[notes]] from dialogue", () => {
    const src = `JOHN\nHello [[ad-lib]] world.`;
    const doc = parse(src);
    const dialogue = tokensOf(doc, "dialogue").filter((t) => t.text.trim());
    const combined = dialogue.map((d) => d.text).join(" ");
    expect(combined).not.toContain("[[ad-lib]]");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PAGE BREAKS
// ═══════════════════════════════════════════════════════════════════════════

describe("Page Breaks", () => {
  it("recognizes === page breaks", () => {
    const doc = parse("Action.\n\n===\n\nMore action.");
    const breaks = tokensOf(doc, "page_break");
    expect(breaks).toHaveLength(1);
  });

  it("recognizes ==== page breaks", () => {
    const doc = parse("Action.\n\n====\n\nMore action.");
    const breaks = tokensOf(doc, "page_break");
    expect(breaks).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BONEYARD
// ═══════════════════════════════════════════════════════════════════════════

describe("Boneyard", () => {
  it("strips /* ... */ boneyard blocks", () => {
    const src = `Visible text.

/* 
This is deleted content 
that should not appear.
*/

More visible text.`;

    const doc = parse(src);
    const actions = tokensOf(doc, "action");
    expect(actions.every((a) => !a.text.includes("deleted content"))).toBe(true);
  });

  it("handles single-line boneyard", () => {
    const src = `Keep this. /* Delete this */ And this.`;
    const doc = parse(src);
    // Boneyard is stripped inline — the remaining text should not contain the deleted part
    const actions = tokensOf(doc, "action");
    for (const a of actions) {
      expect(a.text).not.toContain("Delete this");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EMPHASIS PARSING
// ═══════════════════════════════════════════════════════════════════════════

describe("parseEmphasis", () => {
  it("parses bold text", () => {
    const result = parseEmphasis("This is **bold** text.");
    const boldSpan = result.find((s) => s.bold && !s.italic && !s.underline);
    expect(boldSpan).toBeDefined();
    expect(boldSpan!.text).toBe("bold");
  });

  it("parses italic text", () => {
    const result = parseEmphasis("This is *italic* text.");
    const italicSpan = result.find((s) => s.italic && !s.bold && !s.underline);
    expect(italicSpan).toBeDefined();
    expect(italicSpan!.text).toBe("italic");
  });

  it("parses underlined text", () => {
    const result = parseEmphasis("This is _underlined_ text.");
    const ulSpan = result.find((s) => s.underline && !s.bold && !s.italic);
    expect(ulSpan).toBeDefined();
    expect(ulSpan!.text).toBe("underlined");
  });

  it("parses bold-italic text", () => {
    const result = parseEmphasis("***bold italic***");
    const span = result.find((s) => s.bold && s.italic && !s.underline);
    expect(span).toBeDefined();
    expect(span!.text).toBe("bold italic");
  });

  it("parses bold-underline text", () => {
    const result = parseEmphasis("_**bold underline**_");
    const span = result.find((s) => s.bold && s.underline && !s.italic);
    expect(span).toBeDefined();
  });

  it("handles escaped asterisks", () => {
    const result = parseEmphasis("Literal \\*asterisk\\*");
    const combined = result.map((s) => s.text).join("");
    expect(combined).toContain("*asterisk*");
  });

  it("handles escaped underscores", () => {
    const result = parseEmphasis("Literal \\_underscore\\_");
    const combined = result.map((s) => s.text).join("");
    expect(combined).toContain("_underscore_");
  });

  it("returns plain text with no style when no emphasis", () => {
    const result = parseEmphasis("Just plain text.");
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Just plain text.");
    expect(result[0].bold).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

describe("Format Helpers", () => {
  describe("formatTitlePage", () => {
    it("formats a title page", () => {
      const result = formatTitlePage({
        title: "MY SCREENPLAY",
        credit: "Written by",
        authors: ["Jane Doe"],
        contact: "jane@example.com",
      });
      expect(result).toContain("Title: MY SCREENPLAY");
      expect(result).toContain("Credit: Written by");
      expect(result).toContain("Author: Jane Doe");
      expect(result).toContain("Contact: jane@example.com");
    });

    it("formats multiple authors", () => {
      const result = formatTitlePage({
        authors: ["Jane Doe", "John Smith"],
      } as TitlePageData);
      expect(result).toContain("Author: Jane Doe");
      expect(result).toContain("Author: John Smith");
    });

    it("omits empty fields", () => {
      const result = formatTitlePage({ title: "TEST" } as TitlePageData);
      expect(result).not.toContain("Credit:");
      expect(result).not.toContain("Author:");
    });
  });

  describe("formatSceneHeading", () => {
    it("formats a forced scene heading with dot prefix", () => {
      expect(formatSceneHeading("FLASHBACK", true)).toBe(".FLASHBACK");
    });

    it("formats a regular scene heading in uppercase", () => {
      expect(formatSceneHeading("int. office - day")).toBe("INT. OFFICE - DAY");
    });
  });

  describe("formatDialogue", () => {
    it("forces @ for mixed-case character names", () => {
      const result = formatDialogue("Jane Smith", ["Hello."]);
      expect(result).toContain("@Jane Smith");
    });

    it("forces @ for names with spaces", () => {
      const result = formatDialogue("JOHN SMITH", ["Hi."]);
      expect(result).toContain("@JOHN SMITH");
    });

    it("uses uppercase ALLCAPS names without @", () => {
      const result = formatDialogue("JOHN", ["Hey."]);
      expect(result).toContain("JOHN");
      expect(result).not.toContain("@JOHN");
    });

    it("joins multiple dialogue lines", () => {
      const result = formatDialogue("JOHN", ["Line one.", "Line two."]);
      expect(result).toContain("Line one.\nLine two.");
    });
  });

  describe("formatTransition", () => {
    it("uppercases transitions", () => {
      expect(formatTransition("cut to:")).toBe("CUT TO:");
    });
  });

  describe("formatParenthetical", () => {
    it("wraps text in parens", () => {
      expect(formatParenthetical("whispering")).toBe("(whispering)");
    });
  });

  describe("formatCentered", () => {
    it("wraps text in >/</", () => {
      expect(formatCentered("THE END")).toBe(">THE END<");
    });
  });

  describe("formatNote", () => {
    it("wraps text in double brackets", () => {
      expect(formatNote("Check this")).toBe("[[Check this]]");
    });
  });

  describe("formatSection", () => {
    it("formats depth 1 section", () => {
      expect(formatSection(1, "Act One")).toBe("# Act One");
    });

    it("formats depth 3 section", () => {
      expect(formatSection(3, "Sub-beat")).toBe("### Sub-beat");
    });
  });

  describe("formatPanel", () => {
    it("formats a panel marker", () => {
      expect(formatPanel("Panel 1")).toBe("## Panel 1");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACT LOCATION NAME
// ═══════════════════════════════════════════════════════════════════════════

describe("extractLocationName", () => {
  it("strips INT. prefix and time-of-day suffix", () => {
    expect(extractLocationName("INT. CITY STREET - NIGHT")).toBe("City Street");
  });

  it("strips EXT. prefix", () => {
    expect(extractLocationName("EXT. ROOFTOP - CONTINUOUS")).toBe("ROOFTOP");
  });

  it("handles forced headings", () => {
    expect(extractLocationName(".FLASHBACK - THE OLD HOUSE")).toBe("Flashback - The Old House");
  });

  it("strips V.O./O.S. extensions", () => {
    expect(extractLocationName("INT. OFFICE (V.O.) - DAY")).toBe("OFFICE");
  });

  it("returns the original text if nothing to strip", () => {
    expect(extractLocationName("SIMPLE")).toBe("SIMPLE");
  });

  it("handles INT./EXT. prefix", () => {
    const result = extractLocationName("INT./EXT. CAR - DAY");
    expect(result).toBe("CAR");
  });

  it("handles EST. prefix", () => {
    expect(extractLocationName("EST. CITY SKYLINE - DAY")).toBe("City Skyline");
  });

  it("handles MULTIPLE time-of-day combos", () => {
    expect(extractLocationName("INT. HOSPITAL - NIGHT - FLASHBACK")).toBe("HOSPITAL");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION / FULL SCRIPT
// ═══════════════════════════════════════════════════════════════════════════

describe("Full Script Integration", () => {
  const fullScript = `Title: LAST LIGHT
Credit: Written by
Author: Alex Chen
Genre: Thriller

INT. OFFICE - NIGHT

A dimly lit office. Paperwork everywhere.

JOHN
(tired)
I've been working on this case for six years.

MARY
**That's** a long time.

>FADE TO BLACK.<

===

EXT. ROOFTOP - CONTINUOUS

Wind howls across the rooftop.

# Act Two

## Panel 1

JOHN looks out at the city.

[[Remember to add establishing shot]]

= A pivotal moment`;

  let doc: FountainDocument;

  beforeAll(() => {
    doc = parse(fullScript);
  });

  it("parses the title page", () => {
    expect(doc.title.title).toBe("LAST LIGHT");
    expect(doc.title.credit).toBe("Written by");
    expect(doc.title.authors).toEqual(["Alex Chen"]);
    expect(doc.title.genre).toBe("Thriller");
  });

  it("counts scenes", () => {
    expect(doc.sceneCount).toBe(2);
  });

  it("collects characters", () => {
    expect(doc.characters).toContain("JOHN");
    expect(doc.characters).toContain("MARY");
  });

  it("parses a section (depth 1)", () => {
    const sections = tokensOf(doc, "section");
    expect(sections).toHaveLength(1);
    expect(sections[0].depth).toBe(1);
    expect(sections[0].text).toBe("Act Two");
  });

  it("parses panel markers", () => {
    expect(doc.panelCount).toBe(1);
  });

  it("parses centered text", () => {
    const centered = tokensOf(doc, "centered");
    expect(centered).toHaveLength(1);
    expect(centered[0].text).toBe("FADE TO BLACK.");
  });

  it("parses page breaks", () => {
    const breaks = tokensOf(doc, "page_break");
    expect(breaks).toHaveLength(1);
  });

  it("strips boneyard/notes from content", () => {
    const allText = doc.tokens.map((t) => t.text).join(" ");
    expect(allText).not.toContain("[[Remember");
  });

  it("parses synopsis", () => {
    const synopses = tokensOf(doc, "synopsis");
    expect(synopses).toHaveLength(1);
    expect(synopses[0].text).toBe("A pivotal moment");
  });

  it("parses parenthetical in dialogue", () => {
    const parens = tokensOf(doc, "parenthetical");
    expect(parens).toHaveLength(1);
    expect(parens[0].text).toBe("(tired)");
  });

  it("preserves bold emphasis in dialogue text", () => {
    const dialogue = tokensOf(doc, "dialogue").filter((t) => t.text.trim());
    const combined = dialogue.map((d) => d.text).join(" ");
    expect(combined).toContain("**That's**");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe("Edge Cases", () => {
  it("handles empty input", () => {
    const doc = parse("");
    expect(doc.tokens).toEqual([]);
    expect(doc.characters).toEqual([]);
    expect(doc.sceneCount).toBe(0);
  });

  it("handles CRLF line endings", () => {
    const src = "INT. OFFICE - DAY\r\n\r\nAction line.\r\n";
    const doc = parse(src);
    expect(doc.sceneCount).toBe(1);
  });

  it("handles CR-only line endings", () => {
    const src = "INT. OFFICE - DAY\r\rAction line.\r";
    const doc = parse(src);
    expect(doc.sceneCount).toBe(1);
  });

  it("handles script with only a title page", () => {
    const src = "Title: EMPTY SCRIPT";
    const doc = parse(src);
    expect(doc.title.title).toBe("EMPTY SCRIPT");
    expect(doc.tokens).toEqual([]);
  });

  it("handles title page key casing", () => {
    const src = `title: Lowercase Title
AUTHOR: Uppercase Author

INT. ROOM - DAY`;
    const doc = parse(src);
    expect(doc.titlePageRaw.title).toBe("Lowercase Title");
  });
});