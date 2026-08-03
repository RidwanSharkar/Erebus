/** Coop enemy type → uppercase nameplate label. */
export const ENEMY_DISPLAY_NAMES: Record<string, string> = {
  knight: 'KNIGHT',
  warlock: 'WARLOCK',
  weaver: 'WEAVER',
  shade: 'SHADE',
  ghoul: 'GHOUL',
  templar: 'TEMPLAR',
  viper: 'VIPER',
  colossus: 'COLOSSUS',
  'stone-giant': 'STONE GIANT',
  'eternal-oak': 'ETERNAL OAK',
  spectre: 'SPECTRE',
  assassin: 'ASSASSIN',
  shaman: 'SHAMAN',
  'frost-queen': 'FROST QUEEN',
  medusa: 'MEDUSA',
  'death-knight': 'DEATHKNIGHT',
  tiger: 'TIGER',
  'boss-tiger': 'TIGER',
  wolf: 'WOLF',
  'boss-wolf': 'WOLF',
  bear: 'BEAR',
  'boss-bear': 'BEAR',
  serpent: 'SERPENT',
  'boss-serpent': 'SERPENT',
  'bone-spider': 'RECLUSE',
  wyvern: 'WYVERN',
  terrorhawk: 'TERRORHAWK',
  // Bosses / elites
  boss: 'HATE',
  boss2: 'ENVY',
  boss3: 'FEAR',
  destiny: 'DESTINY',
  nemesis: 'NEMESIS',
  valkyrie: 'VALKYRIE',
  sentinel: 'SENTINEL',
  skyray: 'SKYRAY',
  wraith: 'WRAITH',
  martyr: 'MARTYR',
  greed: 'GREED',
  'player-zombie': 'ZOMBIE',
  // Titans (soul variants also resolved via TITAN_DISPLAY_NAMES in TitanRenderer)
  titan: 'TITAN',
  'storm-titan': 'STORM TITAN',
  'titan-of-mercy': 'TITAN OF MERCY',
  'titan-of-wrath': 'TITAN OF WRATH',
  'plague-titan': 'PLAGUE TITAN',
};

export function getEnemyDisplayName(type: string): string {
  const key = type.toLowerCase();
  return ENEMY_DISPLAY_NAMES[key] ?? key.replace(/-/g, ' ').toUpperCase();
}
