import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { api } from '../../lib/api';

interface Category {
  category_id: number;
  name: string;
  abbreviation: string;
}

/* Commented out for future implementation
interface Subcategory {
  subcategory_id: string;
  name: string;
  abbreviation: string;
  category_id: number;
}

interface Subbiercategory {
  subbiercategory_id: string;
  name: string;
  abbreviation: string;
  subcategory_id: string;
}
*/

type Level = 'category' | 'subcategory' | 'subbiercategory';

export function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  // const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  // const [subbiercategories, setSubbiercategories] = useState<Subbiercategory[]>([]);
  const [activeLevel, setActiveLevel] = useState<Level>('category');
  const [editing, setEditing] = useState<number | string | 'new' | null>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    loadCategories();
    // loadSubcategories();
    // loadSubbiercategories();
  }, []);

  const loadCategories = async () => {
    try {
      const { data } = await api.get('/admin/categories');
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  /* Commented out for future implementation
  const loadSubcategories = async () => {
    try {
      const { data } = await api.get('/admin/subcategories');
      setSubcategories(data || []);
    } catch (error) {
      console.error('Failed to load subcategories:', error);
    }
  };

  const loadSubbiercategories = async () => {
    try {
      const { data } = await api.get('/admin/subbiercategories');
      setSubbiercategories(data || []);
    } catch (error) {
      console.error('Failed to load subbiercategories:', error);
    }
  };
  */

  const handleSaveCategory = async () => {
    try {
      if (editing === 'new') {
        await api.post('/admin/categories', formData);
      } else {
        await api.put(`/admin/categories/${editing}`, formData);
      }
      loadCategories();
      setEditing(null);
      setFormData({});
    } catch (error: any) {
      alert('Fehler: ' + (error.response?.data?.error || error.message));
    }
  };

  /* Commented out for future implementation
  const handleSaveSubcategory = async () => {
    try {
      if (editing === 'new') {
        await api.post('/admin/subcategories', formData);
      } else {
        await api.put(`/admin/subcategories/${editing}`, formData);
      }
      loadSubcategories();
      setEditing(null);
      setFormData({});
    } catch (error: any) {
      alert('Fehler: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSaveSubbiercategory = async () => {
    try {
      if (editing === 'new') {
        await api.post('/admin/subbiercategories', formData);
      } else {
        await api.put(`/admin/subbiercategories/${editing}`, formData);
      }
      loadSubbiercategories();
      setEditing(null);
      setFormData({});
    } catch (error: any) {
      alert('Fehler: ' + (error.response?.data?.error || error.message));
    }
  };
  */

  const handleDelete = async (level: Level, id: number | string) => {
    if (!confirm('Wirklich löschen?')) return;

    try {
      await api.delete(`/admin/${level === 'category' ? 'categories' : level === 'subcategory' ? 'subcategories' : 'subbiercategories'}/${id}`);
      if (level === 'category') loadCategories();
      // else if (level === 'subcategory') loadSubcategories();
      // else loadSubbiercategories();
    } catch (error: any) {
      alert('Fehler: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Kategorien verwalten</h2>

      {/* Level Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveLevel('category')}
          className={`px-4 py-2 rounded-lg font-semibold ${activeLevel === 'category' ? 'bg-accent-red text-white' : 'bg-white/10 text-gray-400'}`}
        >
          Kategorien
        </button>
        <button
          onClick={() => setActiveLevel('subcategory')}
          className={`px-4 py-2 rounded-lg font-semibold ${activeLevel === 'subcategory' ? 'bg-accent-red text-white' : 'bg-white/10 text-gray-400'}`}
        >
          Unterkategorien
        </button>
        <button
          onClick={() => setActiveLevel('subbiercategory')}
          className={`px-4 py-2 rounded-lg font-semibold ${activeLevel === 'subbiercategory' ? 'bg-accent-red text-white' : 'bg-white/10 text-gray-400'}`}
        >
          Sub-Unterkategorien
        </button>
      </div>

      {/* Categories */}
      {activeLevel === 'category' && (
        <div className="space-y-2">
          <button
            onClick={() => { setEditing('new'); setFormData({}); }}
            className="px-4 py-2 bg-accent-red text-white rounded-lg font-semibold hover:shadow-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Neue Kategorie
          </button>

          {editing && (
            <div className="glass rounded-xl p-4 space-y-3 border-2 border-accent-red">
              <input
                type="text"
                placeholder="Name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg glass text-white"
              />
              <input
                type="text"
                placeholder="Abkürzung (max. 3 Zeichen)"
                maxLength={3}
                value={formData.abbreviation || ''}
                onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-lg glass text-white"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveCategory} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  Speichern
                </button>
                <button onClick={() => { setEditing(null); setFormData({}); }} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg flex items-center justify-center gap-2">
                  <X className="w-4 h-4" />
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {categories.map(cat => (
            <div key={cat.category_id} className="glass rounded-xl p-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">{cat.name}</h3>
                <p className="text-gray-400 text-sm">{cat.abbreviation}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(cat.category_id); setFormData(cat); }} className="p-2 hover:bg-white/10 rounded-lg text-blue-400">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete('category', cat.category_id)} className="p-2 hover:bg-white/10 rounded-lg text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Similar sections for subcategories and subbiercategories can be added */}
      {activeLevel === 'subcategory' && (
        <div className="text-white">
          <p>Unterkategorie-Verwaltung (ähnlich wie Kategorien)</p>
          <p className="text-sm text-gray-400 mt-2">Hinweis: Unterkategorien benötigen eine Kategorie als Elternelement</p>
        </div>
      )}

      {activeLevel === 'subbiercategory' && (
        <div className="text-white">
          <p>Sub-Unterkategorie-Verwaltung (ähnlich wie Kategorien)</p>
          <p className="text-sm text-gray-400 mt-2">Hinweis: Sub-Unterkategorien benötigen eine Unterkategorie als Elternelement</p>
        </div>
      )}
    </div>
  );
}
