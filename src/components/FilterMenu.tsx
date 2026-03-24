import React, { useState } from 'react';
import { Tag } from '../types';

export interface FilterState {
  status: string | null;
  priority: number | null;
  dueDate: string | null;
  tagId: number | null;
}

interface FilterMenuProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  tags: Tag[];
}

export default function FilterMenu({ filters, onFiltersChange, tags }: FilterMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = Object.values(filters).filter(v => v !== null).length;

  const handleStatusChange = (status: string | null) => {
    onFiltersChange({ ...filters, status });
  };

  const handlePriorityChange = (priority: number | null) => {
    onFiltersChange({ ...filters, priority });
  };

  const handleDueDateChange = (dueDate: string | null) => {
    onFiltersChange({ ...filters, dueDate });
  };

  const handleTagChange = (tagId: number | null) => {
    onFiltersChange({ ...filters, tagId });
  };

  const clearFilters = () => {
    onFiltersChange({ status: null, priority: null, dueDate: null, tagId: null });
  };

  return (
    <div className="filter-menu">
      <button 
        className={`filter-toggle ${activeCount > 0 ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        Filtrele {activeCount > 0 && `(${activeCount})`}
      </button>
      
      {isOpen && (
        <div className="filter-dropdown">
          <div className="filter-section">
            <label>Durum</label>
            <div className="filter-options">
              <button 
                className={`filter-option ${filters.status === null ? 'active' : ''}`}
                onClick={() => handleStatusChange(null)}
              >
                Tümü
              </button>
              <button 
                className={`filter-option ${filters.status === 'todo' ? 'active' : ''}`}
                onClick={() => handleStatusChange('todo')}
              >
                Yapılacak
              </button>
              <button 
                className={`filter-option ${filters.status === 'inprogress' ? 'active' : ''}`}
                onClick={() => handleStatusChange('inprogress')}
              >
                Devam Ediyor
              </button>
              <button 
                className={`filter-option ${filters.status === 'done' ? 'active' : ''}`}
                onClick={() => handleStatusChange('done')}
              >
                Tamamlandı
              </button>
            </div>
          </div>

          <div className="filter-section">
            <label>Öncelik</label>
            <div className="filter-options">
              <button 
                className={`filter-option ${filters.priority === null ? 'active' : ''}`}
                onClick={() => handlePriorityChange(null)}
              >
                Tümü
              </button>
              <button 
                className={`filter-option priority-low ${filters.priority === 0 ? 'active' : ''}`}
                onClick={() => handlePriorityChange(0)}
              >
                Düşük
              </button>
              <button 
                className={`filter-option priority-medium ${filters.priority === 1 ? 'active' : ''}`}
                onClick={() => handlePriorityChange(1)}
              >
                Orta
              </button>
              <button 
                className={`filter-option priority-high ${filters.priority === 2 ? 'active' : ''}`}
                onClick={() => handlePriorityChange(2)}
              >
                Yüksek
              </button>
            </div>
          </div>

          <div className="filter-section">
            <label>Bitiş Tarihi</label>
            <div className="filter-options">
              <button 
                className={`filter-option ${filters.dueDate === null ? 'active' : ''}`}
                onClick={() => handleDueDateChange(null)}
              >
                Tümü
              </button>
              <button 
                className={`filter-option ${filters.dueDate === 'overdue' ? 'active' : ''}`}
                onClick={() => handleDueDateChange('overdue')}
              >
                Gecikmiş
              </button>
              <button 
                className={`filter-option ${filters.dueDate === 'today' ? 'active' : ''}`}
                onClick={() => handleDueDateChange('today')}
              >
                Bugün
              </button>
              <button 
                className={`filter-option ${filters.dueDate === 'week' ? 'active' : ''}`}
                onClick={() => handleDueDateChange('week')}
              >
                Bu Hafta
              </button>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="filter-section">
              <label>Etiket</label>
              <div className="filter-options tags">
                <button 
                  className={`filter-option ${filters.tagId === null ? 'active' : ''}`}
                  onClick={() => handleTagChange(null)}
                >
                  Tümü
                </button>
                {tags.map(tag => (
                  <button 
                    key={tag.id}
                    className={`filter-option tag-filter ${filters.tagId === tag.id ? 'active' : ''}`}
                    onClick={() => handleTagChange(tag.id)}
                    style={{ backgroundColor: filters.tagId === tag.id ? tag.color : undefined }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeCount > 0 && (
            <button className="filter-clear" onClick={clearFilters}>
              Filtreleri Temizle
            </button>
          )}
        </div>
      )}
    </div>
  );
}
