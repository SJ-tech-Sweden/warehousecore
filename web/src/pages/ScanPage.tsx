import { useState, useCallback, useRef, useEffect } from 'react';
import { ScanLine, CheckCircle, XCircle, MapPin, Lightbulb, Camera, Nfc, Keyboard, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { scansApi, zonesApi, jobsApi, ledApi } from '../lib/api';
import type { ScanResponse } from '../lib/api';
import { useBlockBodyScroll } from '../hooks/useBlockBodyScroll';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useNFCScanner } from '../hooks/useNFCScanner';

type InputMethod = 'keyboard' | 'camera' | 'nfc';
type ScanStep = 'device' | 'zone';

export function ScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [scanCode, setScanCode] = useState('');
  const [action, setAction] = useState<'intake' | 'outtake' | 'check'>('check');
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Input method: keyboard (default), camera, or nfc
  const [inputMethod, setInputMethod] = useState<InputMethod>('keyboard');

  // Two-step workflow for intake
  const [step, setStep] = useState<ScanStep>('device');
  const [deviceScanCode, setDeviceScanCode] = useState('');
  const [consumableQuantity, setConsumableQuantity] = useState<number | undefined>(undefined);

  // Job-Code scan states
  const [showLEDModal, setShowLEDModal] = useState(false);
  const [scannedJobId, setScannedJobId] = useState<number | null>(null);

  // Block body scroll when LED modal is open
  useBlockBodyScroll(showLEDModal);

  // Keep a stable ref to the current scan submission handler so the scanner
  // callbacks (which are memoised) can always call the latest version.
  const submitCodeRef = useRef<(code: string) => void>(() => {});

  const handleCodeDetected = useCallback((code: string) => {
    submitCodeRef.current(code);
  }, []);

  const barcodeScanner = useBarcodeScanner({ onDetected: handleCodeDetected });
  const nfcScanner = useNFCScanner({ onDetected: handleCodeDetected });

  // Start/stop scanners when input method changes
  useEffect(() => {
    if (inputMethod !== 'camera') barcodeScanner.stopScanning();
    if (inputMethod !== 'nfc') nfcScanner.stopScanning();

    if (inputMethod === 'camera') {
      barcodeScanner.startScanning();
    } else if (inputMethod === 'nfc') {
      nfcScanner.startScanning();
    }
    // Intentionally not including scanner methods in deps to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMethod]);

  // Stop scanners on unmount
  useEffect(() => {
    return () => {
      barcodeScanner.stopScanning();
      nfcScanner.stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processCode = useCallback(async (code: string) => {
    if (!code.trim()) return;

    // Check if scan code is a Job-Code (format: JOB######)
    const jobCodeMatch = code.match(/^JOB(\d{6})$/i);
    if (jobCodeMatch) {
      const jobId = parseInt(jobCodeMatch[1], 10);
      await handleJobCodeScan(jobId);
      return;
    }

    setLoading(true);
    try {
      // Step 1: Scan device
      if (action === 'intake' && step === 'device') {
        // Verify device exists by trying to scan it (check action)
        const { data } = await scansApi.process({
          scan_code: code,
          action: 'check',
        });

        if (data.success) {
          // Check if this is an accessory/consumable (has product info with unit)
          if (data.product && data.product.unit) {
            // This is an accessory/consumable - ask for quantity
            const quantityStr = window.prompt(t('scan.prompts.intakeQuantity', { unit: data.product.unit }));

            if (!quantityStr || isNaN(Number(quantityStr)) || Number(quantityStr) <= 0) {
              setResult({
                success: false,
                message: t('scan.invalidQuantity'),
                action,
                duplicate: false,
              });
              setLoading(false);
              return;
            }

            // Store quantity and proceed to zone scan
            setConsumableQuantity(Number(quantityStr));
            setDeviceScanCode(code);
            setStep('zone');
            setScanCode('');
            setResult(null);
            setLoading(false);
            return;
          }

          // Regular device - proceed to zone scan
          setDeviceScanCode(code);
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
        const { data: zone } = await zonesApi.getByScan(code);

        // Now process the actual intake with zone_id (and quantity if it's a consumable)
        const { data } = await scansApi.process({
          scan_code: deviceScanCode,
          action: 'intake',
          zone_id: zone.zone_id,
          job_id: consumableQuantity, // Pass quantity for consumables
        });

        setResult(data);
        setScanCode('');
        setDeviceScanCode('');
        setConsumableQuantity(undefined);
        setStep('device');
      }
      // All other actions (outtake, check) - single step
      else {
        // For consumables with intake/outtake, ask for quantity first
        let quantity = undefined;
        if ((action === 'intake' || action === 'outtake')) {
          // First check if this might be a consumable (quick check without committing)
          const checkResponse = await scansApi.process({
            scan_code: code,
            action: 'check',
          });

          // If the response includes product info with a unit, it's an accessory/consumable
          if (checkResponse.data.product && checkResponse.data.product.unit) {
            const promptText = action === 'intake'
              ? t('scan.prompts.intakeQuantity', { unit: checkResponse.data.product.unit })
              : t('scan.prompts.outtakeQuantity', { unit: checkResponse.data.product.unit });
            const quantityStr = window.prompt(promptText);

            if (!quantityStr || isNaN(Number(quantityStr)) || Number(quantityStr) <= 0) {
              setResult({
                success: false,
                message: t('scan.invalidQuantity'),
                action,
                duplicate: false,
              });
              setLoading(false);
              return;
            }
            quantity = Number(quantityStr);
          }
        }

        // Now do the actual scan with quantity if provided
        const { data } = await scansApi.process({
          scan_code: code,
          action,
          job_id: quantity, // Pass quantity via job_id field (backend expects this)
        });
        setResult(data);
        setScanCode('');
      }
    } catch (error: any) {
      console.error('Scan failed:', error);
      setResult({
        success: false,
        message: error.response?.data?.error || t('scan.scanError'),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, step, deviceScanCode, consumableQuantity, t]);

  // Keep submitCodeRef in sync with the latest processCode so scanner callbacks
  // (which are memoised on mount) can always reach the current state closure.
  useEffect(() => {
    submitCodeRef.current = processCode;
  }, [processCode]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    processCode(scanCode);
  };

  const handleActionChange = (newAction: 'intake' | 'outtake' | 'check') => {
    setAction(newAction);
    setStep('device');
    setDeviceScanCode('');
    setConsumableQuantity(undefined);
    setScanCode('');
    setResult(null);
  };

  const handleInputMethodChange = (method: InputMethod) => {
    setScanCode('');
    setResult(null);
    setInputMethod(method);
  };

  const handleJobCodeScan = async (jobId: number) => {
    setScanCode('');
    setLoading(true);

    try {
      // First, verify job exists
      await jobsApi.getById(jobId);

      // Check LED status
      const { data: ledStatus } = await ledApi.getStatus();

      if (ledStatus.mqtt_connected) {
        // LED is on - navigate directly to job
        await ledApi.highlightJob(jobId);
        navigate(`/jobs/${jobId}`);
      } else {
        // LED is off - ask user if they want to enable it
        setScannedJobId(jobId);
        setShowLEDModal(true);
      }
    } catch (error: any) {
      console.error('Job scan failed:', error);
      setResult({
        success: false,
        message: error.response?.data?.error || t('jobsPage.jobNotFound', { id: jobId }),
        action: 'check',
        duplicate: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLEDModalConfirm = async () => {
    if (!scannedJobId) return;

    try {
      setLoading(true);
      await ledApi.highlightJob(scannedJobId);
      setShowLEDModal(false);
      navigate(`/jobs/${scannedJobId}`);
    } catch (error) {
      console.error('LED activation failed:', error);
      setShowLEDModal(false);
      navigate(`/jobs/${scannedJobId}`);
    }
  };

  const handleLEDModalCancel = () => {
    if (scannedJobId) {
      navigate(`/jobs/${scannedJobId}`);
    }
    setShowLEDModal(false);
    setScannedJobId(null);
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
              {step === 'zone' ? t('scan.zoneTitle') : t('scan.scannerTitle')}
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              {step === 'zone'
                ? t('scan.zoneSubtitle')
                : t('scan.scannerSubtitle')}
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
                <span className="text-sm sm:text-base font-semibold">{t('scan.steps.device')}</span>
              </div>
              <div className="w-8 sm:w-12 h-0.5 bg-white/20"></div>
              <div className={`flex items-center gap-1.5 sm:gap-2 ${step === 'zone' ? 'text-accent-red' : 'text-gray-500'}`}>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm sm:text-base ${
                  step === 'zone' ? 'bg-accent-red' : 'bg-gray-700'
                }`}>
                  2
                </div>
                <span className="text-sm sm:text-base font-semibold">{t('scan.steps.zone')}</span>
              </div>
            </div>
          )}

          {/* Input Method Selector */}
          <div className="flex gap-2 mb-4 sm:mb-6 p-1 bg-white/5 rounded-xl">
            <button
              type="button"
              onClick={() => handleInputMethodChange('keyboard')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                inputMethod === 'keyboard'
                  ? 'bg-accent-red text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              {t('scan.inputMethods.keyboard')}
            </button>
            {barcodeScanner.isSupported && (
              <button
                type="button"
                onClick={() => handleInputMethodChange('camera')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  inputMethod === 'camera'
                    ? 'bg-accent-red text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Camera className="w-4 h-4" />
                {t('scan.inputMethods.camera')}
              </button>
            )}
            {nfcScanner.isSupported && (
              <button
                type="button"
                onClick={() => handleInputMethodChange('nfc')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  inputMethod === 'nfc'
                    ? 'bg-accent-red text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Nfc className="w-4 h-4" />
                {t('scan.inputMethods.nfc')}
              </button>
            )}
          </div>

          {/* Camera Preview */}
          {inputMethod === 'camera' && (
            <div className="mb-4 sm:mb-6">
              {barcodeScanner.error ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  <X className="w-5 h-5 flex-shrink-0" />
                  {barcodeScanner.error}
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video
                    ref={barcodeScanner.videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  {/* Scanning overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-2/3 h-2/3 border-2 border-accent-red/70 rounded-lg relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-accent-red rounded-tl-md -translate-x-0.5 -translate-y-0.5"></div>
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-accent-red rounded-tr-md translate-x-0.5 -translate-y-0.5"></div>
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-accent-red rounded-bl-md -translate-x-0.5 translate-y-0.5"></div>
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-accent-red rounded-br-md translate-x-0.5 translate-y-0.5"></div>
                    </div>
                  </div>
                  {!barcodeScanner.isScanning && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <p className="text-white text-sm">{t('scan.camera.starting')}</p>
                    </div>
                  )}
                </div>
              )}
              <p className="text-center text-gray-400 text-xs sm:text-sm mt-2">
                {t('scan.camera.hint')}
              </p>
            </div>
          )}

          {/* NFC Waiting State */}
          {inputMethod === 'nfc' && (
            <div className="mb-4 sm:mb-6">
              {nfcScanner.error ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  <X className="w-5 h-5 flex-shrink-0" />
                  {nfcScanner.error}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-white/5 border border-white/10">
                  <div className={`p-4 rounded-full ${nfcScanner.isScanning ? 'bg-accent-red/20 animate-pulse' : 'bg-white/10'}`}>
                    <Nfc className={`w-12 h-12 ${nfcScanner.isScanning ? 'text-accent-red' : 'text-gray-500'}`} />
                  </div>
                  <p className="text-white text-sm sm:text-base font-semibold">
                    {nfcScanner.isScanning ? t('scan.nfc.ready') : t('scan.nfc.starting')}
                  </p>
                  <p className="text-gray-400 text-xs sm:text-sm text-center">
                    {t('scan.nfc.hint')}
                  </p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleScan} className="space-y-4 sm:space-y-6">
            {/* Scan Input - primary input in keyboard mode, manual fallback in camera/NFC modes */}
            <div>
              <input
                type="text"
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                placeholder={
                  inputMethod === 'keyboard'
                    ? (step === 'zone' ? t('scan.placeholders.zone') : t('scan.placeholders.device'))
                    : t('scan.placeholders.manualFallback')
                }
                autoFocus={inputMethod === 'keyboard'}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white/10 backdrop-blur-md border-2 border-white/20 rounded-xl text-white text-base sm:text-xl placeholder-gray-500 focus:outline-none focus:border-accent-red transition-colors"
              />
            </div>

            {/* Action Selection - only show in step 1 */}
            {step === 'device' && (
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                  { value: 'check', label: t('scan.actions.check'), color: 'blue' },
                  { value: 'intake', label: t('scan.actions.intake'), color: 'green' },
                  { value: 'outtake', label: t('scan.actions.outtake'), color: 'red' },
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

            {/* Submit Button - always visible so camera/NFC results can be confirmed manually too */}
            <button
              type="submit"
              disabled={loading || !scanCode.trim()}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-accent-red to-red-700 text-white font-bold text-base sm:text-lg rounded-xl hover:shadow-lg hover:shadow-accent-red/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95"
            >
              {loading ? t('scan.scanning') : step === 'zone' ? t('scan.scanZone') : t('scan.scanDevice')}
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
                      <span className="text-gray-500">{t('scan.result.device')}</span> {result.device.product_name}
                    </p>
                    <p className="text-gray-300 truncate">
                      <span className="text-gray-500">{t('scan.result.id')}</span> {result.device.device_id}
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-500">{t('scan.result.status')}</span>{' '}
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

        {/* LED Activation Modal */}
        {showLEDModal && (
          <div className="fixed inset-0 z-[120] flex min-h-screen items-center justify-center bg-black/80 p-4">
            <div className="flex justify-center">
              <div className="glass-dark rounded-2xl p-6 sm:p-8 border-2 border-white/10 max-w-md w-full">
              <div className="text-center mb-6">
                <div className="inline-block p-4 rounded-xl bg-yellow-500/20 mb-4">
                  <Lightbulb className="w-12 h-12 text-yellow-300" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{t('scan.ledModal.title')}</h2>
                <p className="text-gray-400 text-sm sm:text-base">
                  {t('scan.ledModal.description')}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleLEDModalCancel}
                  className="flex-1 px-4 py-3 rounded-lg font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  {t('scan.ledModal.cancel')}
                </button>
                <button
                  onClick={handleLEDModalConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-lg font-semibold bg-gradient-to-r from-accent-red to-red-700 text-white hover:shadow-lg hover:shadow-accent-red/50 disabled:opacity-50 transition-all"
                >
                  {t('scan.ledModal.confirm')}
                </button>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
