# Connect Four

A Connect Four game with both local 2-player and online multiplayer support. Built with vanilla JavaScript frontend and Node.js/Socket.IO backend.

<img width="513" height="558" alt="image" src="https://github.com/user-attachments/assets/47707550-c712-44e0-83d3-1c46f3b16831" />

<img width="716" height="933" alt="image" src="https://github.com/user-attachments/assets/5a1f42e5-1915-4816-8b11-a03c82e10256" />


## Features

- **Local 2 Player Mode** - Play on the same device, scores saved to localStorage
- **Online Multiplayer** - Real-time gameplay via WebSockets
  - Create games and share game codes
  - Join games from the lobby
  - Rematch system
  - Disconnect handling
- **Responsive Design** - Works on desktop and mobile
- **Sound Effects** - Audio feedback for moves and wins

## Tech Stack

- **Frontend**: HTML, CSS, vanilla JavaScript
- **Backend**: Node.js, Express, Socket.IO, TypeScript

## Project Structure

```
four-in-a-row/
├── server/
│   ├── src/
│   │   ├── index.ts              # Express + Socket.IO server
│   │   ├── game/
│   │   │   ├── Game.ts           # Game logic & state
│   │   │   ├── GameManager.ts    # Manages all games/players
│   │   │   └── types.ts          # TypeScript interfaces
│   │   └── socket/
│   │       └── handlers.ts       # Socket event handlers
│   ├── package.json
│   └── tsconfig.json
├── public/
│   ├── index.html                # Main HTML with all screens
│   ├── styles.css                # Styles for all UI
│   └── game.js                   # Client-side game logic
├── package.json
└── README.md
```

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install server dependencies
npm run install:server

# Start development server (with hot reload)
npm run dev
```

Open http://localhost:3000 in your browser.

### Testing Multiplayer

1. Open two browser tabs to http://localhost:3000
2. Tab 1: Enter a name, click "Create New Game"
3. Tab 2: Enter a name, join the game from the lobby
4. Play!

## Production Deployment

### 1. Build the Server

```bash
cd server
npm install
npm run build
```

### 2. Process Manager (PM2)

PM2 keeps the app running and auto-restarts on crashes or server reboot.

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server/dist/index.js --name "connect-four"

# Configure auto-start on server reboot
pm2 startup
pm2 save
```

**Useful PM2 commands:**

```bash
pm2 status              # Check status
pm2 logs connect-four   # View logs
pm2 restart connect-four # Restart after updates
pm2 stop connect-four   # Stop the app
```

### 3. Nginx Reverse Proxy + SSL

Install Nginx and Certbot:

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

Create Nginx config at `/etc/nginx/sites-available/connect-four`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and get SSL certificate:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/connect-four /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate (follow the prompts)
sudo certbot --nginx -d yourdomain.com
```

Certbot automatically configures HTTPS and sets up auto-renewal.

### 4. Environment Variables

You can configure the server port via environment variable:

```bash
PORT=3000 pm2 start server/dist/index.js --name "connect-four"
```

## License

MIT
