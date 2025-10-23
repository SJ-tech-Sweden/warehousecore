import { useState, useEffect, useRef } from 'react';
import { labelsApi, devicesApi } from '../lib/api';
import type { LabelTemplate, LabelElement, Device } from '../lib/api';
import './LabelDesignerPage.css';

export default function LabelDesignerPage() {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadTemplates();
    loadDevices();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data } = await labelsApi.getTemplates();
      setTemplates(data);
      // Select default template
      const defaultTemplate = data.find((t) => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      } else if (data.length > 0) {
        setSelectedTemplate(data[0]);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadDevices = async () => {
    try {
      const { data } = await devicesApi.getAll();
      setDevices(data);
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  const renderLabelPreview = async (deviceId: string) => {
    if (!selectedTemplate || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size (convert mm to pixels @ 300 DPI)
    const dpi = 300;
    const mmToPx = dpi / 25.4;
    const width = selectedTemplate.width * mmToPx;
    const height = selectedTemplate.height * mmToPx;

    canvas.width = width;
    canvas.height = height;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    try {
      const { data } = await labelsApi.generateDeviceLabel(deviceId, selectedTemplate.id!);
      const elements = data.elements as Array<LabelElement & { image_data?: string }>;

      // Render each element
      for (const elem of elements) {
        const x = elem.x * mmToPx;
        const y = elem.y * mmToPx;
        const w = elem.width * mmToPx;
        const h = elem.height * mmToPx;

        if (elem.type === 'qrcode' || elem.type === 'barcode') {
          if (elem.image_data) {
            const img = new Image();
            await new Promise<void>((resolve) => {
              img.onload = () => {
                ctx.drawImage(img, x, y, w, h);
                resolve();
              };
              img.src = elem.image_data!;
            });
          }
        } else if (elem.type === 'text') {
          ctx.fillStyle = elem.style.color || '#000000';
          ctx.font = `${elem.style.font_weight || 'normal'} ${elem.style.font_size || 12}px ${elem.style.font_family || 'Arial'}`;
          ctx.textAlign = (elem.style.alignment as CanvasTextAlign) || 'left';
          ctx.fillText(elem.content, x, y + (elem.style.font_size || 12));
        }
      }
    } catch (error) {
      console.error('Failed to render label:', error);
    }
  };

  const handlePreview = (deviceId: string) => {
    setPreviewDevice(deviceId);
    renderLabelPreview(deviceId);
  };

  const handlePrint = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Label</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" onload="window.print(); window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleBulkExport = async () => {
    if (selectedDevices.length === 0) {
      alert('Please select at least one device');
      return;
    }

    setLoading(true);
    try {
      // Note: This is a simplified version - in production you'd want to use a proper PDF library
      // like jsPDF or pdfmake for professional results
      for (const deviceId of selectedDevices) {
        await renderLabelPreview(deviceId);
        // Add a small delay to allow rendering
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Download each label
        const canvas = canvasRef.current;
        if (canvas) {
          const link = document.createElement('a');
          link.download = `label-${deviceId}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        }
      }
      alert(`Exported ${selectedDevices.length} labels successfully!`);
    } catch (error) {
      console.error('Bulk export failed:', error);
      alert('Failed to export labels');
    } finally {
      setLoading(false);
    }
  };

  const toggleDeviceSelection = (deviceId: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId]
    );
  };

  const selectAll = () => {
    setSelectedDevices(devices.map((d) => d.device_id));
  };

  const deselectAll = () => {
    setSelectedDevices([]);
  };

  return (
    <div className="label-designer-page">
      <div className="label-designer-header">
        <h1>📋 Label Designer</h1>
        <p>Generate and print barcode labels for devices</p>
      </div>

      <div className="label-designer-container">
        {/* Template Selection */}
        <div className="label-section">
          <h2>1. Select Template</h2>
          <div className="template-selector">
            {templates.map((template) => (
              <button
                key={template.id}
                className={`template-card ${selectedTemplate?.id === template.id ? 'active' : ''}`}
                onClick={() => setSelectedTemplate(template)}
              >
                <div className="template-name">{template.name}</div>
                <div className="template-size">
                  {template.width} x {template.height} mm
                </div>
                {template.is_default && <span className="default-badge">Default</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Device Selection */}
        <div className="label-section">
          <h2>2. Select Devices</h2>
          <div className="device-selection-controls">
            <button onClick={selectAll} className="btn-secondary">
              Select All ({devices.length})
            </button>
            <button onClick={deselectAll} className="btn-secondary">
              Deselect All
            </button>
            <span className="selection-count">
              {selectedDevices.length} selected
            </span>
          </div>
          <div className="device-list">
            {devices.slice(0, 50).map((device) => (
              <div
                key={device.device_id}
                className={`device-item ${selectedDevices.includes(device.device_id) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedDevices.includes(device.device_id)}
                  onChange={() => toggleDeviceSelection(device.device_id)}
                />
                <span className="device-id">{device.device_id}</span>
                <span className="device-product">{device.product_name}</span>
                <button
                  onClick={() => handlePreview(device.device_id)}
                  className="btn-preview"
                >
                  Preview
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="label-section">
          <h2>3. Preview & Export</h2>
          <div className="preview-container">
            <canvas ref={canvasRef} className="label-canvas" />
            {previewDevice && (
              <div className="preview-info">
                Previewing: <strong>{previewDevice}</strong>
              </div>
            )}
          </div>
          <div className="export-controls">
            <button
              onClick={handlePrint}
              disabled={!previewDevice}
              className="btn-primary"
            >
              🖨️ Print Current Label
            </button>
            <button
              onClick={handleBulkExport}
              disabled={selectedDevices.length === 0 || loading}
              className="btn-primary"
            >
              {loading ? '⏳ Exporting...' : `📦 Export ${selectedDevices.length} Labels`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
