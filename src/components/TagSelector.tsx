import React, { useState, useEffect } from 'react';
import { Tag } from '../types';

interface TagSelectorProps {
  todoId: number;
  projectId: number;
  attachedTags: Tag[];
  onTagsChange: () => void;
}

export default function TagSelector({ todoId, projectId, attachedTags, onTagsChange }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');

  useEffect(() => {
    loadTags();
  }, [projectId]);

  const loadTags = async () => {
    const tags = await window.electronAPI.tagsGetAll(projectId);
    setAllTags(tags);
  };

  const handleAttach = async (tagId: number) => {
    await window.electronAPI.tagsAttach(todoId, tagId);
    onTagsChange();
  };

  const handleDetach = async (tagId: number) => {
    await window.electronAPI.tagsDetach(todoId, tagId);
    onTagsChange();
  };

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    await window.electronAPI.tagsCreate({ name: newTagName.trim(), color: newTagColor, project_id: projectId });
    setNewTagName('');
    loadTags();
    setShowCreate(false);
  };

  const isAttached = (tagId: number) => attachedTags.some(t => t.id === tagId);

  return (
    <div className="tag-selector">
      <div className="tag-selector-header">
        <label>Etiketler</label>
        <button type="button" className="tag-add-btn" onClick={() => setShowCreate(!showCreate)}>+</button>
      </div>
      
      {showCreate && (
        <div className="tag-create-form">
          <input 
            value={newTagName} 
            onChange={e => setNewTagName(e.target.value)} 
            placeholder="Etiket adı"
          />
          <input 
            type="color" 
            value={newTagColor} 
            onChange={e => setNewTagColor(e.target.value)}
          />
          <button type="button" onClick={handleCreate}>Ekle</button>
        </div>
      )}
      
      <div className="tag-list">
        {allTags.map(tag => (
          <label key={tag.id} className="tag-option">
            <input 
              type="checkbox" 
              checked={isAttached(tag.id)} 
              onChange={() => isAttached(tag.id) ? handleDetach(tag.id) : handleAttach(tag.id)}
            />
            <span className="tag" style={{ backgroundColor: tag.color }}>{tag.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
