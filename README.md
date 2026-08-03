# 🌑  Erebus β

A cooperative 1-3 player 3D boss battle action game featuring fast-paced real-time combat with a unique weapon/class system and boss encounter mechanics, emphasizing tactical positioning, resource management and coordinated party strategies within a fantasy/sci-fi arena.

## Table of Contents

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

<!-- GAME_GUIDE:START -->
## Game Guide

Player-facing reference generated from the same data as the in-game Rulebook. Regenerate with `npm run readme:generate`.

### 1. Basics

#### Health

You start with 200 HP. Each level grants +20 max HP. Each point of STAMINA grants +10 max HP. Health is depleted after your shield is broken.

#### Shields

Base max shield is 25. Each point of INTELLECT grants +3 max shield. Shields absorb damage before health and regenerate after a short delay when you stop taking damage.

#### Dash Charge

You have 3 dash charges. Each charge recharges in 8 seconds. Double-tap W, A, S, or D to dash in that direction. Some talents and boons consume or restore dash charges.

#### Energy

Energy starts at 100. It drains while sprinting or channeling archetype powers (Shift), then regenerates after about 2 seconds of idle. Without energy, sprint and energy-gated Shift abilities stop.

#### Controls

- WASD — Move
- Double-tap WASD — Dash (consumes a dash charge)
- Left click — Primary attack
- Right click — Camera
- Space — Jump
- Q / E / R / F — Abilities (loadout-dependent)
- Shift — Archetype power (sprint, deflect, channel, etc.)
- X — Interact (weapons, pillars, pedestals, allies, runes)
- 1 / 2 — Swap primary / secondary weapon when slots differ

### 2. Stats

- **STRENGTH** — +4% critical strike damage per point
- **STAMINA** — +10 maximum health per point
- **AGILITY** — +1% critical strike chance per point
- **INTELLECT** — +3 maximum shield per point

Base critical chance is 11%. Base critical damage multiplier is 2.0×. Leveling grants +5 STAT points each level. Spend them in the Stats panel. Enemies may drop STAT runes (press X to collect).

### 3. Weapons

In the throne room, stand by a floating weapon and press X to equip it. Use the ability pillar (X) to assign Q, E, and R from the shared ability pool. Boons you pick stack for the rest of the run.

#### Runeblade

*Arcane runeblade — combo melee with smite and void grasp.*

**Left-click** — Melee combo chain — three hits that escalate in power.

- **Q** — **Wraith Strike**: A swift strike that briefly applies SLOW and TAUNT to enemies hit. 5 second cooldown.
- **E** — **Colossus Strike**: Calls down a pillar of radiant energy, dealing damage to enemy players in a small area, healing you for 10 HP. 8 second cooldown.
- **R** — **Death Grasp**: Launch a spectral claw that grabs an enemy, dealing 80 damage and TAUNTING them. Non-elite enemies are pulled in front of you.

#### Sabres

*Frost dual blades — flurries, shadow step, and skyfall.*

**Left-click** — Fast dual-blade flurry with stacking pressure on the same target.

- **Q** — **Backstab**: Strikes through enemies, dealing massive bonus damage if attacking the target from behind. 4 second cooldown.
- **E** — **Flourish**: Unleash a flurry of close-range slashes. Applies a 4 second STUN to enemies that are hit by this ability a third time. 1.5 second cooldown.
- **R** — **Divebomb**: Leap into the air and crash down, dealing 125 damage and applying STUN for 2 seconds to enemies caught below. 8 second cooldown.

#### Bow

*Elemental bow — charged shots and ethereal volleys.*

**Left-click** — Hold left-click to charge a shot. Release while the bow flashes for a Perfect Shot.

- **Q** — **Frostbite**: Fires 5 arrows in an arc. An enemy can be hit by multiple arrows at close range. 8 second cooldown.
- **E** — **Reaping Talons**: Fires a powerful piercing arrow that returns to you. Each hit heals you for 2 HP each when orbs are returned. 7 second cooldown.
- **R** — (unlocked later / empty by default)

#### Scythe

*Chaos scythe — mantra, sunwell, and cryoflame.*

**Left-click** — Hold left-click to fire Entropic Bolts in a stream (or Icebeam if that talent is active).

- **Q** — **Mantra**: Summons a totem that lasts for 8 seconds that blasts nearby enemies within range. 7 second cooldown
- **E** — **Crossentropy**: Charges for 1 second to fire an accelerating plasma bolt that explodes on impact. 8 second cooldown.
- **R** — (unlocked later / empty by default)

### 4. Archetypes

Choose an archetype from a west-rim pedestal in the throne room (press X). **Shift** activates its power.

- **Rogue** — Hold Shift to sprint.

- **Gladiator** — Press Shift to deflect.

- **Acolyte** — Hold Shift to channel Locusts.

- **Alchemist** — Toggle Shift to activate Prime Materia.

- **Sorceress** — Hold Shift to charge Incineration. Left-click to fire. Over 90 charge becomes Plasma, draining shield for bonus damage and forward lightning bolts. 2s cooldown after firing.

### 5. Ancestors

During the intro fountain phase you are offered ancestor candidates. Press X near one to recruit them as your allied companion for the run.

#### Knight

*Melee Guardian* — 500 HP · 50 Melee Damage · ~1.4s Attack Speed · Colossus Smite AoE

A stalwart frontline ally who draws enemy attention, cleaves nearby foes, and unleashes a devastating AoE smite when charged.

#### Huntress

*Ranged Marksman* — 450 HP · 65 Piercing Damage · 1.0s Attack Speed · 20 Range

An agile archer who actively hunts targets within range and favors shots that pierce through multiple enemies for maximum damage.

#### Phantom

*Shadow Assassin* — 400 HP · 40 Dagger Damage · 4.0s Blink Combo · 10 Range

A specialist who follows you until foes draw near, then blinks in and hurls a volley of golden daggers.

#### Demon

*Aggressive Hunter* — 500 HP · 48 Melee Damage · 900ms Attack Speed · Leap Stun

A relentless melee hunter that actively seeks out enemies, closes with a crushing leap, and tears through the front line.

#### Enchantress

*Nature Caster* — 400 HP · 105 Earth Shock · 2.25 Move Speed · Grasping Vines Root

A spellcaster who stays close to you, hurls earth-shock bolts at nearby foes, and roots enemies with grasping vines.

### 6. Talents (Class Boons)

Class talents are offered as 1-of-3 picks when you equip a weapon in the throne room, after clearing a boss (red void portal), from some merchant purchases, and certain deep sanctum rewards. You get one throne class-boon pick per weapon equipped that run.

#### Runeblade

- **Trinity** — Smite consumes up to two available DASH CHARGES to call up to two additional strikes at nearby points during the same cast.
- **Vengeance** — Smite deals increased damage based on how much health you are missing. The lower your health, the more damage each beam deals, up to +200% extra damage.
- **Crusader** — Each Runeblade basic attack that damages an enemy has a 20% chance to grant +50 base damage to each attack for 5 seconds.
- **Windfury** — Each Runeblade basic attack that damages an enemy has a 15% chance to grant 30% additional ATTACK SPEED for 5 seconds. While Windfury is active, each basic attack also heals you for 3 HP.
- **Blizzard** — Each Runeblade basic attack that damages an enemy has a 20% chance to spawn a BLIZZARD around you for 7 seconds, dealing 42 + 1 damage per Strength, Stamina, Intellect, or Agility every 0.5 seconds to enemies within. Each tick applies CHILL; at 5 stacks the target is FROZEN for 6 seconds.
- **Death Knight** — Wraith Strike now holds 2 charges for use.
- **Spellblade** _(INT)_ — Wraith Strike now deals +3 base damage per point of INTELLECT. Hitting an enemy with Wraith Strike restores 36 SHIELD. Permanent grants +10 INTELLECT.
- **Cyclone Rush** — Double-tapping W to dash forward performs a whirlwind spin with your Runeblade, dealing damage to enemies 4 times.
- **Aftershock** — When you cast Wraith Strike, scorch the ground in a line in front of you. After 1 second, the strip erupts in flame pillars, dealing 125 damage to all enemies in the area.
- **Mortal Strike** — Every 4th Runeblade left-click attack unleashes a sweeping arc slash that deals 145 damage to enemies in front of you, in addition to the normal combo hit.
- **Executioner** _(STR)_ — After a DASH, your next Runeblade basic attack (left-click) within 4 seconds resolves as the third combo hit and deals +70 + 3 base damage per STRENGTH.
- **Titan's Grip** — Modifies Runeblade left-click: +2 base damage per Strength on each combo strike. Each strike that damages an enemy has a 25% chance to STUN that enemy for 1.5 seconds. Permanently shifts blade and slash VFX from blue to red (Crusader proc still overrides temporarily).

