import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, BookOpen, ArrowRight, X, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const RegulatoryFrameworks = () => {
  const navigate = useNavigate();
  const [frameworks, setFrameworks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingFramework, setEditingFramework] = useState(null);
  const [formData, setFormData] = useState({ name: '', regulationId: '' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  // Check system status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setStatusLoading(true);
      const response = await fetch("http://127.0.0.1:8000/status");
      const data = await response.json();
      setSystemStatus(data);
      console.log("System status:", data);
    } catch (error) {
      console.error("Failed to fetch status:", error);
      setSystemStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingFramework(null);
    setFormData({ name: '', regulationId: '' });
    setFile(null);
    setUploadError(null);
    setShowModal(true);
  };

  const handleEdit = (framework) => {
    setEditingFramework(framework);
    setFormData({
      name: framework.name,
      regulationId: framework.regulationId
    });
    setShowModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this framework?")) {
      setFrameworks(prev => prev.filter(f => f.id !== id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setUploadError("Please upload a PDF file.");
      return;
    }

    if (!formData.name.trim()) {
      setUploadError("Please enter a framework name.");
      return;
    }

    // Validate PDF
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError("Only PDF files are accepted.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formDataToSend = new FormData();
    formDataToSend.append("file", file);
    formDataToSend.append("regulation_id", formData.regulationId.trim() || formData.name.trim());

    try {
      const response = await fetch("http://127.0.0.1:8000/upload/framework", {
        method: "POST",
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Upload failed");
      }

      console.log("Framework uploaded successfully:", data);

      // Create framework entry with upload data
      const newFramework = {
        id: Date.now().toString(),
        name: formData.name,
        regulationId: data.regulation_id,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        categories: data.categories_processed || [],
        processingTime: data.processing_time,
        status: data.status,
        summary: data.summary
      };

      setFrameworks((prev) => [...prev, newFramework]);
      
      // Update system status
      await checkStatus();

      // Close modal
      setShowModal(false);
      setFile(null);
      setFormData({ name: '', regulationId: '' });

      // Show success message
      const categoriesText = data.categories_processed?.join(", ") || "Unknown";
      alert(`✓ Framework processed successfully!\n\nRegulation ID: ${data.regulation_id}\nCategories: ${categoriesText}\nProcessing time: ${data.processing_time}s\n\n${data.next_step || data.message}`);

    } catch (error) {
      console.error("Error uploading framework:", error);
      setUploadError(error.message || "Failed to upload framework. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    // Check if ready for matching
    if (!systemStatus?.ready_for_matching) {
      if (!systemStatus?.disclosure?.uploaded) {
        alert("⚠️ Disclosure report not uploaded.\n\nPlease go back and upload your company's disclosure report first.");
        return;
      }
      if (!systemStatus?.framework?.uploaded) {
        alert("⚠️ No framework uploaded.\n\nPlease upload at least one regulatory framework.");
        return;
      }
      return;
    }

    if (frameworks.length === 0) {
      alert("Please upload at least one framework before analyzing.");
      return;
    }

    setAnalyzing(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/match", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Analysis failed");
      }

      console.log("Analysis complete:", data);

      // Store results for display on results page
      localStorage.setItem('analysisResults', JSON.stringify({
        ...data,
        timestamp: new Date().toISOString()
      }));

      // Navigate to loading/results page
      navigate('/loading', { 
        state: { 
          analysisData: data,
          fromMatching: true 
        } 
      });

    } catch (error) {
      console.error("Analysis error:", error);
      alert(`❌ Analysis failed: ${error.message}\n\nPlease check:\n- Both disclosure and framework are uploaded\n- Backend server is running\n- Check console for detailed errors`);
    } finally {
      setAnalyzing(false);
    }
  };

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase()) {
      case 'environmental':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'social':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'governance':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50 p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto"
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Regulatory Frameworks</h1>
          <p className="text-slate-600">Select and manage frameworks for compliance analysis</p>
          
          {/* System Status Indicator */}
          {statusLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 inline-flex items-center space-x-2 px-6 py-3 bg-white rounded-full shadow-md"
            >
              <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
              <span className="text-sm text-slate-600">Loading status...</span>
            </motion.div>
          ) : systemStatus && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 inline-flex items-center space-x-4 px-6 py-3 bg-white rounded-full shadow-md"
            >
              <div className="flex items-center space-x-2">
                {systemStatus.disclosure?.uploaded ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                )}
                <span className="text-sm font-medium text-slate-700">
                  Disclosure: {systemStatus.disclosure?.uploaded ? '✓ Ready' : '✗ Not uploaded'}
                </span>
              </div>
              <div className="h-4 w-px bg-slate-300" />
              <div className="flex items-center space-x-2">
                {systemStatus.framework?.uploaded ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                )}
                <span className="text-sm font-medium text-slate-700">
                  Framework: {systemStatus.framework?.uploaded ? '✓ Ready' : '✗ Not uploaded'}
                </span>
              </div>
            </motion.div>
          )}

          {/* Company Info if Available */}
          {systemStatus?.disclosure?.metadata && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-sm text-slate-600"
            >
              Analyzing: <strong>{systemStatus.disclosure.metadata.company_name}</strong> ({systemStatus.disclosure.metadata.report_year})
            </motion.p>
          )}
        </motion.div>

        <motion.button
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAddNew}
          className="mb-6 px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Framework</span>
        </motion.button>

        {/* Frameworks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <AnimatePresence>
            {frameworks.map((framework, index) => (
              <motion.div
                key={framework.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <BookOpen className="w-6 h-6 text-emerald-600" />
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{framework.name}</h3>
                      <p className="text-sm text-slate-500">{framework.regulationId}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDelete(framework.id)}
                      className="p-2 hover:bg-red-100 rounded-full transition-colors duration-200"
                      title="Delete framework"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Categories */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {framework.categories?.map(cat => (
                    <span key={cat} className={`px-3 py-1 rounded-full text-sm font-medium border ${getCategoryColor(cat)}`}>
                      {cat}
                    </span>
                  ))}
                </div>

                {/* Details */}
                <div className="text-sm text-slate-600 space-y-1">
                  <p className="flex items-center space-x-2">
                    <span className="text-slate-500">File:</span>
                    <span className="font-medium">{framework.fileName}</span>
                  </p>
                  {framework.processingTime && (
                    <p className="flex items-center space-x-2">
                      <span className="text-slate-500">Processing:</span>
                      <span className="font-medium">{framework.processingTime}s</span>
                    </p>
                  )}
                  {framework.summary && (
                    <p className="flex items-center space-x-2">
                      <span className="text-slate-500">Clauses:</span>
                      <span className="font-medium">{framework.summary.total_clauses}</span>
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {frameworks.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 bg-white rounded-2xl shadow-lg mb-8"
          >
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium mb-2">No frameworks uploaded yet</p>
            <p className="text-sm text-slate-500">Click "Add New Framework" to upload a regulatory framework</p>
          </motion.div>
        )}

        {/* Analyze Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: systemStatus?.ready_for_matching ? 1.02 : 1 }}
          whileTap={{ scale: systemStatus?.ready_for_matching ? 0.98 : 1 }}
          onClick={handleAnalyze}
          disabled={!systemStatus?.ready_for_matching || analyzing}
          className={`w-full py-4 text-lg font-semibold rounded-full shadow-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
            systemStatus?.ready_for_matching && !analyzing
              ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:shadow-xl cursor-pointer'
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          {analyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analyzing ESG Compliance...</span>
            </>
          ) : (
            <>
              <span>Analyze ESG Compliance</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </motion.button>

        {/* Help Text */}
        {!systemStatus?.ready_for_matching && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm text-slate-500 mt-3"
          >
            {!systemStatus?.disclosure?.uploaded 
              ? "⚠️ Please upload disclosure report first" 
              : "⚠️ Please upload at least one framework to continue"}
          </motion.p>
        )}

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => navigate('/upload')}
          className="mt-6 text-slate-600 hover:text-slate-800 transition-colors duration-200 mx-auto block"
        >
          ← Back to Upload
        </motion.button>
      </motion.div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50"
            onClick={() => !uploading && setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">
                  Add New Framework
                </h2>
                <button
                  onClick={() => !uploading && setShowModal(false)}
                  disabled={uploading}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors duration-200 disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {uploadError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{uploadError}</p>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Framework Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., BRSR, GRI Standards, TCFD"
                    disabled={uploading}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:outline-none transition-colors duration-200 disabled:bg-slate-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Regulation ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.regulationId}
                    onChange={(e) => setFormData({ ...formData, regulationId: e.target.value })}
                    placeholder="Leave empty to use framework name"
                    disabled={uploading}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:outline-none transition-colors duration-200 disabled:bg-slate-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Used for identification in reports
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Upload Framework PDF *
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      setFile(e.target.files[0]);
                      setUploadError(null);
                    }}
                    disabled={uploading}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-500 focus:outline-none transition-colors duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 disabled:opacity-50"
                    required
                  />
                  {file && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-2 flex items-center space-x-2 text-sm text-emerald-600"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </motion.div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className={`w-full py-3 font-semibold rounded-full shadow-lg transition-all duration-300 flex items-center justify-center space-x-2 ${
                    uploading
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white hover:shadow-xl'
                  }`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Uploading & Processing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>Upload Framework</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RegulatoryFrameworks;