import React, { useState, useEffect } from 'react';

interface DailyGoalProps {
  dailyTarget?: number;
  onTargetChange?: (target: number) => void;
}

export default function DailyGoal({ dailyTarget = 8, onTargetChange }: DailyGoalProps) {
  const [target, setTarget] = useState(dailyTarget);
  const [completed, setCompleted] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(dailyTarget));

  useEffect(() => {
    loadGoal();
  }, []);

  const loadGoal = async () => {
    const savedTarget = await window.electronAPI.settingsGet('dailyGoal');
    if (savedTarget) setTarget(savedTarget);
    setEditValue(String(savedTarget || target));
    
    const today = new Date().toISOString().split('T')[0];
    const projects = await window.electronAPI.getProjects();
    let totalSessions = 0;
    
    for (const project of projects) {
      const stats = await window.electronAPI.workGetProjectStats(project.id);
      const todaySessions = stats.sessions.filter((s: any) => s.date === today);
      totalSessions += todaySessions.length;
    }
    setCompleted(totalSessions);
  };

  const handleSave = async () => {
    const newTarget = parseInt(editValue) || 8;
    setTarget(newTarget);
    await window.electronAPI.settingsSet('dailyGoal', newTarget);
    if (onTargetChange) onTargetChange(newTarget);
    setIsEditing(false);
  };

  const percentage = Math.min((completed / target) * 100, 100);
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="daily-goal">
      <div className="goal-header">
        <span className="goal-title">Günlük Hedef</span>
        {isEditing ? (
          <div className="goal-edit">
            <input 
              type="number" 
              value={editValue} 
              onChange={e => setEditValue(e.target.value)}
              min="1"
              max="20"
            />
            <button onClick={handleSave}>✓</button>
            <button onClick={() => setIsEditing(false)}>×</button>
          </div>
        ) : (
          <button className="goal-edit-btn" onClick={() => setIsEditing(true)}>✏️</button>
        )}
      </div>
      
      <div className="goal-progress">
        <svg className="goal-circle" width="80" height="80">
          <circle
            className="goal-bg"
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            strokeWidth="6"
          />
          <circle
            className="goal-fill"
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="goal-text">
          <span className="goal-count">{completed}</span>
          <span className="goal-target">/{target}</span>
        </div>
      </div>
      
      <div className="goal-label">
        {completed >= target ? '🎉 Hedefe Ulaştın!' : `${target - completed} oturum daha`}
      </div>
    </div>
  );
}
