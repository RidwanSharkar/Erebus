# Deployment Guide

## Quick Start

### Local Testing
```bash
# Terminal 1: Start backend
npm run backend

# Terminal 2: Start frontend
npm run dev
```

Visit http://localhost:3000 and test both single-player and multiplayer modes.

## Production Deployment

### Step 1: Deploy Backend to Fly.io

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly**
   ```bash
   fly auth login
   ```

3. **Deploy Backend**
   ```bash
   cd backend
   fly launch --no-deploy
   # Edit fly.toml if needed, then:
   fly deploy
   ```

4. **Get Backend URL**
   ```bash
   fly status
   # Note the hostname (e.g., nocturne-backend.fly.dev)
   ```

### Step 2: Update Frontend Configuration

1. **Update MultiplayerContext.tsx**
   ```typescript
   // In src/contexts/MultiplayerContext.tsx, line ~47
   const serverUrl = process.env.NODE_ENV === 'production' 
     ? 'https://your-app-name.fly.dev'  // <- Update this
     : 'http://localhost:8080';
   ```

### Step 3: Deploy Frontend to Vercel

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy Frontend**
   ```bash
   vercel --prod
   ```

3. **Update Backend CORS**
   ```javascript
   // In backend/server.js, update corsOptions.origin
   origin: process.env.NODE_ENV === 'production' 
     ? ['https://your-vercel-app.vercel.app']  // <- Update this
     : ['http://localhost:3000', ...],
   ```

4. **Redeploy Backend**
   ```bash
   cd backend
   fly deploy
   ```

## Environment Variables

### Backend (.env)
```
NODE_ENV=production
PORT=8080
```

### Frontend (.env.local)
```
NEXT_PUBLIC_BACKEND_URL=https://your-app-name.fly.dev
```

## Monitoring

### Backend Health Check
```bash
curl https://your-app-name.fly.dev/health
```

### Fly.io Logs
```bash
fly logs
```

### Vercel Logs
Check the Vercel dashboard for deployment and runtime logs.

## Troubleshooting

### CORS Issues
- Ensure backend corsOptions includes your frontend domain
- Check browser console for CORS errors

### Connection Issues
- Verify backend is running: `fly status`
- Check health endpoint: `/health`
- Ensure WebSocket connections are allowed

### Performance
- Monitor Fly.io metrics
- Use Vercel Analytics for frontend performance
- Check browser dev tools for 3D rendering performance

## Scaling

### Backend Scaling
```bash
# Scale to 2 instances
fly scale count 2

# Scale machine resources
fly scale vm shared-cpu-2x
```

### Frontend Scaling
Vercel automatically scales based on traffic.

## Security

### Backend
- CORS properly configured
- Rate limiting on Socket.io connections
- Input validation on all events

### Frontend
- No sensitive data in client code
- Proper error handling for network issues

## Cost Optimization

### Fly.io
- Use `auto_stop_machines = true` for development
- Monitor usage with `fly dashboard`

### Vercel
- Optimize bundle size
- Use Next.js Image optimization
- Monitor function execution time
