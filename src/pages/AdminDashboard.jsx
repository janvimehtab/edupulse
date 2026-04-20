import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as xlsx from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { getFlattenedResults, fetchAllStudents, deleteBatchByDegreeAndYear, deleteLastUpload } from '../services/firebaseConfig';
import { cleanSubjectName } from '../utils/cleanSubject';
import { AdminUpload } from '../components/AdminUpload';
import { SubjectConfig } from '../components/SubjectConfig';
import { Download, Settings2, Trash2, AlertTriangle, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Input } from '../components/ui/Input';

export const AdminDashboard = () => {
  const [results, setResults] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjectConfigs, setSubjectConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Filters
  const [filterYear, setFilterYear] = useState('');
  const [filterDegree, setFilterDegree] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const flattened = await getFlattenedResults();
      const allStudents = await fetchAllStudents();
      
      // Load grading boundaries silently
      try {
        const { getSubjectConfigs } = await import('../services/firebaseConfig');
        const configs = await getSubjectConfigs();
        setSubjectConfigs(configs);
      } catch (err) { }
      
      setResults(flattened);
      setStudents(allStudents);
    } catch (error) {
      console.error("Error fetching admin data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter options derived from data
  const filterOptions = useMemo(() => {
    const years = new Set();
    const degrees = new Set();
    const subjects = new Set();
    const teachers = new Set();

    results.forEach(r => {
      if (r.year) years.add(r.year);
      if (r.degree) degrees.add(r.degree);
      if (r.subject) subjects.add(r.subject);
      if (r.teacherName) teachers.add(r.teacherName);
    });

    // Extract raw subjects mapped natively inside student profiles even if results aren't added yet
    students.forEach(s => {
      if (s.registeredSubjects && Array.isArray(s.registeredSubjects)) {
        s.registeredSubjects.forEach(sub => {
           if (sub && String(sub).trim() !== "") subjects.add(String(sub).trim());
        });
      }
    });

    return {
      years: Array.from(years).sort(),
      degrees: Array.from(degrees).sort(),
      subjects: Array.from(subjects).sort(),
      teachers: Array.from(teachers).sort()
    };
  }, [results]);

  // Filtered data using useMemo
  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const matchYear = !filterYear || r.year === filterYear;
      const matchDegree = !filterDegree || r.degree === filterDegree;
      const matchSubject = !filterSubject || r.subject === filterSubject;
      const matchTeacher = !filterTeacher || r.teacherName === filterTeacher;
      return matchYear && matchDegree && matchSubject && matchTeacher;
    });
  }, [results, filterYear, filterDegree, filterSubject, filterTeacher]);

  // Inject placeholder results for students with 0 entries (Data Health Check)
  const masterList = useMemo(() => {
    let populated = [...filteredResults];
    
    // Identify students visually missing from filtered results (who have NO marks logged period)
    const existingIds = new Set(results.map(r => r.studentID));
    students.forEach(student => {
      // If student matches base filters but isn't in results array, manually generate a 'pending' mock
      const matchYear = !filterYear || student.year === filterYear;
      const matchDegree = !filterDegree || student.degree === filterDegree;
      if (!existingIds.has(student.id) && matchYear && matchDegree) {
        populated.push({
          isPendingObj: true,
          studentID: student.id,
          registrationID: student.registrationID,
          rollNo: student.rollNo,
          studentName: student.name,
          degree: student.degree,
          year: student.year,
          teacherName: '-',
          subject: 'No Marks Logged',
          marks: '-'
        });
      }
    });
    
    return populated;
  }, [filteredResults, results, students, filterYear, filterDegree]);

  const handleExport = useCallback(() => {
    if (filteredResults.length === 0) return;
    const worksheet = xlsx.utils.json_to_sheet(filteredResults);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Filtered Results");
    xlsx.writeFile(workbook, `EduPulse_Results_${Date.now()}.xlsx`);
  }, [filteredResults]);

  // Aggregate stats using useMemo
  const stats = useMemo(() => {
    if (filteredResults.length === 0) return { totalStudents: '-', passRate: '-', needsAttention: '-' };
    
    const uniqueStudents = new Set(filteredResults.map(r => r.studentID));
    const totalStudents = uniqueStudents.size;
    
    let passCount = 0;
    let failureMap = {}; // mapping studentID -> failCount
    
    filteredResults.forEach(r => {
      const mark = Number(r.marks) || 0;
      
      const cleanSub = cleanSubjectName(r.subject);
      const threshold = subjectConfigs[cleanSub] !== undefined ? Number(subjectConfigs[cleanSub]) : 40;
      
      if (mark >= threshold) {
        passCount++; 
      } else {
        failureMap[r.studentID] = (failureMap[r.studentID] || 0) + 1;
      }
    });

    let needsAttention = Object.values(failureMap).filter(fails => fails >= 2).length;

    return {
      totalStudents,
      passRate: Math.round((passCount / filteredResults.length) * 100),
      needsAttention
    };
  }, [filteredResults, subjectConfigs]);

  return (
    <div className="w-full relative">
      <div className="max-w-7xl mx-auto px-6 mt-6">
        
        {/* Apple Style Header & Tab Switcher */}
        <motion.div 
          initial={{ opacity: 0, y: -30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-slate-200 dark:border-slate-800"
        >
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">System Overview</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-md">Monitor academic performance safely aggregated from student profiles.</p>
          </div>
          <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl mt-4 md:mt-0 shadow-inner">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'upload' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Master Upload
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Settings
            </button>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* Static Filter Navbar - Apple Style */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl px-6 py-4 flex flex-col md:flex-row md:items-center gap-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] dark:shadow-none border border-slate-100 dark:border-slate-800">
                <div className="flex flex-row flex-wrap items-center gap-3 w-full">
                  <span className="text-xs font-bold uppercase text-slate-400 tracking-widest hidden md:block">Filters</span>
                  <Select 
                    value={filterYear} 
                    onChange={e => setFilterYear(e.target.value)} 
                    options={[
                      { label: `Year: All`, value: '' }, 
                      ...filterOptions.years.map(y => ({label: `Year: ${y}`, value: y}))
                    ]} 
                    className="!w-max min-w-[max-content] !py-1.5 !rounded-full bg-slate-50 dark:bg-slate-800 border-none font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  />
                  <Select 
                    value={filterDegree} 
                    onChange={e => setFilterDegree(e.target.value)} 
                    options={[
                      { label: `Degree: All`, value: '' }, 
                      ...filterOptions.degrees.map(d => ({label: `Degree: ${d}`, value: d}))
                    ]} 
                    className="!w-max min-w-[max-content] !py-1.5 !rounded-full bg-slate-50 dark:bg-slate-800 border-none font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  />
                  <Select 
                    value={filterSubject} 
                    onChange={e => setFilterSubject(e.target.value)} 
                    options={[
                      { label: `Subject: All`, value: '' }, 
                      ...filterOptions.subjects.map(s => ({label: `Subject: ${s}`, value: s}))
                    ]} 
                    className="!w-max min-w-[max-content] !py-1.5 !rounded-full bg-slate-50 dark:bg-slate-800 border-none font-medium text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  />
                  
                  <div className="md:ml-auto">
                    <Button 
                      variant="secondary" 
                      onClick={handleExport} 
                      disabled={filteredResults.length === 0}
                      title="Download Filtered Results"
                      className="w-10 h-10 p-0 rounded-full shadow-sm bg-white hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700"
                    >
                      <Download className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    </Button>
                  </div>
                </div>
              </div>



        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-500 to-primary-600 border-none text-white shadow-md">
            <CardHeader className="border-none pb-2">
              <CardTitle className="text-blue-100 font-medium text-sm uppercase tracking-wider">Filtered Students Found</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-10 w-24 bg-blue-400/50" /> : <div className="text-4xl font-bold">{stats.totalStudents}</div>}
            </CardContent>
          </Card>
          
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-500 dark:text-slate-400 font-medium text-sm uppercase tracking-wider">Filtered Pass Rate</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-10 w-24" /> : (
                <div className="flex items-end gap-2">
                  <div className="text-4xl font-bold text-slate-800 dark:text-white">{stats.passRate}{stats.passRate !== '-' ? '%' : ''}</div>
                  <div className={`text-sm mb-1 ${stats.passRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                    {stats.passRate >= 70 ? 'Excellent' : stats.passRate >= 50 ? 'Average' : stats.passRate !== '-' ? 'Needs Attention' : ''}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-500 dark:text-slate-400 font-medium text-sm uppercase tracking-wider flex items-center justify-between">
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-10 w-24" /> : (
                <div className="flex items-end gap-2">
                  <div className="text-4xl font-bold text-slate-800 dark:text-white">{stats.needsAttention}</div>
                  <div className="text-sm mb-1 text-amber-500 font-medium">Students</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Results Data Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="!p-0 overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">ID</th>
                      <th className="px-6 py-4 font-medium">Student Name</th>
                      <th className="px-6 py-4 font-medium">Teacher</th>
                      <th className="px-6 py-4 font-medium">Subject</th>
                      <th className="px-6 py-4 font-medium">Year</th>
                      <th className="px-6 py-4 font-medium text-right">Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {masterList.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-4">
                          <div className="space-y-4 animate-pulse pt-4 pb-8">
                             {[1, 2, 3].map(i => (
                               <div key={i} className="h-12 bg-slate-100/60 dark:bg-slate-800/40 rounded-lg flex items-center justify-center">
                                  {i === 2 && <span className="text-sm text-slate-400 italic">Waiting for Data...</span>}
                               </div>
                             ))}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      masterList.slice(0, 50).map((r, idx) => (
                        <tr key={idx} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs font-semibold">
                            {r.registrationID || r.rollNo || "-"} 
                            <span className="font-normal opacity-70 ml-1">({r.year})</span>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                            {r.studentName}
                            {r.isPendingObj && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 tracking-wider">
                                PENDING DATA
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{r.teacherName}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400 truncate max-w-[200px]" title={r.subject}>{r.subject}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{r.year}</td>
                          <td className="px-6 py-4 text-right">
                            {r.isPendingObj ? (
                               <span className="text-slate-400 italic">No entry</span>
                            ) : (
                               <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${Number(r.marks) >= (subjectConfigs[cleanSubjectName(r.subject)] !== undefined ? Number(subjectConfigs[cleanSubjectName(r.subject)]) : 40) ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                                 {r.marks}
                               </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
      ) : activeTab === 'upload' ? (
      <motion.div 
        key="upload"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        className="space-y-8"
      >
        <div className="pt-2">
          <SubjectConfig uniqueSubjects={filterOptions.cleanSubjects} onConfigUpdate={loadData} />
        </div>

        <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Database Management</h2>
          <AdminUpload students={students} onUploadSuccess={loadData} />
        </div>
      </motion.div>
      ) : (
      <motion.div 
        key="settings"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        className="space-y-8"
      >
        <div className="pt-2">
          <Card className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10">
            <CardHeader>
              <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Danger Zone: Batch Deletion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Permanently delete all students and their associated results that match a specific Degree and Year. This action cannot be undone.
              </p>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-1/3">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Target Degree</label>
                  <Input id="delDegree" placeholder="e.g. BCA" className="w-full bg-white dark:bg-slate-950" />
                </div>
                <div className="w-full md:w-1/3">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">Target Year</label>
                  <Input id="delYear" placeholder="e.g. 2025" className="w-full bg-white dark:bg-slate-950" />
                </div>
                <Button 
                  variant="primary"
                  className="w-full md:w-auto bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                  onClick={async () => {
                    const d = document.getElementById('delDegree').value.trim();
                    const y = document.getElementById('delYear').value.trim();
                    if(!d || !y) {
                      toast.error("Degree and Year are required.");
                      return;
                    }
                    if(window.confirm(`Are you absolutely sure you want to delete ALL students in ${d} for year ${y}?`)) {
                      try {
                        const res = await deleteBatchByDegreeAndYear(d, y);
                        toast.success(`Deleted ${res.count} student records.`);
                        if(res.count > 0) loadData();
                      } catch(err) {
                        toast.error("Failed to delete batch.");
                        console.error(err);
                      }
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Cohort
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10 mt-6">
            <CardHeader>
              <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Revert Last Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Delete all student records created during the most recent Master File upload. Useful if you made a mistake mapping headers.
              </p>
              <Button 
                variant="primary"
                className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white"
                onClick={async () => {
                  if(window.confirm('Are you certain you want to delete the data from the last uploaded file?')) {
                    try {
                      const res = await deleteLastUpload();
                      if (res.success) {
                         toast.success(`Successfully reverted ${res.count} student records.`);
                         loadData();
                      } else {
                         toast.error(res.message || "Failed to revert.");
                      }
                    } catch(err) {
                      toast.error("Failed to delete last upload.");
                      console.error(err);
                    }
                  }
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Delete Last Uploaded File Data
              </Button>
            </CardContent>
          </Card>
        </div>
      </motion.div>
      )}
      </AnimatePresence>
      </div>
    </div>
  );
};
