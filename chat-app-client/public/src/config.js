export const BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3030'
    : 'https://your-backend.onrender.com';

// Add WebSocket URL helper since Stomp often needs a different prefix (ws/wss)
export const WS_URL = window.location.hostname === 'localhost'
    ? 'ws://localhost:3030/ws'
    : 'wss://your-backend.onrender.com/ws';
