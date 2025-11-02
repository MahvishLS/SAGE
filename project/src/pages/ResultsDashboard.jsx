import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Loader2, Download, FileText, AlertTriangle, CheckCircle, XCircle, Home } from 'lucide-react';

const ResultsDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [esgData, setEsgData] = useState(null);
  const [gapAnalysis, setGapAnalysis] = useState([]);
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
      const formattedGapAnalysis = extractGapAnalysis(detailedResults);
      setGapAnalysis(formattedGapAnalysis);

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
    const gaps = [];
    let gapId = 1;

    // Process each category
    ['environmental', 'social', 'governance'].forEach(category => {
      const categoryData = detailedResults[category];
      if (!categoryData || !categoryData.gap_analysis) return;

      const gapData = categoryData.gap_analysis;

      // Add uncovered regulations
      gapData.uncovered_regulations?.slice(0, 3).forEach(reg => {
        gaps.push({
          id: (gapId++).toString(),
          gap: truncateText(reg.regulation_text, 60),
          expectation: `${categoryData.metadata.regulation_id} requirement - Coverage score: ${reg.best_match_score}`,
          status: 'missing',
          category: category,
          score: reg.best_match_score
        });
      });

      // Add partially covered regulations
      gapData.partially_covered_regulations?.slice(0, 2).forEach(reg => {
        gaps.push({
          id: (gapId++).toString(),
          gap: truncateText(reg.regulation_text, 60),
          expectation: `${categoryData.metadata.regulation_id} requirement - Coverage score: ${reg.best_match_score}`,
          status: 'partial',
          category: category,
          score: reg.best_match_score
        });
      });

      // Add some covered regulations for balance
      gapData.covered_regulations?.slice(0, 1).forEach(reg => {
        gaps.push({
          id: (gapId++).toString(),
          gap: truncateText(reg.regulation_text, 60),
          expectation: `${categoryData.metadata.regulation_id} requirement - Coverage score: ${reg.best_match_score}`,
          status: 'complete',
          category: category,
          score: reg.best_match_score
        });
      });
    });

    // Sort by status priority and limit to top 10
    const statusPriority = { missing: 1, partial: 2, complete: 3 };
    return gaps
      .sort((a, b) => statusPriority[a.status] - statusPriority[b.status])
      .slice(0, 10);
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
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Gap Analysis</h2>
          {gapAnalysis.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
              <p className="text-slate-600">No significant gaps identified</p>
            </div>
          ) : (
            <div className="space-y-4">
              {gapAnalysis.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className={`${getStatusColor(item.status)} border-2 rounded-xl p-6 hover:shadow-lg transition-shadow duration-300`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(item.status)}
                      <h3 className="font-bold text-slate-800">{item.gap}</h3>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      item.status === 'complete' ? 'bg-emerald-100 text-emerald-700' :
                      item.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="pl-8">
                    <p className="text-sm text-slate-600 mb-2">
                      <span className="font-semibold">Regulatory Expectation:</span>
                    </p>
                    <p className="text-sm text-slate-700">{item.expectation}</p>
                    {item.score !== undefined && (
                      <p className="text-xs text-slate-500 mt-2">
                        Match score: {(item.score * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
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