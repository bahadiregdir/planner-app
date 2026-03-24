import React, { useState, useEffect } from 'react';

export default function StreakCounter() {
  const [streak, setStreak] = useState(0);
  const [lastActive, setLastActive] = useState<string | null>(null);

  useEffect(() => {
    loadStreak();
  }, []);

  const loadStreak = async () => {
    const savedStreak = await window.electronAPI.settingsGet('streak');
    const savedLastActive = await window.electronAPI.settingsGet('lastActiveDate');
    
    if (savedStreak) setStreak(savedStreak);
    if (savedLastActive) setLastActive(savedLastActive);
    
    const today = new Date().toISOString().split('T')[0];
    const projects = await window.electronAPI.getProjects();
    let hasWorkedToday = false;
    
    for (const project of projects) {
      const stats = await window.electronAPI.workGetProjectStats(project.id);
      const todaySessions = stats.sessions.filter((s: any) => s.date === today);
      if (todaySessions.length > 0) {
        hasWorkedToday = true;
        break;
      }
    }
    
    if (hasWorkedToday) {
      if (savedLastActive !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (savedLastActive === yesterdayStr) {
          const newStreak = (savedStreak || 0) + 1;
          setStreak(newStreak);
          await window.electronAPI.settingsSet('streak', newStreak);
        } else if (savedLastActive !== today) {
          setStreak(1);
          await window.electronAPI.settingsSet('streak', 1);
        }
      }
      
      setLastActive(today);
      await window.electronAPI.settingsSet('lastActiveDate', today);
    }
  };

  return (
    <div className="streak-counter">
      <div className="streak-icon">🔥</div>
      <div className="streak-info">
        <span className="streak-count">{streak}</span>
        <span className="streak-label">Gün Seri</span>
      </div>
      {streak > 0 && (
        <div className="streak-message">
          {streak >= 7 ? '🏆 Harika!' : streak >= 3 ? '💪 Devam et!' : '✨ Başlangıç!'}
        </div>
      )}
    </div>
  );
}