#### Sabres

- **Relentless** _(STA)_ — Killing an enemy with Backstab fully resets Backstab cooldown and heals you for 30 + 5 HP per point of STAMINA.
- **Killstreak** — Each enemy kill with Backstab grants +20 permanent base damage to Backstab.
- **Crescent Flare** — Every 3rd Sabres basic attack unleashes a crescent slash that deals 150 damage to all enemies in the arc in front of you, in addition to the normal dual-blade hit.
- **Vorpal Gust** — Backstab becomes a piercing wind gust up to 5.65 units in a line forward, hitting every enemy in its path. Targets in the gust tip (~2 units at max range) take higher base Backstab tiers: frontal 333 (vs 333), positional stab 666 (vs 666) on PvE.
- **Fan of Knives** _(AGI)_ — Flourish now fires 3 daggers in a forward fan for 25 + 3 damage per point of AGILITY each.
- **Parry** — Flourish restores 35 shield when cast. Permanently grants +10 INTELLECT and +10 STRENGTH.
- **Wind Shear** _(STR)_ — Every Sabres basic attack fires a wind slash projectile that travels forward, dealing 36 + 3 damage per point of STRENGTH to the first enemy it strikes.
- **Assassin** — Backstab now holds 2 charges for use.
- **Psionic Blades** _(INT)_ — Each Sabres basic attack hit (left and right) deals an additional 10 + 2 damage per point of INTELLECT.
- **Fire Affinity** — Flourish erupts in a brief violent firestorm around you, dealing 100 + 2 damage per point of STRENGTH, AGILITY, STAMINA, and INTELLECT to all enemies within 5.5 units. Applies IGNITE, dealing 80% of the impact damage over 4 seconds. (3s internal cooldown.)

#### Bow

- **Tempest Rounds** _(PASSIVE)_ — Replaces the Bow's basic attack with a rapid three round burst attack.
- **Dual Coil** — Bow basic attacks now launch two projectiles at once, side by side.
- **Execute** — Reaping Talons' forward arrow hit consumes one available DASH CHARGE to deal an additional 200 damage.
- **Concentrated Volley** — Frostbite fires all five arrows in a straight line forward instead of spreading out.
- **Explosive Talons** — Reaping Talons' forward shot no longer returns. When the shot reaches maximum range, it explodes in a small area for 400 damage.
- **Giantkiller** — Reaping Talons' return shot deals additional damage equal to 15% of the target's maximum health (10% on bosses).
- **High Caliber** — Bow left-click takes 1.5× as long to reach full charge. Perfect Shots and fully charged shots deal double base damage (+3 / +2 base damage per STRENGTH respectively).
- **Quick Draw** — Partial and uncharged basic attacks gain +50 base damage and +2 base damage per AGILITY (does not apply to Perfect Shots or fully charged shots).
- **Entanglement** — Each Frostbite arrow hit Entangles its target for 5 seconds: the target cannot move, but can still cast, attack, dash, and blink. Green roots squeeze the target for 20 damage per second.
- **Cloudkill** — Bow basic attacks have a 20% chance on each enemy hit to rain 4–8 poison arrows onto that enemy. Each arrow deals 35 damage to enemies in the impact area.
- **Wyvern Sting** _(INT)_ — When you release a Perfect Shot, you also fire a venemous arrow that applies VENOM to enemies hit, dealing 29 + 3 damage per INTELLECT per second for 6 seconds. Enemmies killed by VENOM raise an infested ZOMBIE ally.
- **Falcon Aspect** — Reaping Talons now holds 2 charges for use.

#### Scythe

- **Particle Beam** _(PASSIVE)_ — Replaces the Scythe's basic attack with a channeled Particle Beam that gets stronger the longer it is held. The beam has an 8 second cooldown if overloaded..
- **Reaper** — Crossentropy travels to full range and pierces through all enemies in its path.Each enemy hit by the bolt heals you for 2 HP. Killing an enemy with Crossentropy grants +5 permanent base damage.
- **Shaman** — Mantra now holds 2 charges for use.
- **Frostpath** — Each Entropic Bolt hit has a 20% chance to trigger a FROST NOVA burst centered on that enemy that applies FREEZE for 4 seconds. Cannot occur more than once every 2.5 seconds.
- **Solar Recharge** — Each Entropic Bolt hit has a 15% chance to trigger Sunwell that HEALS you and nearby allies for 15 HP. Cannot occur more than once every 2.5 seconds.
- **Superconductor** — Mantra Totems now continuiously zaps targets with lightning for 90 damage.
- **Accelerator** — Crossentropy recharges faster for each nearby Totem. Each Totem in range doubles the recharge rate of Crossentropy, up to 6 seconds faster.
- **Healing Stream** — You heal 2 HP per second for each of your Totems within range.
- **Meteor** _(STR)_ — Crossentropy now calls down 1 meteor, with a 15% chance to call a second and a 5% chance to call a third, dealing 240 base damage to enemies in the area. Meteors apply IGNITE, dealing bonus damage equal to 80% of the impact damage plus 2% per point of INTELLECT over 4 seconds.
- **Fragmentation** — Entropic Bolts and Crossentropy now ricochets to the next nearest enemy, then have a 50% chance to bounce to a third target and a 30% chance to bounce to a fourth.
- **Arcane Synergy** _(INT)_ — Entropic Bolts gain +2 base damage per point of INTELLECT and fire 30% faster.

### 7. Primary Boons

Each run has four mutually exclusive primary slots: Left-Click, Q, E, and Dash. Picking one colored variant for a slot locks out the other variants of that slot for the rest of the run. Primary ability-branch boons come from colored combat rooms (red / blue / green / purple).

#### Bow

##### Left-Click

*Primary shot modifiers (+ Wyvern Sting from green rooms)*

- **Charged Shots** — Bow basic attacks apply STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Arctic Sting** — The first enemy hit by Perfect Shot spawns a concentrated BLIZZARD that deals 30 damage every 0.5 seconds to enemies within. Each tick applies CHILL; at 5 stacks the target is FROZEN for 6 seconds.
- **Wrathful Shots** — Perfectly-timed basic attacks now gain +40% critical strike chance and +50% critical strike damage.
- **Wyvern Sting** — When you release a Perfect Shot, you also fire a venemous arrow that applies VENOM to enemies hit, dealing 29 + 3 damage per INTELLECT per second for 6 seconds. Enemmies killed by VENOM raise an infested ZOMBIE ally.

##### Q — Frostbite

*Bite modifiers (requires Frostbite on Q)*

- **Wyvern Bite** — Each Frostbite arrow hit now applies Concentrated VENOM: 31 damage per second per stack (max 5 stacks) over 8 seconds.
- **Wrathful Bite** — Frostbite arrows gain +40% critical strike chance and +40% critical strike damage.
- **Staggering Bite** — Each Frostbite arrow hit now applies STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Glacial Bite** — Each Frostbite (Q) arrow hit now applies 1 stack of CHILL; at 5 stacks the target is FROZEN for 6 seconds.

