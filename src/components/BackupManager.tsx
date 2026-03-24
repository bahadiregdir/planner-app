import React, { useState } from 'react';

export default function BackupManager() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState('');

  const handleExport = async () => {
    setIsExporting(true);
    setMessage('');
    
    try {
      const result = await window.electronAPI?.backupExport?.();
      
      if (result?.canceled) {
        setMessage('');
      } else if (result?.success) {
        setMessage('✅ Yedek başarıyla oluşturuldu');
      } else {
        setMessage('❌ Hata: ' + (result?.error || 'Bilinmeyen hata'));
      }
    } catch (err) {
      setMessage('❌ Hata: ' + String(err));
    }
    
    setIsExporting(false);
  };

  const handleImport = async () => {
    setIsImporting(true);
    setMessage('');
    
    try {
      const result = await window.electronAPI?.backupImport?.();
      
      if (result?.canceled) {
        setMessage('');
      } else if (result?.success) {
        setMessage('✅ Yedek başarıyla yüklendi');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMessage('❌ Hata: ' + (result?.error || 'Bilinmeyen hata'));
      }
    } catch (err) {
      setMessage('❌ Hata: ' + String(err));
    }
    
    setIsImporting(false);
  };

  return (
    <div className="backup-manager">
      <div className="backup-header">
        <span className="backup-title">💾 Veri Yedekleme</span>
      </div>
      
      <div className="backup-actions">
        <button 
          className="backup-btn export"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? 'Kaydediliyor...' : '📤 Yedek Al'}
        </button>
        
        <button 
          className="backup-btn import"
          onClick={handleImport}
          disabled={isImporting}
        >
          {isImporting ? 'Yükleniyor...' : '📥 Yedek Yükle'}
        </button>
      </div>
      
      {message && (
        <div className={`backup-message ${message.startsWith('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
    </div>
  );
}
