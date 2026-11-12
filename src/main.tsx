import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import { EmptyState, Layout } from './components/Layout';
import { BrowsePage } from './pages/BrowsePage';
import { SavedPage } from './pages/SavedPage';
import { ListingPage } from './pages/ListingPage';
import { ListingFormPage } from './pages/ListingFormPage';
import { MyListingsPage } from './pages/MyListingsPage';
import './styles.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><AppProvider><ScrollToTop /><Routes><Route element={<Layout />}><Route index element={<BrowsePage />} /><Route path="saved" element={<SavedPage />} /><Route path="my-listings" element={<MyListingsPage />} /><Route path="listings/new" element={<ListingFormPage />} /><Route path="listings/:id" element={<ListingPage />} /><Route path="listings/:id/edit" element={<ListingFormPage />} /><Route path="*" element={<div className="page-width interior-page"><EmptyState title="Looks like a wrong turn." description="Let’s get you back to finding your next place." action="Back to places" /></div>} /></Route></Routes></AppProvider></BrowserRouter></StrictMode>);
