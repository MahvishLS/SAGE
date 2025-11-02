import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WelcomeDashboard from './pages/WelcomeDashboard';
import UploadReports from './pages/UploadReports';
import RegulatoryFrameworks from './pages/RegulatoryFrameworks';
import Loading from './pages/Loading';
import ResultsDashboard from './pages/ResultsDashboard';
import Report from './pages/Report';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomeDashboard />} />
        <Route path="/upload" element={<UploadReports />} />
        <Route path="/frameworks" element={<RegulatoryFrameworks />} />
        <Route path="/loading" element={<Loading />} />
        <Route path="/results" element={<ResultsDashboard />} />
        <Route path='/report' element={<Report />} />
      </Routes>
    </Router>
  );
}

export default App;
