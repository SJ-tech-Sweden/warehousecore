import { useEffect, useState } from 'react';
import { Package, Warehouse, AlertTriangle, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { dashboardApi } from '../lib/api';
import type { DashboardStats, Movement } from '../lib/api';
import { LowStockAlertsWidget } from '../components/LowStockAlertsWidget';

export function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats>({
    in_storage: 0,
    on_job: 0,
    defective: 0,
    total: 0,
  });
  const [recentActivity, setRecentActivity] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
    const interval = setInterval(() => {
      void loadData();
    }, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const { data } = await dashboardApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }

    try {
      const { data } = await dashboardApi.getRecentMovements(10);
      setRecentActivity(data);
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    }

    if (loading) {
      setLoading(false);
    }
  };

  const formatRelativeTime = (isoTimestamp: string): string => {
    const date = new Date(isoTimestamp);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const diffMs = Date.now() - date.getTime();
    if (diffMs <= 0) {
      return t('dashboard.relative.now');
    }

    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds < 60) {
      return t('dashboard.relative.seconds');
    }

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) {
      return t(diffMinutes === 1 ? 'dashboard.relative.minute' : 'dashboard.relative.minutes', { count: diffMinutes });
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return t(diffHours === 1 ? 'dashboard.relative.hour' : 'dashboard.relative.hours', { count: diffHours });
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return t(diffDays === 1 ? 'dashboard.relative.day' : 'dashboard.relative.days', { count: diffDays });
    }

    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) {
      return t(diffWeeks === 1 ? 'dashboard.relative.week' : 'dashboard.relative.weeks', { count: diffWeeks });
    }

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return t(diffMonths === 1 ? 'dashboard.relative.month' : 'dashboard.relative.months', { count: diffMonths });
    }

    const diffYears = Math.floor(diffDays / 365);
    return t(diffYears === 1 ? 'dashboard.relative.year' : 'dashboard.relative.years', { count: diffYears });
  };

  const describeMovement = (movement: Movement): string => {
    const deviceLabel =
      movement.product_name ??
      movement.serial_number ??
      movement.device_id;

    switch (movement.action) {
      case 'intake':
        return movement.to_zone_name
          ? t('dashboard.movements.intakeToZone', { device: deviceLabel, zone: movement.to_zone_name })
          : t('dashboard.movements.intakeToWarehouse', { device: deviceLabel });
      case 'outtake':
        return movement.to_job_description
          ? t('dashboard.movements.outtakeForJob', { device: deviceLabel, job: movement.to_job_description })
          : t('dashboard.movements.outtakeFromWarehouse', { device: deviceLabel });
      case 'transfer':
        if (movement.from_zone_name && movement.to_zone_name) {
          return t('dashboard.movements.transferBetweenZones', {
            device: deviceLabel,
            fromZone: movement.from_zone_name,
            toZone: movement.to_zone_name,
          });
        }
        if (movement.to_zone_name) {
          return t('dashboard.movements.transferToZone', { device: deviceLabel, zone: movement.to_zone_name });
        }
        if (movement.from_zone_name) {
          return t('dashboard.movements.transferFromZone', { device: deviceLabel, zone: movement.from_zone_name });
        }
        return t('dashboard.movements.transferGeneric', { device: deviceLabel });
      case 'return':
        return t('dashboard.movements.return', { device: deviceLabel });
      case 'move':
        return t('dashboard.movements.move', { device: deviceLabel });
      default:
        return t('dashboard.movements.unknown', { device: deviceLabel, action: movement.action });
    }
  };

  const activityItems = recentActivity.slice(0, 5);

  const statCards = [
    {
      title: t('dashboard.stats.inStorage'),
      value: stats.in_storage,
      icon: Warehouse,
      color: 'from-gray-600 to-gray-800',
      textColor: 'text-gray-300',
    },
    {
      title: t('dashboard.stats.onJob'),
      value: stats.on_job,
      icon: Package,
      color: 'from-accent-red to-red-700',
      textColor: 'text-accent-red',
    },
    {
      title: t('dashboard.stats.defective'),
      value: stats.defective,
      icon: AlertTriangle,
      color: 'from-yellow-600 to-yellow-800',
      textColor: 'text-yellow-500',
    },
    {
      title: t('dashboard.stats.total'),
      value: stats.total,
      icon: TrendingUp,
      color: 'from-blue-600 to-blue-800',
      textColor: 'text-blue-400',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-red"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1 sm:mb-2">{t('dashboard.title')}</h2>
        <p className="text-sm sm:text-base text-gray-400">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:bg-white/20 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br ${card.color} bg-opacity-20`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.textColor}`} />
                </div>
                <div className="text-xs sm:text-sm text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {t('dashboard.live')}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-gray-400 text-xs sm:text-sm font-medium">{card.title}</p>
                <p className={`text-3xl sm:text-4xl font-bold ${card.textColor}`}>{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Low Stock Alerts */}
      <LowStockAlertsWidget />

      {/* Recent Activity */}
      <div className="glass-dark rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">{t('dashboard.recentActivity')}</h3>
        {activityItems.length === 0 ? (
          <div className="text-sm sm:text-base text-gray-400">{t('dashboard.noActivity')}</div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {activityItems.map((activity) => (
              <div
                key={activity.movement_id}
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 glass rounded-lg sm:rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-accent-red animate-pulse flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm sm:text-base text-white font-medium truncate">
                    {describeMovement(activity)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-400">
                    <span>{formatRelativeTime(activity.timestamp) || t('dashboard.relative.now')}</span>
                    {activity.performed_by && (
                      <>
                        <span className="hidden sm:inline text-gray-600">•</span>
                        <span className="truncate">{activity.performed_by}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
