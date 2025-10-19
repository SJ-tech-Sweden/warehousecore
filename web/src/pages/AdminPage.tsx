import { useState } from 'react';
import { Settings, Users, Layers, Lightbulb } from 'lucide-react';
import { ZoneTypesTab } from '../components/admin/ZoneTypesTab';
import { LEDSettingsTab } from '../components/admin/LEDSettingsTab';
import { RolesTab } from '../components/admin/RolesTab';

type TabType = 'zonetypes' | 'led' | 'roles';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('zonetypes');

  const tabs = [
    { id: 'zonetypes' as TabType, label: 'Zonentypen', icon: Layers },
    { id: 'led' as TabType, label: 'LED-Verhalten', icon: Lightbulb },
    { id: 'roles' as TabType, label: 'Rollen & Benutzer', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="w-8 h-8 text-accent-red" />
        <div>
          <h1 className="text-3xl font-bold text-white">Admin-Dashboard</h1>
          <p className="text-gray-400">Systemeinstellungen verwalten</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-dark rounded-2xl p-2">
        <div className="flex gap-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-accent-red text-white shadow-lg'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="glass-dark rounded-2xl p-6">
        {activeTab === 'zonetypes' && <ZoneTypesTab />}
        {activeTab === 'led' && <LEDSettingsTab />}
        {activeTab === 'roles' && <RolesTab />}
      </div>
    </div>
  );
}