##### E — Reaping Talons

*Talons modifiers (requires Reaping Talons)*

- **Wyvern Talons** — Reaping Talons (E) now detonates active VENOM, dealing all remaining DoT damage and instantly ending the effect. Reaping Talons and detonation kills raise an infested ZOMBIE ally for 30s (max 3).
- **Wrathful Talons** — Reaping Talons' backward return arrow gains +50% critical strike chance and +100% critical strike damage.
- **Storm Talons** — Reaping Talons' (E) forward and return hits each apply STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Glacial Talons** — Spawns a concentrated BLIZZARD on the first enemy hit, dealing 30 damage every 0.5 seconds to enemies within. Each tick applies CHILL; at 5 stacks the target is FROZEN for 6 seconds. Reaping Talons now deals double damage to FROZEN enemies.

#### Runeblade

##### Left-Click — Combo

*Basic attack combo branch*

- **Infested Combo** — Your Runeblade basic attacks now heal you for 10% of damage dealt and have a 30% chance per hit to apply 1 stack of Concentrated Venom. Killing an enemy with these attacks raises a ZOMBIE ally for 30s (max 3).
- **Wrathful Combo** — Your Runeblade basic attacks now gain +50% critical strike chance and +125% critical strike damage on the third hit of the combo.
- **Charged Combo** — Your Runeblade basic attacks now apply stagger. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Guard Combo** — Your Runeblade basic attacks have a 35% chance per enemy hit to grant 3 seconds of Aegis INVULNERABILITY.

##### Q — Wraith Strike

*Strike modifiers (requires Wraith Strike)*

- **Infested Strike** — Wraith Strike gains increased base damage and applies 1 stack of Concentrated Venom per hit; killing an enemy with Wraith Strike raises a ZOMBIE ally for 30s (max 3).
- **Wrathful Strike** — Wraith Strike gains +20% critical strike chance and +50% critical strike damage.
- **Storm Strike** — Wraith Strike now applies stagger to enemies. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Wraith Guard** — Wraith Strike now grants 2 seconds of Aegis INVULNERABILITY when it hits an enemy.

##### E — Colossus Smite

*Smite modifiers (requires Colossus Smite)*

- **Infested Smite** — Each Smite beam heals you for 5 health per enemy hit by that beam. Killing an enemy with Smite raises a ZOMBIE ally for 30s (max 3)..
- **Infernal Smite** — Each Smite beam gains +50% critical strike chance and applies IGNITE: dealing bonus damage equal to 80% of that beam’s hit damage over 4 seconds.
- **Tempest Smite** — Each Smite beam applies stagger to enemies hit by that beam. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Colossus Guard** — Hitting an enemy with Smite now grants Aegis INVULNERABILITY for 3 seconds per beam hit.

#### Scythe

##### Left-Click — Entropic

*Entropic bolt / beam branch*

- **Wrathful Bolts** — Entropic Bolts gain +40% critical strike chance.
- **Charged Bolts** — Entropic Bolts now apply STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Infesting Bolts** — Enemies killed by Entropic Bolts raise an allied ZOMBIE ally.
- **Arctic Shards** — Each bolt that hits an enemy has a 15% chance to summon a concentrated BLIZZARD that deals 30 damage every 0.5s to enemies within. Each tick applies CHILL; at 5 stacks the target is FROZEN for 4 seconds.

##### Q — Mantra (Totem)

*Totem modifiers (requires Mantra)*

- **Wrathful Totem** — Mantra's Totem shots now gain increased base damage and +40% critical strike chance.
- **Storm Totem** — Mantra's Totem shots now apply STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Infesting Totem** — Mantra's Totem shots now gain increased base damage. Enemies killed by Totem shots raise an allied ZOMBIE for 30s (max 3).
- **Frost Totem** — Mantra's Totem shots now apply CHILL; at 5 stacks the target can be FROZEN for 4 seconds. Frost totems deal double damage to FROZEN enemies.

##### E — Crossentropy

*Crossentropy modifiers (requires Crossentropy)*

- **Tempest** — Crossentropy now applies 100 STAGGER on hit. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Plague** — Crossentropy now deals 340 base damage and applies 3 stacks of Concentrated Venom per hit. Each enemy killed by Crossentropy raises up to two ZOMBIE allies for 30s (max 3).
- **Inferno** — Crossentropy gains +40% critical strike chance and applies IGNITE, dealing bonus damage equal to 80% of the total damage dealt over 3 seconds.
- **Glacial Storm** — Crossentropy now spawns a FROST NOVA at the impact zone, leaving a concentrated BLIZZARD that deals 30 damage every 0.5s to enemies within. Each tick applies CHILL; at 5 stacks the target is FROZEN for 4 seconds.

#### Sabres

##### Left-Click — Swipes

*Basic attack blades branch*

- **Charged Blades** — Your Sabres' basic attacks now apply STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Wrathful Blades** — Sabres basic attacks now gain +20% critical strike chance and +100% critical strike damage.
- **Infested Blades** — Sabres basic attacks gain increased base damage and have a 15% chance per hit to apply 1 stack of Concentrated Venom. Killing an enemy with these attacks raises a ZOMBIE ally for 30s (max 3).
- **Divine Blades** — Sabres basic attacks have a 20% chance to grant 2.25 seconds of Aegis INVULNERABILITY.

##### Q — Backstab

*Backstab modifiers (requires Backstab on Q)*

- **Charged Stab** — Backstab now applies 80 STAGGER on hit. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Wrathful Stab** — Backstab now gains +30% critical strike chance and +80% critical strike damage.
- **Infested Stab** — Backstab applies 1 stack of Concentrated Venom per hit; killing an enemy with Backstab raises a ZOMBIE ally for 30s (max 3).
- **Divine Stab** — Damaging an enemy with Backstab grants 2.25 seconds of Aegis INVULNERABILITY.

##### E — Flourish

*Flourish modifiers (requires Flourish)*

- **Storm Flourish** — Flourish now applies STAGGER on hit. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Wrathful Flourish** — Flourish gains +35% critical strike chance and +15% critical strike damage.
- **Infested Flourish** — Flourish applies 1 stack of Concentrated Venom per hit; killing an enemy with Flourish raises a ZOMBIE ally for 30s (max 3).
- **Divine Flourish** — Damaging an enemy with Flourish grants 2.25 seconds of Aegis INVULNERABILITY.

#### Dash (shared — one per run)

Divine Dash, Infernal Dash, Glacial Dash, Mending Dash, and Storm Dash are mutually exclusive.

- **Divine Dash** — Each time you dash, gain 2 seconds of Aegis INVULNERABILITY.
- **Infernal Dash** — Forward dashes erupt in fiery pillars at your destination, dealing 195 damage and inflicting IGNITE to enemies in the area, dealing 80% of the damage dealt over 4 seconds.
- **Glacial Dash** — Forward dashes summon a concentrated Arctic BLIZZARD at your destination that deals 30 damage every 0.5s to enemies within. Each tick applies CHILL; at 5 stacks the target is FROZEN for 4 seconds. Backward dashes leave a Frost Nova at your origin, applying FREEZE to enemies in the area for 3 seconds. These effects share a 2 second cooldown.
- **Mending Dash** — Any dash releases a Sunwell burst, healing you for your current amount of STAMINA.
- **Storm Dash** — Any dash arcs lightning to the nearest enemy, dealing 40-240 damage and applying STAGGER to the target. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.

### 8. Secondary Boons

Secondary boons appear in matching colored room reward pools alongside primary ability-branch picks. R-spell boons assign that ability to your R hotkey when picked.

#### Shared Green (Eldritch)

