import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress specific Google Maps API errors from the global error overlay
// since we handle them gracefully in the UI components
window.addEventListener('error', (e) => {
  if (
    e.message?.includes('ApiNotActivatedMapError') ||
    e.message?.includes('Script error.') ||
    e.message?.includes('google')
  ) {
    e.preventDefault();
  }
});

window.onerror = function (message) {
  if (
    typeof message === 'string' &&
    (message.includes('ApiNotActivatedMapError') || message.includes('Script error.'))
  ) {
    return true; // Suppress the error
  }
  return false;
};

const originalConsoleError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' && 
    (args[0].includes('ApiNotActivatedMapError') || args[0].includes('Script error.'))
  ) {
    return;
  }
  originalConsoleError(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
