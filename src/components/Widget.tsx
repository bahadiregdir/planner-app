import React, { useState, useEffect } from 'react';

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#16213e',
    borderRadius: '10px',
    padding: '15px',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '11px',
    color: '#888',
    marginBottom: '10px',
  },
  time: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#ff6b6b',
  },
  timeBreak: {
    color: '#10b981',
  },
  status: {
    fontSize: '11px',
    color: '#666',
    marginTop: '5px',
  },
  controls: {
    display: 'flex',
    gap: '8px',
    marginTop: '15px',
  },
  btn: {
    padding: '5px 15px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold' as const,
  },
  btnStart: {
    backgroundColor: '#ff6b6b',
    color: '#fff',
  },
  btnPause: {
    backgroundColor: '#f59e0b',
    color: '#fff',
  },
  btnStop: {
    backgroundColor: '#2a4a6f',
    color: '#888',
  },
};

export default function Widget() {
  const [state, setState] = useState({
    isWorking: false,
    isBreak: false,
    timeLeft: 0,
    isPaused: false,
  });

  useEffect(() => {
    if (window.electronAPI?.onTrayState) {
      window.electronAPI.onTrayState((s: any) => setState(s));
    }
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>⏱️ Pomodoro</div>
      <div style={{ ...styles.time, ...(state.isBreak ? styles.timeBreak : {}) }}>
        {formatTime(state.timeLeft)}
      </div>
      <div style={styles.status}>
        {!state.isWorking ? 'Durdu' : state.isPaused ? 'Duraklatıldı' : state.isBreak ? 'Mola' : 'Çalışıyor'}
      </div>
      <div style={styles.controls}>
        {state.isWorking && (
          <button style={{ ...styles.btn, ...styles.btnPause }}>{state.isPaused ? 'Devam' : 'Duraklat'}</button>
        )}
        {state.isWorking && (
          <button style={{ ...styles.btn, ...styles.btnStop }}>Bitir</button>
        )}
      </div>
    </div>
  );
}
