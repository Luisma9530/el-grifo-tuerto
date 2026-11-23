import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Parts of the game are loaded on demand. After a new deployment, a page opened
// earlier may ask for a file that no longer exists: reload it (once) to get the
// new version instead of failing. Campaigns are saved in the browser, nothing is lost.
const RELOADED_AT_KEY = 'grifo_chunk_reload_at';
window.addEventListener('vite:preloadError', event => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT_KEY)) || 0;
    if (Date.now() - last < 10000) return; // just reloaded: let the error show
    sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
