import { Wrench, AlertCircle } from 'lucide-react';

export function MaintenancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Wartung & Defekte</h2>
        <p className="text-gray-400">Wartungsmanagement und Defektmeldungen</p>
      </div>

      <div className="glass-dark rounded-2xl p-12 text-center">
        <Wrench className="w-20 h-20 text-gray-600 mx-auto mb-6" />
        <h3 className="text-2xl font-bold text-white mb-2">In Entwicklung</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          Das Wartungsmodul mit Defektmeldungen, Reparaturstatus und Inspektionsplanung wird
          in Kürze verfügbar sein.
        </p>
      </div>

      {/* Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-6">
          <AlertCircle className="w-8 h-8 text-yellow-500 mb-3" />
          <h4 className="font-bold text-white mb-2">Offene Defekte</h4>
          <p className="text-3xl font-bold text-yellow-500">0</p>
        </div>
        <div className="glass rounded-xl p-6">
          <Wrench className="w-8 h-8 text-blue-400 mb-3" />
          <h4 className="font-bold text-white mb-2">In Reparatur</h4>
          <p className="text-3xl font-bold text-blue-400">0</p>
        </div>
        <div className="glass rounded-xl p-6">
          <AlertCircle className="w-8 h-8 text-green-500 mb-3" />
          <h4 className="font-bold text-white mb-2">Repariert</h4>
          <p className="text-3xl font-bold text-green-500">0</p>
        </div>
      </div>
    </div>
  );
}
