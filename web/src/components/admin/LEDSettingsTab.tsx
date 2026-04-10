import { useState, useEffect, useMemo } from 'react';
import { Save, Lightbulb, RefreshCcw, SlidersHorizontal, FileText, Square } from 'lucide-react';
import { api, ledApi, zonesApi, type LEDAppearance, type LEDJobHighlightSettings, type LEDMapping, type Zone } from '../../lib/api';
import { useTranslation } from 'react-i18next';

const ZONE_KEYWORDS = ['bin', 'fach', 'slot', 'compartment', 'shelf', 'gitterbox'];

const zoneLabelForOption = (zone: Zone, t: (key: string) => string): string => {
  const zoneName = zone.name || zone.code || t('admin.ledSettings.unnamedZone');
  const code = zone.code || '';
  return code ? `${zoneName} (${code})` : zoneName;
};

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

const defaultJobSettings: LEDJobHighlightSettings = {
  mode: 'all_bins',
  required: {
    color: '#00FF00',
    pattern: 'solid',
    intensity: 220,
    speed: 1200,
  },
  non_required: {
    color: '#FF0000',
    pattern: 'solid',
    intensity: 160,
    speed: 1200,
  },
};

export function LEDSettingsTab() {
  const { t } = useTranslation();
  const [defaults, setDefaults] = useState<LEDDefault>({
    color: '#FF7A00',
    pattern: 'breathe',
    intensity: 180,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [jobSettings, setJobSettings] = useState<LEDJobHighlightSettings>(defaultJobSettings);
  const [jobSaving, setJobSaving] = useState(false);
  const [jobMessage, setJobMessage] = useState('');
  const [zoneTypes, setZoneTypes] = useState<ZoneTypeLED[]>([]);
  const [zoneTypeLoading, setZoneTypeLoading] = useState(true);
  const [zoneTypeSaving, setZoneTypeSaving] = useState<number | null>(null);
  const [zoneTypeMessages, setZoneTypeMessages] = useState<Record<number, string>>({});
  const [mapping, setMapping] = useState<LEDMapping | null>(null);
  const [mappingLoading, setMappingLoading] = useState(true);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingValidating, setMappingValidating] = useState(false);
  const [mappingMessage, setMappingMessage] = useState('');
  const [pixelsInput, setPixelsInput] = useState<Record<string, string>>({});
  const [zones, setZones] = useState<Zone[]>([]);

  const zoneOptions = useMemo(() => {
    const filtered = zones.filter((zone) => {
      const type = (zone.type || '').toLowerCase();
      if (!type) return false;
      return ZONE_KEYWORDS.some((keyword) => type.includes(keyword));
    });
    const list = filtered.length > 0 ? filtered : zones;
    return [...list].sort((a, b) =>
      zoneLabelForOption(a, t).localeCompare(zoneLabelForOption(b, t), 'de', { sensitivity: 'base' })
    );
  }, [zones, t]);
  const previewBinOptions = useMemo(() => {
    if (!mapping) return [];
    const seen = new Set<string>();
    const entries: string[] = [];
    mapping.shelves.forEach((shelf) => {
      shelf.bins.forEach((bin) => {
        if (bin.bin_id && !seen.has(bin.bin_id)) {
          seen.add(bin.bin_id);
          entries.push(bin.bin_id);
        }
      });
    });
    return entries.sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
  }, [mapping]);
  const [previewBinId, setPreviewBinId] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewActive, setPreviewActive] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const [previewTarget, setPreviewTarget] = useState<string | null>(null);

  useEffect(() => {
    loadDefaults();
    loadJobSettings();
    loadZoneTypes();
    loadMapping();
  }, []);

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const { data } = await zonesApi.getAll();
        setZones(data);
      } catch (error) {
        console.error('Failed to load zones for LED mapping:', error);
      }
    };

    fetchZones();
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

  const loadJobSettings = async () => {
    try {
      const { data } = await ledApi.getJobSettings();
      setJobSettings(data);
    } catch (error) {
      console.error('Failed to load job highlight settings:', error);
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

  const rebuildPixelInputs = (mappingData: LEDMapping): Record<string, string> => {
    const next: Record<string, string> = {};
    mappingData.shelves.forEach((shelf, shelfIndex) => {
      shelf.bins.forEach((bin, binIndex) => {
        next[`${shelfIndex}:${binIndex}`] = bin.pixels.join(', ');
      });
    });
    return next;
  };

  const loadMapping = async () => {
    setMappingLoading(true);
    try {
      const { data } = await ledApi.getMapping();
      setMapping(data);
      setPixelsInput(rebuildPixelInputs(data));
      if (!previewBinId.trim()) {
        const firstShelf = data.shelves.find((shelf) => shelf.bins.length > 0);
        if (firstShelf) {
          const firstBin = firstShelf.bins[0]?.bin_id;
          if (firstBin) {
            setPreviewBinId(firstBin);
          }
        }
      }
      setMappingMessage('');
    } catch (error) {
      console.error('Failed to load LED mapping:', error);
      setMapping(null);
      setPixelsInput({});
      setMappingMessage(t('admin.ledSettings.messages.mappingLoadError'));
    } finally {
      setMappingLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      await api.put('/admin/led/single-bin-default', defaults);
      setMessage(t('admin.ledSettings.messages.settingsSaved'));
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      setMessage(`${t('common.error')}: ` + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  const updateJobAppearance = (section: 'required' | 'non_required', patch: Partial<LEDAppearance>) => {
    setJobSettings((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...patch },
    }));
  };

  const handleJobSettingsSave = async () => {
    setJobSaving(true);
    setJobMessage('');

    try {
      await ledApi.updateJobSettings(jobSettings);
      setJobMessage(t('admin.ledSettings.messages.jobSaved'));
      setTimeout(() => setJobMessage(''), 3000);
    } catch (error: any) {
      setJobMessage(`${t('common.error')}: ` + (error.response?.data?.error || error.message));
    } finally {
      setJobSaving(false);
    }
  };

  const handleMappingValidate = async () => {
    if (!mapping) {
      setMappingMessage(t('admin.ledSettings.messages.noMappingLoaded'));
      return;
    }
    setMappingValidating(true);
    setMappingMessage('');
    try {
      const { data } = await ledApi.validateMapping(mapping);
      if (data.valid) {
        setMappingMessage(t('admin.ledSettings.messages.mappingValid', { bins: data.total_bins ?? 0, shelves: data.total_shelves ?? 0 }));
      } else {
        const errors = Array.isArray(data.errors) ? data.errors.join(', ') : t('admin.ledSettings.messages.unknownError');
        setMappingMessage('⚠️ ' + errors);
      }
    } catch (error: any) {
      setMappingMessage(`${t('common.error')}: ` + (error.response?.data?.error || error.message || error.toString()));
    } finally {
      setMappingValidating(false);
    }
  };

  const handleMappingSave = async () => {
    if (!mapping) {
      setMappingMessage(t('admin.ledSettings.messages.noMappingLoaded'));
      return;
    }
    setMappingSaving(true);
    setMappingMessage('');
    try {
      await ledApi.updateMapping(mapping);
      setMappingMessage(t('admin.ledSettings.messages.mappingSaved'));
      setTimeout(() => setMappingMessage(''), 4000);
    } catch (error: any) {
      setMappingMessage(`${t('common.error')}: ` + (error.response?.data?.error || error.message || error.toString()));
    } finally {
      setMappingSaving(false);
    }
  };

  const updateMappingDefaults = (patch: Partial<LEDMapping['defaults']>) => {
    setMapping((prev) => {
      if (!prev) return prev;
      return { ...prev, defaults: { ...prev.defaults, ...patch } };
    });
  };

  const updateShelfId = (shelfIndex: number, value: string) => {
    setMapping((prev) => {
      if (!prev) return prev;
      const shelves = prev.shelves.map((shelf, idx) =>
        idx === shelfIndex ? { ...shelf, shelf_id: value } : shelf
      );
      return { ...prev, shelves };
    });
  };

  const addShelf = () => {
    setMapping((prev) => {
      if (!prev) {
        return prev;
      }
      const next: LEDMapping = {
        ...prev,
        shelves: [...prev.shelves, { shelf_id: `${prev.warehouse_id}-shelf-${prev.shelves.length + 1}`, bins: [] }],
      };
      setPixelsInput(rebuildPixelInputs(next));
      return next;
    });
  };

  const removeShelf = (shelfIndex: number) => {
    setMapping((prev) => {
      if (!prev) return prev;
      const next: LEDMapping = {
        ...prev,
        shelves: prev.shelves.filter((_, idx) => idx !== shelfIndex),
      };
      setPixelsInput(rebuildPixelInputs(next));
      return next;
    });
  };

  const addBin = (shelfIndex: number) => {
    setMapping((prev) => {
      if (!prev) return prev;
      const shelves = prev.shelves.map((shelf, idx) =>
        idx === shelfIndex ? { ...shelf, bins: [...shelf.bins, { bin_id: '', pixels: [] }] } : shelf
      );
      const next: LEDMapping = { ...prev, shelves };
      setPixelsInput(rebuildPixelInputs(next));
      return next;
    });
  };

  const removeBin = (shelfIndex: number, binIndex: number) => {
    setMapping((prev) => {
      if (!prev) return prev;
      const shelves = prev.shelves.map((shelf, idx) =>
        idx === shelfIndex
          ? { ...shelf, bins: shelf.bins.filter((_, bIdx) => bIdx !== binIndex) }
          : shelf
      );
      const next: LEDMapping = { ...prev, shelves };
      setPixelsInput(rebuildPixelInputs(next));
      return next;
    });
  };

  const updateBinId = (shelfIndex: number, binIndex: number, value: string) => {
    setMapping((prev) => {
      if (!prev) return prev;
      const shelves = prev.shelves.map((shelf, idx) => {
        if (idx !== shelfIndex) return shelf;
        const bins = shelf.bins.map((bin, bIdx) =>
          bIdx === binIndex ? { ...bin, bin_id: value } : bin
        );
        return { ...shelf, bins };
      });
      return { ...prev, shelves };
    });
  };

  const parsePixels = (value: string): number[] => {
    if (!value.trim()) {
      return [];
    }
    return value
      .split(/[,\s]+/)
      .map((part) => parseInt(part.trim(), 10))
      .filter((num) => !Number.isNaN(num));
  };

  const handlePixelInputChange = (shelfIndex: number, binIndex: number, value: string) => {
    const key = `${shelfIndex}:${binIndex}`;
    setPixelsInput((prev) => ({ ...prev, [key]: value }));
    const pixels = parsePixels(value);
    setMapping((prev) => {
      if (!prev) return prev;
      const shelves = prev.shelves.map((shelf, idx) => {
        if (idx !== shelfIndex) return shelf;
        const bins = shelf.bins.map((bin, bIdx) =>
          bIdx === binIndex ? { ...bin, pixels } : bin
        );
        return { ...shelf, bins };
      });
      return { ...prev, shelves };
    });
  };

  const toPreviewAppearance = (color: string, pattern: string, intensity: number, speed?: number): LEDAppearance => ({
    color,
    pattern,
    intensity: Math.max(0, Math.min(255, intensity)),
    speed: speed && speed > 0 ? speed : 1200,
  });

  const triggerPreview = async (appearances: LEDAppearance[], targetOverride?: string, clearBefore: boolean = false) => {
    if (appearances.length === 0) {
      return;
    }
    setPreviewLoading(true);
    setPreviewMessage('');
    const formTarget = previewBinId.trim();
    const target = (targetOverride && targetOverride.trim().length > 0 ? targetOverride.trim() : '') || formTarget || undefined;
    try {
      await ledApi.preview(appearances, clearBefore, target);
      setPreviewActive(true);
      setPreviewTarget(target ?? 'all');
      setPreviewMessage(
        target
          ? t('admin.ledSettings.messages.previewStartedFor', { target })
          : t('admin.ledSettings.messages.previewStarted')
      );
      setTimeout(() => setPreviewMessage(''), 4000);
    } catch (error: any) {
      setPreviewMessage(t('admin.ledSettings.messages.previewError') + (error.response?.data?.error || error.message));
      setPreviewActive(false);
      setPreviewTarget(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreviewStop = async () => {
    setStopLoading(true);
    try {
      await ledApi.clear();
      setPreviewActive(false);
      setPreviewTarget(null);
      setPreviewMessage(t('admin.ledSettings.messages.previewStopped'));
      setTimeout(() => setPreviewMessage(''), 3000);
    } catch (error: any) {
      setPreviewMessage(t('admin.ledSettings.messages.stopError') + (error.response?.data?.error || error.message));
    } finally {
      setStopLoading(false);
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
      setZoneTypeFeedback(zoneType.id, t('admin.ledSettings.messages.zoneTypeSaved'));
      loadZoneTypes();
    } catch (error: any) {
      setZoneTypeFeedback(
        zoneType.id,
        `${t('common.error')}: ` + (error.response?.data?.error || error.message)
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

  if (loading || zoneTypeLoading) return <div className="text-white">{t('common.loading')}</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{t('admin.ledSettings.title')}</h1>
        <p className="text-gray-400">{t('admin.ledSettings.subtitle')}</p>
      </div>

      <div className="glass rounded-xl p-6 space-y-6 border border-accent-red/30">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-6 h-6 text-yellow-400" />
          <div>
            <h2 className="text-xl font-bold text-white">{t('admin.ledSettings.singleBinTitle')}</h2>
            <p className="text-gray-400 text-sm">{t('admin.ledSettings.singleBinSubtitle')}</p>
          </div>
        </div>
        {/* Pattern Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-400 mb-3">{t('admin.ledSettings.pattern')}</label>
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
                {pattern === 'solid' && t('admin.ledSettings.patterns.solid')}
                {pattern === 'breathe' && t('admin.ledSettings.patterns.breathe')}
                {pattern === 'blink' && t('admin.ledSettings.patterns.blink')}
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-sm font-semibold text-gray-400 mb-3">{t('admin.ledSettings.color')}</label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={defaults.color}
              onChange={(e) => setDefaults({ ...defaults, color: e.target.value })}
              className="w-20 h-20 rounded-xl cursor-pointer"
              title={t('admin.ledSettings.color')}
            />
            <div className="flex-1">
              <input
                type="text"
                value={defaults.color}
                onChange={(e) => setDefaults({ ...defaults, color: e.target.value })}
                className="w-full px-4 py-3 rounded-xl glass text-white font-mono"
                placeholder="#FF4500"
              />
              <p className="text-gray-500 text-xs mt-1">{t('admin.ledSettings.hexHint')}</p>
            </div>
          </div>
        </div>

        {/* Intensity Slider */}
        <div>
          <label className="block text-sm font-semibold text-gray-400 mb-3">{t('admin.ledSettings.intensity')}: {defaults.intensity} / 255</label>
          <input
            type="range"
            min="0"
            max="255"
            value={defaults.intensity}
            onChange={(e) => setDefaults({ ...defaults, intensity: parseInt(e.target.value) })}
            className="w-full h-3 rounded-lg bg-white/10 appearance-none cursor-pointer"
            title={t('admin.ledSettings.intensity')}
          />
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-semibold text-gray-400 mb-3">{t('admin.ledSettings.preview')}</label>
          <div className="glass rounded-xl p-8 flex items-center justify-center">
            <div
              className={`w-32 h-32 rounded-2xl transition-all duration-1000 bg-accent-red ${
                defaults.intensity > 200
                  ? 'opacity-100'
                  : defaults.intensity > 140
                    ? 'opacity-75'
                    : defaults.intensity > 80
                      ? 'opacity-50'
                      : 'opacity-30'
              } ${
                defaults.pattern === 'breathe'
                  ? 'animate-pulse'
                  : defaults.pattern === 'blink'
                    ? 'animate-[ping_1s_infinite]'
                    : ''
              }`}
            ></div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-white/10">
          <div className="mb-3">
            <label className="block text-sm font-semibold text-gray-400 mb-2">
              {t('admin.ledSettings.previewBinOptional')}
            </label>
            <input
              type="text"
              list="preview-bin-options"
              value={previewBinId}
              onChange={(e) => setPreviewBinId(e.target.value)}
              placeholder="z. B. WDL-06-RG-02-F-01"
              className="w-full px-3 py-2 rounded-lg glass text-white font-mono"
              title={t('admin.ledSettings.previewBinOptional')}
            />
            <datalist id="preview-bin-options">
              {previewBinOptions.map((bin) => (
                <option key={bin} value={bin} />
              ))}
            </datalist>
            <p className="text-xs text-gray-500 mt-2">
              {t('admin.ledSettings.previewBinHint')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 py-3 px-4 sm:px-6 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                saving
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-accent-red to-red-700 hover:shadow-lg hover:shadow-red-500/50 hover:scale-105 active:scale-95'
              }`}
            >
              <Save className="w-5 h-5 flex-shrink-0" />
              <span className="hidden sm:inline">{saving ? t('common.saving') : t('admin.apiSettings.saveSettings')}</span>
              <span className="sm:hidden">{saving ? t('common.saving') : t('common.save')}</span>
            </button>
            <button
              onClick={() =>
                triggerPreview(
                  [
                    toPreviewAppearance(
                      defaults.color,
                      defaults.pattern,
                      defaults.intensity,
                      defaults.pattern === 'solid' ? 1200 : 1200
                    ),
                  ]
                )
              }
              disabled={previewLoading}
              className={`flex-1 py-3 px-4 sm:px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                previewLoading
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Lightbulb className="w-5 h-5 flex-shrink-0 text-yellow-300" />
              <span className="hidden sm:inline">{previewLoading ? t('admin.ledSettings.previewRunning') : t('admin.ledSettings.previewLed')}</span>
              <span className="sm:hidden">{previewLoading ? t('admin.ledSettings.runningShort') : t('admin.ledSettings.preview')}</span>
            </button>
            <button
              onClick={handlePreviewStop}
              disabled={(!previewActive && !previewLoading) || stopLoading}
              className={`flex-1 py-3 px-4 sm:px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                (!previewActive && !previewLoading) || stopLoading
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              <Square className="w-5 h-5 flex-shrink-0 text-red-300" />
              <span className="hidden sm:inline">{stopLoading ? t('admin.ledSettings.stopping') : t('admin.ledSettings.stopPreview')}</span>
              <span className="sm:hidden">{stopLoading ? t('admin.ledSettings.stopping') : t('common.stop')}</span>
            </button>
          </div>

          {message && (
            <div className={`mt-3 p-3 rounded-lg text-center text-sm font-semibold ${
              message.includes('✓')
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {message}
            </div>
          )}

          {previewMessage && (
            <div className={`mt-3 p-3 rounded-lg text-center text-sm font-semibold ${
              previewMessage.startsWith('✓')
                ? 'bg-green-500/15 text-green-300'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {previewMessage}
            </div>
          )}
        </div>
      </div>

      {/* Job highlight behaviour */}
      <div className="glass rounded-xl p-6 space-y-6 border border-blue-500/30">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-6 h-6 text-blue-400" />
          <div>
            <h2 className="text-xl font-bold text-white">{t('admin.ledSettings.jobTitle')}</h2>
            <p className="text-gray-400 text-sm">
              {t('admin.ledSettings.jobSubtitle')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setJobSettings((prev) => ({ ...prev, mode: 'all_bins' }))}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                jobSettings.mode === 'all_bins'
                  ? 'bg-accent-red text-white shadow-lg shadow-accent-red/30'
                  : 'glass text-gray-300 hover:text-white'
              }`}
            >
              {t('admin.ledSettings.jobModes.allBins')}
            </button>
            <button
              onClick={() => setJobSettings((prev) => ({ ...prev, mode: 'required_only' }))}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                jobSettings.mode === 'required_only'
                  ? 'bg-accent-red text-white shadow-lg shadow-accent-red/30'
                  : 'glass text-gray-300 hover:text-white'
              }`}
            >
              {t('admin.ledSettings.jobModes.requiredOnly')}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {jobSettings.mode === 'all_bins'
              ? t('admin.ledSettings.jobModeHintAllBins')
              : t('admin.ledSettings.jobModeHintRequiredOnly')}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[{
              key: 'required' as const,
              title: t('admin.ledSettings.requiredBinsTitle'),
              description: t('admin.ledSettings.requiredBinsDescription'),
            }, {
              key: 'non_required' as const,
              title: t('admin.ledSettings.nonRequiredBinsTitle'),
              description: t('admin.ledSettings.nonRequiredBinsDescription'),
            }].map((cfg) => {
              const appearance = jobSettings[cfg.key];
              return (
                <div key={cfg.key} className="glass-dark rounded-xl p-5 space-y-4 border border-white/5">
                  <div>
                    <h4 className="text-white font-semibold">{cfg.title}</h4>
                    <p className="text-xs text-gray-400 mt-1">{cfg.description}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">{t('admin.ledSettings.color')}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={appearance.color}
                        onChange={(e) => updateJobAppearance(cfg.key, { color: e.target.value })}
                        className="w-14 h-14 rounded-lg cursor-pointer"
                        title={t('admin.ledSettings.color')}
                      />
                      <input
                        type="text"
                        value={appearance.color}
                        onChange={(e) => updateJobAppearance(cfg.key, { color: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-lg glass text-white font-mono"
                        placeholder="#00FF00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">{t('admin.ledSettings.pattern')}</label>
                    <select
                      value={appearance.pattern}
                      onChange={(e) => updateJobAppearance(cfg.key, { pattern: e.target.value as LEDAppearance['pattern'] })}
                      className="w-full px-3 py-2 rounded-lg glass text-white"
                      title={t('admin.ledSettings.pattern')}
                    >
                      <option value="solid">{t('admin.ledSettings.patterns.solid')}</option>
                      <option value="breathe">{t('admin.ledSettings.patterns.breathe')}</option>
                      <option value="blink">{t('admin.ledSettings.patterns.blink')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">
                      {t('admin.ledSettings.intensity')}: {appearance.intensity} / 255
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={255}
                      value={appearance.intensity}
                      onChange={(e) => updateJobAppearance(cfg.key, { intensity: parseInt(e.target.value, 10) })}
                      className="w-full h-3 rounded-lg bg-white/10 appearance-none cursor-pointer"
                      title={t('admin.ledSettings.intensity')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">
                      {t('admin.ledSettings.speed')}{appearance.pattern === 'solid' ? '' : `: ${appearance.speed} ms`}
                    </label>
                    <input
                      type="range"
                      min={200}
                      max={3000}
                      step={100}
                      value={appearance.pattern === 'solid' ? 1200 : appearance.speed}
                      disabled={appearance.pattern === 'solid'}
                      onChange={(e) => updateJobAppearance(cfg.key, { speed: parseInt(e.target.value, 10) })}
                      className="w-full h-3 rounded-lg bg-white/10 appearance-none cursor-pointer disabled:opacity-40"
                      title={t('admin.ledSettings.speed')}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {appearance.pattern === 'solid'
                        ? t('admin.ledSettings.noAnimation')
                        : t('admin.ledSettings.speedHint')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleJobSettingsSave}
                disabled={jobSaving}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-white flex items-center justify-center gap-2 ${
                  jobSaving ? 'bg-gray-600 cursor-not-allowed' : 'bg-accent-red hover:bg-red-600 transition-colors'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{jobSaving ? t('common.saving') : t('admin.ledSettings.saveJob')}</span>
              </button>
              <button
                onClick={() =>
                  triggerPreview(
                    [
                      toPreviewAppearance(
                        jobSettings.required.color,
                        jobSettings.required.pattern,
                        jobSettings.required.intensity,
                        jobSettings.required.speed
                      ),
                      toPreviewAppearance(
                        jobSettings.non_required.color,
                        jobSettings.non_required.pattern,
                        jobSettings.non_required.intensity,
                        jobSettings.non_required.speed
                      ),
                    ]
                  )
                }
                disabled={previewLoading}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                  previewLoading
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Lightbulb className="w-4 h-4 text-yellow-300" />
                <span>{previewLoading ? t('admin.ledSettings.previewRunning') : t('admin.ledSettings.previewJob')}</span>
              </button>
              <button
                onClick={handlePreviewStop}
                disabled={(!previewActive && !previewLoading) || stopLoading}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                  (!previewActive && !previewLoading) || stopLoading
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : 'bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                <Square className="w-4 h-4 text-red-300" />
                <span>{stopLoading ? t('admin.ledSettings.stopping') : t('admin.ledSettings.stopPreview')}</span>
              </button>
            </div>
            {jobMessage && (
              <div
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                  jobMessage.startsWith('✓') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}
              >
                {jobMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LED mapping editor */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent-red" />
          <h3 className="text-lg font-semibold text-white">{t('admin.ledSettings.mappingTitle')}</h3>
        </div>
        <p className="text-sm text-gray-400">
          {t('admin.ledSettings.mappingSubtitle')}
        </p>

        {mappingLoading ? (
          <div className="glass rounded-xl p-5 text-sm text-gray-400">{t('admin.ledSettings.mappingLoading')}</div>
        ) : !mapping ? (
          <div className="glass rounded-xl p-5 text-sm text-red-400">
            {t('admin.ledSettings.mappingLoadFailed')}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="glass rounded-xl p-6 space-y-4 border border-white/10">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-semibold">{t('admin.ledSettings.defaultAppearance')}</h4>
                <button
                  onClick={() =>
                    triggerPreview(
                      [
                        toPreviewAppearance(
                          mapping.defaults.color,
                          mapping.defaults.pattern,
                          mapping.defaults.intensity,
                          mapping.defaults.speed
                        ),
                      ]
                    )
                  }
                  disabled={previewLoading && previewTarget !== 'all'}
                  className={`px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                    previewActive && previewTarget === 'all'
                      ? 'bg-red-600 text-white'
                      : previewLoading
                      ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <Lightbulb className="w-4 h-4 text-yellow-300" />
                  <span>{previewActive && previewTarget === 'all' ? t('admin.ledSettings.stopPreview') : previewLoading ? t('admin.ledSettings.previewRunning') : t('admin.ledSettings.preview')}</span>
                </button>
              </div>
              <p className="text-sm text-gray-400">
                {t('admin.ledSettings.defaultAppearanceHint')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">{t('admin.ledSettings.color')}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={mapping.defaults.color}
                      onChange={(e) => updateMappingDefaults({ color: e.target.value })}
                      className="w-16 h-16 rounded-lg cursor-pointer border-2 border-white/10"
                      title={t('admin.ledSettings.color')}
                    />
                    <input
                      type="text"
                      value={mapping.defaults.color}
                      onChange={(e) => updateMappingDefaults({ color: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-lg glass text-white font-mono"
                      placeholder="#FF7A00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">{t('admin.ledSettings.pattern')}</label>
                  <select
                    value={mapping.defaults.pattern}
                    onChange={(e) => updateMappingDefaults({ pattern: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg glass text-white"
                    title={t('admin.ledSettings.pattern')}
                  >
                    <option value="solid">{t('admin.ledSettings.patterns.solid')}</option>
                    <option value="breathe">{t('admin.ledSettings.patterns.breathe')}</option>
                    <option value="blink">{t('admin.ledSettings.patterns.blink')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    {t('admin.ledSettings.intensity')}: {mapping.defaults.intensity} / 255
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={mapping.defaults.intensity}
                    onChange={(e) => updateMappingDefaults({ intensity: parseInt(e.target.value, 10) })}
                    className="w-full h-3 rounded-lg bg-white/10 appearance-none cursor-pointer"
                    title={t('admin.ledSettings.intensity')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    {t('admin.ledSettings.speed')}{mapping.defaults.pattern === 'solid' ? '' : `: ${mapping.defaults.speed ?? 1200} ms`}
                  </label>
                  <input
                    type="range"
                    min={200}
                    max={3000}
                    step={100}
                    value={mapping.defaults.pattern === 'solid' ? 1200 : mapping.defaults.speed ?? 1200}
                    disabled={mapping.defaults.pattern === 'solid'}
                    onChange={(e) => updateMappingDefaults({ speed: parseInt(e.target.value, 10) })}
                    className="w-full h-3 rounded-lg bg-white/10 appearance-none cursor-pointer disabled:opacity-40"
                    title={t('admin.ledSettings.speed')}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {mapping.defaults.pattern === 'solid' ? t('admin.ledSettings.noAnimationShort') : t('admin.ledSettings.speedHintShort')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={loadMapping}
                disabled={mappingLoading}
                className="flex items-center gap-2 px-3 py-2 glass text-gray-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCcw className="w-4 h-4" /> {t('admin.ledSettings.reload')}
              </button>
              <button
                onClick={addShelf}
                className="flex items-center gap-2 px-3 py-2 bg-accent-red/80 hover:bg-accent-red text-white rounded-lg transition-colors"
              >
                {t('admin.ledSettings.addGroup')}
              </button>
            </div>

            {mapping.shelves.length === 0 ? (
              <div className="glass rounded-xl p-5 text-sm text-gray-400">
                {t('admin.ledSettings.noGroups')}
              </div>
            ) : (
              <div className="space-y-4">
                {mapping.shelves.map((shelf, shelfIndex) => (
                  <div key={`${shelf.shelf_id}-${shelfIndex}`} className="glass-dark rounded-xl p-5 space-y-4 border border-white/10">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-400 mb-1">{t('admin.ledSettings.groupIdentifier')}</label>
                        <input
                          type="text"
                          value={shelf.shelf_id}
                          onChange={(e) => updateShelfId(shelfIndex, e.target.value)}
                          className="w-full px-3 py-2 rounded-lg glass text-white"
                          title={t('admin.ledSettings.mappingTitle')}
                        />
                      </div>
                      <button
                        onClick={() => removeShelf(shelfIndex)}
                        className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-red-300"
                      >
                        {t('admin.ledSettings.removeGroup')}
                      </button>
                    </div>

                    <div className="space-y-3">
                      {shelf.bins.map((bin, binIndex) => {
                        const key = `${shelfIndex}:${binIndex}`;
                        const pixelValue = pixelsInput[key] ?? '';
                        const selectedZone = zones.find((zone) => zone.code === bin.bin_id);
                        return (
                          <div key={`${bin.bin_id}-${binIndex}`} className="glass rounded-lg p-4 space-y-3 border border-white/10">
                            <div className="grid gap-3 md:grid-cols-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1">{t('admin.ledSettings.selectArea')}</label>
                                <select
                                  value={selectedZone ? selectedZone.code : ''}
                                  onChange={(e) => updateBinId(shelfIndex, binIndex, e.target.value || bin.bin_id)}
                                  className="w-full px-3 py-2 rounded-lg glass text-white"
                                  title={t('admin.ledSettings.mappingTitle')}
                                >
                                  <option value="">{t('admin.ledSettings.selectAreaPlaceholder')}</option>
                                  {zoneOptions.map((zone) => (
                                    <option key={zone.zone_id} value={zone.code ?? ''} className="bg-dark">
                                      {zoneLabelForOption(zone, t)}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={bin.bin_id}
                                  onChange={(e) => updateBinId(shelfIndex, binIndex, e.target.value)}
                                  className="mt-2 w-full px-3 py-2 rounded-lg glass text-white"
                                  placeholder={t('admin.ledSettings.binCodePlaceholder')}
                                  title={t('admin.ledSettings.binCode')}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1">{t('admin.ledSettings.ledPixels')}</label>
                                <input
                                  type="text"
                                  value={pixelValue}
                                  onChange={(e) => handlePixelInputChange(shelfIndex, binIndex, e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg glass text-white font-mono"
                                  placeholder="0,1,2,3"
                                  title={t('admin.ledSettings.ledPixels')}
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() =>
                                    previewActive && previewTarget === bin.bin_id
                                      ? handlePreviewStop()
                                      : triggerPreview(
                                          [
                                            toPreviewAppearance(
                                              mapping.defaults.color,
                                              mapping.defaults.pattern,
                                              mapping.defaults.intensity,
                                              mapping.defaults.speed
                                            ),
                                          ],
                                          bin.bin_id
                                        )
                                  }
                                  disabled={previewLoading && previewTarget !== bin.bin_id}
                                  className={`px-3 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                                    previewActive && previewTarget === bin.bin_id
                                      ? 'bg-red-600 text-white'
                                      : previewLoading
                                      ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                                      : 'bg-white/10 text-white hover:bg-white/20'
                                  }`}
                                >
                                  <Lightbulb className="w-4 h-4 text-yellow-300" />
                                  <span>{previewActive && previewTarget === bin.bin_id ? t('admin.ledSettings.stop') : previewLoading && previewTarget !== bin.bin_id ? t('admin.ledSettings.loading') : t('admin.ledSettings.preview')}</span>
                                </button>
                                <button
                                  onClick={() => removeBin(shelfIndex, binIndex)}
                                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 hover:bg-white/20 text-red-300"
                                >
                                  {t('admin.ledSettings.removeBin')}
                                </button>
                              </div>
                            </div>
                            {selectedZone && (
                              <p className="text-xs text-gray-500">
                                {selectedZone.name}{' '}
                                {selectedZone.code && (
                                  <span className="italic text-gray-400">
                                    ({selectedZone.code})
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => addBin(shelfIndex)}
                      className="px-3 py-2 rounded-lg text-sm font-semibold bg-accent-red/80 hover:bg-accent-red text-white"
                    >
                      {t('admin.ledSettings.addBin')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleMappingValidate}
                disabled={mappingValidating}
                className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${
                  mappingValidating ? 'bg-gray-600 cursor-not-allowed text-gray-200' : 'glass text-gray-200 hover:text-white'
                }`}
              >
                {mappingValidating ? t('admin.ledSettings.validating') : t('admin.ledSettings.validateMapping')}
              </button>
              <button
                onClick={handleMappingSave}
                disabled={mappingSaving}
                className={`px-4 py-2 rounded-lg font-semibold text-white flex items-center gap-2 ${
                  mappingSaving ? 'bg-gray-600 cursor-not-allowed' : 'bg-accent-red hover:bg-red-600 transition-colors'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{mappingSaving ? t('common.saving') : t('admin.ledSettings.saveMapping')}</span>
              </button>
            </div>

            {mappingMessage && (
              <div
                className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                  mappingMessage.startsWith('✓')
                    ? 'bg-green-500/20 text-green-400'
                    : mappingMessage.startsWith('⚠️')
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
                }`}
              >
                {mappingMessage}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zone type specific defaults */}
      <div className="glass rounded-xl p-6 space-y-6 border border-purple-500/30">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-6 h-6 text-purple-400" />
          <div>
            <h2 className="text-xl font-bold text-white">{t('admin.ledSettings.zoneTypeTitle')}</h2>
            <p className="text-gray-400 text-sm">
              {t('admin.ledSettings.zoneTypeSubtitle')}
            </p>
          </div>
        </div>

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
                  title={t('admin.ledSettings.applyGlobalDefaults')}
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span>{t('admin.ledSettings.applyGlobal')}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">{t('admin.ledSettings.pattern')}</label>
                  <select
                    value={zoneType.default_led_pattern}
                    onChange={(e) => handleZoneTypeFieldChange(zoneType.id, 'default_led_pattern', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg glass text-white"
                    title={t('admin.ledSettings.pattern')}
                  >
                    <option value="solid">{t('admin.ledSettings.patterns.solid')}</option>
                    <option value="breathe">{t('admin.ledSettings.patterns.breathe')}</option>
                    <option value="blink">{t('admin.ledSettings.patterns.blink')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">{t('admin.ledSettings.color')}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={zoneType.default_led_color || '#FF7A00'}
                      onChange={(e) => handleZoneTypeFieldChange(zoneType.id, 'default_led_color', e.target.value)}
                      className="w-14 h-14 rounded-lg cursor-pointer"
                      title={t('admin.ledSettings.color')}
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
                    {t('admin.ledSettings.intensity')}: {zoneType.default_intensity} / 255
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
                    title={t('admin.ledSettings.intensity')}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <button
                    onClick={() => handleZoneTypeSave(zoneType)}
                    disabled={zoneTypeSaving === zoneType.id}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold text-white flex items-center justify-center gap-2 ${
                      zoneTypeSaving === zoneType.id
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-accent-red hover:bg-red-600 transition-colors'
                    }`}
                  >
                    <Save className="w-4 h-4" />
                    <span>{zoneTypeSaving === zoneType.id ? t('common.saving') : t('admin.ledSettings.saveZoneType')}</span>
                  </button>
                  <button
                    onClick={() =>
                      triggerPreview(
                        [
                          toPreviewAppearance(
                            zoneType.default_led_color || defaults.color,
                            zoneType.default_led_pattern || 'solid',
                            zoneType.default_intensity ?? 180,
                            zoneType.default_led_pattern === 'solid' ? 1200 : 1200
                          ),
                        ]
                      )
                    }
                    disabled={previewLoading}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                      previewLoading
                        ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <Lightbulb className="w-4 h-4 text-yellow-300" />
                    <span>{previewLoading ? t('admin.ledSettings.previewRunning') : t('admin.ledSettings.previewLed')}</span>
                  </button>
                  <button
                    onClick={handlePreviewStop}
                    disabled={(!previewActive && !previewLoading) || stopLoading}
                    className={`flex-1 px-4 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 ${
                      (!previewActive && !previewLoading) || stopLoading
                        ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                        : 'bg-white/5 text-white hover:bg-white/10'
                    }`}
                  >
                    <Square className="w-4 h-4 text-red-300" />
                    <span>{stopLoading ? t('admin.ledSettings.stopping') : t('admin.ledSettings.stopPreview')}</span>
                  </button>
            </div>
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
