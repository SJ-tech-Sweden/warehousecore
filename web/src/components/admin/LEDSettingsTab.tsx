import { useState, useEffect } from 'react';
import { Save, Lightbulb } from 'lucide-react';
import { api } from '../../lib/api';

interface LEDDefault {
  color: string;
  pattern: string;
  intensity: number;
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

  useEffect(() => {
    loadDefaults();
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

  if (loading) return <div className="text-white">Lädt...</div>;

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
    </div>
  );
}
