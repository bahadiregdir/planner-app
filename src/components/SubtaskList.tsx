import React, { useState, useEffect } from 'react';
import { Subtask } from '../types';

interface SubtaskListProps {
  todoId: number;
}

export default function SubtaskList({ todoId }: SubtaskListProps) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadSubtasks();
  }, [todoId]);

  const loadSubtasks = async () => {
    const tasks = await window.electronAPI.subtasksGetByTodo(todoId);
    setSubtasks(tasks);
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await window.electronAPI.subtasksCreate({ todo_id: todoId, title: newTitle.trim() });
    setNewTitle('');
    loadSubtasks();
  };

  const handleToggle = async (id: number, completed: boolean) => {
    await window.electronAPI.subtasksToggle(id, completed);
    loadSubtasks();
  };

  const handleDelete = async (id: number) => {
    await window.electronAPI.subtasksDelete(id);
    loadSubtasks();
  };

  const completedCount = subtasks.filter(s => s.completed).length;
  const totalCount = subtasks.length;

  if (totalCount === 0) return null;

  return (
    <div className="subtask-list">
      <div className="subtask-header" onClick={() => setExpanded(!expanded)}>
        <span>Alt Görevler ({completedCount}/{totalCount})</span>
        <span>{expanded ? '▼' : '▶'}</span>
      </div>
      
      {expanded && (
        <>
          <div className="subtask-items">
            {subtasks.map(subtask => (
              <div key={subtask.id} className={`subtask-item ${subtask.completed ? 'completed' : ''}`}>
                <input 
                  type="checkbox" 
                  checked={!!subtask.completed} 
                  onChange={() => handleToggle(subtask.id, !subtask.completed)}
                />
                <span className="subtask-title">{subtask.title}</span>
                <button type="button" className="subtask-delete" onClick={() => handleDelete(subtask.id)}>×</button>
              </div>
            ))}
          </div>
          
          <div className="subtask-add">
            <input 
              value={newTitle} 
              onChange={e => setNewTitle(e.target.value)} 
              placeholder="Yeni alt görev..."
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button type="button" onClick={handleAdd}>+</button>
          </div>
        </>
      )}
    </div>
  );
}