- **Raise Dead** _(R SPELL)_ — Instantly summons one ZOMBIE ally at your position. Subject to the 3-ZOMBIE cap and benefits from all ZOMBIE boons.
- **Orb Shield** — Whenever you take damage from an enemy, spend 1 DASH CHARGE to heal for 50 + your current STAMINA.
- **Juggernaut Strain** — 33% chance when any ZOMBIE is raised to summon a JUGGERNAUT instead: larger, stronger, and more durable.
- **Berserker Strain** — ZOMBIES from any source have double HEALTH and double MOVEMENT SPEED.
- **Exploder Strain** — Your ZOMBIES detonate on their first hit, dealing damage equal to their maximum health in a small area and dying instantly. Enemies killed by the blast raise a new ZOMBIE.
- **Pack Hunter** — Each of your ZOMBIES deals +15 damage for each ZOMBIE you control, including itself (1 ZOMBIE: 60, 2: 75, 3: 90 base damage).
- **Necros Initiate** — ALLIED KNIGHT starts with 750 HP (+25 max HP per point of STAMINA) instead of 500.

#### Shared Blue (Tempest)

- **Lightning Bolt** _(R SPELL)_ — Calls down a lightning bolt on the highest priority enemy in range, dealing 117 + 20 damage per point of AGILITY and applying STAGGER to the target. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.
- **Paralysis** — STAGGER lightning procs stun enemies for 3 seconds (up from 1.0 seconds).
- **Guardbreak** — STAGGER lightning procs deal 300 damage (up from 150).
- **Unstable Plasma** — STAGGER lightning procs can now critically strike and deal +8 damage per point of AGILITY.
- **Tempest Initiate** — ALLIED KNIGHT's SMITE attack has a reduced cooldown and deals +20 base damage +5 damage per point of AGILITY.
- **Overclock** — Dash charges recharge 25% faster (8s → 6.4s per charge).
- **Override** — While your Q ability is on cooldown, drain all current shield to use it anyway. Cannot occur more than once every 5 seconds.

#### Shared Purple (Abyssal)

- **Coldsnap** _(R SPELL)_ — Conjures an explosive ice vortex that applies FREEZE to nearby enemies, immobilizing them for 6 seconds. 12s cooldown.
- **Aegis** _(R SPELL)_ — Creates a protective barrier that provides INVULNERABILITY, blocking all incoming damage for 3 seconds. 8s cooldown.
- **Momentum Rift** — Whenever you take damage from an enemy, restore 1 dash charge if any charge is on cooldown.
- **Mana Shield** _(INT)_ — Whenever you expend a dash charge, restore shield equal to 2 × your INTELLECT per charge spent.
- **Hailstorm** _(INT)_ — BLIZZARD effects deals 50 damage per tick (up from 30) and +2 damage per point of INTELLECT.
- **Abyssal Initiate** — ALLIED KNIGHT gains +50% movement speed and attack speed.
- **Awakened Eye** — Concentrated Blizzards and your Blizzard storm gain 50% larger radius with denser, larger frost particle effects.

#### Shared Red (Infernal)

- **Meteor Strike** _(R SPELL)_ — Calls down 1 meteor on the nearest enemy within range, with a 15% chance to call a second and a 5% chance to call a third. Meteors deal 240 base damage and apply IGNITE, dealing bonus damage equal to 80% of the impact damage plus 2% per point of INTELLECT over 4 seconds.
- **Rebuke** — Whenever you take damage from an enemy, that enemy erupts in flames, taking 200 damage and is inflicted with IGNITE, dealing 80% of the damage dealt over 4 seconds.
- **Blood Leech** — Critical strikes you deal to enemies now HEAL you for your current STRENGTH points.
- **Infernal Initiate** — ALLIED KNIGHT basic attack gains increased base damage — from 50 to 80 +3 per point of STRENGTH.
- **Fission** — Enemies afflicted with IGNITE erupt on death, dealing 240 damage to nearby enemies and inflicting IGNITE for 80% of the damage dealt over 4 seconds.
- **Blood Orbs** — When you have no dash charges remaining, you may still dash by paying 20 HP.
- **Bloodmage** — While Colossus Strike, Crossentropy, or Reaping Talons is on cooldown, consume 1 dash charge to use it anyway. Cannot occur more than once every 5 seconds.
- **Deathwish** — While you have no dash charges available, heal for 8 HP per second.

### 9. Duo and Ultimate Boons

#### Duo Boons

To unlock a duo boon, own at least one primary weapon-ability room boon (Left-Click / Q / E mutex slot) of each color in the pair. Eligible duos then appear in matching colored room reward pools.

#### Red + Blue

- **Magma Current** — Your STAGGER lightning procs now also IGNITE the enemy, dealing 80% of the proc’s damage as bonus damage over 4 seconds. The bolts turn a deep fiery orange.
- **Tyrant's Cloak** — All IGNITE damage ticks now apply 10 STAGGER. Whenever you take damage from an enemy, strike that enemy with a STAGGER lightning bolt (once every 3 seconds; independent of Rebuke).

#### Red + Green

- **Legion** — Allied ZOMBIES can now critically strike with their melee attacks and Exploder Strain detonations, using your exact critical strike chance and critical damage multiplier.
- **Hellfire Venom** — Allied ZOMBIE attacks now apply 1 stack of Concentrated VENOM. Whenever an enemy is affected by any VENOM (Concentrated Venom, Cobra Shot, or Entanglement), they are also inflicted with IGNITE dealing 80% of 100 damage × your current level over 4 seconds.

#### Green + Blue

- **Plague Doctor** — Your STAGGER lightning procs now heal you for 1 HP per point of your current AGILITY. The bolts turn a verdant green.
- **Storm Witch** — Your STAGGER lightning procs now also apply 2 stacks of Concentrated VENOM to the target.

#### Red + Purple

- **Frost Queen** — Any enemy that becomes FROZEN is immediately struck by a METEOR at their location, dealing the same damage as your Meteor Strike. Gain a pair of small BONE WINGS.
- **Duality** — All IGNITE damage ticks have a 15% chance to summon a BLIZZARD at the ignited enemy’s location.

#### Green + Purple

- **Valkyrie** — Whenever you successfully block an attack while invulnerable (AEGIS), heal for 2 HP + 1 HP per point of your current STAMINA and INTELLECT combined.
- **Acid Rain** — Each damage tick of your BLIZZARD now also applies 1 stack of Concentrated VENOM to the enemy hit.

#### Blue + Purple

- **Monsoon** — Each damage tick of your BLIZZARD now also applies 10 STAGGER to the enemy hit.
- **Spell Thief** — Killing an enemy with your STAGGER lightning bolt or BLIZZARD damage restores 1 dash charge.

#### Ultimate Boons

To unlock an ultimate, own 2 or more primary mutex-group room boons of that same color (ability-branch and/or dash). The ultimate then appears in that color's room reward pool.

##### Purple

- **Divine Cold** — Whenever Aegis INVULNERABILITY procs (Aegis, Colossus Guard, Divine Combo, etc.), summon an Arctic BLIZZARD on 1 enemy in front of you. Once every 2 seconds.

##### Red

- **Pyromania** — Inflicting IGNITE on an enemy also calls a METEOR down on their position (Meteor Strike / Crossentropy style). Once every 1 second.

##### Blue

- **Storm Shield** — Whenever your STAGGER lightning bolt procs on an enemy, restore 20 shield plus 5 shield for each point of Agility you have.

##### Green

- **Lethal Injection** — Increases the maximum CONCENTRATED VENOM stacks you can apply to an enemy from 5 to 10.

### 10. Portal Colors

After clearing a combat room: approach the pedestal and press X → choose a reward / boon → portals unlock so you can choose the next gateway. Reward choices can be rerolled for 1 Fate in combat (free in the throne room).

