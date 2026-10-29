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
// ─── Regex patterns (Fountain 1.1 spec) ──────────────────────────────────
const regex = {
    /** Title page keys per Fountain spec */
    title_page: /^(title|credit|author[s]?|source|notes|draft date|date|contact|copyright|genre|revision)\s*:/im,
    /** Standard scene heading: INT./EXT./I/E./EST. prefix */
    scene_heading: /^(?:(?:int|ext|est|int\.\/ext|i\/e)\.?\s+.+)/i,
    /** Forced scene heading: starts with a single dot (not ellipsis) */
    scene_heading_forced: /^\.(?!\.+)/,
    /** Scene number: #Scene Number# */
    scene_number: /#(.+)#/,
    /** Transition: CUT TO:, FADE OUT., >TO:, etc. */
    transition: /^(?:fade\s+(?:to\s+black|out)|cut\s+to\s+black)\.|^(?:> *)?.+\s+to:$/im,
    /** Forced transition: starts with > */
    transition_forced: /^>\s*(?!=)(?!\[)/,
    /** Centered text: >text< */
    centered: /^>\s*(.+?)\s*<$/,
    /** Section heading: #, ##, ### */
    section: /^(#{1,3})\s+(.*)/,
    /** Synopsis: = text */
    synopsis: /^=\s+(.*)/,
    /** Standalone note: [[text]] */
    note: /^\[{2}(?!\[+)([\s\S]+?)\]{2}(?!\[+)$/,
    /** Inline note: [[text]] within other elements */
    note_inline: /\[{2}(?!\[+)([\s\S]+?)\]{2}(?!\[+)/g,
    /** Page break: === or more */
    page_break: /^={3,}$/,
    /** Line break: two spaces at end of line */
    line_break: / {2}$/m,
    /** Boneyard open/close */
    boneyard_open: /^\/\*/,
    boneyard_close: /\*\//,
    /** Character cue: ALL CAPS (optionally with extension), or @name */
    character: /^@(.+)|^([A-Z][A-Z0-9 \-_'.]*)(?:\s*\(([^)]+)\))?(\^)?$/,
    /** Parenthetical: (text) */
    parenthetical: /^\((.+)\)$/,
    /** Emphasis styles (Fountain inline formatting) */
    bold_italic_underline: /(?:_{1}\*{3}(?=.+\*{3}_{1})|\*{3}_{1}(?=.+_{1}\*{3}))(.+?)(?:\*{3}_{1}|_{1}\*{3})/g,
    bold_underline: /(?:_{1}\*{2}(?=.+\*{2}_{1})|\*{2}_{1}(?=.+_{1}\*{2}))(.+?)(?:\*{2}_{1}|_{1}\*{2})/g,
    italic_underline: /(?:_{1}\*{1}(?=.+\*{1}_{1})|\*{1}_{1}(?=.+_{1}\*{1}))(.+?)(?:\*{1}_{1}|_{1}\*{1})/g,
    bold_italic: /(?:\*{3}(?=.+\*{3}))(.+?)(?:\*{3})/g,
    bold: /(?:\*{2}(?=.+\*{2}))(.+?)(?:\*{2})/g,
    italic: /(?:\*{1}(?=.+\*{1}))(.+?)(?:\*{1})/g,
    underline: /(?:_{1}(?=.+_{1}))(.+?)(?:_{1})/g,
    /** Normalize line endings */
    standardizer: /\r\n|\r/g,
    /** Split blocks on blank lines */
    splitter: /\n{2,}/,
    /** Clean leading/trailing whitespace */
    cleaner: /^\n+|\n+$/g,
    /** Standardize indented character cues (3+ spaces or tab) */
    whitespacer: /^\t+|^ {3,}/gm,
};
// ─── Lexer ───────────────────────────────────────────────────────────────
/**
 * Pre-process raw source: normalize line endings, strip boneyard markers
 * onto their own lines, standardize whitespace for character cues.
 */
function lexer(script) {
    return script
        .replace(regex.standardizer, "\n")
        .replace(regex.cleaner, "")
        .replace(regex.whitespacer, "");
}
// ─── Tokenizer ──────────────────────────────────────────────────────────
/**
 * Split the pre-processed source into blocks separated by blank lines,
 * then classify each block by Fountain element type.
 */
function tokenize(script) {
    const src = lexer(script).split(regex.splitter).reverse();
    const tokens = [];
    let lineNum = 1;
    let dual = false;
    while (src.length) {
        const block = src.pop();
        lineNum += countNewlines(block);
        if (!block.trim())
            continue;
        // ── Title page ──
        if (regex.title_page.test(block)) {
            const entries = block.split(/\n/).filter((l) => l.trim());
            for (const entry of entries) {
                const colonIdx = entry.indexOf(":");
                if (colonIdx < 0)
                    continue;
                const key = entry.slice(0, colonIdx).trim();
                const value = entry.slice(colonIdx + 1).trim();
                tokens.push({
                    type: "title_page",
                    text: value,
                    line: lineNum,
                });
                tokens.push({
                    type: "title_page",
                    text: key.toLowerCase().replace(/ /g, "_"),
                    line: lineNum,
                }); // key stored as auxiliary token
            }
            continue;
        }
        // ── Scene heading ──
        if (regex.scene_heading.test(block) || regex.scene_heading_forced.test(block)) {
            let text = block.trim();
            if (text.startsWith("."))
                text = text.replace(/^\.\s*/, "");
            let sceneNumber;
            const snMatch = text.match(regex.scene_number);
            if (snMatch) {
                sceneNumber = snMatch[1];
                text = text.replace(regex.scene_number, "");
            }
            // Avoid false match: indented action that starts with INT./EXT. but
            // has content on the next line with no scene context
            if (text.length > 0 && !text.endsWith("  ")) {
                tokens.push({
                    type: "scene_heading",
                    text: text.trim(),
                    line: lineNum,
                    scene_number: sceneNumber,
                });
                continue;
            }
        }
        // ── Centered text ──
        {
            const match = block.trim().match(regex.centered);
            if (match) {
                tokens.push({
                    type: "centered",
                    text: match[1].trim(),
                    line: lineNum,
                });
                continue;
            }
        }
        // ── Transition ──
        if (regex.transition.test(block.trim())) {
            let text = block.trim();
            if (text.startsWith(">"))
                text = text.replace(/^>\s*/, "");
            tokens.push({
                type: "transition",
                text: text.trim(),
                line: lineNum,
            });
            continue;
        }
        // ── Dialogue block (character + parenthetical + dialogue) ──
        {
            // Split first line (character cue) from the rest
            const lines = block.split(/\n/);
            const firstLine = lines[0].trim();
            const charMatch = firstLine.match(regex.character);
            if (charMatch) {
                const charName = (charMatch[1] || charMatch[2]).trim();
                const extension = charMatch[3] || undefined;
                const isDual = !!charMatch[4];
                if (charName.length > 0 && !firstLine.endsWith("  ")) {
                    // Parse the rest of the block for dialogue / parenthetical lines
                    const remaining = lines.slice(1).join("\n").trim();
                    if (isDual) {
                        tokens.push({ type: "dual_dialogue", text: "", line: lineNum, dual: "end" });
                    }
                    tokens.push({ type: "dialogue", text: "", line: lineNum }); // dialogue_end marker
                    // Split dialogue content by parentheticals
                    const parts = remaining
                        .split(/(\(.+\)(?:\n)*)/)
                        .reverse()
                        .filter((p) => p.trim());
                    for (const part of parts) {
                        const trimmed = part.trim();
                        if (regex.parenthetical.test(trimmed)) {
                            tokens.push({
                                type: "parenthetical",
                                text: trimmed,
                                line: lineNum + 1,
                            });
                        }
                        else if (trimmed) {
                            tokens.push({
                                type: "dialogue",
                                text: trimmed,
                                line: lineNum + 1,
                                character: charName,
                            });
                        }
                    }
                    tokens.push({
                        type: "character",
                        text: extension ? `${charName} (${extension})` : charName,
                        character: charName,
                        line: lineNum,
                        dual: isDual ? (dual ? "left" : undefined) : undefined,
                    });
                    if (dual) {
                        tokens.push({ type: "dual_dialogue", text: "", line: lineNum, dual: "begin" });
                    }
                    dual = isDual;
                    continue;
                }
            }
        }
        // ── Section / Panel heading ──
        {
            const startMatch = block.trim().match(regex.section);
            if (startMatch) {
                // A block may contain several consecutive heading lines (e.g. a
                // section and its sub-panels written without blank lines) — emit one
                // token per heading line and hand any remaining content back to the
                // block stack for normal classification.
                const lines = block.trim().split(/\n/);
                let consumed = 0;
                for (const line of lines) {
                    const headingMatch = line.trim().match(regex.section);
                    if (!headingMatch)
                        break;
                    const depth = headingMatch[1].length;
                    const headingText = headingMatch[2].trim();
                    // ## is a comic panel marker
                    tokens.push({
                        type: depth === 2 ? "panel" : "section",
                        text: headingText,
                        depth,
                        line: lineNum,
                    });
                    consumed++;
                }
                if (consumed > 0) {
                    const rest = lines.slice(consumed).join("\n").trim();
                    if (rest)
                        src.push(rest); // stack top = next popped block
                    continue;
                }
            }
        }
        // ── Synopsis ──
        {
            const match = block.trim().match(regex.synopsis);
            if (match) {
                tokens.push({
                    type: "synopsis",
                    text: match[1].trim(),
                    line: lineNum,
                });
                continue;
            }
        }
        // ── Note (standalone block) ──
        if (regex.note.test(block.trim())) {
            const match = block.trim().match(regex.note);
            if (match) {
                tokens.push({
                    type: "note",
                    text: match[1].trim(),
                    line: lineNum,
                });
                continue;
            }
        }
        // ── Page break ──
        if (regex.page_break.test(block.trim())) {
            tokens.push({
                type: "page_break",
                text: "===",
                line: lineNum,
            });
            continue;
        }
        // ── Default: Action ──
        tokens.push({
            type: "action",
            text: block.trim(),
            line: lineNum,
        });
    }
    return tokens;
}
// ─── Title page builder ──────────────────────────────────────────────────
function buildTitlePage(tokens) {
    const rawPairs = {};
    // Title page tokens come in pairs: value then key (from the tokenizer)
    let i = 0;
    while (i < tokens.length && tokens[i].type === "title_page") {
        const value = tokens[i].text;
        i++;
        if (i < tokens.length && tokens[i].type === "title_page") {
            const key = tokens[i].text;
            if (!rawPairs[key])
                rawPairs[key] = [];
            rawPairs[key].push(value);
            i++;
        }
        else {
            break;
        }
    }
    // Flatten: single values stay as string, multiple values become arrays
    const raw = {};
    for (const [key, values] of Object.entries(rawPairs)) {
        if (values.length === 1) {
            raw[key] = values[0];
        }
        else {
            raw[key] = values.join(", ");
        }
    }
    const title = { ...raw };
    // Normalize authors: always produce an array when author keys exist
    const authorKeys = Object.keys(rawPairs).filter((k) => k.startsWith("author"));
    if (authorKeys.length > 0) {
        title.authors = authorKeys.flatMap((k) => rawPairs[k]);
    }
    // Remap common key variants
    if (raw["draft_date"]) {
        title.draftDate = raw["draft_date"];
        delete title["draft_date"];
    }
    return { title, raw };
}
// ─── Main parse function ────────────────────────────────────────────────
/**
 * Parse a Fountain-formatted string into a structured document.
 *
 * ```ts
 * import { parse } from "@superheropw/fountain-js";
 * const doc = parse(fountainSource);
 * ```
 */
export function parse(source) {
    // Handle boneyard blocks — strip them from the source but keep them as
    // `boneyard` tokens (their line is relative to the pre-strip source).
    const boneyardMatches = [];
    {
        let cleaned = source.replace(regex.standardizer, "\n");
        const re = /\/\*[\s\S]*?\*\//g;
        let m;
        while ((m = re.exec(cleaned))) {
            boneyardMatches.push({
                line: cleaned.slice(0, m.index).split("\n").length,
                text: m[0].replace(/^\/\*/, "").replace(/\*\/$/, "").trim(),
            });
        }
    }
    // Handle boneyard blocks first — remove them from the source
    let cleaned = source;
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ""); // strip boneyard blocks
    // Process inline notes (non-standalone): replace [[...]] that are NOT on their own line
    // Standalone note blocks (entire block is [[...]]) are preserved for tokenizer
    const inlineNoteMatches = [];
    cleaned = cleaned.replace(/\[\[(?!\[)([\s\S]+?)\]\](?!\])/gm, (match, inner, offset) => {
        // Check if this note is standalone (its own paragraph)
        const before = cleaned.slice(Math.max(0, offset - 2), offset);
        const after = cleaned.slice(offset + match.length, offset + match.length + 2);
        const isStandalone = (before === '' || /\n/.test(before)) && (after === '' || /^\n/.test(after));
        if (isStandalone)
            return match;
        inlineNoteMatches.push({
            line: cleaned.slice(0, offset).split("\n").length,
            text: inner.trim(),
        });
        return '';
    });
    const rawTokens = tokenize(cleaned);
    // Build title page from tokens
    const { title, raw: titlePageRaw } = buildTitlePage(rawTokens);
    const tokens = rawTokens.filter((t) => t.type !== "title_page");
    if (boneyardMatches.length || inlineNoteMatches.length) {
        // Insert hidden-content tokens at their original positions (stable merge:
        // relative order of regular tokens is preserved; hidden tokens are placed
        // before the first token whose line is later than the hidden block's).
        for (const hidden of [...boneyardMatches.map((h) => ({ ...h, type: "boneyard" })), ...inlineNoteMatches.map((h) => ({ ...h, type: "note" }))]) {
            const token = ({ type: hidden.type, text: hidden.text, line: hidden.line });
            const insertAt = tokens.findIndex((t) => t.line >= hidden.line);
            if (insertAt === -1)
                tokens.push(token);
            else
                tokens.splice(insertAt, 0, token);
        }
    }
    // Extract characters
    const characters = [];
    const charSet = new Set();
    for (const tok of tokens) {
        if (tok.type === "character" && tok.character) {
            if (!charSet.has(tok.character)) {
                charSet.add(tok.character);
                characters.push(tok.character);
            }
        }
    }
    // Extract scenes
    const scenes = tokens.filter((t) => t.type === "scene_heading");
    return {
        tokens,
        title,
        titlePageRaw,
        characters,
        scenes,
        sceneCount: scenes.length,
        panelCount: tokens.filter((t) => t.type === "panel").length,
    };
}
// ─── Formatter helpers ─────────────────────────────────────────────────
/**
 * Generate a Fountain title page block from structured data.
 */
export function formatTitlePage(data) {
    const lines = [];
    if (data.title)
        lines.push(`Title: ${data.title}`);
    if (data.credit)
        lines.push(`Credit: ${data.credit}`);
    const authors = data.authors || (data.author ? [data.author] : []);
    for (const a of authors)
        lines.push(`Author: ${a}`);
    if (data.source)
        lines.push(`Source: ${data.source}`);
    if (data.notes)
        lines.push(`Notes: ${data.notes}`);
    if (data.draftDate)
        lines.push(`Draft date: ${data.draftDate}`);
    if (data.contact)
        lines.push(`Contact: ${data.contact}`);
    if (data.copyright)
        lines.push(`Copyright: ${data.copyright}`);
    if (data.genre)
        lines.push(`Genre: ${data.genre}`);
    return lines.join("\n");
}
/**
 * Generate a Fountain scene heading.
 * Use `forced = true` for non-standard headings (no INT./EXT. prefix).
 */
export function formatSceneHeading(text, forced = false) {
    if (forced)
        return `.${text}`;
    return text.toUpperCase();
}
/**
 * Generate a Fountain-formatted dialogue block for a given character.
 * Names with spaces or mixed casing are @-forced per Fountain spec.
 */
export function formatDialogue(characterName, lines) {
    const needsForce = /[a-z]/.test(characterName) || /\s/.test(characterName);
    const cue = needsForce ? `@${characterName}` : characterName.toUpperCase();
    return `${cue}\n${lines.join("\n")}`;
}
/**
 * Format a Fountain transition.
 */
export function formatTransition(text) {
    return text.toUpperCase();
}
/**
 * Format a parenthetical in dialogue.
 */
export function formatParenthetical(text) {
    return `(${text})`;
}
/**
 * Format a centered line.
 */
export function formatCentered(text) {
    return `>${text}<`;
}
/**
 * Format a Fountain note.
 */
export function formatNote(text) {
    return `[[${text}]]`;
}
/**
 * Format a section heading (depth 1 or 3). Depth 2 uses formatPanel.
 */
export function formatSection(depth, text) {
    return `${"#".repeat(depth)} ${text}`;
}
/**
 * Format a panel marker (## heading in comic/screenplay context).
 */
export function formatPanel(text) {
    return `## ${text}`;
}
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
export function extractLocationName(sceneHeading) {
    let text = sceneHeading.replace(/^\.\s*/, "");
    text = text.replace(/^(?:INT\.\/EXT\.|I\/E\.|INT\.|EXT\.|EST\.)\s*/i, "");
    const timeWords = "DAY|NIGHT|CONTINUOUS|SAME TIME|MORNING|AFTERNOON|EVENING|DAWN|DUSK|SUNSET|SUNRISE|MOMENTS LATER|LATER|ANOTHER DAY|FLASHBACK|FLASH FORWARD|INSERT|INTERCUT";
    const timeRegex = new RegExp(`\\s*-\\s*(?:${timeWords})(?:\\s+-\\s*(?:${timeWords})|(?:\\([^)]+\\)))*\\s*$`, "i");
    text = text.replace(timeRegex, "");
    text = text.replace(/\s+\((?:V\.O\.|O\.S\.|O\.C\.|OFF)\)\s*$/i, "");
    const result = text.trim();
    if (!result)
        return sceneHeading.trim();
    if (result === result.toUpperCase() && result.includes(" ")) {
        return result
            .toLowerCase()
            .replace(/\b(\w)/g, (c) => c.toUpperCase());
    }
    return result;
}
/**
 * Parse emphasis (bold, italic, underline) from Fountain inline text.
 * Returns an array of styled spans.
 */
export function parseEmphasis(text) {
    const styles = [
        { re: regex.bold_italic_underline, type: "bold_italic_underline" },
        { re: regex.bold_underline, type: "bold_underline" },
        { re: regex.italic_underline, type: "italic_underline" },
        { re: regex.bold_italic, type: "bold_italic" },
        { re: regex.bold, type: "bold" },
        { re: regex.italic, type: "italic" },
        { re: regex.underline, type: "underline" },
    ];
    // Remove literal escaped chars
    let s = text
        .replace(/\\\*/g, "[star]")
        .replace(/\\_/g, "[underline]");
    let result = [{ text: s }];
    for (const { re, type } of styles) {
        result = result.flatMap((span) => {
            if (!span.text)
                return [span];
            const parts = [];
            let lastIndex = 0;
            let m;
            const globalRe = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
            while ((m = globalRe.exec(span.text)) !== null) {
                // Text before match
                if (m.index > lastIndex) {
                    parts.push({ text: span.text.slice(lastIndex, m.index), bold: span.bold, italic: span.italic, underline: span.underline });
                }
                // The matched emphasis text
                const inner = m[1] || m[0];
                parts.push({
                    text: inner,
                    bold: type.includes("bold") || !!span.bold,
                    italic: type.includes("italic") || !!span.italic,
                    underline: type.includes("underline") || !!span.underline,
                });
                lastIndex = m.index + m[0].length;
            }
            if (lastIndex < span.text.length) {
                parts.push({ text: span.text.slice(lastIndex), bold: span.bold, italic: span.italic, underline: span.underline });
            }
            return parts.length > 0 ? parts : [span];
        });
    }
    // Restore escaped chars
    for (const span of result) {
        span.text = span.text
            .replace(/\[star\]/g, "*")
            .replace(/\[underline\]/g, "_");
    }
    return result;
}
// ─── Utility ────────────────────────────────────────────────────────────
function countNewlines(text) {
    let count = 0;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === "\n")
            count++;
    }
    return count;
}
