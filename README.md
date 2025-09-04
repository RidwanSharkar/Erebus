# Avernus - Multiplayer 3D Action Game

A multiplayer 3D action game built with Next.js, React Three Fiber, and Socket.io.

## Features

- **Single Player Mode**: Fight enemies solo with full weapon arsenal
- **Multiplayer Mode**: Team up with up to 5 players per room
- **Three Weapon Types**: Sword, Bow, and Scythe with unique abilities
- **Real-time Combat**: Synchronized enemy health, positions, and player actions
- **Shared Progression**: Kill counts and health bonuses shared across all players

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd nocturne
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Start the backend server**
   ```bash
   npm run backend
   ```
   This will install backend dependencies and start the server on port 8080.

4. **Start the frontend (in a new terminal)**
   ```bash
   npm run dev
   ```
   The game will be available at http://localhost:3000

### Game Controls

- **WASD** - Move
- **Right Click + Drag** - Look Around
- **Left Click** - Attack/Fire
- **R** - Special Ability
- **Space** - Jump
- **Mouse Wheel** - Zoom
- **1** - Switch to Sword
- **2** - Switch to Bow  
- **3** - Switch to Scythe

### Multiplayer

1. Click "Multiplayer" from the main menu
2. Enter your player name
3. Enter a Room ID (use the same ID to play with friends)
4. Preview the room or join directly
5. Click "Start Game" when ready

## Deployment

### Backend (Fly.io)

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly**
   ```bash
   fly auth login
   ```

3. **Deploy the backend**
   ```bash
   cd backend
   fly deploy
   ```

### Frontend (Vercel)

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

3. **Update backend URL**
   Update the `serverUrl` in `src/contexts/MultiplayerContext.tsx` to point to your deployed Fly.io backend.

## Architecture

### Frontend
- **Next.js 14** - React framework
- **React Three Fiber** - 3D rendering
- **Socket.io Client** - Real-time communication
- **Tailwind CSS** - Styling

### Backend
- **Node.js + Express** - Server framework
- **Socket.io** - Real-time multiplayer
- **Game Rooms** - Isolated multiplayer sessions
- **Enemy AI** - Server-side enemy behavior

### Game Systems
- **ECS Architecture** - Entity Component System
- **Weapon System** - Sword, Bow, Scythe with unique abilities
- **Combat System** - Damage calculation and effects
- **Physics System** - Movement and collisions

## Multiplayer Features

- **Room-based Multiplayer** - Up to 5 players per room
- **Synchronized Enemies** - All players see the same enemies
- **Shared Health System** - Kill count increases max health for all players
- **Real-time Combat** - Damage and effects synchronized across players
- **Player Animations** - See other players' weapon attacks and abilities

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with both single and multiplayer modes
5. Submit a pull request

## License

This project is licensed under the MIT License.