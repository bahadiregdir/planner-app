import React, { useState, useEffect } from 'react';
import './TrayWidget.css';

export default function TrayWidget() {
  const [timerState, setTimerState] = useState({
    isWorking: false,
    isBreak: false,
    timeLeft: 0,
    isPaused: false,
  });

  useEffect(() => {
    if (window.electronAPI?.onTrayState) {
      window.electronAPI.onTrayState((state: any) => {
        setTimerState(state);
      });
    }
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="tray-widget">
      <div className="tray-header">
        <span className="tray-icon">⏱️</span>
        <span className="tray-title">Pomodoro</span>
      </div>
      
      <div className="tray-timer">
        <span className={`tray-time ${timerState.isBreak ? 'break' : ''}`}>
          {formatTime(timerState.timeLeft)}
        </span>
        <span className="tray-status">
          {!timerState.isWorking ? 'Durdu' : 
           timerState.isPaused ? 'Duraklatıldı' : 
           timerState.isBreak ? 'Mola' : 'Çalışıyor'}
        </span>
      </div>
    </div>
  );
}
