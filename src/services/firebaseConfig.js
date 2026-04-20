import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { 
  getFirestore, doc, getDoc, collection, getDocs, 
  writeBatch, arrayUnion, query, where, or, and, setDoc,
  orderBy, limit
} from "firebase/firestore";
import { cleanSubjectName } from "../utils/cleanSubject";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Authentication service
export const mockLogin = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential;
};

// Get user role from Firestore 'users' collection
export const getUserRole = async (uid) => {
  const userDocRef = doc(db, 'users', uid);
  const userDocSnap = await getDoc(userDocRef);
  if (userDocSnap.exists()) {
    return userDocSnap.data();
  }
  return { role: 'student', name: 'Unknown User' }; 
};

// ================= NEW ARCHITECTURE METHODS =================

// 1. Fetch all student profiles and their nested results
export const fetchAllStudents = async () => {
  const studentsRef = collection(db, 'students');
  const snapshot = await getDocs(studentsRef);
  const data = [];
  snapshot.forEach(doc => {
    data.push({ id: doc.id, ...doc.data() });
  });
  return data;
};

// Utility to flatten students -> results for dashboards
export const getFlattenedResults = async () => {
  const students = await fetchAllStudents();
  const flattened = [];
  
  students.forEach(student => {
    if (student.results && Array.isArray(student.results)) {
      student.results.forEach(res => {
        flattened.push({
          studentID: student.id,
          rollNo: student.rollNo,
          studentName: student.name,
          degree: student.degree,
          year: student.year,
          ...res
        });
      });
    }
  });
  return flattened;
};

// Fetch single student by Year and RollNo OR RegistrationID
export const fetchStudentProfile = async (year, searchId) => {
  try {
    const studentsRef = collection(db, 'students');
    // Fetch everybody in the specific cohort to bypass complex OR index requirements
    const q = query(studentsRef, where('year', '==', String(year)));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;

    // Client-side fuzzy check avoiding strict OR index failure
    const targetDoc = snapshot.docs.find(docSnap => {
      const data = docSnap.data();
      return data.rollNo === String(searchId) || data.registrationID === String(searchId);
    });

    if (targetDoc) {
      return { id: targetDoc.id, ...targetDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Fetch Error:", error);
    throw error;
  }
};

// 2. Upload Master Student Spreadsheet (Admin)
// Expects array of { studentID, name, degree, year }
export const uploadMasterStudents = async (studentList) => {
  const batch = writeBatch(db);
  const studentsRef = collection(db, 'students');
  const uniqueCleanSubjects = new Set();
  const uploadID = Date.now().toString();
  
  studentList.forEach(student => {
    const compositeId = `${student.year}_${student.rollNo || student.registrationID}`;
    if(!student.year) return; // Must have valid year

    if (student.registeredSubjects && Array.isArray(student.registeredSubjects)) {
      student.registeredSubjects.forEach(sub => {
        if (sub && String(sub).trim() !== "") {
          uniqueCleanSubjects.add(cleanSubjectName(sub));
        }
      });
    }

    const newDocRef = doc(studentsRef, compositeId);
    batch.set(newDocRef, { 
      ...student, 
      uploadID,
      results: [] // initialize empty results array
    });
  });

  // Init clean subject rules without overwriting custom admin settings
  const configsSnapshot = await getDocs(collection(db, 'subjectConfigs'));
  const existingConfigKeys = new Set(configsSnapshot.docs.map(d => d.id));

  uniqueCleanSubjects.forEach(cleanSub => {
    if (!existingConfigKeys.has(cleanSub)) {
      const configRef = doc(db, 'subjectConfigs', cleanSub);
      batch.set(configRef, { passingMarks: 40 });
    }
  });

  await batch.commit();
  return { success: true, count: studentList.length };
};

// 3. Admin: Fetch Subject Configs (Passing Marks)
export const getSubjectConfigs = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'subjectConfigs'));
    const configs = {};
    snapshot.docs.forEach(doc => {
      configs[doc.id] = doc.data().passingMarks;
    });
    return configs;
  } catch (error) {
    console.error("Error fetching subject configs:", error);
    return {};
  }
};

// 4. Admin: Save or Update Subject Config
export const setSubjectConfig = async (subjectName, passingMarks) => {
  try {
    const docRef = doc(db, 'subjectConfigs', subjectName);
    await setDoc(docRef, { passingMarks: Number(passingMarks) }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("Error saving subject config:", error);
    throw error;
  }
};


// 3. Append single result to specific student via arrayUnion (Admin Manual)
export const appendResultToStudent = async (docId, resultData) => {
  const studentRef = doc(db, 'students', docId);
  await setDoc(studentRef, {
    results: arrayUnion(resultData)
  }, { merge: true });
  return { success: true };
};

export const appendMultipleResultsToStudent = async (docId, resultsArray) => {
  const studentRef = doc(db, 'students', docId);
  await setDoc(studentRef, {
    results: arrayUnion(...resultsArray)
  }, { merge: true });
  return { success: true };
};

export const deleteBatchByDegreeAndYear = async (degree, year) => {
  const studentsRef = collection(db, 'students');
  const q = query(studentsRef, where('degree', '==', String(degree)), where('year', '==', String(year)));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return { success: true, count: 0 };

  const batch = writeBatch(db);
  let count = 0;
  snapshot.docs.forEach((document) => {
    batch.delete(document.ref);
    count++;
  });

  await batch.commit();
  return { success: true, count };
};

export const deleteLastUpload = async () => {
  const studentsRef = collection(db, 'students');
  const qLatest = query(studentsRef, orderBy('uploadID', 'desc'), limit(1));
  const snap = await getDocs(qLatest);
  
  if (snap.empty) return { success: false, message: "No uploads found." };
  
  const latestUploadID = snap.docs[0].data().uploadID;
  if (!latestUploadID) return { success: false, message: "No upload history tracked." };

  const qDelete = query(studentsRef, where('uploadID', '==', latestUploadID));
  const deleteSnap = await getDocs(qDelete);
  
  if (deleteSnap.empty) return { success: false, message: "No records found for the latest upload." };

  const batch = writeBatch(db);
  let count = 0;
  deleteSnap.docs.forEach(doc => {
    batch.delete(doc.ref);
    count++;
  });
  await batch.commit();
  return { success: true, count };
};

