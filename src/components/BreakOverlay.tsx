import React, { useState, useEffect } from 'react';

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a1628',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    color: '#fff',
    userSelect: 'none',
    cursor: 'default',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '30px',
    color: '#ff6b6b',
  },
  timer: {
    fontSize: '80px',
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: '40px',
    letterSpacing: '5px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '30px',
  },
  actions: {
    display: 'flex',
    gap: '15px',
  },
  btn: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
  },
  btnSnooze5: {
    backgroundColor: '#2a4a6f',
    color: '#fff',
  },
  btnSnooze10: {
    backgroundColor: '#2a4a6f',
    color: '#fff',
  },
  btnSkip: {
    backgroundColor: '#10b981',
    color: '#fff',
  },
};

export default function BreakOverlay() {
  const [timeLeft, setTimeLeft] = useState(0);
  const [breakType, setBreakType] = useState('');

  useEffect(() => {
    if (window.electronAPI?.onTrayState) {
      window.electronAPI.onTrayState((s: any) => {
        setTimeLeft(s.timeLeft || 0);
        setBreakType(s.isBreak ? 'Mola' : 'Çalışma');
      });
    }
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSnooze = (minutes: number) => {
    if (window.electronAPI?.snoozeBreak) {
      window.electronAPI.snoozeBreak(minutes);
    }
  };

  const handleSkip = () => {
    if (window.electronAPI?.skipBreak) {
      window.electronAPI.skipBreak();
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.icon}>⏰</div>
      <div style={styles.title}>{breakType}</div>
      <div style={styles.timer}>{formatTime(timeLeft)}</div>
      <div style={styles.subtitle}>Kalan süre</div>
      
      <div style={styles.actions}>
        <button 
          style={{ ...styles.btn, ...styles.btnSnooze5 }}
          onClick={() => handleSnooze(5)}
        >
          +5 dk
        </button>
        <button 
          style={{ ...styles.btn, ...styles.btnSnooze10 }}
          onClick={() => handleSnooze(10)}
        >
          +10 dk
        </button>
        <button 
          style={{ ...styles.btn, ...styles.btnSkip }}
          onClick={handleSkip}
        >
          Geç
        </button>
      </div>
    </div>
  );
}
