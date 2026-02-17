
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  // Use createElement instead of JSX to avoid syntax errors in pure JS
  root.render(React.createElement(React.StrictMode, null, React.createElement(App)));
}
