
import { Sidebar } from '@/components/Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50 ml-64">
        <div className="container max-w-7xl mx-auto p-4 md:p-6 pb-24">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
