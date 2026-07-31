import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import CustomersPage from './components/CustomersPage';
import ServicesPage from './components/ServicesPage';
import TemplatesPage from './components/TemplatesPage';
import InvoicesPage from './components/InvoicesPage';
import InvoiceEditor from './components/InvoiceEditor';

function AppInhalt() {
  const { session, ladeVorgang } = useAuth();

  if (ladeVorgang) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-tanne-700/60">
        Lade…
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/rechnungen" replace />} />
        <Route path="/rechnungen" element={<InvoicesPage />} />
        <Route path="/rechnungen/:id" element={<InvoiceEditor />} />
        <Route path="/vorlagen" element={<TemplatesPage />} />
        <Route path="/kunden" element={<CustomersPage />} />
        <Route path="/leistungen" element={<ServicesPage />} />
        <Route path="*" element={<Navigate to="/rechnungen" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppInhalt />
      </AuthProvider>
    </HashRouter>
  );
}
