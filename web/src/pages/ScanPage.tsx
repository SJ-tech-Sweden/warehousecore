import { useState } from 'react';
import { ScanLine, CheckCircle, XCircle, MapPin } from 'lucide-react';
import { scansApi, zonesApi } from '../lib/api';
import type { ScanResponse } from '../lib/api';

type ScanStep = 'device' | 'zone';

export function ScanPage() {
  const [scanCode, setScanCode] = useState('');
  const [action, setAction] = useState<'intake' | 'outtake' | 'check'>('check');
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Two-step workflow for intake
  const [step, setStep] = useState<ScanStep>('device');
  const [deviceScanCode, setDeviceScanCode] = useState('');

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;

    setLoading(true);
    try {
      // Step 1: Scan device
      if (action === 'intake' && step === 'device') {
        // Verify device exists by trying to scan it (check action)
        const { data } = await scansApi.process({
          scan_code: scanCode,
          action: 'check',
        });

        if (data.success) {
          // Device found - proceed to zone scan
          setDeviceScanCode(scanCode);
          setStep('zone');
          setScanCode('');
          setResult(null);
        } else {
          setResult(data);
        }
      }
      // Step 2: Scan zone for intake
      else if (action === 'intake' && step === 'zone') {
        // Find zone by barcode
        const { data: zone } = await zonesApi.getByScan(scanCode);

        // Now process the actual intake with zone_id
        const { data } = await scansApi.process({
          scan_code: deviceScanCode,
          action: 'intake',
          zone_id: zone.zone_id,
        });

        setResult(data);
        setScanCode('');
        setDeviceScanCode('');
        setStep('device');
      }
      // All other actions (outtake, check) - single step
      else {
        const { data } = await scansApi.process({
          scan_code: scanCode,
          action,
        });
        setResult(data);
        setScanCode('');
      }
    } catch (error: any) {
      console.error('Scan failed:', error);
      setResult({
        success: false,
        message: error.response?.data?.error || 'Scan fehlgeschlagen',
        action,
        duplicate: false,
      });

      // Reset to step 1 on error
      if (step === 'zone') {
        setStep('device');
        setDeviceScanCode('');
        setScanCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActionChange = (newAction: 'intake' | 'outtake' | 'check') => {
    setAction(newAction);
    setStep('device');
    setDeviceScanCode('');
    setScanCode('');
    setResult(null);
  };

  return (
    <div className="flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl my-auto">
        {/* Scan Form */}
        <div className="glass-dark rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-white/10">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-block p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-accent-red to-red-700 mb-3 sm:mb-4">
              {step === 'zone' ? (
                <MapPin className="w-8 h-8 sm:w-12 sm:h-12 text-white" />
              ) : (
                <ScanLine className="w-8 h-8 sm:w-12 sm:h-12 text-white" />
              )}
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold text-white mb-1 sm:mb-2">
              {step === 'zone' ? 'Lagerplatz Scannen' : 'Barcode Scanner'}
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              {step === 'zone'
                ? 'Scanne den Barcode des Lagerplatzes'
                : 'Gerät scannen oder Code eingeben'}
            </p>
          </div>

          {/* Step Indicator for Intake */}
          {action === 'intake' && (
            <div className="mb-4 sm:mb-6 flex items-center justify-center gap-2 sm:gap-4">
              <div className={`flex items-center gap-1.5 sm:gap-2 ${step === 'device' ? 'text-accent-red' : 'text-green-500'}`}>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm sm:text-base ${
                  step === 'device' ? 'bg-accent-red' : 'bg-green-500'
                }`}>
                  {step === 'zone' ? '✓' : '1'}
                </div>
                <span className="text-sm sm:text-base font-semibold">Gerät</span>
              </div>
              <div className="w-8 sm:w-12 h-0.5 bg-white/20"></div>
              <div className={`flex items-center gap-1.5 sm:gap-2 ${step === 'zone' ? 'text-accent-red' : 'text-gray-500'}`}>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm sm:text-base ${
                  step === 'zone' ? 'bg-accent-red' : 'bg-gray-700'
                }`}>
                  2
                </div>
                <span className="text-sm sm:text-base font-semibold">Lagerplatz</span>
              </div>
            </div>
          )}

          <form onSubmit={handleScan} className="space-y-4 sm:space-y-6">
            {/* Scan Input */}
            <div>
              <input
                type="text"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                placeholder={step === 'zone' ? 'Lagerplatz-Barcode / Code' : 'Barcode / QR-Code / Geräte-ID'}
                autoFocus
                className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-xl text-white text-base sm:text-xl placeholder-gray-500 focus:outline-none focus:border-accent-red transition-colors"
              />
            </div>

            {/* Action Selection - only show in step 1 */}
            {step === 'device' && (
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                  { value: 'check', label: 'Prüfen', color: 'blue' },
                  { value: 'intake', label: 'Einlagern', color: 'green' },
                  { value: 'outtake', label: 'Auslagern', color: 'red' },
                ].map((btn) => (
                  <button
                    key={btn.value}
                    type="button"
                    onClick={() => handleActionChange(btn.value as any)}
                    className={`px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all ${
                      action === btn.value
                        ? 'bg-accent-red text-white scale-105'
                        : 'glass text-gray-400 hover:text-white hover:scale-105'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !scanCode.trim()}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-accent-red to-red-700 text-white font-bold text-base sm:text-lg rounded-xl hover:shadow-lg hover:shadow-accent-red/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              {loading ? 'Scannen...' : step === 'zone' ? 'Lagerplatz Scannen' : 'Gerät Scannen'}
            </button>
          </form>
        </div>

        {/* Scan Result */}
        {result && (
          <div className={`mt-4 sm:mt-6 glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2 ${
            result.success ? 'border-green-500/50' : 'border-red-500/50'
          } animate-fade-in`}>
            <div className="flex items-start gap-3 sm:gap-4">
              {result.success ? (
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-base sm:text-lg font-semibold ${
                  result.success ? 'text-green-400' : 'text-red-400'
                }`}>
                  {result.message}
                </p>
                {result.device && (
                  <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                    <p className="text-gray-300 truncate">
                      <span className="text-gray-500">Gerät:</span> {result.device.product_name}
                    </p>
                    <p className="text-gray-300 truncate">
                      <span className="text-gray-500">ID:</span> {result.device.device_id}
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-500">Status:</span>{' '}
                      <span className={result.success ? 'text-green-400' : 'text-yellow-400'}>
                        {result.new_status || result.device.status}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
