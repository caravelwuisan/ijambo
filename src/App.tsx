import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Spinner } from './components/ui'

const Home = lazy(() => import('./pages/Home'))
const Register = lazy(() => import('./pages/Register'))
const Login = lazy(() => import('./pages/Login'))
const Diagnostic = lazy(() => import('./pages/Diagnostic'))
const Results = lazy(() => import('./pages/Results'))
const Pricing = lazy(() => import('./pages/Pricing'))
const Payment = lazy(() => import('./pages/Payment'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ModulePage = lazy(() => import('./pages/Module'))
const LessonPage = lazy(() => import('./pages/Lesson'))
const Exams = lazy(() => import('./pages/Exams'))
const ExamRunner = lazy(() => import('./pages/ExamRunner'))
const Coaching = lazy(() => import('./pages/Coaching'))
const AdminLayout = lazy(() => import('./admin/AdminLayout'))

function Protected({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />

        <Route path="/diagnostic" element={<Protected><Diagnostic /></Protected>} />
        <Route path="/results" element={<Protected><Results /></Protected>} />
        <Route path="/pay/:planId" element={<Protected><Payment /></Protected>} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/module/:moduleId" element={<Protected><ModulePage /></Protected>} />
        <Route path="/lesson/:lessonId" element={<Protected><LessonPage /></Protected>} />
        <Route path="/exams" element={<Protected><Exams /></Protected>} />
        <Route path="/exam/:examId" element={<Protected><ExamRunner /></Protected>} />
        <Route path="/coaching" element={<Protected><Coaching /></Protected>} />

        <Route
          path="/admin/*"
          element={
            <Protected roles={['admin', 'coach']}>
              <AdminLayout />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
