import { lazy, Suspense } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/ui'

const Dashboard = lazy(() => import('./Dashboard'))
const Questions = lazy(() => import('./Questions'))
const TestsAdmin = lazy(() => import('./TestsAdmin'))
const ExamsAdmin = lazy(() => import('./ExamsAdmin'))
const CoursesAdmin = lazy(() => import('./CoursesAdmin'))
const UsersAdmin = lazy(() => import('./UsersAdmin'))
const PaymentsAdmin = lazy(() => import('./PaymentsAdmin'))
const CoachingAdmin = lazy(() => import('./CoachingAdmin'))
const Corrections = lazy(() => import('./Corrections'))
const SettingsAdmin = lazy(() => import('./SettingsAdmin'))

const ADMIN_NAV = [
  { to: '/admin', label: 'Tableau de bord', icon: '📊', end: true },
  { to: '/admin/questions', label: 'Questions', icon: '❓' },
  { to: '/admin/tests', label: 'Tests & quiz', icon: '📝' },
  { to: '/admin/exams', label: 'Examens blancs', icon: '⏱' },
  { to: '/admin/courses', label: 'Formations', icon: '📚' },
  { to: '/admin/users', label: 'Utilisateurs', icon: '👥' },
  { to: '/admin/payments', label: 'Paiements', icon: '💳' },
  { to: '/admin/coaching', label: 'Coaching', icon: '🗓' },
  { to: '/admin/corrections', label: 'Corrections', icon: '✍️' },
  { to: '/admin/settings', label: 'Paramètres', icon: '⚙️' },
]

// le rôle coach n'accède qu'à ses créneaux et sa file de corrections (§6.7)
const COACH_NAV = ADMIN_NAV.filter((n) => ['/admin/coaching', '/admin/corrections'].includes(n.to))

export default function AdminLayout() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const nav = isAdmin ? ADMIN_NAV : COACH_NAV

  return (
    <div className="min-h-dvh bg-paper flex">
      {/* Layout sobre : fond paper, accents green (§6) */}
      <aside className="w-56 flex-none border-r border-line bg-card min-h-dvh px-3 py-5 hidden md:flex flex-col">
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-green text-white flex items-center justify-center font-extrabold text-sm">IJ</div>
          <div>
            <div className="font-extrabold text-[13px] leading-none">IJAMBO</div>
            <div className="text-[10px] text-muted mt-0.5">Back-office</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] no-underline font-medium ${
                  isActive ? 'bg-green-soft text-green font-bold' : 'text-ink hover:bg-paper'
                }`
              }
            >
              <span className="text-[15px]">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2 pt-4 border-t border-line">
          <div className="text-[12px] font-semibold">{profile?.first_name} {profile?.last_name}</div>
          <div className="text-[10.5px] text-muted">{profile?.role}</div>
          <button
            className="text-[11.5px] text-red font-semibold mt-1.5 bg-transparent border-0 cursor-pointer p-0"
            onClick={() => supabase.auth.signOut().then(() => (location.href = '/'))}
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* nav mobile */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-line flex overflow-x-auto z-20">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex-1 min-w-16 text-center py-2 text-[10px] no-underline ${isActive ? 'text-green font-bold' : 'text-muted'}`
            }
          >
            <div className="text-[16px]">{n.icon}</div>
            {n.label.split(' ')[0]}
          </NavLink>
        ))}
      </div>

      <main className="flex-1 px-4 md:px-8 py-6 pb-20 md:pb-6 max-w-6xl">
        <Suspense fallback={<Spinner />}>
          <Routes>
            {isAdmin ? (
              <>
                <Route index element={<Dashboard />} />
                <Route path="questions" element={<Questions />} />
                <Route path="tests" element={<TestsAdmin />} />
                <Route path="exams" element={<ExamsAdmin />} />
                <Route path="courses" element={<CoursesAdmin />} />
                <Route path="users" element={<UsersAdmin />} />
                <Route path="payments" element={<PaymentsAdmin />} />
                <Route path="settings" element={<SettingsAdmin />} />
              </>
            ) : (
              <Route index element={<Navigate to="/admin/coaching" replace />} />
            )}
            <Route path="coaching" element={<CoachingAdmin />} />
            <Route path="corrections" element={<Corrections />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
