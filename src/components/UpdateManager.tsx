import React, { useState, useEffect } from 'react';

interface UpdateState {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  version: string;
  progress: number;
}

export default function UpdateManager() {
  const [updateState, setUpdateState] = useState<UpdateState>({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    version: '',
    progress: 0,
  });
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (window.electronAPI?.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable((info: any) => {
        setUpdateState(prev => ({
          ...prev,
          available: true,
          version: info.version,
        }));
        setError('');
      });
    }

    if (window.electronAPI?.onUpdateProgress) {
      window.electronAPI.onUpdateProgress((progress: any) => {
        setUpdateState(prev => ({
          ...prev,
          downloading: true,
          progress: progress.percent,
        }));
      });
    }

    if (window.electronAPI?.onUpdateDownloaded) {
      window.electronAPI.onUpdateDownloaded(() => {
        setUpdateState(prev => ({
          ...prev,
          downloading: false,
          downloaded: true,
        }));
      });
    }
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateState(prev => ({ ...prev, checking: true }));
    setError('');
    try {
      const result = await window.electronAPI?.updateCheck?.();
      if (result?.error) {
        setError(String(result.error));
      }
    } catch (err) {
      console.error('Update check failed:', err);
      setError(String(err));
    }
    setUpdateState(prev => ({ ...prev, checking: false }));
  };

  const handleDownload = async () => {
    setUpdateState(prev => ({ ...prev, downloading: true }));
    await window.electronAPI?.updateDownload?.();
  };

  const handleInstall = () => {
    window.electronAPI?.updateInstall?.();
  };

  if (!updateState.available && !updateState.downloaded) {
    return (
      <div>
        <button 
          className="update-check-btn" 
          onClick={handleCheckForUpdates}
          disabled={updateState.checking}
        >
          {updateState.checking ? 'Kontrol ediliyor...' : '🔄 Güncelleme Kontrol Et'}
        </button>
        {error && (
          <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '8px' }}>
            Hata: {error}
          </div>
        )}
      </div>
    );
  }

  if (updateState.downloaded) {
    return (
      <div className="update-notification update-ready">
        <span>✅ Güncelleme hazır: v{updateState.version}</span>
        <button onClick={handleInstall}>Yükle ve Yeniden Başlat</button>
      </div>
    );
  }

  if (updateState.available) {
    return (
      <div className="update-notification update-available">
        <span>📥 Güncelleme mevcut: v{updateState.version}</span>
        {updateState.downloading ? (
          <div className="update-progress">
            <div 
              className="update-progress-bar" 
              style={{ width: `${updateState.progress}%` }}
            />
            <span>%{Math.round(updateState.progress)}</span>
          </div>
        ) : (
          <button onClick={handleDownload}>İndir</button>
        )}
      </div>
    );
  }

  return null;
}
