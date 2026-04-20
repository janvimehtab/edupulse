import React, { useState, useMemo } from 'react';
import * as xlsx from 'xlsx';
import { Upload, CheckCircle, AlertCircle, Database, UserPlus } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';
import { uploadMasterStudents, appendResultToStudent } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

export const AdminUpload = ({ students = [], onUploadSuccess }) => {
  const { currentUser } = useAuth();


  const [file, setFile] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mapping, setMapping] = useState({});
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [yearFormat, setYearFormat] = useState('hyphenBounded'); // 'hyphenBounded' | 'generic'

  const PROFILE_FIELDS = [
    { key: 'registrationID', label: 'Registration ID', aliases: ['registration id', 'reg id', 'application id', 'app id'] },
    { key: 'rollNo', label: 'Class Roll No', aliases: ['roll no', 'registration', 'id', 'class roll'] },
    { key: 'name', label: 'Full Name', aliases: ['student name', 'name', 'student'] },
    { key: 'degree', label: 'Degree', aliases: ['course', 'program', 'major'] },
    { key: 'year', label: 'Batch/Year (Fallback)', aliases: ['year', 'batch', 'session'], optional: true }
  ];

  const REQUIRED_FIELDS = PROFILE_FIELDS.filter(f => !f.optional);

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;


    setFile(uploadedFile);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target.result;
        const workbook = xlsx.read(data, { type: 'binary' });

        let allParsedData = [];
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const parsedSheet = xlsx.utils.sheet_to_json(sheet, { defval: "" });
          allParsedData = [...allParsedData, ...parsedSheet];
        });

        if (allParsedData.length === 0) {
          toast.error("The uploaded file is completely empty across all sheets.");
          return;
        }

        const headers = Object.keys(allParsedData[0] || {});
        setRawHeaders(headers);
        setRawData(allParsedData);
        setPreviewData(allParsedData.slice(0, 3));

        autoMapHeaders(headers);
        // Set unselected by default
        setSelectedSubjects([]);

        setIsModalOpen(true);
      } catch (error) {
        toast.error("Failed to parse file.");
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const autoMapHeaders = (headers) => {
    const initialMapping = {};
    PROFILE_FIELDS.forEach(field => {
      const fieldAliases = [field.key.toLowerCase(), ...field.aliases.map(a => a.toLowerCase())];
      const matchedHeader = headers.find(h => fieldAliases.includes(h.toLowerCase().trim()));
      initialMapping[field.key] = matchedHeader || "";
    });
    setMapping(initialMapping);
  };

  const isMappingComplete = useMemo(() => {
    return REQUIRED_FIELDS.every(field => mapping[field.key] !== "" && mapping[field.key] !== undefined);
  }, [mapping]);

  const handleConfirmUpload = async () => {
    setIsUploading(true);
    try {
      const cleanedData = rawData.map(row => {
        const newRow = {};
        PROFILE_FIELDS.forEach(field => {
          const excelHeader = mapping[field.key];
          newRow[field.key] = excelHeader && row[excelHeader] !== undefined ? String(row[excelHeader]).trim() : "";
        });

        // Extract 4-digit Year dynamically mapped to Regex Toggle
        const possibleYearString = newRow.registrationID || newRow.rollNo || "";
        let extractedYear;

        if (yearFormat === 'hyphenBounded') {
          extractedYear = possibleYearString.match(/-(\d{4})-/);
        } else {
          // Generic grab for first bounded 4 numbers
          extractedYear = possibleYearString.match(/(?:^|\D)(\d{4})(?:\D|$)/);
        }

        if (extractedYear && extractedYear[1]) {
          newRow.year = extractedYear[1];
        } else {
          // Absolute fallback
          const fallback = possibleYearString.match(/(\d{4})/);
          if (fallback && fallback[1]) newRow.year = fallback[1];
        }

        // Dynamically pull the textual cell values from the chosen columns
        const dynamicSubjects = [];
        selectedSubjects.forEach(colHeader => {
          let cellValue = row[colHeader];
          if (cellValue !== undefined && String(cellValue).trim() !== "") {
            const strVal = String(cellValue).trim();
            if (/^(yes|y|true|1|v|checked)$/i.test(strVal)) {
              dynamicSubjects.push(colHeader.trim());
            } else if (!/^(no|n|false|0)$/i.test(strVal)) {
              dynamicSubjects.push(strVal);
            }
          } else {
            // Implicit assignment for empty cells under selected Subject headers
            dynamicSubjects.push(colHeader.trim());
          }
        });
        
        newRow.registeredSubjects = [...new Set(dynamicSubjects)];
        return newRow;
      });

      const res = await uploadMasterStudents(cleanedData);
      toast.success(`Created ${res.count} master profiles!`);

      setIsModalOpen(false);
      setFile(null);
      if (onUploadSuccess) onUploadSuccess();
    } catch (error) {
      toast.error(`Upload failed: ${error.message || 'Unknown network error'}`);
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full space-y-6">


      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer relative">
          <Upload className="w-10 h-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            Upload Student Register
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={'Map Headers: Profile Setup'}>
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex gap-3 text-blue-800 dark:text-blue-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>Please match your file's columns to the required database structure.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
            {PROFILE_FIELDS.map(field => (
              <div key={field.key} className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 w-1/2 flex items-center">
                  {field.label} {!field.optional && <span className="text-red-500 ml-1">*</span>}
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

          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Select Target Columns for Subject Extraction</h4>
            <p className="text-xs text-slate-500 mb-3">The specific text inside these columns will be extracted and saved as personal subjects for each student.</p>
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

          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Data Preview</h4>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    {PROFILE_FIELDS.map(f => (<th key={f.key} className="px-4 py-3">{f.label}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="bg-white border-b dark:bg-slate-900 dark:border-slate-700">
                      {PROFILE_FIELDS.map(field => {
                        const val = mapping[field.key] ? row[mapping[field.key]] : "-";
                        return <td key={field.key} className="px-4 py-2 truncate max-w-[150px]">{val}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

            <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-slate-200 dark:border-slate-800 gap-4">
              <div className="flex flex-col bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg w-full sm:w-auto">
                <span className="text-[10px] uppercase font-bold text-slate-500 mb-1 ml-1 cursor-default">ID Extraction Format</span>
                <select 
                  value={yearFormat} 
                  onChange={(e) => setYearFormat(e.target.value)}
                  className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-200 border-none outline-none focus:ring-0 cursor-pointer"
                >
                  <option value="hyphenBounded">[ID]-[Year]-[Number] (e.g. 1-2025-50)</option>
                  <option value="generic">Generic Auto-Extract (e.g. 2025/112)</option>
                </select>
              </div>

              <Button
                variant="primary"
                onClick={handleConfirmUpload}
                disabled={!isMappingComplete || isUploading}
                className="gap-2 w-full sm:w-auto h-12 px-8"
              >
                {isUploading ? 'Processing...' : 'Confirm Injection'}
                {!isUploading && isMappingComplete && <CheckCircle className="w-4 h-4 ml-1" />}
              </Button>
            </div>
        </div>
      </Modal>
    </div>
  );
};
