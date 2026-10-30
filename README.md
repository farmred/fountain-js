# @superheropw/fountain-js

A Fountain screenplay parser and formatter for JavaScript/TypeScript. Implements the [Fountain 1.1 spec](https://fountain.io/syntax/) with extensions for comic panel markers (`##` headings).

Inspired by [Fountain.js](https://github.com/mattdaly/Fountain.js/) by Matt Daly.

## Install

```bash
npm install @superheropw/fountain-js
```

## Quick Start

```ts
import { parse } from "@superheropw/fountain-js";

const source = `
Title: LAST LIGHT
Author: Alex Chen

INT. OFFICE - NIGHT

A dimly lit office. Paperwork everywhere.

JOHN
(tired)
I've been working on this case for six years.

MARY
**That's** a long time.

>FADE TO BLACK.<

## Panel 1

JOHN looks out at the city.
`;

const doc = parse(source);

console.log(doc.title.title);       // "LAST LIGHT"
console.log(doc.title.authors);      // ["Alex Chen"]
console.log(doc.scenes.length);      // 1
console.log(doc.sceneCount);         // 1
console.log(doc.characters);          // ["JOHN", "MARY"]
console.log(doc.panelCount);          // 1
```

## API Reference

### `parse(source: string): FountainDocument`

Parse a Fountain-formatted string into a structured document.

```ts
interface FountainDocument {
  tokens: FountainToken[];       // All parsed tokens in document order
  title: TitlePageData;          // Structured title page data
  titlePageRaw: Record<string, string>;  // Raw key:value pairs
  characters: string[];          // Unique character names (deduped)
  scenes: FountainToken[];      // Scene heading tokens
  sceneCount: number;            // Number of scenes
  panelCount: number;            // Number of comic panel markers
}
```

### Token Types

Each `FountainToken` has a `type` field:

| Type               | Description                              |
| ------------------ | ---------------------------------------- |
| `scene_heading`    | Scene heading (INT./EXT., forced, etc.)  |
| `action`           | Default action/narrative text            |
| `character`        | Character cue (before dialogue)          |
| `dialogue`         | Dialogue lines                           |
| `parenthetical`    | Parenthetical within dialogue             |
| `dual_dialogue`    | Dual-dialogue marker                     |
| `transition`       | CUT TO:, FADE OUT., etc.                 |
| `centered`         | >text< centered text                     |
| `section`          | Section headings (#, ###)                |
| `panel`            | Comic panel marker (##)                  |
| `synopsis`         | Synopsis/outline (= text)                |
| `note`             | Standalone note ([[text]])               |
| `page_break`       | Page break (=== or more)                 |
| `boneyard`         | Reserved (boneyard content is stripped)  |

```ts
interface FountainToken {
  type: FountainTokenType;
  text: string;
  line: number;              // 1-based line number
  character?: string;        // Normalized character name
  dual?: string;             // Dual-dialogue side
  depth?: number;            // Section depth (1-3)
  scene_number?: string;     // From #N# in scene heading
}
```

### Formatter Helpers

Generate Fountain-formatted strings from structured data:

```ts
import {
  formatTitlePage,
  formatSceneHeading,
  formatDialogue,
  formatTransition,
  formatParenthetical,
  formatCentered,
  formatNote,
  formatSection,
  formatPanel,
} from "@superheropw/fountain-js";

formatTitlePage({ title: "MY SCRIPT", authors: ["Jane Doe"] });
// "Title: MY SCRIPT\nAuthor: Jane Doe"

formatSceneHeading("INT. OFFICE - DAY");
// "INT. OFFICE - DAY"
formatSceneHeading("FLASHBACK", true);
// ".FLASHBACK"

formatDialogue("JOHN", ["Hello there.", "How are you?"]);
// "JOHN\nHello there.\nHow are you?"

formatDialogue("Jane Smith", ["Hi."]);
// "@Jane Smith\nHi."

formatTransition("CUT TO:");
// "CUT TO:"

formatParenthetical("whispering");
// "(whispering)"

formatCentered("THE END");
// ">THE END<"

formatNote("Check continuity");
// "[[Check continuity]]"

formatSection(1, "Act One");
// "# Act One"

formatPanel("Panel 1");
// "## Panel 1"
```

### `extractLocationName(sceneHeading: string): string`

Extracts a human-readable location name from a scene heading, stripping prefixes (INT./EXT.), time-of-day suffixes, and character extensions.

```ts
extractLocationName("INT. CITY STREET - NIGHT");
// "City Street"

extractLocationName("EXT. ROOFTOP - CONTINUOUS");
// "Rooftop"

extractLocationName(".FLASHBACK - THE OLD HOUSE");
// "Flashback - The Old House"
```

### `parseEmphasis(text: string): EmphasisSpan[]`

Parses Fountain inline formatting (bold, italic, underline combinations) into styled spans:

```ts
const spans = parseEmphasis("This is **bold** and *italic*.");
// [
//   { text: "This is " },
//   { text: "bold", bold: true },
//   { text: " and " },
//   { text: "italic", italic: true },
//   { text: "." }
// ]
```

Supported emphasis patterns:

| Syntax       | Style                                               |
| ------------ | --------------------------------------------------- |
| `*text*`     | Italic                                              |
| `**text**`   | Bold                                                |
| `_text_`     | Underline                                           |
| `***text***` | Bold + Italic                                       |
| `_**text**_` | Bold + Underline                                    |
| `_*text*_`   | Italic + Underline                                  |
| `_***text***_` | Bold + Italic + Underline                        |

Escaped characters: `\*` renders as `*`, `\_` renders as `_`.

---

## Fountain Syntax Reference

This library implements the [Fountain 1.1 specification](https://fountain.io/syntax/). Below is a quick reference of supported syntax.

### Title Page

```
Title: MY SCREENPLAY
Credit: Written by
Author: Jane Doe
Author: John Smith
Draft date: 2024-01-15
Genre: Thriller
Contact: jane@example.com
Copyright: 2024 Jane Doe
Source: Adapted from the novel
Notes: Final draft
Revision: Blue
```

Title page key-value pairs appear at the top of the file, separated from the body by a blank line.

### Scene Headings

```
INT. OFFICE - DAY
EXT. BEACH - SUNSET
EST. CITY SKYLINE - DAY
INT./EXT. CAR - DAY
I/E. HOUSE - NIGHT
```

Forced scene headings (no INT./EXT. prefix):

```
.FLASHBACK - THE OLD HOUSE
```

Scene numbers with `#N#`:

```
INT. OFFICE - DAY #42#
```

### Action (Default)

Any text that doesn't match another element type is treated as action:

```
A dark room. Shadows on the wall.
The door creaks open slowly.
```

### Character Cues & Dialogue

All-caps character name on its own line, followed by dialogue:

```
JOHN
I can't do this anymore.
```

Force a character name (for mixed-case or spaces):

```
@Jane Smith
Hello there.
```

Character with extension:

```
JOHN (V.O.)
On the phone we hear...
```

Dual dialogue (caret `^` after character name):

```
JOHN ^
I'm leaving.
                    MARY ^
You can't!
```

### Parentheticals

```
JOHN
(whispering)
Come closer.
```

### Transitions

```
CUT TO:
FADE OUT.
FADE TO BLACK.
>SMASH CUT TO:
```

### Centered Text

```
>THE END<
```

### Sections & Synopsis

```
# Act One
## Panel 1
### Sub-beat
= This is a synopsis/outline note.
```

> **Comic extension:** `##` headings are parsed as `panel` tokens instead of `section` tokens, supporting comic/script hybrid workflows.

### Notes (Inline & Block)

```
Action text [[this is a note]] continues here.
```

Standalone note blocks:

```
[[This is a standalone note]]
```

Inline notes are stripped from the parsed output. Standalone note blocks become `note` tokens.

### Page Breaks

```
===
```

(Three or more `=` characters on their own line.)

### Boneyard

Content between `/*` and `*/` is completely removed from the output:

```
/* This content is deleted and won't appear in the parsed document. */
```

### Emphasis (Inline Formatting)

| Syntax          | Style              |
| --------------- | ------------------ |
| `*italic*`     | Italic             |
| `**bold**`     | Bold               |
| `_underline_` | Underline          |
| `***bold italic***` | Bold + Italic |
| `_**bold underline**_` | Bold + Underline |
| `_*italic underline*_` | Italic + Underline |

Escaped: `\*` → `*`, `\_` → `_`

---

## Running Tests

```bash
npm test           # Run once
npm run test:watch # Watch mode
```

## License

MIT
## Used by

Powers the script engine in [superhero.pw](https://superhero.pw) — the series-first production workspace for comics and episodic storytelling — including the free [Fountain editor](https://app.superhero.pw/fountain-editor), the [Fountain → Markdown converter](https://app.superhero.pw/fountain-converter), and the [Script Analyzer](https://app.superhero.pw/script-analyzer) (all run in the browser, no account needed).

## License

MIT — see [LICENSE](LICENSE).
