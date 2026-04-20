import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminDashboard } from './pages/AdminDashboard';
import { TeacherDashboard } from './pages/TeacherDashboard';
import { StudentDashboard } from './pages/StudentDashboard';
import { MarksEntry } from './pages/MarksEntry';
import { Button } from './components/ui/Button';
import { Input } from './components/ui/Input';
import { Card, CardContent } from './components/ui/Card';
import { GraduationCap, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123'); // pre-filled for mock
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const user = await login(email, password);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'teacher') navigate('/teacher');
      else if (user.role === 'student') navigate('/student');
    } catch (err) {
      // toast already handled in auth context
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }} 
      className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950"
    >
      <Card className="w-full max-w-md shadow-2xl border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl">
        <CardContent className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-primary-600 p-3 rounded-2xl mb-4 shadow-lg shadow-primary-500/30">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">EduPulse</h1>
            <p className="text-sm text-slate-500 mt-1 text-center">Manage academic results with ease.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <Input 
              type="email" 
              label="Email address" 
              placeholder="e.g. admin@edupulse.com" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input 
              type="password" 
              label="Password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <div className="pt-2">
              <Button type="submit" className="w-full h-11 text-base bg-primary-600 hover:bg-primary-700 shadow-md">
                Sign In
              </Button>
            </div>
          </form>
          
          <div className="mt-6 text-xs text-slate-500 text-center bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
            <p className="font-semibold mb-1 text-slate-700 dark:text-slate-300">Mock Login Credentials:</p>
            <p>Admin: admin@edupulse.com</p>
            <p>Teacher: teacher@edupulse.com</p>
            <p>Student: student@edupulse.com</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser } = useAuth();
  
  if (!currentUser) return <Navigate to="/login" replace />;
  
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Redirect to appropriate dashboard if wrong role
    return <Navigate to={`/${currentUser.role}`} replace />;
  }

  return children;
};

const Layout = ({ children }) => {
  const { currentUser, logout } = useAuth();
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm transition-all text-slate-900 dark:text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary-600 p-1.5 rounded-lg shadow-sm">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">EduPulse</span>
          </div>
          
          {currentUser && (
            <div className="flex items-center gap-4">
              {currentUser?.role === 'admin' && (
                <>
                  <Link to="/admin" className="text-slate-600 dark:text-slate-300 hover:text-primary-600 transition-colors">Admin Panel</Link>
                  <Link to="/admin/marks-entry" className="text-slate-600 dark:text-slate-300 hover:text-primary-600 transition-colors">Manual Marks</Link>
                </>
              )}
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400 text-sm">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-sm">
                  <p className="font-medium leading-none">{currentUser.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{currentUser.role}</p>
                </div>
              </div>
              <Button variant="ghost" onClick={logout} className="p-2 h-auto text-slate-500">
                <LogOut className="w-5 h-5" />
                <span className="sr-only">Logout</span>
              </Button>
            </div>
          )}
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={window.location.pathname}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: '#1e293b', color: '#fff' } }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Layout><AdminDashboard /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/admin/marks-entry" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Layout><MarksEntry /></Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/teacher" element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <Layout><TeacherDashboard /></Layout>
            </ProtectedRoute>
          } />
          
          <Route path="/student" element={
            <ProtectedRoute allowedRoles={['student']}>
              <Layout><StudentDashboard /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
