/**
 * Splices the generated Game Guide into README.md between marker comments.
 * Usage: npm run readme:generate
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportGameGuideMarkdown } from '../src/utils/exportGameGuideMarkdown.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const README_PATH = join(ROOT, 'README.md');

const START_MARKER = '<!-- GAME_GUIDE:START -->';
const END_MARKER = '<!-- GAME_GUIDE:END -->';
const LEGACY_MARKER = '<!-- LEGACY_README -->';

const TOC = `## Table of Contents

- [Game Guide](#game-guide)
  - [1. Basics](#1-basics)
  - [2. Stats](#2-stats)
  - [3. Weapons](#3-weapons)
  - [4. Archetypes](#4-archetypes)
  - [5. Ancestors](#5-ancestors)
  - [6. Talents (Class Boons)](#6-talents-class-boons)
  - [7. Primary Boons](#7-primary-boons)
  - [8. Secondary Boons](#8-secondary-boons)
  - [9. Duo and Ultimate Boons](#9-duo-and-ultimate-boons)
  - [10. Portal Colors](#10-portal-colors)
  - [11. Aspects](#11-aspects)
  - [12. Spirit Animals](#12-spirit-animals)
  - [13. Run Progression](#13-run-progression)
  - [14. Enemies](#14-enemies)
  - [15. Items, Merchant & Economy](#15-items-merchant--economy)
- [Legacy README](#legacy-readme)
`;

const HEADER = `# 🌑  Erebus β

A cooperative 1-3 player 3D boss battle action game featuring fast-paced real-time combat with a unique weapon/class system and boss encounter mechanics, emphasizing tactical positioning, resource management and coordinated party strategies within a fantasy/sci-fi arena.
`;

function buildFirstRunReadme(legacyBody: string): string {
  const guide = exportGameGuideMarkdown();
  return [
    HEADER.trimEnd(),
    '',
    TOC.trimEnd(),
    '',
    START_MARKER,
    guide.trimEnd(),
    END_MARKER,
    '',
    '---',
    '',
    LEGACY_MARKER,
    '',
    '## Legacy README',
    '',
    legacyBody.trimEnd(),
    '',
  ].join('\n');
}

function spliceGuide(existing: string): string {
  const start = existing.indexOf(START_MARKER);
  const end = existing.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('README.md is missing GAME_GUIDE markers; expected a first-run wrap.');
  }

  const guide = exportGameGuideMarkdown();
  const before = existing.slice(0, start + START_MARKER.length);
  const after = existing.slice(end);
  return `${before}\n${guide.trimEnd()}\n${after}`;
}

function extractLegacyFromOldReadme(raw: string): string {
  // Drop the old H1 + pitch (replaced by HEADER); keep demos, screenshots, technical docs.
  const withoutTitle = raw.replace(/^#\s+[^\n]*\n+/, '');
  const pitchMatch = withoutTitle.match(
    /^A cooperative 1-3 player[\s\S]*?\n\n+/,
  );
  if (pitchMatch) {
    return withoutTitle.slice(pitchMatch[0].length).trimStart();
  }
  return withoutTitle.trimStart();
}

function main(): void {
  const raw = readFileSync(README_PATH, 'utf8');

  let next: string;
  if (raw.includes(START_MARKER) && raw.includes(END_MARKER)) {
    next = spliceGuide(raw);
    // Refresh TOC / header if present before the start marker
    if (!raw.includes('## Table of Contents')) {
      const start = next.indexOf(START_MARKER);
      next = `${HEADER}\n${TOC}\n${next.slice(start)}`;
    }
  } else {
    next = buildFirstRunReadme(extractLegacyFromOldReadme(raw));
  }

  writeFileSync(README_PATH, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  console.log(`Updated ${README_PATH}`);
}

main();
