import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Search, UserCircle, CheckCircle, AlertCircle, Database, ListPlus, Trash2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchStudentProfile, appendMultipleResultsToStudent, getSubjectConfigs } from '../services/firebaseConfig';
import { cleanSubjectName } from '../utils/cleanSubject';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

export const MarksEntry = () => {
  const { currentUser } = useAuth();
  
  // Search State
  const [searchYear, setSearchYear] = useState('');
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Student Profile State
  const [student, setStudent] = useState(null);
  
  // Form State
  const [examTag, setExamTag] = useState(''); // Stores the selected semester
  const [marks, setMarks] = useState({});
  const [draftQueue, setDraftQueue] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subjectConfigs, setSubjectConfigs] = useState({});

  React.useEffect(() => {
    const loadConfigs = async () => {
      const configs = await getSubjectConfigs();
      setSubjectConfigs(configs);
    };
    loadConfigs();
  }, []);

  const semesterOptions = Array.from({length: 8}, (_, i) => ({
    label: `Semester ${i + 1}`,
    value: `Semester ${i + 1}`
  }));

  // Common years to choose from (could be dynamic or hardcoded for ease)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({length: 5}, (_, i) => ({
    label: String(currentYear - i), 
    value: String(currentYear - i)
  }));

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchYear || !searchId) {
      toast.error("Please enter both Batch/Year and Student ID");
      return;
    }
    
    setIsSearching(true);
    setStudent(null);
    setMarks({});
    
    try {
      const safeYear = String(searchYear).trim();
      const safeId = String(searchId).trim();
      const profile = await fetchStudentProfile(safeYear, safeId);
      if (profile) {
        setStudent(profile);
        
        // Initialize marks object dynamically
        const initialMarks = {};
        if (profile.registeredSubjects && profile.registeredSubjects.length > 0) {
          profile.registeredSubjects.forEach(sub => {
            initialMarks[sub] = '';
          });
          setMarks(initialMarks);
        } else {
          toast.success(`Found ${profile.name}, but no subjects are mapped!`);
        }
      } else {
        toast.error("Student not found.");
      }
    } catch (error) {
      toast.error(`Database error: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMarksChange = (subject, value) => {
    // Only allow positive numbers or empty string
    if (value === '' || Number(value) >= 0) {
      setMarks(prev => ({ ...prev, [subject]: value }));
    }
  };

  const handleSubmitMarks = async (e) => {
    e.preventDefault();
    if (!examTag) {
      toast.error("Please enter a Semester or Exam Tag (e.g. Midterms 2024)");
      return;
    }

    // Build payload array
    const resultsPayload = [];
    let hasValidData = false;

    Object.keys(marks).forEach(subject => {
      if (marks[subject] !== '') {
        hasValidData = true;
        resultsPayload.push({
          subject: subject,
          marks: Number(marks[subject]),
          semester: examTag,
          teacherName: currentUser?.name || 'Manual Entry',
          timestamp: Date.now()
        });
      }
    });

    // Check for duplicates in queue
    const isAlreadyQueued = draftQueue.some(d => d.studentId === student.id && d.examTag === examTag);
    if (isAlreadyQueued) {
       toast.error(`${student.name} is already in the queue for ${examTag}!`);
       return;
    }

    setDraftQueue(prev => [...prev, {
       studentId: student.id,
       studentName: student.name,
       registrationID: student.registrationID || student.rollNo,
       examTag: examTag,
       payload: resultsPayload
    }]);

    toast.success(`Drafted ${resultsPayload.length} subjects for ${student.name}!`);
    
    // Reset form for next search
    setStudent(null);
    setSearchId('');
    setMarks({});
    // Keep searchYear and examTag intentionally for rapid subsequent entry
  };

  const handleCommitQueue = async () => {
    if (draftQueue.length === 0) return;
    
    setIsSubmitting(true);
    let successCount = 0;
    
    try {
      for (const draft of draftQueue) {
        await appendMultipleResultsToStudent(draft.studentId, draft.payload);
        successCount++;
      }
      toast.success(`Successfully committed ${successCount} student records to Firebase!`);
      setDraftQueue([]);
    } catch (error) {
      toast.error(`Sync halted mid-way. Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeDraft = (idxToRemove) => {
    setDraftQueue(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="max-w-4xl mx-auto space-y-8 py-6"
    >
      
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Manual Marks Entry</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Search for a student to assign individual subjective marks.</p>
      </div>

      {/* SEARCH CARD */}
      <Card>
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-end gap-4">
            <div className="w-full md:w-1/3">
              <Select 
                label="Academic Year / Batch"
                value={searchYear}
                onChange={(e) => setSearchYear(e.target.value)}
                options={[{label: 'Select Year', value: ''}, ...yearOptions]}
                required
              />
            </div>
            <div className="w-full md:w-1/2">
              <Input 
                type="text"
                label="Class Roll No / Registration ID"
                placeholder="e.g. 101 or 2026-REG-01"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="primary" disabled={isSearching} className="w-full md:w-auto h-[42px] gap-2 shrink-0">
              <Search className="w-4 h-4" />
              {isSearching ? 'Searching...' : 'Find Student'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* RESULTS CONTEXT */}
      {student && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/40">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                <UserCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-lg">{student.name}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                  {student.degree} · ID: {student.registrationID || student.rollNo} ({student.year})
                </p>
              </div>
            </CardContent>
          </Card>

          {(!student.registeredSubjects || student.registeredSubjects.length === 0) ? (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-6 rounded-xl border border-red-200 dark:border-red-900/50 flex flex-col items-center text-center">
              <AlertCircle className="w-10 h-10 mb-2 opacity-80" />
              <h4 className="font-bold">No Custom Subjects Found</h4>
              <p className="text-sm mt-1 max-w-md">This student's profile was created, but no specific subjects were mapped in the Master Spreadsheet during upload.</p>
            </div>
          ) : (
            <Card>
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <CardTitle>Academic Entry Form</CardTitle>
                <p className="text-sm text-slate-500">Only positive numbers are permitted.</p>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmitMarks} className="space-y-8">
                  
                  <div className="max-w-xs">
                    <Select 
                      label="Semester"
                      value={examTag}
                      onChange={(e) => setExamTag(e.target.value)}
                      options={[{label: 'Select Semester', value: ''}, ...semesterOptions]}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    {student.registeredSubjects.map(subject => {
                      const cleanSub = cleanSubjectName(subject);
                      const threshold = subjectConfigs[cleanSub] !== undefined ? Number(subjectConfigs[cleanSub]) : 40;
                      const isFailing = marks[subject] !== '' && Number(marks[subject]) < threshold;

                      return (
                        <div key={subject} className="relative">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            label={subject}
                            placeholder={`Passing: ${threshold}`}
                            value={marks[subject] || ''}
                            onChange={(e) => handleMarksChange(subject, e.target.value)}
                            className={isFailing ? "!border-red-500/50 !bg-red-50 dark:!bg-red-900/10 focus:!ring-red-500 text-red-900 dark:text-red-400" : ""}
                          />
                          {isFailing && <span className="absolute bottom-[-18px] left-0 text-[10px] text-red-500 font-bold tracking-wide">FAILING THRESHOLD</span>}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex justify-end pt-4">
                    <Button type="submit" variant="primary" className="gap-2 px-8">
                      Add to Queue
                      <ListPlus className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* DRAFT QUEUE UI */}
      {draftQueue.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }} 
          animate={{ opacity: 1, height: 'auto' }} 
          className="pt-8 border-t border-slate-200 dark:border-slate-800"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
                <Database className="w-6 h-6 text-primary-500" /> Draft Queue
              </h2>
              <p className="text-sm text-slate-500 mt-1">These records are held locally. Commit them to permanently sync to Firebase.</p>
            </div>
            <Button 
              onClick={handleCommitQueue} 
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-lg shadow-green-500/20"
            >
              {isSubmitting ? 'Syncing...' : 'Commit All to Database'}
              {!isSubmitting && <Send className="w-4 h-4 ml-1" />}
            </Button>
          </div>

          <Card className="overflow-hidden border-amber-200 dark:border-amber-900/50 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400/80">
                  <tr>
                    <th className="px-6 py-4 font-medium">Student</th>
                    <th className="px-6 py-4 font-medium">ID</th>
                    <th className="px-6 py-4 font-medium">Semester</th>
                    <th className="px-6 py-4 font-medium">Subjects Logged</th>
                    <th className="px-6 py-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  <AnimatePresence>
                    {draftQueue.map((draft, idx) => (
                      <motion.tr 
                        key={`${draft.studentId}-${idx}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="bg-white dark:bg-slate-900"
                      >
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{draft.studentName}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">{draft.registrationID}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {draft.examTag}
                        </td>
                        <td className="px-6 py-4 max-w-sm">
                          <div className="flex flex-wrap gap-2">
                            {draft.payload.map(p => {
                              const cleanSub = cleanSubjectName(p.subject);
                              const threshold = subjectConfigs[cleanSub] !== undefined ? Number(subjectConfigs[cleanSub]) : 40;
                              const isFailing = Number(p.marks) < threshold;
                              return (
                                <span key={p.subject} className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wider border ${isFailing ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'}`}>
                                  {cleanSub}: {p.marks}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <button 
                             onClick={() => removeDraft(idx)}
                             className="text-red-500 hover:text-red-700 transition-colors p-1"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

    </motion.div>
  );
};
