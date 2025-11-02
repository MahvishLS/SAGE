import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Download, FileText, AlertTriangle, CheckCircle, XCircle, Home } from 'lucide-react';

const Report = () => {
    const navigate = useNavigate();

    const handleExportPDF = () => {
        alert('PDF export functionality would be implemented here');
    };

    const handleExportJSON = () => {
        const data = { esgData, gapAnalysis, complianceScore: 72 };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sage-analysis-results.json';
        a.click();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50 p-6">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="bg-gradient-to-br from-emerald-600 to-cyan-600 rounded-3xl shadow-2xl p-8 text-white mb-8"
            >
                <h2 className="text-2xl font-bold mb-6">Summary Report</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold mb-2">Overall Compliance Score</h3>
                            <div className="flex items-end space-x-2">
                                <span className="text-6xl font-bold">72%</span>
                                <span className="text-xl mb-2">compliant</span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-3">Key Missing Areas</h3>
                            <ul className="space-y-2">
                                <li className="flex items-start space-x-2">
                                    <span className="mt-1">•</span>
                                    <span>Scope 3 emissions data</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <span className="mt-1">•</span>
                                    <span>Climate scenario analysis</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                    <span className="mt-1">•</span>
                                    <span>Biodiversity assessments</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-3">Suggested Actions</h3>
                        <ol className="space-y-3">
                            <li className="flex items-start space-x-2">
                                <span className="font-bold">1.</span>
                                <span>Implement comprehensive value chain emissions tracking system</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="font-bold">2.</span>
                                <span>Conduct TCFD-aligned climate risk scenario analysis</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="font-bold">3.</span>
                                <span>Enhance supply chain sustainability documentation</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="font-bold">4.</span>
                                <span>Develop biodiversity impact assessment framework</span>
                            </li>
                        </ol>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="flex flex-wrap gap-4 justify-center"
            >
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleExportPDF}
                    className="px-6 py-3 bg-white text-slate-800 font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
                >
                    <FileText className="w-5 h-5" />
                    <span>Download as PDF</span>
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleExportJSON}
                    className="px-6 py-3 bg-white text-slate-800 font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
                >
                    <Download className="w-5 h-5" />
                    <span>Download JSON</span>
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
                >
                    <Home className="w-5 h-5" />
                    <span>Back to Home</span>
                </motion.button>
            </motion.div>
        </div>
    );
}

export default Report;