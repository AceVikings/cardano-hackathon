import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AgentEditor from "../components/AgentEditor";

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
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <h1 className="text-xl font-bold text-foam-white font-heading">
              Agent Workflow Editor
            </h1>
            <p className="text-sm text-sea-mist/60">
              Drag agents from the sidebar and connect them to build your
              workflow
            </p>
          </div>
        </div>
      </div>

      {/* Editor Canvas */}
      <div className="flex-1 overflow-hidden">
        <AgentEditor />
      </div>
    </div>
  );
}
