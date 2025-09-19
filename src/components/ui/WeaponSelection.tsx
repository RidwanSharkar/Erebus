import React, { useState } from 'react';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';

interface WeaponOption {
  type: WeaponType;
  name: string;
  icon: string;
  description: string;
  defaultSubclass: WeaponSubclass;
}

interface WeaponSelectionProps {
  onWeaponsSelected: (primary: WeaponType, secondary: WeaponType) => void;
  gameMode: 'multiplayer' | 'pvp';
}

export default function WeaponSelection({ onWeaponsSelected, gameMode }: WeaponSelectionProps) {
  const [selectedWeapons, setSelectedWeapons] = useState<WeaponType[]>([]);

  const weapons: WeaponOption[] = [
    {
      type: WeaponType.SCYTHE,
      name: 'Scythe',
      icon: '☠️',
      description: 'High damage, area attacks. Specializes in chaos and abyssal energies.',
      defaultSubclass: WeaponSubclass.CHAOS
    },
    {
      type: WeaponType.SWORD,
      name: 'Greatsword',
      icon: '💎',
      description: 'Balanced weapon with charge attacks. Focuses on divine and vengeful power.',
      defaultSubclass: WeaponSubclass.DIVINITY
    },
    {
      type: WeaponType.SABRES,
      name: 'Sabres',
      icon: '⚔️',
      description: 'Dual-wielded blades for fast attacks. Masters of frost and assassination.',
      defaultSubclass: WeaponSubclass.FROST
    },
    {
      type: WeaponType.RUNEBLADE,
      name: 'Runeblade',
      icon: '🔮',
      description: 'Magic-infused blade with spells. Wields arcane and natural forces.',
      defaultSubclass: WeaponSubclass.ARCANE
    },
    {
      type: WeaponType.BOW,
      name: 'Bow',
      icon: '🏹',
      description: 'Ranged weapon with charged shots. Commands elemental and venom powers.',
      defaultSubclass: WeaponSubclass.ELEMENTAL
    }
  ];

  const handleWeaponToggle = (weaponType: WeaponType) => {
    const isSelected = selectedWeapons.includes(weaponType);

    if (isSelected) {
      // Remove weapon if already selected
      const newSelectedWeapons = selectedWeapons.filter(w => w !== weaponType);
      setSelectedWeapons(newSelectedWeapons);
    } else {
      // Add weapon if not selected and we haven't reached the limit
      if (selectedWeapons.length < 2) {
        const newSelectedWeapons = [...selectedWeapons, weaponType];
        setSelectedWeapons(newSelectedWeapons);
      }
    }
  };

  const handleConfirmSelection = () => {
    if (selectedWeapons.length === 2) {
      onWeaponsSelected(selectedWeapons[0], selectedWeapons[1]);
    }
  };

  const getWeaponSubclassDescription = (weapon: WeaponOption) => {
    switch (weapon.type) {
      case WeaponType.SCYTHE:
        return 'Chaos: Raw destructive power | Abyssal: Void-based abilities';
      case WeaponType.SWORD:
        return 'Divinity: Holy light attacks | Vengeance: Retribution strikes';
      case WeaponType.SABRES:
        return 'Frost: Ice-based mobility | Assassin: Stealth and precision';
      case WeaponType.RUNEBLADE:
        return 'Arcane: Magical damage | Nature: Healing and growth';
      case WeaponType.BOW:
        return 'Elemental: Fire/Ice/Lightning | Venom: Poison and corruption';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50">
      <div className={`bg-black/90 p-8 rounded-xl border-2 ${gameMode === 'pvp' ? 'border-red-500' : 'border-green-500'} text-white max-w-4xl w-11/12`}>
        <h2 className="text-3xl font-bold mb-6 text-center text-green-400">
          Choose Your Weapons
        </h2>
        <p className="text-center mb-8 text-gray-300">
          Select 2 weapons for your arsenal. Your primary weapon becomes the '1' key, secondary becomes the '2' key.
          {gameMode === 'pvp' && (
            <span className="block mt-2 text-yellow-400">
              At level 3, you'll automatically unlock a random tertiary weapon as the '3' key!
            </span>
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {weapons.map((weapon) => {
            const isSelected = selectedWeapons.includes(weapon.type);
            const canSelect = !isSelected && selectedWeapons.length < 2;

            return (
              <div
                key={weapon.type}
                onClick={() => handleWeaponToggle(weapon.type)}
                className={`
                  p-6 rounded-lg border-2 cursor-pointer transition-all duration-300
                  ${isSelected
                    ? 'border-green-500 bg-green-500/20 shadow-lg shadow-green-500/30'
                    : canSelect
                      ? 'border-gray-600 bg-gray-800/50 hover:border-gray-400 hover:bg-gray-700/50'
                      : 'border-gray-700 bg-gray-900/50 opacity-60 cursor-not-allowed'
                  }
                `}
              >
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">{weapon.icon}</div>
                  <h3 className="text-xl font-bold mb-2">{weapon.name}</h3>
                </div>

                <p className="text-sm text-gray-300 mb-3 text-center">
                  {weapon.description}
                </p>



                {isSelected && (
                  <div className="mt-4 text-center">
                    <span className="inline-block px-3 py-1 bg-green-600 text-white text-sm rounded-full">
                      Selected ({selectedWeapons.indexOf(weapon.type) === 0 ? 'Primary' : 'Secondary'})
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={handleConfirmSelection}
            disabled={selectedWeapons.length !== 2}
            className={`
              px-8 py-4 text-xl font-bold rounded-lg transition-all duration-300
              ${selectedWeapons.length === 2
                ? 'bg-green-500 hover:bg-green-600 text-white cursor-pointer hover:-translate-y-1 shadow-lg'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Confirm Selection ({selectedWeapons.length}/2)
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Selected: {selectedWeapons.length > 0 ? selectedWeapons.join(', ') : 'None'}</p>
        </div>
      </div>
    </div>
  );
}
