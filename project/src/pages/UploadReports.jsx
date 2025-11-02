import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, X, ArrowRight } from 'lucide-react';

const UploadReports = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState(/** @type {File[]} */ ([]));
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf' || file.type === 'text/plain'
    );
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileInput = (e) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // const handleNext = async () => {
  //   if (files.length === 0) return;

  //   const formData = new FormData();
  //   files.forEach(file => formData.append("file", file));

  //   try {
  //     setUploadProgress(10);

  //     const response = await fetch("http://127.0.0.1:8000/upload", {
  //       method: "POST",
  //       body: formData,
  //     });

  //     if (!response.ok) throw new Error("Upload failed");
  //     setUploadProgress(100);

      
  //     setTimeout(() => navigate("/frameworks"), 500);

  //     console.log(response);
  //   } catch (error) {
  //     console.error(error);
  //     alert("Upload failed, check backend logs.");
  //   }
  // };

  const handleNext = async () => {
    if (files.length === 0) {
      setError("Please select a file to upload");
      return;
    }

    // if (!companyName.trim()) {
    //   setError("Please enter the company name");
    //   return;
    // }

    // Only take the first file (backend expects single file)
    const file = files[0];
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("company_name", "tetrapak");
    formData.append("report_year", "2024");

    try {
      setUploadProgress(10);
      setUploading(true);
      setError(null);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 5000);

      const response = await fetch("http://127.0.0.1:8000/upload/disclosure", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || "Upload failed");
      }

      setUploadProgress(100);

      console.log("Disclosure uploaded successfully:", {
        company: data.company_name,
        year: data.report_year,
        categories: data.categories_processed,
        time: data.processing_time,
        summary: data.summary
      });

      // Store metadata in localStorage for later use
      localStorage.setItem('disclosureMetadata', JSON.stringify({
        companyName: data.company_name,
        reportYear: data.report_year,
        categories: data.categories_processed,
        uploadedAt: new Date().toISOString(),
        summary: data.summary
      }));

      setSuccess(true);

      // Navigate to frameworks page
      setTimeout(() => {
        navigate("/frameworks");
      }, 1500);

    } catch (error) {
      console.error("Upload error:", error);
      setError(error.message || "Upload failed. Please try again.");
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl w-full"
      >
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Upload Compliance Reports</h1>
          <p className="text-slate-600">Upload PDF or text files for analysis</p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl shadow-2xl p-8"
        >
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            className={`border-3 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50'
            }`}
          >
            <motion.div
              animate={{ y: isDragging ? -10 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <Upload className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                Drag & Drop Files Here
              </h3>
              <p className="text-slate-600 mb-4">or</p>
              <label className="inline-block px-6 py-3 bg-emerald-600 text-white font-semibold rounded-full cursor-pointer hover:bg-emerald-700 transition-colors duration-300">
                Browse Files
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-slate-500 mt-4">Supports PDF and TXT files</p>
            </motion.div>
          </div>

          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6"
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-3">
                Uploaded Files ({files.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((file, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between bg-slate-50 p-4 rounded-xl hover:bg-slate-100 transition-colors duration-200"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="font-medium text-slate-800">{file.name}</p>
                        <p className="text-sm text-slate-500">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-2 hover:bg-red-100 rounded-full transition-colors duration-200"
                    >
                      <X className="w-5 h-5 text-red-500" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {uploadProgress > 0 && uploadProgress < 100 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6"
            >
              <div className="bg-slate-200 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                />
              </div>
              <p className="text-center text-slate-600 mt-2">{uploadProgress}%</p>
            </motion.div>
          )}

          <motion.button
            whileHover={{ scale: files.length > 0 ? 1.02 : 1 }}
            whileTap={{ scale: files.length > 0 ? 0.98 : 1 }}
            onClick={handleNext}
            disabled={files.length === 0}
            className={`w-full mt-8 py-4 rounded-full font-semibold text-lg flex items-center justify-center space-x-2 transition-all duration-300 ${
              files.length > 0
                ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg hover:shadow-xl'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>Next</span>
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => navigate('/')}
          className="mt-6 text-slate-600 hover:text-slate-800 transition-colors duration-200 mx-auto block"
        >
          Back to Home
        </motion.button>
      </motion.div>
    </div>
  );
};

export default UploadReports;
