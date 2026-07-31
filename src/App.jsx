import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import CustomersPage from './components/CustomersPage';
import ServicesPage from './components/ServicesPage';
import TemplatesPage from './components/TemplatesPage';
import InvoicesPage from './components/InvoicesPage';
import InvoiceEditor from './components/InvoiceEditor';
import DeliveryNotesPage from './components/DeliveryNotesPage';
import DeliveryNoteEditor from './components/DeliveryNoteEditor';
import CreditNotesPage from './components/CreditNotesPage';
import CreditNoteEditor from './components/CreditNoteEditor';
import RemindersPage from './components/RemindersPage';
import ExpensesPage from './components/ExpensesPage';
import OverviewPage from './components/OverviewPage';

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
        <Route path="/lieferscheine" element={<DeliveryNotesPage />} />
        <Route path="/lieferscheine/:id" element={<DeliveryNoteEditor />} />
        <Route path="/gutschriften" element={<CreditNotesPage />} />
        <Route path="/gutschriften/:id" element={<CreditNoteEditor />} />
        <Route path="/mahnungen" element={<RemindersPage />} />
        <Route path="/vorlagen" element={<TemplatesPage />} />
        <Route path="/kunden" element={<CustomersPage />} />
        <Route path="/leistungen" element={<ServicesPage />} />
        <Route path="/ausgaben" element={<ExpensesPage />} />
        <Route path="/uebersicht" element={<OverviewPage />} />
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