- **(Red) Infernal Gate** — Red (Infernal) boons — generally the hardest combat rooms.
- **(Blue) Tempest Gate** — Blue (Tempest) boons.
- **(Green) Eldritch Gate** — Green (Eldritch) boons — zombie / necromancy themes.
- **(Purple) Abyssal Gate** — Purple (Abyssal) boons — frost / aegis themes.
- **(Yellow) Trial Room** — +250 GOLD from the pedestal.
- **(Orange) Stat Room** — +5 STAT points from the pedestal.
- **(Pink) Merchant** — Buy heal, dash charge, weapon talent, and items with GOLD.
- **(Red Void) Boss Room** — Defeat the boss, then pick a CLASS TALENT from your weapon pool.

### 11. Aspects

Each throne weapon has multiple aspects that change visuals and core combat behavior for the run.

#### Runeblade

Choose an aspect from the weapon pedestal in the throne room (cycle with the showcase, confirm with X).

- **Aspect of Envy** — Increases attack speed by 20%. Wraith Strike applies Shadowflame (ignites for 60% of hit damage over 2.5s).

- **Aspect of Mania** — Reduces the cooldown of Colossus Smite (E) by 2 seconds and triples its base heal. Death Grasp (R) pulls and taunts target.

- **Aspect of Pride** — Tempest Sweep: Charging R for at least 1.5s Ignites hit enemies for 80% of impact damage over 4 seconds.

- **Aspect of Regret** — Warhammer form: Higher base damage, slower swings. Third combo hit has a 50% chance to immediately trigger a Stagger Lightning Bolt on the target.

#### Sabres

Choose an aspect from the weapon pedestal in the throne room (cycle with the showcase, confirm with X).

- **Aspect of Havoc** — Reduces the cooldown of Divebomb by 2 seconds, increasing its damage and it now applies Ignite (80% of impact damage over 3s).

- **Aspect of Apathy** — Primary attacks apply Avalanche on hit enemies — Arctic Blizzard damage and chill every 0.5s for 6s.

- **Aspect of Cruelty** — Poison Dart: after each dash, the next primary attack fires a dart dealing 20 + 5 per AGILITY and applying 1 stack of Concentrated Venom. Backstab (Q) applies 1 stack ofConcentrated Venom. Dash distance is doubled.

#### Bow

Choose an aspect from the weapon pedestal in the throne room (cycle with the showcase, confirm with X).

- **Aspect of Vengeance** — Hunter's Mark: Barrage marks enemies for 5s. A Perfect Shot on a marked enemy creates a lightning bolt at the enemy location. Terminal Velocity: Perfect Shot and Reaping Talons (forward and return) deal +20 + 2 per AGILITY bonus damage when the target is hit from over 10 meters away.

- **Aspect of Infamy** — Always accompanied by a loyal tiger companion.

- **Aspect of Resent** — Rejuvenating Shot: heals allies, or Entangles enemies hit.

#### Scythe

Choose an aspect from the weapon pedestal in the throne room (cycle with the showcase, confirm with X).

- **Aspect of Madness** — Vengeful Spirit: Crossentropy hits summon a stationary apparition that attacks nearby enemies. Binding Totem: Mantra totems Entangle the closest enemy within 4.5 every 2s.


- **Aspect of Arrogance** — Every third Entropic Bolt Ignites the enemy for 200% of that bolt\'s damage over 4 seconds. Crossentropy hits on Ignited enemies create a pillar of fire dealing 125 + 5 damage per Intellect.

- **Aspect of Vanity** — Entropic Bolts fire 20% faster. After each dash, release 3 Locusts that seek enemies. Grants +1 dash charge.

### 12. Spirit Animals

Clearing Fae Realm III grants a spirit animal companion that follows you between rooms. After recruiting, empower it with one upgrade from its pool.

#### Tiger

*600 HP · 29 Melee Damage · 1100ms Attack Cooldown · 10 Aggro Radius*

Regenerates 15 HP every 5s.

**Empower upgrades** (choose one after Fae Realm III):

- **Apex Killer** — The Tiger now has a base damage of 71 per hit with a 20% critical strike chance.
- **Evasion** — While within 6 range of your Tiger ally, you have a 20% chance to entirely dodge incoming damage.
- **Dire Hide** — Increases maximum health of the Tiger by 600.

#### Wolf

*400 HP · 33 Melee Damage · 1100ms Attack Cooldown · 10 Aggro Radius*

Regenerates 30 HP every 5s.

**Empower upgrades** (choose one after Fae Realm III):

- **Pack Expansion** — Gain a second Wolf companion that fights alongside you.
- **Persistence Hunter** — While within 10 range of your Wolf ally, gain permanent bonus movement speed (3.575 → 4.0). Sprint speed is unchanged.
- **Dire Hide** — Increases maximum health of the Wolf by 600.

#### Bear

*800 HP · 47 Melee Damage · 1400ms Attack Cooldown · 10 Aggro Radius*

Regenerates 40 HP every 5s.

**Empower upgrades** (choose one after Fae Realm III):

- **Siegebreaker** — The Bear gains +1000 max HP permanently, and gains a Taunt ability (6s cooldown) that AOE-taunts all enemies within 7 range.
- **Mending Spores** — While within 6 range of your Bear ally, gain +1 HP regeneration per second.
- **Grizzly Claws** — Increases the base attack damage of the Bear by +40.

#### Serpent

*500 HP · 37 Melee Damage · 1100ms Attack Cooldown · 10 Aggro Radius*

Regenerates 15 HP every 5s.

**Empower upgrades** (choose one after Fae Realm III):

- **Neurotoxin** — All melee hits of the Serpent inflict 1 stack of Concentrated Venom.
- **Mending Spores** — While within 6 range of your Serpent ally, gain +1 HP regeneration per second.
- **Basilisk Hide** — Increases maximum health of the Serpent by 600.

#### Spider

*450 HP · 32 Melee Damage · 1400ms Attack Cooldown · 10 Aggro Radius*

Regenerates 15 HP every 5s.

**Empower upgrades** (choose one after Fae Realm III):

- **Ensnaring Threads** — Spider shoots grey web missiles (70 damage, 2.5s cooldown) that entangle enemies. Prefers ranged shots and spreads entangles across targets.
- **Mending Spores** — While within 6 range of your Spider ally, gain +1 HP regeneration per second.
- **Arachnid Matter** — Increases maximum health of the Spider by 600.

### 13. Run Progression

A co-op run flows through fixed sequences and an open throne-room portal loop.

#### Intro — Inner Sanctum I–IV

Every run begins with a one-time 4-room intro sequence (Inner Sanctum). Clear each room, then take the void portal. After room IV: drink from the healing fountain, revive an Ancestor, then choose gateways into the main loop.

Intro gold rewards by room: 50 / 75 / 100 (final intro room grants no combat gold).

#### Throne Room Loop

Between combat rooms you return to the Throne Room. Equip weapons and aspects, pick an archetype, assign Q/E/R abilities at the ability pillar, spend STAT points, then enter a colored or special portal.

- Starting Fate: **3**
- Boon reroll cost: **1 Fate** in combat rooms (free in the throne room)

#### Mid-run Sequences

- **Sunken Temple I–IV** — unlocks after Boss 1 (Hate / Twin Emperors). Fixed underwater rooms; ends with free boss-loot picks, fountain, then return to the main loop.
- Sunken gold rewards: 50 / 75 / 100
- **Eternity's Palace I–V** — later mid-run sequence with its own gold curve and loot/fountain checkpoints.
- Eternity gold rewards: 50 / 75 / 75
- **Fae Realm I–III** — beast-themed rooms; clearing III grants your Spirit Animal, then an empower choice.
- Fae Realm gold rewards: 40 / 60 / 80

#### Boss Chambers & Deep Sanctum

- **Chamber of Death** (red void / boss portal) — defeat the boss, then pick a class talent from your weapon pool.
- **Deep Sanctum** — high-value Inner Sanctum visits granting at least **150 gold** and **8 STAT points**.

#### Surprise Gates

Occasionally portals lead to special destinations:

