import React, { useState, useMemo } from 'react';
import * as xlsx from 'xlsx';
import { Upload, CheckCircle, AlertCircle, Database, UserPlus } from 'lucide-react';
import { Button } from './ui/Button.jsx';
import { Card, CardContent } from './ui/Card';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';
import { uploadMasterStudents, appendResultToStudent } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

export const AdminUpload = ({ students = [], onUploadSuccess }) => {
  const { currentUser } = useAuth();
  const [mode, setMode] = useState('profiles'); // 'profiles' or 'results'
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  const [file, setFile] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mapping, setMapping] = useState({});
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const PROFILE_FIELDS = [
    { key: 'rollNo', label: 'Class Roll No', aliases: ['roll no', 'registration', 'id', 'class roll'] },
    { key: 'name', label: 'Full Name', aliases: ['student name', 'name', 'student'] },
    { key: 'degree', label: 'Degree', aliases: ['course', 'program', 'major'] },
    { key: 'year', label: 'Batch/Year', aliases: ['year', 'batch', 'session'] }
  ];

  const RESULT_FIELDS = [
    { key: 'subject', label: 'Subject', aliases: ['course module', 'module', 'class'] },
    { key: 'marks', label: 'Marks', aliases: ['score', 'grade', 'points'] },
    { key: 'semester', label: 'Semester', aliases: ['term', 'sem'] }
  ];

  const REQUIRED_FIELDS = mode === 'profiles' ? PROFILE_FIELDS : RESULT_FIELDS;

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    if (mode === 'results' && !selectedStudentId) {
      toast.error("Please select a target student first!");
      return;
    }
    
    setFile(uploadedFile);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target.result;
        const workbook = xlsx.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const parsedData = xlsx.utils.sheet_to_json(sheet, { defval: "" });

        if (parsedData.length === 0) {
          toast.error("The uploaded file is empty.");
          return;
        }

        const headers = Object.keys(parsedData[0]);
        setRawHeaders(headers);
        setRawData(parsedData);
        setPreviewData(parsedData.slice(0, 3));
        
        autoMapHeaders(headers);
        // Auto-select unmapped columns as subjects in Profile mode
        const initialMapValues = [];
        REQUIRED_FIELDS.forEach(field => {
          const fieldAliases = [field.key.toLowerCase(), ...field.aliases.map(a => a.toLowerCase())];
          const match = headers.find(h => fieldAliases.includes(h.toLowerCase().trim()));
          if(match) initialMapValues.push(match);
        });
        if(mode === 'profiles') {
           setSelectedSubjects(headers.filter(h => !initialMapValues.includes(h)));
        }
        
        setIsModalOpen(true);
      } catch (error) {
        toast.error("Failed to parse file.");
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const autoMapHeaders = (headers) => {
    const initialMapping = {};
    REQUIRED_FIELDS.forEach(field => {
      const fieldAliases = [field.key.toLowerCase(), ...field.aliases.map(a => a.toLowerCase())];
      const matchedHeader = headers.find(h => fieldAliases.includes(h.toLowerCase().trim()));
      initialMapping[field.key] = matchedHeader || "";
    });
    setMapping(initialMapping);
  };

  const isMappingComplete = useMemo(() => {
    return REQUIRED_FIELDS.every(field => mapping[field.key] !== "" && mapping[field.key] !== undefined);
  }, [mapping, mode]);

  const handleConfirmUpload = async () => {
    setIsUploading(true);
    try {
      const cleanedData = rawData.map(row => {
        const newRow = {};
        REQUIRED_FIELDS.forEach(field => {
          const excelHeader = mapping[field.key];
          newRow[field.key] = excelHeader && row[excelHeader] !== undefined ? String(row[excelHeader]).trim() : "";
        });
        if (mode === 'profiles') {
          newRow.registeredSubjects = selectedSubjects;
        }
        return newRow;
      });

      if (mode === 'profiles') {
        const res = await uploadMasterStudents(cleanedData);
        toast.success(`Created ${res.count} master profiles!`);
      } else {
        // Mode Results requires appending iteratively
        for (const row of cleanedData) {
          row.teacherName = currentUser?.name || 'Admin'; // Tag admin as the teacher/uploader
          row.timestamp = Date.now();
          await appendResultToStudent(selectedStudentId, row);
        }
        toast.success(`Appended ${cleanedData.length} results to student!`);
      }

      setIsModalOpen(false);
      setFile(null);
      if(onUploadSuccess) onUploadSuccess();
    } catch (error) {
      toast.error(`Upload failed: ${error.message || 'Unknown network error'}`);
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Mode Selector */}
      <div className="flex gap-4">
        <Button 
          variant={mode === 'profiles' ? 'primary' : 'secondary'} 
          onClick={() => setMode('profiles')}
          className="flex-1 py-3 h-auto gap-3"
        >
          <UserPlus className="w-5 h-5" />
          <div className="text-left hidden sm:block">
            <div className="font-semibold">Master Profiles</div>
            <div className="text-xs opacity-80 font-normal mt-0.5">Initialize student database</div>
          </div>
        </Button>
        <Button 
          variant={mode === 'results' ? 'primary' : 'secondary'} 
          onClick={() => setMode('results')}
          className="flex-1 py-3 h-auto gap-3"
        >
          <Database className="w-5 h-5" />
          <div className="text-left hidden sm:block">
            <div className="font-semibold">Student Results</div>
            <div className="text-xs opacity-80 font-normal mt-0.5">Append specific marks</div>
          </div>
        </Button>
      </div>

      {mode === 'results' && (
        <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
          <CardContent className="p-4">
            <Select 
              label="Select Target Student Account"
              value={selectedStudentId}
              onChange={e => setSelectedStudentId(e.target.value)}
              options={students.map(s => ({ label: `${s.name} (${s.studentID}) - ${s.degree}`, value: s.id }))}
              className="max-w-md"
            />
          </CardContent>
        </Card>
      )}

      {/* Upload Dropzone */}
      <Card className={(mode === 'results' && !selectedStudentId) ? 'opacity-50 pointer-events-none' : ''}>
        <CardContent className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative">
          <Upload className="w-10 h-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            Upload {mode === 'profiles' ? 'Student Register' : 'Assessment Sheet'}
            {mode === 'results' && selectedStudentId && <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full ml-2">Target Locked</span>}
          </h3>
          <p className="text-sm text-slate-500 mt-2 text-center max-w-sm">Drag and drop your spreadsheet here to begin auto-mapping columns.</p>
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileUpload}
            value={""}
          />
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Map Headers: ${mode === 'profiles' ? 'Profile Setup' : 'Result Upload'}`}>
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex gap-3 text-blue-800 dark:text-blue-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>Please match your file's columns to the required database structure.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
            {REQUIRED_FIELDS.map(field => (
              <div key={field.key} className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 w-1/2 flex items-center">
                  {field.label} <span className="text-red-500 ml-1">*</span>
                </label>
                <Select
                  className="w-1/2"
                  value={mapping[field.key] || ""}
                  onChange={(e) => {
                     setMapping(prev => ({ ...prev, [field.key]: e.target.value }));
                     setSelectedSubjects(prev => prev.filter(sub => sub !== e.target.value));
                  }}
                  options={rawHeaders.map(h => ({ label: h, value: h }))}
                />
              </div>
            ))}
          </div>

          {mode === 'profiles' && (
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Select Columns as Subjects</h4>
              <p className="text-xs text-slate-500 mb-3">These columns will be added to the student's registered subjects instead of standard profile data.</p>
              <div className="flex flex-wrap gap-3">
                {rawHeaders.filter(h => !Object.values(mapping).includes(h)).length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No remaining columns found.</span>
                ) : (
                  rawHeaders.filter(h => !Object.values(mapping).includes(h)).map(h => (
                    <label key={h} className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        checked={selectedSubjects.includes(h)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedSubjects(prev => [...prev, h]);
                          else setSelectedSubjects(prev => prev.filter(s => s !== h));
                        }}
                      />
                      {h}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Data Preview</h4>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    {REQUIRED_FIELDS.map(f => (<th key={f.key} className="px-4 py-3">{f.label}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="bg-white border-b dark:bg-slate-900 dark:border-slate-700">
                      {REQUIRED_FIELDS.map(field => {
                        const val = mapping[field.key] ? row[mapping[field.key]] : "-";
                        return <td key={field.key} className="px-4 py-2 truncate max-w-[150px]">{val}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button 
              variant="primary" 
              onClick={handleConfirmUpload} 
              disabled={!isMappingComplete || isUploading}
              className="gap-2"
            >
              {isUploading ? 'Processing...' : 'Confirm Injection'}
              {!isUploading && isMappingComplete && <CheckCircle className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
