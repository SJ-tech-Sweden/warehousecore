import { useState, useEffect } from 'react';
import { Save, Lightbulb, RefreshCcw } from 'lucide-react';
import { api } from '../../lib/api';

interface LEDDefault {
  color: string;
  pattern: string;
  intensity: number;
}

interface ZoneTypeLED {
  id: number;
  key: string;
  label: string;
  description?: string;
  default_led_pattern: string;
  default_led_color: string;
  default_intensity: number;
}

export function LEDSettingsTab() {
  const [defaults, setDefaults] = useState<LEDDefault>({
    color: '#FF7A00',
    pattern: 'breathe',
    intensity: 180,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [zoneTypes, setZoneTypes] = useState<ZoneTypeLED[]>([]);
  const [zoneTypeLoading, setZoneTypeLoading] = useState(true);
  const [zoneTypeSaving, setZoneTypeSaving] = useState<number | null>(null);
  const [zoneTypeMessages, setZoneTypeMessages] = useState<Record<number, string>>({});

  useEffect(() => {
    loadDefaults();
    loadZoneTypes();
  }, []);

  const loadDefaults = async () => {
    try {
      const response = await api.get('/admin/led/single-bin-default');
      setDefaults(response.data);
    } catch (error) {
      console.error('Failed to load LED defaults:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadZoneTypes = async () => {
    try {
      const response = await api.get('/admin/zone-types');
      setZoneTypes(response.data);
    } catch (error) {
      console.error('Failed to load zone type LED defaults:', error);
    } finally {
      setZoneTypeLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      await api.put('/admin/led/single-bin-default', defaults);
      setMessage('✓ Einstellungen gespeichert');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      setMessage('Fehler: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleZoneTypeFieldChange = (id: number, field: keyof ZoneTypeLED, value: string | number) => {
    setZoneTypes((prev) =>
      prev.map((zoneType) =>
        zoneType.id === id
          ? { ...zoneType, [field]: value }
          : zoneType
      )
    );
  };

  const setZoneTypeFeedback = (id: number, text: string) => {
    setZoneTypeMessages((prev) => ({ ...prev, [id]: text }));
    if (text) {
      setTimeout(() => {
        setZoneTypeMessages((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 3000);
    }
  };

  const handleZoneTypeSave = async (zoneType: ZoneTypeLED) => {
    setZoneTypeSaving(zoneType.id);
    setZoneTypeFeedback(zoneType.id, '');

    try {
      await api.put(`/admin/zone-types/${zoneType.id}`, {
        default_led_pattern: zoneType.default_led_pattern,
        default_led_color: zoneType.default_led_color,
        default_intensity: zoneType.default_intensity,
      });
      setZoneTypeFeedback(zoneType.id, '✓ Zonentyp gespeichert');
      loadZoneTypes();
    } catch (error: any) {
      setZoneTypeFeedback(
        zoneType.id,
        'Fehler: ' + (error.response?.data?.error || error.message)
      );
    } finally {
      setZoneTypeSaving(null);
    }
  };

  const applyGlobalDefaultsToZoneType = (zoneTypeId: number) => {
    setZoneTypes((prev) =>
      prev.map((zoneType) =>
        zoneType.id === zoneTypeId
          ? {
              ...zoneType,
              default_led_color: defaults.color,
              default_led_pattern: defaults.pattern,
              default_intensity: defaults.intensity,
            }
          : zoneType
      )
    );
  };

  if (loading || zoneTypeLoading) return <div className="text-white">Lädt...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Lightbulb className="w-6 h-6 text-yellow-400" />
        <div>
          <h2 className="text-xl font-bold text-white">LED-Standardverhalten (Einzelfach-Highlight)</h2>
          <p className="text-gray-400 text-sm">Diese Einstellungen gelten für die "Fach beleuchten" Funktion</p>
        </div>
      </div>

      <div className="glass rounded-xl p-6 space-y-6">
        {/* Pattern Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-400 mb-3">Muster</label>
          <div className="grid grid-cols-3 gap-3">
            {['solid', 'breathe', 'blink'].map(pattern => (
              <button
                key={pattern}
                onClick={() => setDefaults({ ...defaults, pattern })}
                className={`px-4 py-3 rounded-xl font-semibold transition-all ${
                  defaults.pattern === pattern
                    ? 'bg-accent-red text-white shadow-lg'
                    : 'glass text-gray-400 hover:bg-white/10'
                }`}
              >
                {pattern === 'solid' && 'Durchgehend'}
                {pattern === 'breathe' && 'Atmen'}
                {pattern === 'blink' && 'Blinken'}
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-sm font-semibold text-gray-400 mb-3">Farbe</label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={defaults.color}
              onChange={(e) => setDefaults({ ...defaults, color: e.target.value })}
              className="w-20 h-20 rounded-xl cursor-pointer"
            />
            <div className="flex-1">
              <input
                type="text"
                value={defaults.color}
                onChange={(e) => setDefaults({ ...defaults, color: e.target.value })}
                className="w-full px-4 py-3 rounded-xl glass text-white font-mono"
                placeholder="#FF4500"
              />
              <p className="text-gray-500 text-xs mt-1">Hex-Format (z.B. #FF4500 für Orange)</p>
            </div>
          </div>
        </div>

        {/* Intensity Slider */}
        <div>
          <label className="block text-sm font-semibold text-gray-400 mb-3">
            Intensität: {defaults.intensity} / 255
          </label>
          <input
            type="range"
            min="0"
            max="255"
            value={defaults.intensity}
            onChange={(e) => setDefaults({ ...defaults, intensity: parseInt(e.target.value) })}
            className="w-full h-3 rounded-lg bg-white/10 appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${defaults.color} 0%, ${defaults.color} ${(defaults.intensity / 255) * 100}%, rgba(255,255,255,0.1) ${(defaults.intensity / 255) * 100}%, rgba(255,255,255,0.1) 100%)`
            }}
          />
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-semibold text-gray-400 mb-3">Vorschau</label>
          <div className="glass rounded-xl p-8 flex items-center justify-center">
            <div
              className="w-32 h-32 rounded-2xl transition-all duration-1000"
              style={{
                backgroundColor: defaults.color,
                opacity: defaults.intensity / 255,
                animation: defaults.pattern === 'breathe' ? 'breathe 2s infinite' : defaults.pattern === 'blink' ? 'blink 1s infinite' : 'none'
              }}
            ></div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-white/10">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
              saving
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-accent-red to-red-700 hover:shadow-lg hover:shadow-red-500/50 hover:scale-105 active:scale-95'
            }`}
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Speichert...' : 'Einstellungen speichern'}</span>
          </button>

          {message && (
            <div className={`mt-3 p-3 rounded-lg text-center text-sm font-semibold ${
              message.includes('✓')
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>

      {/* Inline CSS for animations */}
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: ${defaults.intensity / 255}; }
          50% { opacity: ${(defaults.intensity / 255) * 0.3}; }
        }
        @keyframes blink {
          0%, 49% { opacity: ${defaults.intensity / 255}; }
          50%, 100% { opacity: 0; }
        }
      `}</style>

      {/* Zone type specific defaults */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">LED-Standardwerte pro Zonentyp</h3>
        <p className="text-sm text-gray-400">
          Passe hier das LED-Verhalten für einzelne Zonentypen an. Diese Einstellungen überschreiben den globalen Standard.
        </p>

        <div className="space-y-4">
          {zoneTypes.map((zoneType) => (
            <div key={zoneType.id} className="glass rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h4 className="text-white font-semibold">{zoneType.label}</h4>
                  <p className="text-xs text-gray-500 font-mono">{zoneType.key}</p>
                  {zoneType.description && (
                    <p className="text-sm text-gray-400 mt-1">{zoneType.description}</p>
                  )}
                </div>
                <button
                  onClick={() => applyGlobalDefaultsToZoneType(zoneType.id)}
                  className="flex items-center gap-2 px-3 py-2 glass text-gray-300 hover:text-white rounded-lg transition-colors"
                  title="Globale LED-Standards übernehmen"
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span>Global übernehmen</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Muster</label>
                  <select
                    value={zoneType.default_led_pattern}
                    onChange={(e) => handleZoneTypeFieldChange(zoneType.id, 'default_led_pattern', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg glass text-white"
                  >
                    <option value="solid">Durchgehend</option>
                    <option value="breathe">Atmen</option>
                    <option value="blink">Blinken</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">Farbe</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={zoneType.default_led_color || '#FF7A00'}
                      onChange={(e) => handleZoneTypeFieldChange(zoneType.id, 'default_led_color', e.target.value)}
                      className="w-14 h-14 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={zoneType.default_led_color || ''}
                      onChange={(e) => handleZoneTypeFieldChange(zoneType.id, 'default_led_color', e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg glass text-white font-mono"
                      placeholder="#FF4500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Intensität: {zoneType.default_intensity} / 255
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="255"
                    value={zoneType.default_intensity}
                    onChange={(e) =>
                      handleZoneTypeFieldChange(zoneType.id, 'default_intensity', parseInt(e.target.value, 10))
                    }
                    className="w-full h-3 rounded-lg bg-white/10 appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${zoneType.default_led_color || defaults.color} 0%, ${
                        zoneType.default_led_color || defaults.color
                      } ${(zoneType.default_intensity / 255) * 100}%, rgba(255,255,255,0.1) ${
                        (zoneType.default_intensity / 255) * 100
                      }%, rgba(255,255,255,0.1) 100%)`,
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  onClick={() => handleZoneTypeSave(zoneType)}
                  disabled={zoneTypeSaving === zoneType.id}
                  className={`px-4 py-2 rounded-lg font-semibold text-white flex items-center justify-center gap-2 ${
                    zoneTypeSaving === zoneType.id
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-accent-red hover:bg-red-600 transition-colors'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{zoneTypeSaving === zoneType.id ? 'Speichert...' : 'Zonentyp speichern'}</span>
                </button>
                {zoneTypeMessages[zoneType.id] && (
                  <div
                    className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                      zoneTypeMessages[zoneType.id].startsWith('✓')
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {zoneTypeMessages[zoneType.id]}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
