import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Leaf, Globe, TreeDeciduous } from 'lucide-react';

const WelcomeDashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-blue-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
            className="flex justify-center mb-8 space-x-4"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
            >
              <Leaf className="w-16 h-16 text-emerald-600" />
            </motion.div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Globe className="w-16 h-16 text-cyan-600" />
            </motion.div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5 }}
            >
              <TreeDeciduous className="w-16 h-16 text-emerald-700" />
            </motion.div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-6xl font-bold mb-4 bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent"
          >
            SAGE
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="text-2xl text-slate-700 mb-3"
          >
            Sustainability Assurance and Governance Engine
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="text-lg text-slate-600 mb-12 max-w-2xl mx-auto"
          >
            Leverage advanced AI to match sustainability regulations with compliance reports,
            perform ESG gap analysis, and ensure governance excellence.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            whileHover={{ scale: 1.05, boxShadow: "0 10px 40px rgba(16, 185, 129, 0.3)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/upload')}
            className="px-12 py-4 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Get Started
          </motion.button>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left"
          >
            {[
              {
                title: "AI-Powered Analysis",
                description: "BERT model for accurate regulation matching",
                icon: "🤖"
              },
              {
                title: "ESG Classification",
                description: "Automatic categorization into E, S, G buckets",
                icon: "📊"
              },
              {
                title: "Gap Detection",
                description: "Identify compliance gaps instantly",
                icon: "🔍"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 + index * 0.2, duration: 0.6 }}
                className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300"
              >
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default WelcomeDashboard;
