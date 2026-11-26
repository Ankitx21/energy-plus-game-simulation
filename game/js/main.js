import { loadCity } from './data.js';
import { init } from './ui.js';

const app = document.querySelector('#app');
app.innerHTML = '<div class="loading">Loading the Bengaluru simulation table…</div>';
loadCity('blr').then(init).catch(err => {
  console.error(err);
  const fileMode = location.protocol === 'file:';
  app.innerHTML = `<div class="loading err">Could not load the simulation data.<br>${fileMode
    ? 'Open the game through the local server: double-click <b>play.bat</b> (or run <code>python -m http.server -d game</code>) and go to http://localhost:8000.'
    : err.message}</div>`;
});
