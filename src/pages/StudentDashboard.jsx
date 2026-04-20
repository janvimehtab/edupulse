import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { getFlattenedResults } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/ui/Skeleton';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export const StudentDashboard = () => {
  const { currentUser } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const allResults = await getFlattenedResults();
        setResults(allResults);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Process data for charts
  const { lineChartData, barChartData, stats } = useMemo(() => {
    if (results.length === 0 || !currentUser) return { lineChartData: [], barChartData: [], stats: {} };

    // My results
    const myResults = results.filter(r => r.studentName.toLowerCase() === currentUser.name.toLowerCase());
    
    // Sort by timestamp (or year/semester ideally, using timestamp for chronological proxy here)
    const sortedMyResults = [...myResults].sort((a, b) => a.timestamp - b.timestamp);
    
    // Line Chart Data: Marks over time
    const lineData = sortedMyResults.map((r, i) => ({
      sequence: `Assessment ${i+1}`,
      marks: Number(r.marks) || 0,
      subject: r.subject
    }));

    // Bar Chart Data: Subject vs Class Average
    // 1. Calculate class average per subject
    const subjectAverages = {};
    const subjectCounts = {};
    results.forEach(r => {
      const s = r.subject;
      if (!subjectAverages[s]) { subjectAverages[s] = 0; subjectCounts[s] = 0; }
      subjectAverages[s] += Number(r.marks) || 0;
      subjectCounts[s] += 1;
    });

    const averageBySubject = {};
    Object.keys(subjectAverages).forEach(s => {
      averageBySubject[s] = subjectAverages[s] / subjectCounts[s];
    });

    // 2. Map student marks to class average
    const barDataMap = {};
    myResults.forEach(r => {
      const s = r.subject;
      if (!barDataMap[s]) {
        barDataMap[s] = {
          subject: s,
          myScore: Number(r.marks) || 0,
          classAverage: averageBySubject[s]
        };
      } else {
        // Average if multiple assessments for same subject
        barDataMap[s].myScore = (barDataMap[s].myScore + Number(r.marks)) / 2;
      }
    });

    // Overall stats calculations
    let totalMarks = 0;
    myResults.forEach(r => totalMarks += Number(r.marks) || 0);

    return {
      lineChartData: lineData,
      barChartData: Object.values(barDataMap),
      stats: {
        totalSubjects: Object.keys(barDataMap).length,
        averageScore: myResults.length ? Math.round(totalMarks / myResults.length) : 0
      }
    };
  }, [results, currentUser]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 flex flex-col items-center sm:items-start">
      <div className="w-full">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome, {currentUser?.name}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Review your academic progress and detailed analytics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <Card className="bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 dark:bg-primary-500/5 rounded-bl-full pointer-events-none" />
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 dark:text-slate-400 font-medium text-sm uppercase tracking-wider relative z-10">Your Average Score</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            {loading ? <Skeleton className="h-10 w-24" /> : <div className="text-4xl font-bold text-slate-800 dark:text-white">{stats.averageScore} <span className="text-xl text-slate-400 font-normal">/ 100</span></div>}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 dark:bg-green-500/5 rounded-bl-full pointer-events-none" />
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-500 dark:text-slate-400 font-medium text-sm uppercase tracking-wider relative z-10">Subjects Evaluated</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            {loading ? <Skeleton className="h-10 w-24" /> : <div className="text-4xl font-bold text-slate-800 dark:text-white">{stats.totalSubjects}</div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Performance Trend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-72" />
            ) : lineChartData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-slate-500">No data available</div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="sequence" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                    <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                      formatter={(val, name, props) => [`${val} (${props.payload.subject})`, 'Marks']}
                    />
                    <Line type="monotone" dataKey="marks" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Score vs Class Average</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-72" />
            ) : barChartData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-slate-500">No data available</div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="subject" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                    <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
                    <Bar dataKey="myScore" name="Your Score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="classAverage" name="Class Average" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
