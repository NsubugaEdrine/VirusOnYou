import { Outlet } from 'react-router-dom'
import TopAppBar from './TopAppBar'
import NavigationDrawer from './NavigationDrawer'
import BottomNavBar from './BottomNavBar'

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-container-lowest">
      <TopAppBar />
      <NavigationDrawer />

      <main className="md:ml-[240px] pt-16 pb-24 md:pb-8 px-6 lg:px-margin flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1440px] mx-auto py-8">
          <Outlet />
        </div>
      </main>

      <BottomNavBar />
    </div>
  )
}
