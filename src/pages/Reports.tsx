import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Reports.css';

interface DayData {
  date: string;
  workMinutes: number;
  breakMinutes: number;
  sessions: number;
}

interface ProjectStats {
  id: number;
  name: string;
  color: string;
  totalMinutes: number;
}

interface ReportData {
  dailyData: DayData[];
  projectStats: ProjectStats[];
  totalWork: number;
  totalBreak: number;
  totalSessions: number;
  streak: number;
}

export default function Reports() {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadReport();
  }, [period]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      if (period === 'week') {
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate.setDate(startDate.getDate() - 30);
      }

      const dailyData: DayData[] = [];
      const projects = await window.electronAPI.getProjects();

      const projectStats: ProjectStats[] = projects.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        totalMinutes: 0,
      }));

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        let dayWorkMinutes = 0;
        let dayBreakMinutes = 0;
        let daySessions = 0;

        for (const project of projects) {
          const stats = await window.electronAPI.workGetProjectStats(project.id);
          const daySessionsData = stats.sessions.filter((s: any) => s.date === dateStr);
          daySessions += daySessionsData.length;
          dayWorkMinutes += daySessionsData.reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);

          const projectStat = projectStats.find(p => p.id === project.id);
          if (projectStat) {
            projectStat.totalMinutes += daySessionsData.reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
          }
        }

        dailyData.push({
          date: dateStr,
          workMinutes: dayWorkMinutes,
          breakMinutes: dayBreakMinutes,
          sessions: daySessions,
        });
      }

      const totalWork = dailyData.reduce((sum, d) => sum + d.workMinutes, 0);
      const totalBreak = dailyData.reduce((sum, d) => sum + d.breakMinutes, 0);
      const totalSessions = dailyData.reduce((sum, d) => sum + d.sessions, 0);

      let streak = 0;
      for (let i = dailyData.length - 1; i >= 0; i--) {
        if (dailyData[i].workMinutes > 0) {
          streak++;
        } else {
          break;
        }
      }

      setData({
        dailyData,
        projectStats: projectStats.filter(p => p.totalMinutes > 0).sort((a, b) => b.totalMinutes - a.totalMinutes),
        totalWork,
        totalBreak,
        totalSessions,
        streak,
      });
    } catch (err) {
      console.error('Report load error:', err);
    }
    setLoading(false);
  };

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}sa ${m}dk` : `${m}dk`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return `${days[date.getDay()]} ${date.getDate()}`;
  };

  const getMaxMinutes = () => {
    if (!data) return 60;
    return Math.max(...data.dailyData.map(d => d.workMinutes), 30);
  };

  const getBarHeight = (minutes: number) => {
    const max = getMaxMinutes();
    return Math.max((minutes / max) * 120, 4);
  };

  if (loading || !data) {
    return (
      <div className="reports-page">
        <div className="reports-header">
          <h1>Raporlar</h1>
        </div>
        <div className="loading">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div className="reports-header-left">
          <button className="btn-back" onClick={() => navigate('/')}>← Geri</button>
          <h1>Raporlar</h1>
        </div>
        <div className="period-toggle">
          <button 
            className={period === 'week' ? 'active' : ''} 
            onClick={() => setPeriod('week')}
          >
            Haftalık
          </button>
          <button 
            className={period === 'month' ? 'active' : ''} 
            onClick={() => setPeriod('month')}
          >
            Aylık
          </button>
        </div>
      </div>

      <div className="reports-stats">
        <div className="stat-card">
          <span className="stat-value">{formatMinutes(data.totalWork)}</span>
          <span className="stat-label">Toplam Çalışma</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.totalSessions}</span>
          <span className="stat-label">Oturum</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{formatMinutes(data.totalBreak)}</span>
          <span className="stat-label">Toplam Mola</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">🔥 {data.streak}</span>
          <span className="stat-label">Seri</span>
        </div>
      </div>

      <div className="chart-container">
        <h2>Günlük Çalışma</h2>
        <div className="bar-chart">
          {data.dailyData.map((day, i) => (
            <div key={i} className="bar-wrapper">
              <div 
                className="bar"
                style={{ 
                  height: `${getBarHeight(day.workMinutes)}px`,
                  backgroundColor: day.workMinutes > 0 ? '#ff6b6b' : '#1a4a7a',
                }}
                title={`${formatDate(day.date)}: ${formatMinutes(day.workMinutes)}`}
              />
              {period === 'week' && (
                <span className="bar-label">{formatDate(day.date)}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {data.projectStats.length > 0 && (
        <div className="project-stats-container">
          <h2>Proje Bazlı</h2>
          <div className="project-stats-list">
            {data.projectStats.map(project => (
              <div key={project.id} className="project-stat-item">
                <div className="project-color" style={{ backgroundColor: project.color }} />
                <span className="project-name">{project.name}</span>
                <span className="project-time">{formatMinutes(project.totalMinutes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
