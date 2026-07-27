import { Outlet } from 'react-router-dom'
import TopAppBar from './TopAppBar'
import NavigationDrawer from './NavigationDrawer'
import BottomNavBar from './BottomNavBar'

export default function Layout() {
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-surface-container-lowest">
      <TopAppBar />
      <NavigationDrawer />

      <main className="w-full md:ml-[240px] pt-16 pb-24 md:pb-8 px-4 sm:px-6 lg:px-margin flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="w-full max-w-[1440px] mx-auto py-6 sm:py-8">
          <Outlet />
        </div>
      </main>

      <BottomNavBar />
    </div>
  )
}
