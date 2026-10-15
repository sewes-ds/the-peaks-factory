import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './foundation/platformRoot.css';
import './foundation/peaksTheme.css';
import './foundation/layoutPrimitives.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
