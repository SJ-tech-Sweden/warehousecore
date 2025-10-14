import { useEffect, useState } from 'react';
import { Package, Search } from 'lucide-react';
import { devicesApi } from '../lib/api';
import type { Device } from '../lib/api';
import { getStatusColor, formatStatus } from '../lib/utils';

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const { data } = await devicesApi.getAll({ limit: 100 });
      setDevices(data);
    } catch (error) {
      console.error('Failed to load devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDevices = devices.filter((device) =>
    device.device_id.toLowerCase().includes(search.toLowerCase()) ||
    device.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-red"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Geräte</h2>
          <p className="text-gray-400">{filteredDevices.length} Geräte gefunden</p>
        </div>
      </div>

      {/* Search */}
      <div className="glass rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Geräte suchen..."
            className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-red transition-colors"
          />
        </div>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDevices.map((device) => (
          <div
            key={device.device_id}
            className="glass-dark rounded-xl p-5 hover:bg-white/10 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-gradient-to-br from-accent-red/20 to-red-700/20 group-hover:from-accent-red/30 group-hover:to-red-700/30 transition-colors">
                <Package className="w-6 h-6 text-accent-red" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate mb-1">
                  {device.product_name || 'Unbekannt'}
                </h3>
                <p className="text-sm text-gray-400 mb-2">{device.device_id}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    getStatusColor(device.status)
                  } bg-white/10`}>
                    {formatStatus(device.status)}
                  </span>
                  {device.zone_name && (
                    <span className="text-xs text-gray-500">📍 {device.zone_name}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDevices.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Keine Geräte gefunden</p>
        </div>
      )}
    </div>
  );
}
