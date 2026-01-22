import type { ReactNode } from 'react'
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-gray-100 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 mr-64 p-6 max-w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
