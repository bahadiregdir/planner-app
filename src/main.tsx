import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import App from './App';
import Widget from './components/Widget';
import BreakOverlay from './components/BreakOverlay';
import Reports from './pages/Reports';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/widget" element={<Widget />} />
          <Route path="/break-overlay" element={<BreakOverlay />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>
);