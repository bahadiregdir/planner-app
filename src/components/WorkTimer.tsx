import React, { useState, useEffect, useRef } from 'react';
import './WorkTimer.css';

interface WorkTimerProps {
  projectId?: number;
  onClose?: () => void;
}

interface TimerSettings {
  workDuration: number;
  breakDuration: number;
}

interface Session {
  id: number;
  date: string;
  start_time: string;
  end_time?: string;
  break_minutes: number;
  work_minutes: number;
  status: string;
}

export default function WorkTimer({ projectId, onClose }: WorkTimerProps) {
  const [isWorking, setIsWorking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [sessions, setSessions] = useState<number>(0);
  const [totalWorkMinutes, setTotalWorkMinutes] = useState(0);
  const [projectStats, setProjectStats] = useState<{ totalMinutes: number }>({ totalMinutes: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<TimerSettings>({
    workDuration: 25,
    breakDuration: 5,
  });
  const [showLunchModal, setShowLunchModal] = useState(false);
  const [lunchDuration, setLunchDuration] = useState(60);
  const [isLunchBreak, setIsLunchBreak] = useState(false);
  const [showBreakLock, setShowBreakLock] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const [breakType, setBreakType] = useState('');
  const [showEndModal, setShowEndModal] = useState(false);
  const [report, setReport] = useState<{ sessions: Session[]; totalWork: number; totalBreak: number } | null>(null);
  const [showPreBreakWarning, setShowPreBreakWarning] = useState(false);
  const [preBreakCountdown, setPreBreakCountdown] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const preBreakTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const breakTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSettings();
    checkProjectSession();
  }, [projectId]);

  useEffect(() => {
    if (window.electronAPI?.updateTrayState) {
      window.electronAPI.updateTrayState({
        isWorking,
        isBreak: isBreak || isLunchBreak,
        timeLeft: isBreak || isLunchBreak ? breakTimeLeft : timeLeft,
        isPaused,
      });
    }
  }, [isWorking, isBreak, isLunchBreak, timeLeft, breakTimeLeft, isPaused]);

  useEffect(() => {
    if (isWorking && !isPaused && !isBreak && !isLunchBreak) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleWorkComplete();
            return settings.workDuration * 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isWorking, isPaused, isBreak, isLunchBreak]);

  useEffect(() => {
    if (showBreakLock && breakTimeLeft > 0) {
      breakTimerRef.current = setInterval(() => {
        setBreakTimeLeft(prev => {
          if (prev <= 1) {
            handleBreakEnd();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    }
    return () => { if (breakTimerRef.current) clearInterval(breakTimerRef.current); };
  }, [showBreakLock, breakTimeLeft]);

  const loadSettings = async () => {
    const saved = await window.electronAPI.settingsGet('timerSettings');
    if (saved) setSettings(saved);
  };

  const saveSettings = async (newSettings: TimerSettings) => {
    setSettings(newSettings);
    await window.electronAPI.settingsSet('timerSettings', newSettings);
  };

  const checkProjectSession = async () => {
    if (projectId) {
      const session = await window.electronAPI.workGetProjectToday(projectId);
      if (session) {
        setIsWorking(true);
      }
      const stats = await window.electronAPI.workGetProjectStats(projectId);
      if (stats) {
        setProjectStats(stats);
        setTotalWorkMinutes(stats.totalMinutes);
      }
    }
  };

  const startWork = async () => {
    if (projectId) {
      await window.electronAPI.workStart(projectId);
    }
    setIsWorking(true);
    setIsPaused(false);
    setTimeLeft(settings.workDuration * 60);
    window.electronAPI.showNotification('Çalışma Başladı', 'Başarılar! Pomodoro başlasın.');
  };

  const stopWork = async () => {
    if (projectId) {
      const result = await window.electronAPI.workStop();
      if (result) {
        const newTotal = totalWorkMinutes + (result.duration_minutes || 0);
        setTotalWorkMinutes(newTotal);
        setProjectStats({ totalMinutes: newTotal });
      }
    }
    setIsWorking(false);
    setIsPaused(false);
    setIsBreak(false);
    setIsLunchBreak(false);
  };

  const handleWorkComplete = async () => {
    setSessions(prev => prev + 1);
    setTotalWorkMinutes(prev => prev + settings.workDuration);
    
    await window.electronAPI.showNotification('Süre Doldu!', 'Mola zamanı!');
    showPreBreakCountdown();
  };

  const showPreBreakCountdown = () => {
    setPreBreakCountdown(120);
    setShowPreBreakWarning(true);
    
    if (preBreakTimerRef.current) clearInterval(preBreakTimerRef.current);
    
    preBreakTimerRef.current = setInterval(() => {
      setPreBreakCountdown(prev => {
        if (prev <= 1) {
          if (preBreakTimerRef.current) clearInterval(preBreakTimerRef.current);
          setShowPreBreakWarning(false);
          startBreak();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const confirmBreakStart = () => {
    if (preBreakTimerRef.current) clearInterval(preBreakTimerRef.current);
    setShowPreBreakWarning(false);
    startBreak();
  };

  const startBreak = () => {
    setBreakType('mola');
    setBreakTimeLeft(settings.breakDuration * 60);
    setShowBreakLock(true);
  };

  const handleBreakEnd = () => {
    setShowBreakLock(false);
    setBreakTimeLeft(0);
    setIsBreak(false);
    setTimeLeft(settings.workDuration * 60);
    window.electronAPI.showNotification('Mola Bitti', 'Çalışmaya devam edebilirsin!');
  };

  const skipBreak = () => {
    if (preBreakTimerRef.current) clearInterval(preBreakTimerRef.current);
    setShowBreakLock(false);
    setShowPreBreakWarning(false);
    setPreBreakCountdown(0);
    setBreakTimeLeft(0);
    setIsBreak(false);
    setTimeLeft(settings.workDuration * 60);
  };

  const snoozeBreak = (minutes: number) => {
    setBreakTimeLeft(prev => prev + minutes * 60);
  };

  const startLunchBreak = () => {
    setIsLunchBreak(true);
    setLunchDuration(60);
    setBreakTimeLeft(lunchDuration * 60);
    setShowBreakLock(true);
    setBreakType('lunch');
    window.electronAPI.showNotification('Öğle Arası', 'Afiyet olsun! 🍽️');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
  };

  const showEndOfDayReport = async () => {
    if (!projectId) return;
    const stats = await window.electronAPI.workGetProjectStats(projectId);
    setReport({ sessions: stats.sessions, totalWork: stats.totalMinutes, totalBreak: 0 });
    setShowEndModal(true);
    window.electronAPI.showNotification('Proje Çalışması Bitti', `Toplam ${formatMinutes(stats.totalMinutes)} çalıştın!`);
  };

  return (
    <div className={`work-timer ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="timer-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <h3>⏱️ Pomodoro</h3>
        <span className="collapse-icon">{isCollapsed ? '▼' : '▲'}</span>
      </div>

      {!isCollapsed && (
        <>
          {showPreBreakWarning && (
            <div className="pre-break-overlay">
              <div className="pre-break-content">
                <h2>⏰ Mola Yakında!</h2>
                <div className="pre-break-timer">{Math.floor(preBreakCountdown / 60)}:{(preBreakCountdown % 60).toString().padStart(2, '0')}</div>
                <p>Otomatik başlayacak</p>
                <div className="pre-break-actions">
                  <button className="start-btn" onClick={confirmBreakStart}>Mola Başlasın</button>
                </div>
              </div>
            </div>
          )}

          {showBreakLock && (
            <div className="break-lock">
              <div className="break-lock-content">
                <h2>{breakType === 'lunch' ? '🍽️ Öğle Arası' : breakType === 'long' ? '☕ Uzun Mola' : '⏰ Mola'}</h2>
                <div className="break-timer">{formatTime(breakTimeLeft)}</div>
                <div className="break-actions">
                  {breakType !== 'lunch' && (
                    <>
                      <button onClick={() => snoozeBreak(5)}>+5 dk ertele</button>
                      <button onClick={() => snoozeBreak(10)}>+10 dk ertele</button>
                    </>
                  )}
                  <button className="skip-btn" onClick={skipBreak}>Molayı Geç</button>
                </div>
              </div>
            </div>
          )}

          <div className="timer-controls-mini">
            <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>⚙️</button>
          </div>

          {showSettings && (
            <div className="settings-panel">
              <label>Çalışma süresi (dk): <input type="number" value={settings.workDuration} onChange={e => saveSettings({...settings, workDuration: Number(e.target.value)})} /></label>
              <label>Mola süresi (dk): <input type="number" value={settings.breakDuration} onChange={e => saveSettings({...settings, breakDuration: Number(e.target.value)})} /></label>
            </div>
          )}

          <div className="timer-display">
            <div className={`timer-circle ${isWorking && !isPaused ? 'active' : ''}`}>
              <span className="timer-time">{formatTime(isWorking ? timeLeft : settings.workDuration * 60)}</span>
              <span className="timer-status">
                {!isWorking ? 'Başlamadı' : isPaused ? 'Durduruldu' : isLunchBreak ? 'Öğle Arası' : isBreak ? 'Mola' : 'Çalışıyor'}
              </span>
            </div>
          </div>

          <div className="timer-controls">
            {!isWorking ? (
              <button className="start-btn" onClick={startWork}>Başla</button>
            ) : (
              <>
                <button className="pause-btn" onClick={() => setIsPaused(!isPaused)}>{isPaused ? 'Devam' : 'Durdur'}</button>
                <button className="stop-btn" onClick={stopWork}>Bitir</button>
              </>
            )}
          </div>

          <div className="timer-stats">
            <div className="stat">
              <span className="stat-value">{sessions}</span>
              <span className="stat-label">Oturum</span>
            </div>
            <div className="stat">
              <span className="stat-value">{formatMinutes(totalWorkMinutes)}</span>
              <span className="stat-label">Toplam</span>
            </div>
          </div>

          <div className="timer-extras">
            <button className="lunch-btn" onClick={() => setShowLunchModal(true)}>🍽️ Öğle</button>
            <button className="report-btn" onClick={showEndOfDayReport}>📊</button>
          </div>

          {showLunchModal && (
            <div className="modal-overlay" onClick={() => setShowLunchModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Öğle Arası</h3>
                <label>Kaç dakika? <input type="number" value={lunchDuration} onChange={e => setLunchDuration(Number(e.target.value))} /></label>
                <div className="modal-actions">
                  <button onClick={() => setShowLunchModal(false)}>İptal</button>
                  <button className="start-btn" onClick={() => { setShowLunchModal(false); startLunchBreak(); }}>Başlat</button>
                </div>
              </div>
            </div>
          )}

          {showEndModal && report && (
            <div className="modal-overlay" onClick={() => setShowEndModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>📊 Rapor</h3>
                <div className="report-content">
                  <p>Toplam: <strong>{formatMinutes(report.totalWork)}</strong></p>
                </div>
                <div className="modal-actions">
                  <button onClick={() => setShowEndModal(false)}>Kapat</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {isCollapsed && isWorking && !isPaused && (
        <div className="timer-mini-display">
          <span className="timer-time-mini">{formatTime(timeLeft)}</span>
          <span className="timer-status-mini">{isBreak ? 'Mola' : 'Çalışıyor'}</span>
        </div>
      )}
    </div>
  );
}
