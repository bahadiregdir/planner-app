import React, { useState, useEffect } from 'react';
import DailyGoal from './DailyGoal';
import StreakCounter from './StreakCounter';

export default function MotivationSection() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [dailyGoal, setDailyGoal] = useState({ completed: 0, target: 8 });
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const savedTarget = await window.electronAPI.settingsGet('dailyGoal');
    const savedStreak = await window.electronAPI.settingsGet('streak');
    const target = savedTarget || 8;
    
    if (savedStreak) setStreak(savedStreak);
    
    const today = new Date().toISOString().split('T')[0];
    const projects = await window.electronAPI.getProjects();
    let totalSessions = 0;
    
    for (const project of projects) {
      const stats = await window.electronAPI.workGetProjectStats(project.id);
      const todaySessions = stats.sessions.filter((s: any) => s.date === today);
      totalSessions += todaySessions.length;
    }
    
    setDailyGoal({ completed: totalSessions, target });
  };

  return (
    <div className={`motivation-section ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="motivation-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <span className="motivation-title">📊 İstatistikler</span>
        <span className="collapse-icon">{isCollapsed ? '▼' : '▲'}</span>
      </div>
      
      {!isCollapsed && (
        <div className="motivation-content">
          <DailyGoal />
          <StreakCounter />
        </div>
      )}
      
      {isCollapsed && (
        <div className="motivation-mini">
          <span className="mini-goal">🎯 {dailyGoal.completed}/{dailyGoal.target}</span>
          <span className="mini-streak">🔥 {streak} gün</span>
        </div>
      )}
    </div>
  );
}
