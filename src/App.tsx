import React, { useState, useEffect, useRef } from 'react';
import { Project, Todo, Tag, Subtask } from './types';
import { useNavigate } from 'react-router-dom';
import { useTheme } from './context/ThemeContext';
import WorkTimer from './components/WorkTimer';
import TagSelector from './components/TagSelector';
import SubtaskList from './components/SubtaskList';
import SearchBar from './components/SearchBar';
import FilterMenu, { FilterState } from './components/FilterMenu';
import MotivationSection from './components/MotivationSection';
import UpdateManager from './components/UpdateManager';
import BackupManager from './components/BackupManager';
import './App.css';

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [todos, setTodos] = useState<Todo[]>( []);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [draggedTodo, setDraggedTodo] = useState<Todo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: null,
    priority: null,
    dueDate: null,
    tagId: null,
  });
  const titleInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadTodos(selectedProject.id);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (window.electronAPI?.onShortcut) {
      window.electronAPI.onShortcut((shortcut: string) => {
        if (shortcut === 'newTodo' && selectedProject) {
          setEditingTodo(null);
          setShowTodoModal(true);
          setTimeout(() => titleInputRef.current?.focus(), 100);
        } else if (shortcut === 'bulkAdd' && selectedProject) {
          setShowBulkModal(true);
        }
      });
    }
  }, [selectedProject]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (selectedProject && !showProjectModal && !showBulkModal) {
          setEditingTodo(null);
          setShowTodoModal(true);
          setTimeout(() => titleInputRef.current?.focus(), 100);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        if (selectedProject && !showProjectModal && !showTodoModal) {
          setShowBulkModal(true);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setShowProjectModal(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        searchInput?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        navigate('/reports');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProject, showProjectModal, showTodoModal, showBulkModal, navigate, toggleTheme]);

  const loadProjects = async () => {
    const data = await window.electronAPI.getProjects();
    setProjects(data);
  };

  const loadTodos = async (projectId: number) => {
    const data = await window.electronAPI.getTodos(projectId);
    const tags = await window.electronAPI.tagsGetAll(projectId);
    setAllTags(tags);
    
    const todosWithDetails = await Promise.all(data.map(async (todo) => {
      const todoTags = await window.electronAPI.tagsGetByTodo(todo.id);
      const subtasks = await window.electronAPI.subtasksGetByTodo(todo.id);
      return { ...todo, tags: todoTags, subtasks };
    }));
    setTodos(todosWithDetails);
  };

  const filterTodos = (todoList: Todo[]) => {
    return todoList.filter(todo => {
      if (searchQuery && !todo.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      if (filters.status !== null && todo.status !== filters.status) {
        return false;
      }
      
      if (filters.priority !== null && todo.priority !== filters.priority) {
        return false;
      }
      
      if (filters.dueDate !== null && todo.due_date) {
        const dueDate = new Date(todo.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (filters.dueDate === 'overdue' && dueDate < today) {
        } else if (filters.dueDate === 'today') {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (!(dueDate >= today && dueDate < tomorrow)) return false;
        } else if (filters.dueDate === 'week') {
          const weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() + 7);
          if (!(dueDate >= today && dueDate <= weekEnd)) return false;
        }
      } else if (filters.dueDate !== null && !todo.due_date) {
        return false;
      }
      
      if (filters.tagId !== null) {
        if (!todo.tags || !todo.tags.some(t => t.id === filters.tagId)) {
          return false;
        }
      }
      
      return true;
    }).sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
  };

  const filteredTodos = filterTodos(todos);
  const todoTodos = filteredTodos.filter(t => t.status === 'todo');
  const inProgressTodos = filteredTodos.filter(t => t.status === 'inprogress');
  const doneTodos = filteredTodos.filter(t => t.status === 'done');

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const color = formData.get('color') as string;

    if (editingProject) {
      await window.electronAPI.updateProject({ id: editingProject.id, name, description, color });
    } else {
      await window.electronAPI.createProject({ name, description, color });
    }
    setShowProjectModal(false);
    setEditingProject(null);
    loadProjects();
  };

  const handleDeleteProject = async (id: number) => {
    if (confirm('Projeyi silmek istediğinize emin misiniz?')) {
      await window.electronAPI.deleteProject(id);
      if (selectedProject?.id === id) {
        setSelectedProject(null);
        setTodos([]);
      }
      loadProjects();
    }
  };

  const handleCreateTodo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProject) return;
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const priority = Number(formData.get('priority') || 1);
    const due_date = (formData.get('due_date') as string) || null;

    if (editingTodo) {
      await window.electronAPI.updateTodo({ id: editingTodo.id, title, priority, due_date: due_date || undefined });
    } else {
      await window.electronAPI.createTodo({ project_id: selectedProject.id, title, priority, due_date: due_date || undefined });
    }
    setShowTodoModal(false);
    setEditingTodo(null);
    loadTodos(selectedProject.id);
  };

  const handleDeleteTodo = async (id: number) => {
    if (!selectedProject) return;
    await window.electronAPI.deleteTodo(id);
    loadTodos(selectedProject.id);
  };

  const handleBulkImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProject) return;
    const formData = new FormData(e.currentTarget);
    const bulkText = formData.get('bulktodos') as string;
    const lines = bulkText.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const trimmed = line.trim();
      const dashMatch = trimmed.match(/^[-•]\s*/);
      const cleanTitle = dashMatch ? trimmed.slice(dashMatch[0].length) : trimmed;
      await window.electronAPI.createTodo({
        project_id: selectedProject.id,
        title: cleanTitle,
      });
    }
    setShowBulkModal(false);
    loadTodos(selectedProject.id);
  };

  const handleCopyTodo = (title: string) => {
    navigator.clipboard.writeText(title);
  };

  const handleDragStart = (todo: Todo) => {
    setDraggedTodo(todo);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: 'todo' | 'inprogress' | 'done') => {
    if (!draggedTodo || !selectedProject) return;
    await window.electronAPI.updateTodoStatus({ id: draggedTodo.id, status });
    setDraggedTodo(null);
    loadTodos(selectedProject.id);
  };

  const getProgress = () => {
    if (todos.length === 0) return 0;
    const done = todos.filter(t => t.status === 'done').length;
    return Math.round((done / todos.length) * 100);
  };

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {!sidebarCollapsed && (
          <>
            <div className="sidebar-header">
              <h1>Planner</h1>
              <div className="sidebar-actions">
                <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}>
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
                <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(true)} title="Sidebar'ı Daralt">
                  ◀
                </button>
              </div>
            </div>
            <WorkTimer />
            <MotivationSection />
            <button className="btn-reports" onClick={() => navigate('/reports')}>
              📊 Raporlar
            </button>
            <BackupManager />
            <UpdateManager />
            <h2>Projeler</h2>
            <button className="btn-primary" onClick={() => { setEditingProject(null); setShowProjectModal(true); }}>
              + Yeni Proje
            </button>
            <div className="project-list">
              {projects.map(project => (
                <div
                  key={project.id}
                  className={`project-item ${selectedProject?.id === project.id ? 'active' : ''}`}
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="project-color" style={{ backgroundColor: project.color }}></div>
                  <div className="project-info">
                    <div className="project-name">{project.name}</div>
                    {project.description && <div className="project-desc">{project.description}</div>}
                  </div>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}>×</button>
                </div>
              ))}
            </div>
          </>
        )}
        {sidebarCollapsed && (
          <div className="sidebar-collapsed-content">
            <button className="sidebar-expand" onClick={() => setSidebarCollapsed(false)} title="Sidebar'ı Genişlet">
              ▶
            </button>
            <button className="sidebar-btn" onClick={() => navigate('/')} title="Ana Sayfa">🏠</button>
            <button className="sidebar-btn" onClick={() => navigate('/reports')} title="Raporlar">📊</button>
            <button className="sidebar-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        )}
      </div>

      <div className="main-content">
        {selectedProject ? (
          <>
            <div className="project-header">
              <div>
                <h1>{selectedProject.name}</h1>
                {selectedProject.description && <p>{selectedProject.description}</p>}
              </div>
              <div className="progress-container">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${getProgress()}%` }}></div>
                </div>
                <span className="progress-text">%{getProgress()} Tamamlandı</span>
              </div>
            </div>

            <button className="btn-primary" onClick={() => { setEditingTodo(null); setShowTodoModal(true); }}>
              + Yeni Görev
            </button>
            <button className="btn-secondary" onClick={() => setShowBulkModal(true)}>
              Toplu Ekle
            </button>

            <div className="search-filter-container">
              <SearchBar 
                value={searchQuery} 
                onChange={setSearchQuery}
                placeholder="Görevlerde ara..."
              />
              <FilterMenu 
                filters={filters} 
                onFiltersChange={setFilters}
                tags={allTags}
              />
            </div>

            <div className="kanban-board">
              <div
                className="kanban-column"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop('todo')}
              >
                <h3>Yapılacak ({todoTodos.length})</h3>
                {todoTodos.map(todo => (
                  <div
                    key={todo.id}
                    className={`todo-card priority-${todo.priority}`}
                    draggable
                    onDragStart={() => handleDragStart(todo)}
                  >
                    <div className="todo-card-header">
                      <div className="todo-title">{todo.title}</div>
                      <span className={`priority-badge priority-${todo.priority}`}>
                        {todo.priority === 0 ? 'Düşük' : todo.priority === 1 ? 'Orta' : 'Yüksek'}
                      </span>
                    </div>
                    {todo.description && <div className="todo-desc">{todo.description}</div>}
                    {todo.tags && todo.tags.length > 0 && (
                      <div className="todo-tags">
                        {todo.tags.map(tag => (
                          <span key={tag.id} className="tag" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                        ))}
                      </div>
                    )}
                    {todo.due_date && (
                      <div className={`todo-due ${new Date(todo.due_date) < new Date() ? 'overdue' : ''}`}>
                        📅 {todo.due_date}
                      </div>
                    )}
                    {todo.subtasks && todo.subtasks.length > 0 && (
                      <div className="todo-subtasks">
                        ✅ {todo.subtasks.filter(s => s.completed).length}/{todo.subtasks.length}
                      </div>
                    )}
                    <div className="todo-actions">
                      <button onClick={() => handleCopyTodo(todo.title)}>Kopyala</button>
                      <button onClick={() => { setEditingTodo(todo); setShowTodoModal(true); }}>Düzenle</button>
                      <button onClick={() => handleDeleteTodo(todo.id)}>Sil</button>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="kanban-column"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop('inprogress')}
              >
                <h3>Devam Ediyor ({inProgressTodos.length})</h3>
                {inProgressTodos.map(todo => (
                  <div
                    key={todo.id}
                    className={`todo-card inprogress priority-${todo.priority}`}
                    draggable
                    onDragStart={() => handleDragStart(todo)}
                  >
                    <div className="todo-card-header">
                      <div className="todo-title">{todo.title}</div>
                      <span className={`priority-badge priority-${todo.priority}`}>
                        {todo.priority === 0 ? 'Düşük' : todo.priority === 1 ? 'Orta' : 'Yüksek'}
                      </span>
                    </div>
                    {todo.description && <div className="todo-desc">{todo.description}</div>}
                    {todo.tags && todo.tags.length > 0 && (
                      <div className="todo-tags">
                        {todo.tags.map(tag => (
                          <span key={tag.id} className="tag" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                        ))}
                      </div>
                    )}
                    {todo.due_date && (
                      <div className={`todo-due ${new Date(todo.due_date) < new Date() ? 'overdue' : ''}`}>
                        📅 {todo.due_date}
                      </div>
                    )}
                    {todo.subtasks && todo.subtasks.length > 0 && (
                      <div className="todo-subtasks">
                        ✅ {todo.subtasks.filter(s => s.completed).length}/{todo.subtasks.length}
                      </div>
                    )}
                    <div className="todo-actions">
                      <button onClick={() => handleCopyTodo(todo.title)}>Kopyala</button>
                      <button onClick={() => { setEditingTodo(todo); setShowTodoModal(true); }}>Düzenle</button>
                      <button onClick={() => handleDeleteTodo(todo.id)}>Sil</button>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="kanban-column"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop('done')}
              >
                <h3>Tamamlandı ({doneTodos.length})</h3>
                {doneTodos.map(todo => (
                  <div
                    key={todo.id}
                    className={`todo-card done priority-${todo.priority}`}
                    draggable
                    onDragStart={() => handleDragStart(todo)}
                  >
                    <div className="todo-card-header">
                      <div className="todo-title">{todo.title}</div>
                      <span className={`priority-badge priority-${todo.priority}`}>
                        {todo.priority === 0 ? 'Düşük' : todo.priority === 1 ? 'Orta' : 'Yüksek'}
                      </span>
                    </div>
                    {todo.description && <div className="todo-desc">{todo.description}</div>}
                    {todo.tags && todo.tags.length > 0 && (
                      <div className="todo-tags">
                        {todo.tags.map(tag => (
                          <span key={tag.id} className="tag" style={{ backgroundColor: tag.color }}>{tag.name}</span>
                        ))}
                      </div>
                    )}
                    {todo.due_date && (
                      <div className={`todo-due ${new Date(todo.due_date) < new Date() ? 'overdue' : ''}`}>
                        📅 {todo.due_date}
                      </div>
                    )}
                    {todo.subtasks && todo.subtasks.length > 0 && (
                      <div className="todo-subtasks">
                        ✅ {todo.subtasks.filter(s => s.completed).length}/{todo.subtasks.length}
                      </div>
                    )}
                    <div className="todo-actions">
                      <button onClick={() => handleCopyTodo(todo.title)}>Kopyala</button>
                      <button onClick={() => { setEditingTodo(todo); setShowTodoModal(true); }}>Düzenle</button>
                      <button onClick={() => handleDeleteTodo(todo.id)}>Sil</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>Hoş Geldiniz!</h2>
            <p>Başlamak için bir proje seçin veya yeni proje oluşturun.</p>
          </div>
        )}
      </div>

      {showProjectModal && (
        <div className="modal-overlay" onClick={() => setShowProjectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingProject ? 'Proje Düzenle' : 'Yeni Proje'}</h3>
            <form onSubmit={handleCreateProject}>
              <input name="name" placeholder="Proje Adı" defaultValue={editingProject?.name} required />
              <textarea name="description" placeholder="Açıklama" defaultValue={editingProject?.description} />
              <select name="color" defaultValue={editingProject?.color || '#3B82F6'}>
                <option value="#3B82F6">Mavi</option>
                <option value="#10B981">Yeşil</option>
                <option value="#F59E0B">Turuncu</option>
                <option value="#EF4444">Kırmızı</option>
                <option value="#8B5CF6">Mor</option>
                <option value="#EC4899">Pembe</option>
              </select>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowProjectModal(false)}>İptal</button>
                <button type="submit" className="btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTodoModal && (
        <div className="modal-overlay" onClick={() => setShowTodoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editingTodo ? 'Görev Düzenle' : 'Yeni Görev'}</h3>
            <form onSubmit={handleCreateTodo}>
              <input name="title" placeholder="Görev Adı" defaultValue={editingTodo?.title} required ref={titleInputRef} />
              <div className="form-row">
                <div className="form-group">
                  <label>Öncelik</label>
                  <select name="priority" defaultValue={editingTodo?.priority ?? 1}>
                    <option value={0}>Düşük</option>
                    <option value={1}>Orta</option>
                    <option value={2}>Yüksek</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Bitiş Tarihi</label>
                  <input type="date" name="due_date" defaultValue={editingTodo?.due_date || ''} />
                </div>
              </div>
              
              {editingTodo && selectedProject && (
                <>
                  <TagSelector 
                    todoId={editingTodo.id} 
                    projectId={selectedProject.id} 
                    attachedTags={editingTodo.tags || []} 
                    onTagsChange={() => loadTodos(selectedProject.id)}
                  />
                  <SubtaskList todoId={editingTodo.id} />
                </>
              )}
              
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowTodoModal(false)}>İptal</button>
                <button type="submit" className="btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Toplu Görev Ekle</h3>
            <form onSubmit={handleBulkImport}>
              <p className="bulk-hint">Her satıra bir görev yazın veya "Panodan Yapıştır" butonuna basın</p>
              <button type="button" className="btn-secondary" style={{marginBottom: '10px', marginLeft: 0}} onClick={async () => {
                const text = await navigator.clipboard.readText();
                const textarea = document.querySelector('textarea[name="bulktodos"]') as HTMLTextAreaElement;
                if (textarea) textarea.value = text;
              }}>Panodan Yapıştır</button>
              <textarea name="bulktodos" placeholder="Görev 1&#10;Görev 2&#10;Görev 3" required />
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowBulkModal(false)}>İptal</button>
                <button type="submit" className="btn-primary">Ekle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
