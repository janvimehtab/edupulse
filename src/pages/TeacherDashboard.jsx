import React, { useState, useEffect } from 'react';

import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { getFlattenedResults } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/ui/Skeleton';
import { FileSpreadsheet, Users, Trophy } from 'lucide-react';

export const TeacherDashboard = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({ totalUploads: 0, totalStudents: 0 });
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const allResults = await getFlattenedResults();
      const myResults = allResults.filter(r => r.teacherName === currentUser?.name);
      
      const uniqueStudents = new Set(myResults.map(r => r.studentName));
      
      setStats({
        totalUploads: myResults.length,
        totalStudents: uniqueStudents.size
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [currentUser]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Teacher Portal</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage results and upload new assessment data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-indigo-500 to-primary-600 text-white shadow-md border-none">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-indigo-100 font-medium text-sm mb-1 uppercase tracking-wider">Total Records Uploaded</p>
              {loading ? <Skeleton className="h-10 w-20 bg-indigo-400/50" /> : <div className="text-4xl font-bold">{stats.totalUploads}</div>}
            </div>
            <div className="p-4 bg-white/10 rounded-full">
              <FileSpreadsheet className="w-8 h-8 text-white" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1 uppercase tracking-wider">Students Evaluated</p>
              {loading ? <Skeleton className="h-10 w-20" /> : <div className="text-4xl font-bold text-slate-800 dark:text-white">{stats.totalStudents}</div>}
            </div>
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
              <Users className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};
