import { useState } from 'react';
import { Download, Package, Building2, Tag, Layers, Cable, Briefcase, FileText, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ExportType = {
  id: string;
  icon: typeof Download;
};

export function ExportTab() {
  const [loading, setLoading] = useState<string | null>(null);
  const { t } = useTranslation();

  const exportTypes: ExportType[] = [
    {
      id: 'products',
      icon: Package,
    },
    {
      id: 'products-with-count',
      icon: TrendingUp,
    },
    {
      id: 'products-with-brand',
      icon: Tag,
    },
    {
      id: 'devices',
      icon: FileText,
    },
    {
      id: 'manufacturers',
      icon: Building2,
    },
    {
      id: 'manufacturers-with-brands',
      icon: Building2,
    },
    {
      id: 'brands',
      icon: Tag,
    },
    {
      id: 'zones',
      icon: Layers,
    },
    {
      id: 'cables',
      icon: Cable,
    },
    {
      id: 'jobs',
      icon: Briefcase,
    },
  ];

  const handleExport = async (exportType: string, label: string) => {
    setLoading(exportType);

    try {
      const response = await fetch(`/api/v1/admin/export/${exportType}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(t('admin.export.messages.exportFailed'));
      }

      // Get the blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `export_${exportType}_${new Date().toISOString().split('T')[0]}.csv`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Show success message
      const event = new CustomEvent('toast', {
        detail: {
          type: 'success',
          message: t('admin.export.messages.exportSuccess', { label }),
        },
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Export error:', error);
      const event = new CustomEvent('toast', {
        detail: {
          type: 'error',
          message: t('admin.export.messages.exportError'),
        },
      });
      window.dispatchEvent(event);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('admin.export.title')}</h2>
        <p className="text-gray-400">
          {t('admin.export.subtitle')}
        </p>
      </div>

      {/* Export Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exportTypes.map((exportType) => {
          const Icon = exportType.icon;
          const isLoading = loading === exportType.id;

          return (
            <button
              key={exportType.id}
              onClick={() => handleExport(exportType.id, t(`admin.export.types.${exportType.id}.label`))}
              disabled={isLoading}
              className="glass-dark p-6 rounded-xl text-left hover:bg-white/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-accent-red/20 rounded-lg group-hover:bg-accent-red/30 transition-colors">
                  <Icon className="w-6 h-6 text-accent-red" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-accent-red transition-colors">
                    {t(`admin.export.types.${exportType.id}.label`)}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {t(`admin.export.types.${exportType.id}.description`)}
                  </p>
                </div>
              </div>

              {/* Download Button */}
              <div className="mt-4 flex items-center justify-end">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-accent-red">
                    <div className="w-4 h-4 border-2 border-accent-red border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium">{t('admin.export.exporting')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 group-hover:text-accent-red transition-colors">
                    <Download className="w-4 h-4" />
                    <span className="text-sm font-medium">{t('admin.export.downloadCsv')}</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="glass-dark p-6 rounded-xl border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent-red" />
          {t('admin.export.notes.title')}
        </h3>
        <ul className="space-y-2 text-gray-400 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-accent-red mt-1">•</span>
            <span>
              <strong className="text-white">{t('admin.export.notes.encodingLabel')}</strong> {t('admin.export.notes.encodingText')}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-red mt-1">•</span>
            <span>
              <strong className="text-white">{t('admin.export.notes.delimiterLabel')}</strong> {t('admin.export.notes.delimiterText')}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-red mt-1">•</span>
            <span>
              <strong className="text-white">{t('admin.export.notes.numberFormatLabel')}</strong> {t('admin.export.notes.numberFormatText')}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-red mt-1">•</span>
            <span>
              <strong className="text-white">{t('admin.export.notes.dateFormatLabel')}</strong> {t('admin.export.notes.dateFormatText')}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent-red mt-1">•</span>
            <span>
              <strong className="text-white">{t('admin.export.notes.excelImportLabel')}</strong> {t('admin.export.notes.excelImportText')}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