- **Eden / Distorted Eden / Eden Finale**
- **Delirium Gate** — defend the structure (or clear ghouls on failure)
- **Erebus Gate**
- **Dream Layer** — legendary item shop and set pieces

#### Economy Snapshot

- Trial Room (Crypt of Currency) pedestal: **+250 GOLD**
- Stat Room (Crypt of Skill) pedestal: **+5 STAT points**
- Leveling grants +20 max HP and +5 STAT points per level (base crit chance 11%, base crit damage 2.0×).

### 14. Enemies

Enemy nameplates as they appear in co-op. Combat profiles vary by type; bosses and titans are pull-immune to Death Grasp.

#### Beasts

- TIGER
- WOLF
- BEAR
- SERPENT
- RECLUSE
- WYVERN
- TERRORHAWK

#### Elites

- KNIGHT
- WARLOCK
- WEAVER
- SHADE
- GHOUL
- TEMPLAR
- VIPER
- COLOSSUS
- STONE GIANT
- ETERNAL OAK
- SPECTRE
- ASSASSIN
- SHAMAN
- FROST QUEEN
- MEDUSA
- DEATHKNIGHT
- SKYRAY
- WRAITH
- MARTYR
- GREED
- ZOMBIE

#### Bosses

- HATE
- ENVY
- FEAR
- DESTINY
- NEMESIS
- VALKYRIE
- SENTINEL

#### Titans

- TITAN
- STORM TITAN
- TITAN OF MERCY
- TITAN OF WRATH
- PLAGUE TITAN

### 15. Items, Merchant & Economy

#### Merchant (Avernus — Pink Portal)

Spend GOLD on heal, utilities, weapon talents, dash charges, and boss drops.

- Heal: **50 gold**
- Oxygen (max energy): **300 gold** (up to 3 purchases)
- Warpdrive (dash distance): **300 gold** (up to 3 purchases)
- Weapon talent purchases: up to **3** per run
- Premium backfill (after base slots sell out): **1200 gold**

#### Dream Layer Items

Legendary armor, rings, and pendants found in the Dream Layer and related loot.

- **Exodia Helm** (*Kaiser*) — Critical hits spawn a pillar of fire on the target, dealing 195 damage and inflicting Ignite (2.5s ICD).
- **Exodia Pauldrons** (*Scorpion Lance*) — After expending a dash charge, your next primary attack within 2s fires a piercing shard (40 + 4×AGI dmg, 7u range). 1.5s ICD.
- **Exodia Plate** (*Hatemail Vest*) — Taking any damage returns 300% of it to the attacker.
- **Exodia Greaves** (*Sleepwalker*) — Enemies drop twice the FLOW (2 shards normal, 6 titan/nemesis/valkyrie, 15 bosses).
- **Exodia Gauntlets** (*Vicegrip*) — Sabres left/right swings gain +20 damage. Runeblade combo swings gain +50 damage. No effect on Scythe or Bow.
- **Archmage Coil** (*Arcane Reservoir*) — Expending a dash charge restores 20 Energy. Cannot stack with Exodia Helm. 2pc (with Belt): +15 Intellect.
- **Archmage Belt** (*Quickened Mind*) — Reduces Q ability cooldowns (Frostbite 6s, Wraith Strike 3.75s, Mantra 6s, Backstab 2.75s). 2pc (with Coil): +15 Intellect.
- **Hexmetal Cloak** (*Damage Ward*) — No single source of damage can exceed 50. 2pc: base walk speed 4.125 (does not stack with sprint). 3pc: +1 dash charge.
- **Hexmetal Leggings** (*Momentum Weave*) — Halves movement speed reduction while attacking (Runeblade, Scythe, Bow LMB). 2pc: base walk speed 4.125. 3pc: +1 dash charge.
- **Hexmetal Vambraces** (*Swift Arms*) — Reduces E ability cooldowns (Reaping Talons 5s, Colossus Strike 6s/4.5s Legionnaire, Crossentropy 6s, Flourish 0.75s). 2pc: walk 4.125. 3pc: +1 dash charge.
- **Persephone** (*Death Goddess*) — The next fatal blow sets you to 90% HP and consumes the ring. Regenerated by Immortal Union (4pc Exodia).
- **Wyvern Amethyst** (*Leviathan Scales*) — Venom applications also apply 1 Needler stack (max 4). At 4 stacks: burst 70 + 4×INT magic damage.
- **Infinite Amber** (*Enchanter's Gift*) — Increases Energy recovery rate by 40%.
- **Liquid Sapphire** (*Cold Grace*) — Primary attacks on frozen enemies consume Freeze to shatter them for +350 bonus damage.
- **Jaguar Emerald** (*Trial by Fire*) — Venom effects are red-themed. Primary attacks gain +30% crit chance vs venomed enemies.
- **Razed Diamond** (*Bloodrose Ember*) — Q abilities deal increased damage based on missing HP, up to +250%.
- **Hunter's Mark** (*Hunter's Mark*) — Your beast companions deal +30 melee damage.
- **Soul Ward** (*Soul Bond*) — Negate a hit and deal double the damage to your ally instead. 6s cooldown.
<!-- GAME_GUIDE:END -->

---

<!-- LEGACY_README -->

## Legacy README

**1.0 DEMO: https://www.youtube.com/watch?v=IXBi8mOIxyk&t=47s** <br>
**0.7 Sound Effects: https://www.youtube.com/watch?v=4zXGMIMsG2k** 

