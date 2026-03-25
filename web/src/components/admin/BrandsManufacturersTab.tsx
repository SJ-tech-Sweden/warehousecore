import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Building2, Tag, Globe } from 'lucide-react';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';

interface Manufacturer {
  manufacturer_id: number;
  name: string;
  website?: string;
}

interface Brand {
  brand_id: number;
  name: string;
  manufacturer_id?: number;
  manufacturer_name?: string;
}

type Level = 'manufacturers' | 'brands';

export function BrandsManufacturersTab() {
  const { t } = useTranslation();
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeLevel, setActiveLevel] = useState<Level>('manufacturers');
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [manufacturerFilter, setManufacturerFilter] = useState<number | ''>('');

  useEffect(() => {
    loadManufacturers();
    loadBrands();
  }, []);

  const loadManufacturers = async () => {
    try {
      const { data } = await api.get('/admin/manufacturers');
      setManufacturers(data || []);
    } catch (error) {
      console.error('Failed to load manufacturers:', error);
    }
  };

  const loadBrands = async () => {
    try {
      const { data } = await api.get('/admin/brands');
      setBrands(data || []);
    } catch (error) {
      console.error('Failed to load brands:', error);
    }
  };

  const handleSaveManufacturer = async () => {
    try {
      if (editing === 'new') {
        await api.post('/admin/manufacturers', formData);
      } else {
        await api.put(`/admin/manufacturers/${editing}`, formData);
      }
      loadManufacturers();
      setEditing(null);
      setFormData({});
    } catch (error: any) {
      alert(`${t('common.error')}: ` + (error.response?.data?.error || error.message));
    }
  };

  const handleSaveBrand = async () => {
    try {
      const payload = {
        name: formData.name,
        manufacturer_id: formData.manufacturer_id || null,
      };
      if (editing === 'new') {
        await api.post('/admin/brands', payload);
      } else {
        await api.put(`/admin/brands/${editing}`, payload);
      }
      loadBrands();
      setEditing(null);
      setFormData({});
    } catch (error: any) {
      alert(`${t('common.error')}: ` + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteManufacturer = async (id: number) => {
    if (!confirm(t('admin.brandsManufacturers.confirmDeleteManufacturer'))) return;

    try {
      await api.delete(`/admin/manufacturers/${id}`);
      loadManufacturers();
    } catch (error: any) {
      alert(`${t('common.error')}: ` + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteBrand = async (id: number) => {
    if (!confirm(t('admin.brandsManufacturers.confirmDeleteBrand'))) return;

    try {
      await api.delete(`/admin/brands/${id}`);
      loadBrands();
    } catch (error: any) {
      alert(`${t('common.error')}: ` + (error.response?.data?.error || error.message));
    }
  };

  const filteredBrands = manufacturerFilter === '' 
    ? brands 
    : brands.filter((brand) => brand.manufacturer_id === manufacturerFilter);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">{t('admin.brandsManufacturers.title')}</h2>

      {/* Level Selector */}
      <div className="flex gap-2 overflow-x-auto scrollbar-thin">
        <button
          onClick={() => { setActiveLevel('manufacturers'); setEditing(null); setFormData({}); }}
          className={`px-3 sm:px-4 py-2 rounded-lg font-semibold whitespace-nowrap flex-shrink-0 text-sm sm:text-base flex items-center gap-2 ${activeLevel === 'manufacturers' ? 'bg-accent-red text-white' : 'bg-white/10 text-gray-400'}`}
        >
          <Building2 className="w-4 h-4" />
          {t('admin.brandsManufacturers.levels.manufacturers')}
        </button>
        <button
          onClick={() => { setActiveLevel('brands'); setEditing(null); setFormData({}); }}
          className={`px-3 sm:px-4 py-2 rounded-lg font-semibold whitespace-nowrap flex-shrink-0 text-sm sm:text-base flex items-center gap-2 ${activeLevel === 'brands' ? 'bg-accent-red text-white' : 'bg-white/10 text-gray-400'}`}
        >
          <Tag className="w-4 h-4" />
          {t('admin.brandsManufacturers.levels.brands')}
        </button>
      </div>

      {/* Manufacturers */}
      {activeLevel === 'manufacturers' && (
        <div className="space-y-2">
          <button
            onClick={() => { setEditing('new'); setFormData({}); }}
            className="px-4 py-2 bg-accent-red text-white rounded-lg font-semibold hover:shadow-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('admin.brandsManufacturers.newManufacturer')}
          </button>

          {editing !== null && (
            <div className="glass rounded-xl p-4 space-y-3 border-2 border-accent-red">
              <input
                type="text"
                placeholder={t('common.name')}
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg glass text-white"
                title={t('common.name')}
              />
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  placeholder={t('admin.brandsManufacturers.websiteOptional')}
                  value={formData.website || ''}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 rounded-lg glass text-white"
                  title={t('admin.brandsManufacturers.websiteOptional')}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveManufacturer} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {t('common.save')}
                </button>
                <button onClick={() => { setEditing(null); setFormData({}); }} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg flex items-center justify-center gap-2">
                  <X className="w-4 h-4" />
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {manufacturers.length === 0 && !editing && (
            <div className="glass rounded-xl p-6 text-center text-gray-400">
              <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t('admin.brandsManufacturers.noManufacturers')}</p>
            </div>
          )}

          {manufacturers.map(manufacturer => (
            <div key={manufacturer.manufacturer_id} className="glass rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-accent-red" />
                <div>
                  <h3 className="text-white font-semibold">{manufacturer.name}</h3>
                  {manufacturer.website && (
                    <a 
                      href={manufacturer.website.startsWith('http') ? manufacturer.website : `https://${manufacturer.website}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 text-sm hover:underline flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3" />
                      {manufacturer.website}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setEditing(manufacturer.manufacturer_id); setFormData(manufacturer); }} 
                  className="p-2 hover:bg-white/10 rounded-lg text-blue-400"
                  title={t('common.edit')}
                  aria-label={t('common.edit')}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteManufacturer(manufacturer.manufacturer_id)} 
                  className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Brands */}
      {activeLevel === 'brands' && (
        <div className="space-y-2">
          <button
            onClick={() => { setEditing('new'); setFormData({}); }}
            className="px-4 py-2 bg-accent-red text-white rounded-lg font-semibold hover:shadow-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('admin.brandsManufacturers.newBrand')}
          </button>

          <div className="glass rounded-xl p-3 sm:p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border border-white/10">
            <div className="text-sm font-semibold text-white">{t('admin.brandsManufacturers.filterByManufacturer')}</div>
            <select
              value={manufacturerFilter}
              onChange={(e) => setManufacturerFilter(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="w-full sm:w-64 px-3 py-2 rounded-lg glass text-white"
              title={t('admin.brandsManufacturers.filterByManufacturer')}
            >
              <option value="">{t('admin.brandsManufacturers.allManufacturers')}</option>
              {manufacturers.map(m => (
                <option key={m.manufacturer_id} value={m.manufacturer_id}>{m.name}</option>
              ))}
            </select>
          </div>

          {editing !== null && (
            <div className="glass rounded-xl p-4 space-y-3 border-2 border-accent-red">
              <input
                type="text"
                placeholder={t('admin.brandsManufacturers.brandName')}
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg glass text-white"
                title={t('admin.brandsManufacturers.brandName')}
              />
              <select
                value={formData.manufacturer_id || ''}
                onChange={(e) => setFormData({ ...formData, manufacturer_id: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 rounded-lg glass text-white"
                title={t('admin.brandsManufacturers.manufacturerOptional')}
              >
                <option value="">{t('admin.brandsManufacturers.manufacturerOptional')}</option>
                {manufacturers.map(m => (
                  <option key={m.manufacturer_id} value={m.manufacturer_id}>{m.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={handleSaveBrand} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {t('common.save')}
                </button>
                <button onClick={() => { setEditing(null); setFormData({}); }} className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg flex items-center justify-center gap-2">
                  <X className="w-4 h-4" />
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {filteredBrands.length === 0 && !editing && (
            <div className="glass rounded-xl p-6 text-center text-gray-400">
              <Tag className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t('admin.brandsManufacturers.noBrands')}</p>
            </div>
          )}

          {filteredBrands.map(brand => (
            <div key={brand.brand_id} className="glass rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Tag className="w-5 h-5 text-accent-red" />
                <div>
                  <h3 className="text-white font-semibold">{brand.name}</h3>
                  {brand.manufacturer_name && (
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {brand.manufacturer_name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setEditing(brand.brand_id); setFormData(brand); }} 
                  className="p-2 hover:bg-white/10 rounded-lg text-blue-400"
                  title={t('common.edit')}
                  aria-label={t('common.edit')}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteBrand(brand.brand_id)} 
                  className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                  title={t('common.delete')}
                  aria-label={t('common.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
