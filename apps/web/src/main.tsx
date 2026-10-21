import './shared/styles/base.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { registerServiceWorker } from './app/register-sw';

const root = document.getElementById('root');
if (!root) throw new Error('Falta #root en index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
