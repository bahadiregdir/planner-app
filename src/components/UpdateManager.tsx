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
  const [showModal, setShowModal] = useState(false);

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
    setShowModal(true);
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

  const closeModal = () => {
    setShowModal(false);
    setError('');
    setUpdateState({
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
      version: '',
      progress: 0,
    });
  };

  return (
    <>
      <button 
        className="update-check-btn" 
        onClick={handleCheckForUpdates}
        disabled={updateState.checking}
      >
        {updateState.checking ? 'Kontrol ediliyor...' : '🔄 Güncelleme Kontrol Et'}
      </button>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#1a1a2e',
            borderRadius: '16px',
            padding: '32px',
            minWidth: '320px',
            maxWidth: '400px',
            color: '#fff',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Güncelleme Kontrolü</h2>
            </div>

            {updateState.checking && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #333',
                  borderTop: '4px solid #ff6b6b',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px',
                }} />
                <p>Güncellemeler kontrol ediliyor...</p>
              </div>
            )}

            {error && !updateState.checking && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
                <p style={{ color: '#ef4444', marginBottom: '24px' }}>Hata: {error}</p>
                <button
                  onClick={closeModal}
                  style={{
                    background: '#333',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 32px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Kapat
                </button>
              </div>
            )}

            {!updateState.checking && !error && !updateState.available && !updateState.downloaded && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <p style={{ color: '#10b981', marginBottom: '8px' }}>Güncel sürümdesin!</p>
                <p style={{ color: '#888', fontSize: '14px' }}>Şu anki sürüm en güncel.</p>
                <button
                  onClick={closeModal}
                  style={{
                    background: '#ff6b6b',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 32px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginTop: '16px',
                  }}
                >
                  Tamam
                </button>
              </div>
            )}

            {updateState.available && !updateState.downloaded && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
                <p style={{ color: '#10b981', marginBottom: '8px' }}>Yeni sürüm mevcut!</p>
                <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>
                  v{updateState.version}
                </p>
                {updateState.downloading ? (
                  <div>
                    <div style={{
                      background: '#333',
                      height: '8px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      marginBottom: '8px',
                    }}>
                      <div style={{
                        background: '#ff6b6b',
                        height: '100%',
                        width: `${updateState.progress}%`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <p style={{ fontSize: '14px' }}>%{Math.round(updateState.progress)} indirildi</p>
                  </div>
                ) : (
                  <button
                    onClick={handleDownload}
                    style={{
                      background: '#ff6b6b',
                      color: '#fff',
                      border: 'none',
                      padding: '12px 32px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                    }}
                  >
                    İndir
                  </button>
                )}
                <button
                  onClick={closeModal}
                  style={{
                    background: 'transparent',
                    color: '#888',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginTop: '12px',
                  }}
                >
                  Sonra
                </button>
              </div>
            )}

            {updateState.downloaded && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <p style={{ color: '#10b981', marginBottom: '24px' }}>Güncelleme hazır!</p>
                <button
                  onClick={handleInstall}
                  style={{
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 32px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Yükle ve Yeniden Başlat
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
