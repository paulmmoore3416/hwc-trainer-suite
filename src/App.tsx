import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Spinner, ToastProvider } from './components/ui';
import Login from './pages/Login';
import Accept from './pages/Accept';
import Verify from './pages/Verify';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const StudentForm = lazy(() => import('./pages/StudentForm'));
const StudentDetail = lazy(() => import('./pages/StudentDetail'));
const Classes = lazy(() => import('./pages/Classes'));
const ClassDetail = lazy(() => import('./pages/ClassDetail'));
const Certificates = lazy(() => import('./pages/Certificates'));
const CertificateEditor = lazy(() => import('./pages/CertificateEditor'));
const Incidents = lazy(() => import('./pages/Incidents'));
const IncidentForm = lazy(() => import('./pages/IncidentForm'));
const Reports = lazy(() => import('./pages/Reports'));
const Team = lazy(() => import('./pages/Team'));
const Admin = lazy(() => import('./pages/Admin'));
const Logs = lazy(() => import('./pages/Logs'));
const Profile = lazy(() => import('./pages/Profile'));
const DevPreview = lazy(() => import('./pages/DevPreview'));

function Protected({ children }: { children: ReactNode }) {
  const { session, profile, loading, recovery, signOut } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner label="Loading the suite…" />;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (recovery) return <Navigate to="/set-password" replace />;
  if (!profile) return <Spinner label="Loading your profile…" />;
  if (!profile.active) {
    return (
      <div className="mx-auto mt-24 max-w-md rounded-2xl bg-white p-8 text-center shadow">
        <h1 className="text-lg font-semibold">Account deactivated</h1>
        <p className="mt-2 text-sm text-slate-600">Your instructor account is not active. Contact your facility administrator.</p>
        <button className="mt-5 rounded-lg bg-brand-800 px-4 py-2 text-sm text-white" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

function SuperOnly({ children }: { children: ReactNode }) {
  const { isSuper } = useAuth();
  return isSuper ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/accept" element={<Accept />} />
                <Route path="/set-password" element={<Accept />} />
                <Route path="/verify/:code" element={<Verify />} />
                {import.meta.env.DEV && <Route path="/__dev/certificate" element={<DevPreview />} />}
                <Route
                  element={
                    <Protected>
                      <Layout />
                    </Protected>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="students" element={<Students />} />
                  <Route path="students/new" element={<StudentForm />} />
                  <Route path="students/:id" element={<StudentDetail />} />
                  <Route path="students/:id/edit" element={<StudentForm />} />
                  <Route path="classes" element={<Classes />} />
                  <Route path="classes/:id" element={<ClassDetail />} />
                  <Route path="certificates" element={<Certificates />} />
                  <Route path="certificates/new" element={<CertificateEditor />} />
                  <Route path="certificates/:id" element={<CertificateEditor />} />
                  <Route path="incidents" element={<Incidents />} />
                  <Route path="incidents/new" element={<IncidentForm />} />
                  <Route path="incidents/:id" element={<IncidentForm />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="team" element={<Team />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="admin" element={<SuperOnly><Admin /></SuperOnly>} />
                  <Route path="logs" element={<SuperOnly><Logs /></SuperOnly>} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
