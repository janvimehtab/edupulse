import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { CheckCircle, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSubjectConfigs, setSubjectConfig } from '../services/firebaseConfig';
import { toast } from 'react-hot-toast';

export const SubjectConfig = ({ uniqueSubjects = [], onConfigUpdate }) => {
  const [configs, setConfigs] = useState({});
  const [isSaving, setIsSaving] = useState({});

  useEffect(() => {
    const fetchConfigs = async () => {
      const activeConfigs = await getSubjectConfigs();
      setConfigs(activeConfigs);
    };
    fetchConfigs();
  }, []);

  const handleMarkChange = (subject, value) => {
    // Basic validation to stay numeric
    if (value === '' || Number(value) >= 0) {
      setConfigs(prev => ({ ...prev, [subject]: value }));
    }
  };

  const handleSave = async (subject) => {
    if (!configs[subject] || configs[subject] === '') {
      toast.error(`Please provide a threshold for ${subject}`);
      return;
    }

    setIsSaving(prev => ({ ...prev, [subject]: true }));
    try {
      await setSubjectConfig(subject, configs[subject]);
      toast.success(`Updated ${subject} passing marks to ${configs[subject]}`);
      
      // Ping upstream UI context to recalculate percentages immediately
      if (onConfigUpdate) onConfigUpdate();
    } catch (error) {
      toast.error(`Failed to update ${subject}: ${error.message}`);
    } finally {
      setIsSaving(prev => ({ ...prev, [subject]: false }));
    }
  };

  // Combine locally mapped subjects from current cohort with any previously stored subject Config keys
  const combinedSubjects = Array.from(new Set([...uniqueSubjects, ...Object.keys(configs)])).sort();

  if (combinedSubjects.length === 0) {
    return (
      <div className="pt-2">
        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">System Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
           {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/50 dark:bg-slate-900/50 h-[104px] rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center">
                 <span className="text-sm font-medium text-slate-400 italic">Waiting for Data...</span>
              </div>
           ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <h3 className="text-xl font-bold mb-1 text-slate-900 dark:text-white">System Configuration</h3>
      <p className="text-sm text-slate-500 mb-6 flex items-center gap-2">
        <span>Set custom passing marks for each unique subject mapped inside the cohort.</span>
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {combinedSubjects.map(subject => (
            <motion.div 
              key={subject} 
              whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
              className="flex flex-col bg-white dark:bg-slate-950 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors"
            >
              <label className="text-base font-bold text-slate-900 dark:text-white truncate" title={subject}>
                {subject}
              </label>
              <span className="text-[10px] uppercase font-bold text-primary-500 tracking-wider mb-4">Extracted from Master Data</span>
              
              <div className="flex items-center gap-3 mt-auto">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 40"
                  value={configs[subject] !== undefined ? configs[subject] : ''}
                  onChange={(e) => handleMarkChange(subject, e.target.value)}
                  className="flex-1 bg-transparent border-0 border-b-2 border-slate-200 dark:border-slate-700 outline-none focus:ring-0 focus:border-primary-500 text-lg font-medium py-1 px-1 transition-colors"
                />
                <Button 
                  variant="secondary" 
                  className="w-10 h-10 p-0 rounded-full bg-slate-50 hover:bg-primary-50 hover:text-primary-600 dark:bg-slate-800 dark:hover:bg-primary-900/30" 
                  onClick={() => handleSave(subject)}
                  disabled={isSaving[subject]}
                  title="Save Limit"
                >
                  {isSaving[subject] ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Save className="w-4 h-4" />}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
    </div>
  );
};
