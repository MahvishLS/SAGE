import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Download, FileText, AlertTriangle, CheckCircle, XCircle, Home, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

const Report = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState(null);
    const [error, setError] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [expandedCategory, setExpandedCategory] = useState(null);

    useEffect(() => {
        loadOrGenerateReport();
    }, []);

    const loadOrGenerateReport = async () => {
        try {
            setLoading(true);
            setError(null);

            // Try to load from localStorage first
            const storedReport = localStorage.getItem('complianceReport');
            if (storedReport) {
                const parsed = JSON.parse(storedReport);
                // Check if report is recent (within 1 hour)
                const reportAge = Date.now() - new Date(parsed.timestamp).getTime();
                if (reportAge < 3600000) { // 1 hour
                    setReportData(parsed);
                    setLoading(false);
                    return;
                }
            }

            // Generate new report
            await generateReport();

        } catch (error) {
            console.error('Error loading report:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const generateReport = async () => {
        try {
            setGenerating(true);
            console.log('Generating AI compliance report...');

            const response = await fetch('http://127.0.0.1:8000/generate-report', {
                method: 'POST'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Failed to generate report');
            }

            console.log('Report generated:', data);

            // Store in localStorage
            const reportWithTimestamp = {
                ...data,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('complianceReport', JSON.stringify(reportWithTimestamp));

            setReportData(reportWithTimestamp);

        } catch (error) {
            console.error('Report generation error:', error);
            throw error;
        } finally {
            setGenerating(false);
        }
    };

    const handleExportJSON = () => {
        if (!reportData) return;

        const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `esg-compliance-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = () => {
        if (!reportData || !reportData.reports) return;

        // Create HTML content for PDF
        let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>ESG Compliance Report</title>
                <style>
                    body { 
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 900px;
                        margin: 0 auto;
                        padding: 40px;
                    }
                    h1 { color: #059669; border-bottom: 3px solid #059669; padding-bottom: 10px; }
                    h2 { color: #0891b2; margin-top: 30px; }
                    h3 { color: #475569; margin-top: 20px; }
                    .header { text-align: center; margin-bottom: 40px; }
                    .score { 
                        font-size: 48px; 
                        font-weight: bold; 
                        color: #059669;
                        text-align: center;
                        margin: 20px 0;
                    }
                    .metadata { 
                        background: #f1f5f9; 
                        padding: 15px; 
                        border-radius: 8px; 
                        margin: 20px 0;
                    }
                    .category-section {
                        margin: 30px 0;
                        padding: 20px;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        page-break-inside: avoid;
                    }
                    .missing-area {
                        background: #fef2f2;
                        padding: 10px;
                        margin: 5px 0;
                        border-left: 4px solid #ef4444;
                    }
                    .action-item {
                        background: #f0fdf4;
                        padding: 10px;
                        margin: 5px 0;
                        border-left: 4px solid #059669;
                    }
                    ul, ol { margin: 10px 0; padding-left: 25px; }
                    .page-break { page-break-after: always; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🌱 ESG Compliance Report</h1>
                    <p><strong>Generated:</strong> ${new Date(reportData.timestamp).toLocaleString()}</p>
                    <div class="score">${reportData.overall_compliance_score.toFixed(1)}% Compliant</div>
                </div>

                <div class="metadata">
                    <h3>Report Summary</h3>
                    <p><strong>Categories Analyzed:</strong> ${reportData.summary.total_categories}</p>
                    <p><strong>Reports Generated:</strong> ${reportData.summary.reports_generated}</p>
                </div>
        `;

        // Add key missing areas
        if (reportData.key_missing_areas && reportData.key_missing_areas.length > 0) {
            htmlContent += `
                <h2>Key Missing Areas</h2>
                ${reportData.key_missing_areas.map(area => 
                    `<div class="missing-area">⚠️ ${area}</div>`
                ).join('')}
            `;
        }

        // Add suggested actions
        if (reportData.suggested_actions && reportData.suggested_actions.length > 0) {
            htmlContent += `
                <h2>Priority Actions</h2>
                <ol>
                    ${reportData.suggested_actions.map((action, idx) => 
                        `<li class="action-item">${action}</li>`
                    ).join('')}
                </ol>
                <div class="page-break"></div>
            `;
        }

        // Add each category report
        Object.entries(reportData.reports).forEach(([category, data]) => {
            htmlContent += `
                <div class="category-section">
                    <h2>${data.category} Compliance Report</h2>
                    <p><strong>Coverage:</strong> ${data.coverage_percentage.toFixed(1)}%</p>
                    ${convertMarkdownToHTML(data.report_markdown)}
                </div>
                <div class="page-break"></div>
            `;
        });

        htmlContent += `
            </body>
            </html>
        `;

        // Create blob and download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `esg-compliance-report-${new Date().toISOString().split('T')[0]}.html`;
        a.click();
        URL.revokeObjectURL(url);

        alert('Report downloaded!');
    };

    const convertMarkdownToHTML = (markdown) => {
        if (!markdown) return '';
        
        return markdown
            // Headers
            .replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/# (.*)/g, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Lists
            .replace(/^\* (.*)/gm, '<li>$1</li>')
            .replace(/^- (.*)/gm, '<li>$1</li>')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
    };

    const handleRegenerateReport = async () => {
        localStorage.removeItem('complianceReport');
        await loadOrGenerateReport();
    };

    const toggleCategory = (category) => {
        setExpandedCategory(expandedCategory === category ? null : category);
    };

    const renderMarkdown = (markdown) => {
        if (!markdown) return null;

        const sections = markdown.split(/(?=###)/);
        
        return sections.map((section, idx) => {
            if (!section.trim()) return null;

            const lines = section.split('\n');
            const isHeader = lines[0].startsWith('###');
            const header = isHeader ? lines[0].replace(/^###\s*/, '') : '';
            const content = isHeader ? lines.slice(1).join('\n') : section;

            return (
                <div key={idx} className="mb-6">
                    {header && (
                        <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center">
                            <span className="w-2 h-6 bg-emerald-600 mr-3 rounded"></span>
                            {header}
                        </h3>
                    )}
                    <div className="prose prose-slate max-w-none">
                        {content.split('\n').map((line, lineIdx) => {
                            if (!line.trim()) return <br key={lineIdx} />;
                            
                            // Bold text
                            if (line.includes('**')) {
                                const parts = line.split(/\*\*(.*?)\*\*/g);
                                return (
                                    <p key={lineIdx} className="mb-2">
                                        {parts.map((part, i) => 
                                            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                                        )}
                                    </p>
                                );
                            }
                            
                            // Bullet points
                            if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
                                return (
                                    <li key={lineIdx} className="ml-6 mb-1 text-slate-700">
                                        {line.replace(/^[\*\-]\s*/, '')}
                                    </li>
                                );
                            }
                            
                            return <p key={lineIdx} className="mb-2 text-slate-700">{line}</p>;
                        })}
                    </div>
                </div>
            );
        });
    };

    if (loading || generating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center"
                >
                    <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
                    <p className="text-lg text-slate-600">
                        {generating ? 'Generating AI-powered compliance report...' : 'Loading report...'}
                    </p>
                    <p className="text-sm text-slate-500 mt-2">This may take 30-60 seconds</p>
                </motion.div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50 p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center max-w-md"
                >
                    <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Report Generation Failed</h2>
                    <p className="text-slate-600 mb-4">{error}</p>
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={handleRegenerateReport}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => navigate('/loading')}
                            className="px-6 py-3 bg-slate-200 text-slate-800 rounded-full hover:bg-slate-300"
                        >
                            Back to Results
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50">
                <p className="text-slate-600">No report data available</p>
            </div>
        );
    }

    const complianceScore = reportData.overall_compliance_score || 0;
    const keyMissingAreas = reportData.key_missing_areas || [];
    const suggestedActions = reportData.suggested_actions || [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50 p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-7xl mx-auto"
            >
                {/* Header */}
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-center mb-8"
                >
                    <div className="flex items-center justify-center space-x-2 mb-2">
                        <Sparkles className="w-6 h-6 text-emerald-600" />
                        <h1 className="text-4xl font-bold text-slate-800">ESG Compliance Report</h1>
                        <Sparkles className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="text-slate-600">AI-Powered Analysis by Groq</p>
                    {reportData.timestamp && (
                        <p className="text-sm text-slate-500 mt-2">
                            Generated: {new Date(reportData.timestamp).toLocaleString()}
                        </p>
                    )}
                </motion.div>

                {/* Summary Card */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-gradient-to-br from-emerald-600 to-cyan-600 rounded-3xl shadow-2xl p-8 text-white mb-8"
                >
                    <h2 className="text-2xl font-bold mb-6">Executive Summary</h2>
                    {/* Left Column */}
<div>
    <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Overall Compliance Score</h3>
        <div className="flex items-end space-x-2">
            <span className="text-6xl font-bold">{complianceScore.toFixed(1)}%</span>
            <span className="text-xl mb-2">compliant</span>
        </div>
        <div className="mt-4 bg-white/20 rounded-full h-3">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${complianceScore}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="bg-white h-3 rounded-full shadow-lg"
            />
        </div>
    </div>

    {keyMissingAreas.length > 0 && (
        <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Key Gaps
            </h3>
            <div className="space-y-2">
                {keyMissingAreas.slice(0, 5).map((area, idx) => {
                    // Truncate if too long
                    const displayText = area.length > 120 
                        ? area.substring(0, 120) + '...' 
                        : area;
                    
                    return (
                        <div 
                            key={idx} 
                            className="flex items-start space-x-2 bg-white/10 p-2 rounded-lg"
                        >
                            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span className="text-sm leading-snug">{displayText}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    )}
</div>

{/* Right Column */}
<div>
    {suggestedActions.length > 0 && (
        <>
            <h3 className="text-lg font-semibold mb-3 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Priority Actions
            </h3>
            <div className="space-y-2">
                {suggestedActions.slice(0, 6).map((action, idx) => {
                    // Truncate if too long
                    const displayText = action.length > 150 
                        ? action.substring(0, 150) + '...' 
                        : action;
                    
                    return (
                        <div 
                            key={idx} 
                            className="flex items-start space-x-2 bg-white/10 p-2 rounded-lg"
                        >
                            <span className="font-bold text-emerald-200 flex-shrink-0">
                                {idx + 1}.
                            </span>
                            <span className="text-sm leading-snug">{displayText}</span>
                        </div>
                    );
                })}
            </div>
        </>
    )}
</div>
                </motion.div>

                {/* Category Cards */}
                {reportData.reports && Object.keys(reportData.reports).length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-6 mb-8"
                    >
                        {Object.entries(reportData.reports).map(([category, data], idx) => {
                            const categoryColors = {
                                environmental: { gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-50', text: 'text-emerald-700' },
                                social: { gradient: 'from-blue-500 to-cyan-600', bg: 'bg-blue-50', text: 'text-blue-700' },
                                governance: { gradient: 'from-purple-500 to-pink-600', bg: 'bg-purple-50', text: 'text-purple-700' }
                            };

                            const colors = categoryColors[category];
                            const isExpanded = expandedCategory === category;

                            return (
                                <motion.div
                                    key={category}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 + idx * 0.1 }}
                                    className="bg-white rounded-2xl shadow-xl overflow-hidden"
                                >
                                    {/* Category Header */}
                                    <div 
                                        className={`bg-gradient-to-r ${colors.gradient} p-6 cursor-pointer`}
                                        onClick={() => toggleCategory(category)}
                                    >
                                        <div className="flex items-center justify-between text-white">
                                            <div className="flex-1">
                                                <h3 className="text-2xl font-bold mb-2 capitalize">{data.category}</h3>
                                                <div className="flex items-center space-x-4">
                                                    <span className="text-sm">Coverage: {data.coverage_percentage.toFixed(1)}%</span>
                                                    <span className="text-sm">•</span>
                                                    <span className="text-sm">{(data.report_length / 1000).toFixed(1)}k characters</span>
                                                </div>
                                            </div>
                                            <button className="p-2 hover:bg-white/20 rounded-full transition">
                                                {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                            </button>
                                        </div>
                                        
                                        {/* Progress Bar */}
                                        <div className="mt-4 bg-white/30 rounded-full h-2">
                                            <div
                                                className="bg-white h-2 rounded-full transition-all duration-500"
                                                style={{ width: `${data.coverage_percentage}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Expandable Content */}
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="p-6 max-h-96 overflow-y-auto"
                                        >
                                            {renderMarkdown(data.report_markdown)}
                                        </motion.div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}

                {/* Action Buttons */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-wrap gap-4 justify-center"
                >
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleExportPDF}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
                    >
                        <FileText className="w-5 h-5" />
                        <span>Download Report (HTML → PDF)</span>
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleExportJSON}
                        className="px-6 py-3 bg-white text-slate-800 font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2 border-2 border-slate-200"
                    >
                        <Download className="w-5 h-5" />
                        <span>Download JSON</span>
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleRegenerateReport}
                        className="px-6 py-3 bg-emerald-100 text-emerald-700 font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2 border-2 border-emerald-300"
                    >
                        <Sparkles className="w-5 h-5" />
                        <span>Regenerate</span>
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/loading')}
                        className="px-6 py-3 bg-slate-700 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2"
                    >
                        <Home className="w-5 h-5" />
                        <span>Back to Results</span>
                    </motion.button>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default Report;