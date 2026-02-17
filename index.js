import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  // Using createElement instead of JSX to avoid "Unexpected token '<'"
  root.render(React.createElement(React.StrictMode, null, React.createElement(App)));
}