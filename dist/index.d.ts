/**
 * @superheropw/fountain-js
 *
 * Fountain screenplay parser and formatter.
 * Implements the Fountain 1.1 spec (https://fountain.io/syntax/)
 * with extensions for comic panel markers (## headings).
 *
 * Inspired by Fountain.js by Matt Daly (https://github.com/mattdaly/Fountain.js/)
 *
 * ## Quick-start
 *
 * ```ts
 * import { parse } from "@superheropw/fountain-js";
 * const doc = parse(sourceText);
 * console.log(doc.title.title);     // title page "Title:" value
 * console.log(doc.scenes.length);   // number of scene headings
 * console.log(doc.characters);      // unique character names
 * ```
 */
export type FountainTokenType = "title_page" | "scene_heading" | "action" | "character" | "parenthetical" | "dialogue" | "dual_dialogue" | "transition" | "centered" | "section" | "panel" | "synopsis" | "page_break" | "note" | "boneyard" | "line_break";
export interface FountainToken {
    type: FountainTokenType;
    text: string;
    /** 1-based line number */
    line: number;
    /** For character tokens: the normalized character name */
    character?: string;
    /** Dual-dialogue side: 'left' | 'right' */
    dual?: string;
    /** Section depth (1-3) */
    depth?: number;
    /** Scene number (from #N# in scene heading) */
    scene_number?: string;
}
export interface TitlePageData {
    title?: string;
    credit?: string;
    authors?: string[];
    source?: string;
    notes?: string;
    draftDate?: string;
    date?: string;
    contact?: string;
    copyright?: string;
    genre?: string;
    revision?: string;
    /** Any other key:value pairs from the title page */
    [key: string]: string | string[] | undefined;
}
export interface FountainDocument {
    /** All parsed tokens in document order */
    tokens: FountainToken[];
    /** Structured title page data */
    title: TitlePageData;
    /** Raw title page key:value pairs (preserves original keys) */
    titlePageRaw: Record<string, string>;
    /** Unique character names (normalized, deduped) */
    characters: string[];
    /** Scene heading tokens */
    scenes: FountainToken[];
    /** Number of scenes */
    sceneCount: number;
    /** Number of comic panel markers (## headings) */
    panelCount: number;
}
export interface EmphasisSpan {
    type: "bold" | "italic" | "underline" | "bold_italic" | "italic_underline" | "bold_underline" | "bold_italic_underline";
    text: string;
}
/**
 * Parse a Fountain-formatted string into a structured document.
 *
 * ```ts
 * import { parse } from "@superheropw/fountain-js";
 * const doc = parse(fountainSource);
 * ```
 */
export declare function parse(source: string): FountainDocument;
/**
 * Generate a Fountain title page block from structured data.
 */
export declare function formatTitlePage(data: TitlePageData): string;
/**
 * Generate a Fountain scene heading.
 * Use `forced = true` for non-standard headings (no INT./EXT. prefix).
 */
export declare function formatSceneHeading(text: string, forced?: boolean): string;
/**
 * Generate a Fountain-formatted dialogue block for a given character.
 * Names with spaces or mixed casing are @-forced per Fountain spec.
 */
export declare function formatDialogue(characterName: string, lines: string[]): string;
/**
 * Format a Fountain transition.
 */
export declare function formatTransition(text: string): string;
/**
 * Format a parenthetical in dialogue.
 */
export declare function formatParenthetical(text: string): string;
/**
 * Format a centered line.
 */
export declare function formatCentered(text: string): string;
/**
 * Format a Fountain note.
 */
export declare function formatNote(text: string): string;
/**
 * Format a section heading (depth 1 or 3). Depth 2 uses formatPanel.
 */
export declare function formatSection(depth: 1 | 2 | 3, text: string): string;
/**
 * Format a panel marker (## heading in comic/screenplay context).
 */
export declare function formatPanel(text: string): string;
/**
 * Extract location name from a scene heading.
 *
 * Strips INT./EXT. prefix, time-of-day suffixes, and character extensions.
 * Converts ALL-CAPS location names to title case.
 *
 * Examples:
 *  INT. CITY STREET - NIGHT → "City Street"
 *  EXT. ROOFTOP - CONTINUOUS → "Rooftop"
 *  .FLASHBACK - THE OLD HOUSE → "Flashback - The Old House"
 */
export declare function extractLocationName(sceneHeading: string): string;
/**
 * Parse emphasis (bold, italic, underline) from Fountain inline text.
 * Returns an array of styled spans.
 */
export declare function parseEmphasis(text: string): Array<{
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
}>;
