import React from 'react';

interface PVPScoreboardProps {
  playerKills: Map<string, number>;
  players: Map<string, any>; // Player data from multiplayer context
  currentPlayerId?: string;
}

const PVPScoreboard: React.FC<PVPScoreboardProps> = ({
  playerKills,
  players,
  currentPlayerId
}) => {
  // Convert player kills to array and sort by kill count (descending)
  const sortedPlayers = Array.from(playerKills.entries())
    .map(([playerId, kills]) => {
      const player = players.get(playerId);
      return {
        playerId,
        kills,
        name: player?.name || playerId.substring(0, 8), // Use player name or truncated ID
        isCurrentPlayer: playerId === currentPlayerId
      };
    })
    .sort((a, b) => b.kills - a.kills); // Sort by kills descending

  if (sortedPlayers.length === 0) {
    return null; // Don't render if no kills yet
  }

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white rounded-lg p-4 min-w-48 max-w-64 z-50 border border-gray-600">
      {/* Header */}
      <div className="text-center mb-3 border-b border-gray-600 pb-2">
        <div className="text-lg font-bold text-blue-400">PVP MODE</div>
        <div className="text-sm text-gray-300">Kill Leaderboard</div>
      </div>

      {/* Player List */}
      <div className="space-y-1">
        {sortedPlayers.map((player, index) => (
          <div
            key={player.playerId}
            className={`flex justify-between items-center p-2 rounded text-sm ${
              player.isCurrentPlayer
                ? 'bg-blue-600/30 border border-blue-500/50'
                : 'bg-gray-700/30'
            }`}
          >
            {/* Rank and Name */}
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <span className={`text-xs font-bold w-6 ${
                index === 0 ? 'text-yellow-400' :
                index === 1 ? 'text-gray-400' :
                index === 2 ? 'text-amber-600' :
                'text-gray-500'
              }`}>
                #{index + 1}
              </span>
              <span className={`truncate ${
                player.isCurrentPlayer ? 'text-blue-300 font-semibold' : 'text-white'
              }`}>
                {player.name}
                {player.isCurrentPlayer && ' (You)'}
              </span>
            </div>

            {/* Kill Count */}
            <div className="flex items-center space-x-1">
              <span className="text-red-400 font-bold">{player.kills}</span>
              <span className="text-xs text-gray-400">kills</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-gray-600 text-center">
        <div className="text-xs text-gray-400">
          {sortedPlayers.length} player{sortedPlayers.length !== 1 ? 's' : ''} active
        </div>
      </div>
    </div>
  );
};

export default PVPScoreboard;
