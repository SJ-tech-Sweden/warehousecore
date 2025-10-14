import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ScanPage } from './pages/ScanPage';
import { DevicesPage } from './pages/DevicesPage';
import { ZonesPage } from './pages/ZonesPage';
import { ZoneDetailPage } from './pages/ZoneDetailPage';
import { MaintenancePage } from './pages/MaintenancePage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/scan" element={<Layout><ScanPage /></Layout>} />
        <Route path="/devices" element={<Layout><DevicesPage /></Layout>} />
        <Route path="/zones" element={<Layout><ZonesPage /></Layout>} />
        <Route path="/zones/:id" element={<Layout><ZoneDetailPage /></Layout>} />
        <Route path="/maintenance" element={<Layout><MaintenancePage /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
