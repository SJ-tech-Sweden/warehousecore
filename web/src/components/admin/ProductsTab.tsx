import { useState, useEffect } from 'react';
import { Plus, Package } from 'lucide-react';
import { api } from '../../lib/api';

interface Product {
  product_id: number;
  name: string;
  category_name?: string;
  subcategory_name?: string;
  subbiercategory_name?: string;
  item_cost_per_day?: number;
  description?: string;
}

export function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/products');
      setProducts(data || []);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Produkte verwalten</h2>
        <button
          className="px-4 py-2 bg-accent-red text-white rounded-xl font-semibold hover:shadow-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Neues Produkt
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Lade Produkte...</p>
      ) : products.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Keine Produkte vorhanden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(product => (
            <div key={product.product_id} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold">{product.name}</h3>
                  <p className="text-gray-400 text-sm">
                    {[product.category_name, product.subcategory_name, product.subbiercategory_name]
                      .filter(Boolean)
                      .join(' > ')}
                  </p>
                  {product.description && (
                    <p className="text-gray-500 text-xs mt-1">{product.description}</p>
                  )}
                </div>
                {product.item_cost_per_day && (
                  <div className="text-right">
                    <p className="text-white font-semibold">{product.item_cost_per_day.toFixed(2)} €</p>
                    <p className="text-gray-400 text-xs">pro Tag</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass rounded-xl p-4 mt-6">
        <p className="text-sm text-gray-400">
          <strong>Hinweis:</strong> Die vollständige Produktverwaltung mit Erstellung, Bearbeitung und Geräteerstellung wird in zukünftigen Versionen verfügbar sein.
        </p>
      </div>
    </div>
  );
}
