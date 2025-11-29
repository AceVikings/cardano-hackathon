import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Play, Trash2 } from 'lucide-react';
import AgentEditor from '../components/AgentEditor';

export default function AgentEditorPage() {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col pt-16">
      {/* Editor Header */}
      <div className="glass border-b border-sea-mist/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            className="p-2 rounded-lg glass text-sea-mist hover:text-foam-white transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <h1 className="text-xl font-bold text-foam-white font-heading">
              Agent Workflow Editor
            </h1>
            <p className="text-sm text-sea-mist/60">
              Drag agents from the sidebar and connect them to build your workflow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            className="flex items-center gap-2 px-4 py-2 rounded-lg glass text-sea-mist hover:text-foam-white transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm">Clear</span>
          </motion.button>
          <motion.button
            className="flex items-center gap-2 px-4 py-2 rounded-lg glass text-sea-mist hover:text-foam-white transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Save className="w-4 h-4" />
            <span className="text-sm">Save</span>
          </motion.button>
          <motion.button
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aqua-glow text-deep-ocean font-semibold"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Play className="w-4 h-4" />
            <span className="text-sm">Deploy</span>
          </motion.button>
        </div>
      </div>

      {/* Editor Canvas */}
      <div className="flex-1 overflow-hidden">
        <AgentEditor />
      </div>
    </div>
  );
}
