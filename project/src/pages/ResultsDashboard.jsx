import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Loader2, Download, FileText, AlertTriangle, CheckCircle, XCircle, Home } from 'lucide-react';
import * as XLSX from 'xlsx';

const ResultsDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [esgData, setEsgData] = useState(null);
  const [gapAnalysis, setGapAnalysis] = useState([]);
  const [completeGapAnalysis, setCompleteGapAnalysis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState(null);

  useEffect(() => {
    loadAnalysisResults();
  }, []);

  const loadAnalysisResults = async () => {
    try {
      setLoading(true);

      // Check if data came from navigation state
      let analysisData = location.state?.analysisData;

      // If not in state, try localStorage
      if (!analysisData) {
        const storedResults = localStorage.getItem('analysisResults');
        if (storedResults) {
          analysisData = JSON.parse(storedResults);
        }
      }

      if (!analysisData) {
        console.warn('No analysis results found');
        setLoading(false);
        return;
      }

      console.log('Processing analysis data:', analysisData);

      // Extract metadata
      const companyName = analysisData.summary?.company_name || 'Company';
      const reportYear = analysisData.summary?.report_year || '2024';
      const regulationId = analysisData.summary?.regulation_id || 'Regulation';

      setMetadata({
        companyName,
        reportYear,
        regulationId,
        categoriesAnalyzed: analysisData.summary?.categories_analyzed || 0
      });

      // Process detailed results
      const detailedResults = analysisData.detailed_results || {};

      // Transform data for ESG Buckets
      const formattedEsgData = [
        {
          category: 'E',
          title: 'Environmental',
          segments: extractTopDisclosures(detailedResults.environmental),
          color: 'text-emerald-700',
          bgColor: 'bg-emerald-50 border-emerald-300',
          stats: extractCategoryStats(detailedResults.environmental)
        },
        {
          category: 'S',
          title: 'Social',
          segments: extractTopDisclosures(detailedResults.social),
          color: 'text-blue-700',
          bgColor: 'bg-blue-50 border-blue-300',
          stats: extractCategoryStats(detailedResults.social)
        },
        {
          category: 'G',
          title: 'Governance',
          segments: extractTopDisclosures(detailedResults.governance),
          color: 'text-purple-700',
          bgColor: 'bg-purple-50 border-purple-300',
          stats: extractCategoryStats(detailedResults.governance)
        }
      ];

      setEsgData(formattedEsgData);

      // Transform data for Gap Analysis
      const allGaps = extractGapAnalysis(detailedResults);
      const displayGaps = allGaps.slice(0, 7); // Show only first 7

      setCompleteGapAnalysis(allGaps);
      setGapAnalysis(displayGaps);

    } catch (error) {
      console.error('Error loading analysis results:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractTopDisclosures = (categoryData) => {
    if (!categoryData || !categoryData.disclosure_to_regulation_matches) {
      return ['No disclosure data available'];
    }

    // Get top 4 disclosures with strong matches
    const strongMatches = categoryData.disclosure_to_regulation_matches
      .filter(match => match.is_strong_match)
      .slice(0, 4)
      .map(match => truncateText(match.disclosure_text, 80));

    // If less than 4, fill with any matches
    if (strongMatches.length < 4) {
      const allMatches = categoryData.disclosure_to_regulation_matches
        .slice(0, 4)
        .map(match => truncateText(match.disclosure_text, 80));
      return allMatches;
    }

    return strongMatches.length > 0 ? strongMatches : ['No strong matches found'];
  };

  const extractCategoryStats = (categoryData) => {
    if (!categoryData || !categoryData.gap_analysis) {
      return null;
    }

    const stats = categoryData.gap_analysis.coverage_statistics;
    return {
      total: stats.total_regulations,
      covered: stats.fully_covered,
      coverage: stats.coverage_percentage
    };
  };

  const extractGapAnalysis = (detailedResults) => {
    const categories = ['environmental', 'social', 'governance'];
    let allRows = [];

    categories.forEach(category => {
      const catData = detailedResults[category];
      if (!catData || !catData.gap_analysis) return;

      const metadata = catData.metadata || {};
      const regMatches = catData.regulation_to_disclosure_matches || [];

      // Map each regulation_id to its text + best disclosure
      const regMap = {};
      regMatches.forEach(r => {
        regMap[r.regulation_id] = {
          text: r.regulation_text,
          disclosureText: r.matched_disclosures?.[0]?.disclosure_text || 'No matching disclosure found',
          disclosureId: r.matched_disclosures?.[0]?.disclosure_id || 'N/A',
          score: r.best_match_score ? (r.best_match_score * 100).toFixed(1) : 'N/A'
        };
      });

      // Utility to build each Excel row
      const makeRow = (regObj, status) => {
        const regId = regObj.regulation_id || 'N/A';
        const match = regMap[regId] || {};

        return {
          category: metadata.category || category,
          status,
          regulationId: regId,
          frameworkText: match.text || regObj.regulation_text || 'N/A',
          disclosureId: match.disclosureId || 'N/A',
          disclosureText: match.disclosureText || 'No matching disclosure found',
          regulationName: metadata.regulation_id || 'BRSR',
          coverageScore: match.score || 'N/A'
        };
      };

      const gap = catData.gap_analysis;

      const missing = (gap.uncovered_regulations || []).map(r => makeRow(r, 'MISSING'));
      const partial = (gap.partially_covered_regulations || []).map(r => makeRow(r, 'PARTIAL'));
      const covered = (gap.covered_regulations || []).map(r => makeRow(r, 'COVERED'));

      allRows = [...allRows, ...missing, ...partial, ...covered];
    });

    return allRows;
  };




  const truncateText = (text, maxLength) => {
    if (!text) return 'No text available';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'partial':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'missing':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete':
        return 'bg-emerald-50 border-emerald-300';
      case 'partial':
        return 'bg-amber-50 border-amber-300';
      case 'missing':
        return 'bg-red-50 border-red-300';
      default:
        return 'bg-slate-50 border-slate-300';
    }
  };

  const downloadExcel = () => {
    if (completeGapAnalysis.length === 0) {
      alert('No gap analysis data available to download');
      return;
    }

    const excelData = completeGapAnalysis.map((item, index) => ({
      key: index,
      'S.No': index + 1,
      'Category': item.category,
      'Status': item.status?.toUpperCase() || 'N/A',
      'Regulation Clause ID': item.regulationId || 'N/A',
      'Framework Requirement Text': item.frameworkText || 'N/A',
      'Disclosure Clause ID': item.disclosureId || 'N/A',
      'Company Disclosure Text': item.disclosureText || 'N/A',
      'Regulation Name': item.regulationName || metadata?.regulationId || 'N/A',
      'Coverage Score (%)': item.coverageScore || 'N/A'
    }));


    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },   // S.No
      { wch: 15 },  // Category
      { wch: 12 },  // Status
      { wch: 20 },  // Regulation Clause ID
      { wch: 50 },  // Framework Requirement Text
      { wch: 20 },  // Disclosure Clause ID
      { wch: 50 },  // Company Disclosure Text
      { wch: 15 },  // Regulation Name
      { wch: 18 },  // Coverage Score
      { wch: 12 }   // Match Score
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gap Analysis');

    // Add summary sheet
    const summaryData = [
      { 'Metric': 'Company Name', 'Value': metadata?.companyName || 'N/A' },
      { 'Metric': 'Report Year', 'Value': metadata?.reportYear || 'N/A' },
      { 'Metric': 'Regulation', 'Value': metadata?.regulationId || 'N/A' },
      { 'Metric': 'Total Regulations Analyzed', 'Value': completeGapAnalysis.length },
      { 'Metric': 'Missing Coverage', 'Value': completeGapAnalysis.filter(g => g.status === 'missing').length },
      { 'Metric': 'Partial Coverage', 'Value': completeGapAnalysis.filter(g => g.status === 'partial').length },
      { 'Metric': 'Complete Coverage', 'Value': completeGapAnalysis.filter(g => g.status === 'complete').length }
    ];

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Generate filename
    const filename = `Gap_Analysis_${metadata?.companyName || 'Report'}_${metadata?.reportYear || new Date().getFullYear()}.xlsx`;

    // Download
    XLSX.writeFile(wb, filename);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center"
        >
          <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
          <p className="text-lg text-slate-600">Analyzing your report...</p>
        </motion.div>
      </div>
    );
  }

  if (!esgData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <AlertTriangle className="w-16 h-16 text-amber-600 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">No analysis data available.</p>
          <button
            onClick={() => navigate('/upload')}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Upload Report
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50 p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-7xl mx-auto"
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Analysis Results</h1>
          <p className="text-slate-600">ESG Classification and Gap Analysis</p>
          {metadata && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-4 inline-block px-6 py-2 bg-white rounded-full shadow-md"
            >
              <p className="text-sm text-slate-700">
                <strong>{metadata.companyName}</strong> ({metadata.reportYear}) vs <strong>{metadata.regulationId}</strong>
              </p>
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl p-8 mb-8"
        >
          <h2 className="text-2xl font-bold text-slate-800 mb-6">ESG Buckets</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {esgData.map((bucket, index) => (
              <motion.div
                key={bucket.category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className={`${bucket.bgColor} border-2 rounded-2xl p-6`}
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`w-12 h-12 rounded-full ${bucket.bgColor} border-2 ${bucket.color} flex items-center justify-center text-2xl font-bold`}>
                    {bucket.category}
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${bucket.color}`}>{bucket.title}</h3>
                    {bucket.stats && (
                      <p className="text-xs text-slate-600">
                        {bucket.stats.coverage}% coverage ({bucket.stats.covered}/{bucket.stats.total})
                      </p>
                    )}
                  </div>
                </div>
                <ul className="space-y-3">
                  {bucket.segments.map((segment, idx) => (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 + idx * 0.05 }}
                      className="flex items-start space-x-2"
                    >
                      <span className={`mt-1 w-2 h-2 rounded-full ${bucket.color.replace('text', 'bg')}`} />
                      <span className="text-sm text-slate-700">{segment}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-3xl shadow-2xl p-8 mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Gap Analysis</h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={downloadExcel}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-300 flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Full Report</span>
            </motion.button>
          </div>
          {gapAnalysis.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
              <p className="text-slate-600">No significant gaps identified</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {gapAnalysis.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className={`${getStatusColor(item.status)} border-2 rounded-xl p-6 hover:shadow-lg transition-shadow duration-300`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(item.status)}
                        <h3 className="font-bold text-slate-800">{item.frameworkText || item.frameworkTextShort}</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${item.status === 'complete' ? 'bg-emerald-100 text-emerald-700' :
                        item.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="space-y-3 pl-8">
                      {/* <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                          Framework Requirement:
                        </p>
                        <p className="text-sm text-slate-700 bg-white/50 p-2 rounded">
                          {item.frameworkText || item.frameworkTextShort}
                        </p>
                      </div> */}
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                          Company Disclosure:
                        </p>
                        <p className="text-sm text-slate-700 bg-white/50 p-2 rounded">
                          {item.disclosureText || item.disclosureTextShort}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                        <span>Regulation: <strong>{item.regulationName}</strong></span>
                        {item.score !== undefined && (
                          <span>Match score: <strong>{(item.score * 100).toFixed(1)}%</strong></span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                        <span>Clause ID: <strong>{item.regulationId}</strong></span>
                        <span>Disclosure ID: <strong>{item.disclosureId}</strong></span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              {completeGapAnalysis.length > 7 && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-slate-600">
                    Showing 7 of {completeGapAnalysis.length} regulations. Download the full report for complete analysis.
                  </p>
                </div>
              )}
            </>
          )}
        </motion.div>

        <div className="flex items-center justify-between">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/report')}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
          >
            <FileText className="w-5 h-5" />
            <span>View Summary Report</span>
          </motion.button>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-white text-slate-700 font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2 border-2 border-slate-200"
          >
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default ResultsDashboard;