### v0.7 Boss Abilities
![Spear2](https://github.com/user-attachments/assets/31e24563-2d63-42c2-9645-3cc977889355)

### v0.6 Redesigned Spear 
![Spear1](https://github.com/user-attachments/assets/24227104-6208-4e3e-9487-fbd11a9f89ca) <br>

### v0.5 Scythe Rework
![Pulsar](https://github.com/user-attachments/assets/569b3535-ab96-4183-9a37-5ccfd4f0fc64)

### v0.4 Ally Healing
![bowheal](https://github.com/user-attachments/assets/e0c4c545-8e06-4961-bc23-700b85691959)

### v0.3 Co-op Aggro System
![AggroSystem](https://github.com/user-attachments/assets/70b0485a-b29b-47f9-a228-5e8627a2766d)

### v0.2 Initial Boss Model
![BossPreRelease](https://github.com/user-attachments/assets/32f96a9d-e66b-404a-a984-fd2dbd04b866)


### ⚙️ Technical Specs
- **Real-time Multiplayer**: Socket.io-powered networking with sub-60ms latency
- **ECS Architecture**: Entity-Component-System for optimal performance and modularity
- **Advanced 3D Rendering**: Three.js with WebGL, LOD management, and instanced rendering
- **Spatial Audio**: Howler.js-powered 3D positional audio with 30+ unique sound effects
- **Performance Optimizations**: Object pooling, state batching, and performance monitoring
- **Scalable Backend**: Node.js server with automatic scaling and health monitoring
- **In-Game Chat Functionality**: Real-time multiplayer text communication with player names

## 🎨 Custom Model Creation & Visual Effects

**No external 3D models/assets used** - All models built from scratch using Three.js primitives and mathematical shapes, maintaining a consistent 'bone' theme throughout.

### v0.5 Bone Wings Upgrade
![BoneWingsUpgrade](https://github.com/user-attachments/assets/46d1397f-b87d-4f49-89d4-f90a4aba4cbb)

### Model Construction Techniques
- **Primitive Geometry Assembly**: Weapons and units built by combining cylinders, spheres, boxes, and custom geometries
- **Mathematical Shape Generation**: Three.js `Shape` class used to create complex 2D profiles extruded into 3D forms
  - **Quadratic Curves**: `quadraticCurveTo()` method creates Bézier curves for smooth, organic weapon shapes

    ```typescript
    // Runeblade shape creation using quadratic curves
    shape.lineTo(0, 0.08);
    shape.lineTo(-0.2, 0.12);
    shape.quadraticCurveTo(0.8, -0.15, -0.15, 0.12);  // Subtle curve along back
    shape.quadraticCurveTo(1.8, -0, 1.75, 0.05);      // Gentle curve towards tip
    shape.quadraticCurveTo(2.15, 0.05, 2.35, 0.225);   // Sharp point

    // Lower edge with pronounced curves
    shape.quadraticCurveTo(2.125, -0.125, 2.0, -0.25);  // Start curve from tip
    shape.quadraticCurveTo(1.8, -0.45, 1.675, -0.55);   // Peak of the curve
    shape.quadraticCurveTo(0.9, -0.35, 0.125, -0.325);  // Curve back towards guard
    ```
- **Procedural Detailing**: Bones, spikes, and organic structures generated algorithmically for visual consistency

### Visual Effects System
- **Emissive Materials**: Glowing effects achieved through Three.js emissive material properties and dynamic point lights
- **Instanced Mesh Rendering**: High-performance particle systems for trails, auras, and environmental effects
- **Material Shaders**: Custom material configurations for metallic, crystalline, and ethereal appearances
  - **Projectile Trail Shaders**: 

    ```glsl
    // Entropic Bolt Fragment Shader
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float strength = smoothstep(0.5, 0.1, d);
      vec3 glowColor;
      float emissiveMultiplier = 0.5;
      if (uIsCryoflame) {
        glowColor = mix(uColor, vec3(0.2, 0.4, 0.8), 0.4); // Cryoflame: deep navy blue
        emissiveMultiplier = 2.0;
      } else {
        glowColor = mix(uColor, vec3(1.0, 0.6, 0.0), 0.4); // Normal: orange fire effect
        emissiveMultiplier = 1.0;
      }
      gl_FragColor = vec4(glowColor * emissiveMultiplier, vOpacity * strength);
    }
    ```

  - **Ground Shader**: Procedural texturing with normal mapping, ambient occlusion, and subtle animation

    ```glsl
    // Enhanced Ground Fragment Shader
    void main() {
      vec4 colorSample = texture2D(colorMap, vUv);
      vec3 normalSample = texture2D(normalMap, vUv).rgb * 2.0 - 1.0;

      float distanceFromCenter = length(vPosition.xz) / 29.0;
      float ao = 1.0 - smoothstep(0.0, 1.0, distanceFromCenter) * 0.2;

      float animation = sin(vPosition.x * 0.01 + time * 0.1) * sin(vPosition.z * 0.01 + time * 0.07) * 0.02 + 1.0;

      vec3 finalColor = colorSample.rgb * animation * ao;

      float rim = 1.0 - dot(vNormal, vec3(0.0, 1.0, 0.0));
      rim = pow(rim, 3.0) * 0.1;
      finalColor += accentColor * rim;

      gl_FragColor = vec4(finalColor, 1.0);
    }
    ```
- **Dynamic Lighting**: Real-time light positioning and intensity modulation for atmospheric effects

### ECS Integration
- **Component-Based Rendering**: Visual components (Renderer, HealthBar, Collider) integrated with ECS architecture
- **System-Driven Animation**: Animation states managed through ECS components with React Three Fiber integration

## 🛠️ Technical Architecture

### Frontend Stack
- **Framework**: Next.js 14 with React 18
- **3D Engine**: Three.js with React Three Fiber
- **Networking**: Socket.io client with automatic reconnection
- **Audio**: Howler.js with spatial audio processing
- **UI**: Tailwind CSS with custom components
- **State**: React Context with optimized updates

### Backend Stack
- **Runtime**: Node.js with Express
- **WebSocket**: Socket.io with CORS support
- **Deployment**: Fly.io with auto-scaling
- **Monitoring**: Health checks and performance metrics

### Performance Features
- **Entity Component System**: Modular game object management with 13 specialized components
- **Object Pooling**: Pre-allocated objects for projectiles and effects with automatic cleanup
- **State Batching**: Optimized network updates with frame-based batching
- **Level-of-Detail**: Distance-based rendering optimization
- **Instanced Rendering**: Efficient crowd rendering for enemies
- **Spatial Hashing**: Fast collision detection for hundreds of entities


## 🏗️ Entity Component System (ECS) Architecture

### Core ECS Classes

#### **Entity** (`Entity.ts`)
- **Unique Identification**: Each entity has a unique auto-incrementing ID
- **Component Container**: Map-based storage of components with type-safe access
- **Component Queries**: Efficient checking for required component combinations
- **Lifecycle Management**: Active/inactive states and cleanup callbacks
- **User Data**: Arbitrary data storage for game-specific information

```typescript
const player = world.createEntity();
player.addComponent(new Transform(new Vector3(0, 0, 0)));
player.addComponent(new Movement(3.75, 0.8)); // speed, friction
player.addComponent(new Health(500));
```

#### **Component** (`Component.ts`)
- **Abstract Base Class**: All components inherit from `Component`
- **Reset Method**: Required for object pooling cleanup
- **Enabled Flag**: Runtime component activation/deactivation
- **Explicit Type Identifiers**: String-based component identification for performance

#### **System** (`System.ts`)
- **Component Requirements**: Array of required component types for entity filtering
- **Priority System**: Lower numbers execute first (0-100 range)
- **Lifecycle Callbacks**: `onEntityAdded`, `onEntityRemoved`, `onEnable`, `onDisable`
- **Specialized Subclasses**: `RenderSystem`, `PhysicsSystem` for different update types

#### **World** (`World.ts`)
- **Entity Registry**: Central management of all entities
- **System Orchestration**: Priority-sorted system execution
- **Component Pooling**: Automatic object pooling for performance
- **Event System**: Inter-system communication
- **Query System**: Efficient entity filtering by component combinations

```typescript
const world = new World();

// Add systems in priority order
world.addSystem(new MovementSystem(inputManager)); // priority 10
world.addSystem(new CollisionSystem());           // priority 20
world.addSystem(new CombatSystem(world));         // priority 30

// Main game loop
world.update(deltaTime);
world.fixedUpdate(fixedDeltaTime);
world.render(deltaTime);
```

### Component Types

#### **Core Components**
- **Transform**: Position, rotation, scale with matrix caching and parent-child hierarchies
- **Movement**: Physics simulation with velocity, acceleration, friction, and movement flags
- **Health**: Damage/healing system with regeneration, invulnerability, and death states
- **Shield**: Damage absorption with regeneration mechanics

#### **Gameplay Components**
- **Enemy**: AI behavior, target tracking, and enemy-specific properties
- **Projectile**: Bullet/projectile simulation with lifetime and collision detection
- **Tower**: Defensive structures with health and ownership
- **Pillar**: Destructible map objectives with health tracking
- **SummonedUnit**: Temporary allied units with ownership and targeting

#### **Rendering Components**
- **Renderer**: Visual representation with material and geometry management
  - **Instanced Rendering**: High-performance crowd rendering with individual instance control

    ```typescript
    public setupInstancing(instancedMesh: InstancedMesh, instanceId: number): void {
      this.isInstanced = true;
      this.instancedMesh = instancedMesh;
      this.instanceId = instanceId;
    }

    public updateInstanceMatrix(matrix: Matrix4): void {
      if (this.isInstanced && this.instancedMesh && this.instanceId >= 0) {
        this.instancedMesh.setMatrixAt(this.instanceId, matrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
      }
    }

    public setInstanceVisible(visible: boolean): void {
      if (this.isInstanced && this.instancedMesh && this.instanceId >= 0) {
        const matrix = new Matrix4();
        this.instancedMesh.getMatrixAt(this.instanceId, matrix);

        if (!visible) {
          matrix.scale(new Vector3(0, 0, 0)); // Hide by scaling to zero
        }

        this.instancedMesh.setMatrixAt(this.instanceId, matrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
      }
    }
    ```

  - **Dynamic Mesh Updates**: Runtime property synchronization for shadows and materials

    ```typescript
    public updateMesh(): void {
      if (!this.mesh) return;

      // Handle shadow properties for both Mesh and Group hierarchies
      if (this.mesh instanceof Mesh) {
        this.mesh.castShadow = this.castShadow;
        this.mesh.receiveShadow = this.receiveShadow;
      } else if (this.mesh instanceof Group) {
        this.mesh.traverse((child) => {
          if (child instanceof Mesh) {
            child.castShadow = this.castShadow;
            child.receiveShadow = this.receiveShadow;
          }
        });
      }

      this.mesh.frustumCulled = this.frustumCulled;
      this.mesh.visible = this.visible;
      this.mesh.renderOrder = this.renderOrder;

      if (this.needsUpdate && this.geometry && this.material && this.mesh instanceof Mesh) {
        this.mesh.geometry = this.geometry;
        this.mesh.material = this.material;
        this.needsUpdate = false;
      }
    }
    ```
- **HealthBar**: UI health display with dynamic positioning
- **Collider**: Collision detection shapes and boundaries

### System Architecture

#### **Update Systems**
- **MovementSystem**: WASD input, physics simulation, dash mechanics
- **CombatSystem**: Damage calculation, healing, death handling
- **ControlSystem**: Player input, weapon switching, ability management
- **CollisionSystem**: Spatial hash collision detection
- **AudioSystem**: Spatial audio positioning and playback

#### **Render Systems**
- **RenderSystem**: Three.js rendering with LOD management
- **CameraSystem**: Dynamic camera positioning and smoothing
- **HealthBarSystem**: Health bar positioning and updates

#### **Physics Systems** (Fixed Timestep)
- **PhysicsSystem**: Fixed-timestep physics simulation for consistency

### Performance Optimizations

#### **Component Pooling**
```typescript
// World automatically pools components for reuse
const transform = world.createComponent(Transform); // Reused from pool
world.returnComponent(transform); // Returned to pool for next use
```

#### **Entity Queries**
```typescript
// Query entities with specific component combinations
const enemies = world.queryEntities([Transform, Movement, Enemy]);
const projectiles = world.queryEntities([Transform, Projectile]);
```

#### **System Matching**
```typescript
// Systems only process entities with required components
class MovementSystem extends System {
  readonly requiredComponents = [Transform, Movement];

  update(entities: Entity[], deltaTime: number) {
    // Only entities with Transform AND Movement components
    entities.forEach(entity => { /* process */ });
  }
}
```

#### **Event-Driven Communication**
```typescript
// Systems communicate through world events
world.emitEvent('player_damaged', { playerId, damage, source });
world.emitEvent('enemy_killed', { enemyId, killerId });

// Other systems can listen for these events
const events = world.getEvents('enemy_killed');
```

### Custom ECS Architecture

- **Modularity**: Components and systems are independent and reusable
- **Performance**: Only relevant systems process relevant entities
- **Scalability**: Easy to add new entity types and behaviors
- **Maintainability**: Clear separation of data and logic
- **Memory Efficiency**: Object pooling prevents garbage collection spikes
- **Type Safety**: Full TypeScript support with component type checking

## 🧠 Complex State Management Architecture

The game's architecture manages multiple interconnected state systems simultaneously to maintain smooth real-time gameplay across multiplayer environments. Here's how complex state synchronization keeps the game running:

### Multiplayer State Synchronization

#### **Client-Server State Reconciliation**
- **Network Batching**: State updates batched per frame to reduce network overhead while maintaining real-time feel
- **Authoritative Server**: Server maintains true game state, clients interpolate for smooth visuals
- **Conflict Resolution**: Server-authoritative decisions for critical gameplay elements (damage, positioning, ability activation)

```typescript
// State batching prevents network spam while maintaining responsiveness
private batchStateUpdate(updates: any[]): void {
  if (this.stateBatch.length === 0) {
    setTimeout(() => this.flushBatch(), 16); // ~60fps batching
  }
  this.stateBatch.push(...updates);
}
```

#### **Entity State Propagation**
- **Selective Broadcasting**: Only relevant state changes broadcast to reduce bandwidth (position updates every 50ms, health changes immediate)
- **Delta Compression**: Only changed values transmitted, not full state snapshots
- **Prediction & Reconciliation**: Client-side prediction with server reconciliation for responsive feel

### Combat State Management

#### **Damage Calculation Pipeline**
```typescript
// Damage flows through multiple systems with state validation
1. DamageCalculator.calculateDamage() → base damage with crits
2. CombatSystem.queueDamage() → validation and queuing
3. DamageNumberManager.addDamageNumber() → visual feedback
4. Network broadcast → synchronize across clients
```

#### **Ability State Coordination**
- **Cooldown Tracking**: Per-weapon ability states with network synchronization
- **Charge Management**: Real-time charge progress tracking across client/server
- **State Dependencies**: Abilities check multiple state conditions (mana, cooldowns, weapon type)

```typescript
// Complex state checks prevent invalid ability usage
private canActivateAbility(abilityType: string): boolean {
  return this.checkManaCost() &&
         this.checkCooldown(abilityType) &&
         this.checkWeaponCompatibility() &&
         this.checkPlayerState();
}
```

### Enemy AI State Management

#### **Aggro & Behavior States**
- **Dynamic Aggro System**: Players gain/lose aggro based on damage dealt and proximity
- **Taunt Effects**: Temporary state overrides with duration tracking
- **Movement States**: Patrolling → Chasing → Attacking state transitions

```typescript
// Enemy AI maintains  internal state
updateEnemyAI(enemy) {
  switch(enemy.state) {
    case 'patrol': this.handlePatrolLogic();
    case 'aggro': this.handleAggroLogic();
    case 'taunt': this.handleTauntLogic();
    case 'stunned': this.handleStunLogic();
  }
}
```

### Player State Management

#### **Health & Resource States**
- **Multi-layered Health**: Base health + shield + regeneration mechanics
- **Mana System**: Runeblade-specific resource with consumption/regeneration
- **Debuff State Tracking**: Multiple concurrent effects (frozen, slowed, stunned, burning) with durations

### Performance State Management

#### **Object Pooling State**
```typescript
// Pooled objects maintain internal state for reuse
class ProjectilePool {
  private activeProjectiles: Map<string, ProjectileState>;
  private availablePool: ProjectileState[];

  getProjectile(): ProjectileState {
    const projectile = this.availablePool.pop() || new ProjectileState();
    projectile.reset(); // Clean state for reuse
    return projectile;
  }
}
```

#### **LOD State Management**
- **Distance-Based State**: Entities transition between detail levels automatically
- **Culling States**: Frustum culling + occlusion culling state management
- **Render State Batching**: Instanced meshes maintain individual state within optimized batches

### Network State Reliability

#### **Connection State Management**
- **Automatic Reconnection**: Socket.io with exponential backoff reconnection
- **State Synchronization**: Full state resync on reconnection to prevent desynchronization
- **Latency Compensation**: Client-side prediction with server validation

#### **Error Recovery States**
- **Graceful Degradation**: System continues operating during network issues
- **State Validation**: Server-side validation prevents invalid state transitions
- **Rollback Mechanisms**: Critical state rollbacks when network conflicts detected

### State Debugging & Monitoring

#### **Performance State Tracking**
- **FPS Monitoring**: Real-time performance metrics with automatic optimization triggers
- **Memory State**: Object pool utilization tracking to prevent memory leaks
- **Network State**: Latency, packet loss, and state synchronization monitoring

```typescript
// Performance monitoring maintains system health
private monitorSystemHealth(): void {
  if (this.fps < 30) this.enableLowPowerMode();
  if (this.memoryUsage > 0.8) this.triggerGarbageCollection();
  if (this.networkLatency > 100) this.reduceUpdateFrequency();
}
```

This multi-layered state management ensures the game maintains consistent, responsive gameplay across varying network conditions while preventing common multiplayer issues like state desynchronization, input lag, and performance degradation.
